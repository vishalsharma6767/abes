import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createImagePreviewUrl,
  ImageProcessingError,
  inspectImageDimensions,
  MAX_IMAGE_PIXELS,
  MAX_IMAGE_SIZE_BYTES,
  revokeImagePreviewUrl,
  validateImageFile,
  type ImageWorkerLike,
} from "./image-processing";

const dimensions = async () => ({ width: 800, height: 600 });

function createFile(
  name: string,
  type: string,
  bytes: number[],
): File {
  return new File([Uint8Array.from(bytes)], name, { type });
}

const fixtures = [
  {
    name: "photo.jpg",
    type: "image/jpeg",
    bytes: [0xff, 0xd8, 0xff, 0x00],
    format: "jpeg",
  },
  {
    name: "photo.jpeg",
    type: "image/jpeg",
    bytes: [0xff, 0xd8, 0xff, 0x00],
    format: "jpeg",
  },
  {
    name: "photo.png",
    type: "image/png",
    bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
    format: "png",
  },
  {
    name: "photo.webp",
    type: "image/webp",
    bytes: [
      0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00,
      0x57, 0x45, 0x42, 0x50,
    ],
    format: "webp",
  },
] as const;

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("validateImageFile", () => {
  it.each(fixtures)("accepts $name with detected dimensions", async (fixture) => {
    const file = createFile(fixture.name, fixture.type, [...fixture.bytes]);
    const inspect = vi.fn(dimensions);

    await expect(validateImageFile(file, inspect)).resolves.toMatchObject({
      file,
      format: fixture.format,
      width: 800,
      height: 600,
    });
    expect(inspect).toHaveBeenCalledWith(file, undefined);
  });

  it("accepts a supported extension when the browser omits the MIME type", async () => {
    const file = createFile("photo.jpg", "", [0xff, 0xd8, 0xff]);
    await expect(validateImageFile(file, dimensions)).resolves.toMatchObject({
      format: "jpeg",
    });
  });

  it("rejects unsupported types before inspecting their contents", async () => {
    const inspect = vi.fn(dimensions);
    const file = createFile("notes.txt", "text/plain", [1, 2, 3]);

    await expect(validateImageFile(file, inspect)).rejects.toMatchObject({
      code: "unsupported-type",
    });
    expect(inspect).not.toHaveBeenCalled();
  });

  it("rejects MIME type and extension mismatches", async () => {
    const file = createFile("photo.png", "image/jpeg", [0x89, 0x50, 0x4e, 0x47]);

    await expect(validateImageFile(file, dimensions)).rejects.toMatchObject({
      code: "unsupported-type",
    });
  });

  it("rejects empty files", async () => {
    const file = new File([], "empty.png", { type: "image/png" });

    await expect(validateImageFile(file, dimensions)).rejects.toMatchObject({
      code: "empty-file",
    });
  });

  it("rejects corrupted signatures and images the browser cannot decode", async () => {
    const invalidSignature = createFile("broken.jpg", "image/jpeg", [1, 2, 3]);
    await expect(
      validateImageFile(invalidSignature, dimensions),
    ).rejects.toMatchObject({ code: "corrupted-image" });

    const undecodable = createFile("broken.png", "image/png", [
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ]);
    await expect(
      validateImageFile(undecodable, async () => {
        throw new Error("decoder failure");
      }),
    ).rejects.toMatchObject({ code: "corrupted-image" });
  });

  it("rejects files larger than the configured maximum before reading them", async () => {
    const file = new File(
      [new Uint8Array(MAX_IMAGE_SIZE_BYTES + 1)],
      "large.png",
      { type: "image/png" },
    );
    const inspect = vi.fn(dimensions);
    const sliceSpy = vi.spyOn(file, "slice");

    await expect(validateImageFile(file, inspect)).rejects.toMatchObject({
      code: "file-too-large",
    });
    expect(inspect).not.toHaveBeenCalled();
    expect(sliceSpy).not.toHaveBeenCalled();
  });

  it("rejects images with excessive dimensions", async () => {
    const file = createFile("large.png", "image/png", [...fixtures[2].bytes]);
    const width = Math.ceil(Math.sqrt(MAX_IMAGE_PIXELS + 1));

    await expect(
      validateImageFile(file, async () => ({ width, height: width })),
    ).rejects.toMatchObject({ code: "dimensions-too-large" });
  });
});

describe("image resource cleanup", () => {
  it("revokes temporary preview object URLs", () => {
    const file = createFile("photo.jpg", "image/jpeg", [0xff, 0xd8, 0xff]);
    const createUrl = vi
      .spyOn(URL, "createObjectURL")
      .mockReturnValue("blob:seekhelp-preview");
    const revokeUrl = vi.spyOn(URL, "revokeObjectURL");

    const previewUrl = createImagePreviewUrl(file);
    revokeImagePreviewUrl(previewUrl);

    expect(createUrl).toHaveBeenCalledWith(file);
    expect(revokeUrl).toHaveBeenCalledWith("blob:seekhelp-preview");
  });

  it("terminates the worker after successful dimension inspection", async () => {
    const worker: ImageWorkerLike = {
      onmessage: null,
      onerror: null,
      postMessage: () => {
        queueMicrotask(() =>
          worker.onmessage?.({
            data: { type: "dimensions", width: 16, height: 9 },
          } as MessageEvent),
        );
      },
      terminate: vi.fn(),
    };
    const file = createFile("photo.jpg", "image/jpeg", [0xff, 0xd8, 0xff]);

    await expect(
      inspectImageDimensions(file, undefined, () => worker),
    ).resolves.toEqual({ width: 16, height: 9 });
    expect(worker.terminate).toHaveBeenCalledOnce();
  });

  it("terminates the worker when inspection is cancelled", async () => {
    const worker: ImageWorkerLike = {
      onmessage: null,
      onerror: null,
      postMessage: () => undefined,
      terminate: vi.fn(),
    };
    const controller = new AbortController();
    const file = createFile("photo.jpg", "image/jpeg", [0xff, 0xd8, 0xff]);
    const pending = inspectImageDimensions(
      file,
      controller.signal,
      () => worker,
    );
    controller.abort();

    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
    expect(worker.terminate).toHaveBeenCalledOnce();
  });
});

it("exposes actionable validation errors", async () => {
  const file = new File([], "empty.png", { type: "image/png" });

  try {
    await validateImageFile(file, dimensions);
  } catch (error) {
    expect(error).toBeInstanceOf(ImageProcessingError);
    expect((error as ImageProcessingError).message).toContain("empty");
  }
});
