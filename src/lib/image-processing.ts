export const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024;
export const MAX_IMAGE_PIXELS = 40_000_000;

const imageTypes = {
  jpeg: { mimeType: "image/jpeg", extensions: [".jpg", ".jpeg"] },
  png: { mimeType: "image/png", extensions: [".png"] },
  webp: { mimeType: "image/webp", extensions: [".webp"] },
} as const;

export type SupportedImageFormat = keyof typeof imageTypes;

export type ImageDimensions = {
  width: number;
  height: number;
};

export type ValidatedImage = {
  file: File;
  format: SupportedImageFormat;
  width: number;
  height: number;
};

export type ImageProcessingErrorCode =
  | "empty-file"
  | "file-too-large"
  | "unsupported-type"
  | "corrupted-image"
  | "dimensions-too-large"
  | "decoder-unavailable"
  | "inspection-failed";

const errorMessages: Record<ImageProcessingErrorCode, string> = {
  "empty-file": "This image file is empty. Choose another image.",
  "file-too-large": "This image is larger than 10 MB. Choose a smaller file.",
  "unsupported-type": "Choose a JPG, JPEG, PNG, or WebP image.",
  "corrupted-image":
    "This image could not be read. It may be damaged or unsupported by this browser.",
  "dimensions-too-large":
    "This image has too many pixels to preview safely. Choose a smaller image.",
  "decoder-unavailable":
    "Image checking is not supported in this browser. Try a current browser.",
  "inspection-failed":
    "Image checking took too long or failed. Try another image.",
};

export class ImageProcessingError extends Error {
  constructor(readonly code: ImageProcessingErrorCode) {
    super(errorMessages[code]);
    this.name = "ImageProcessingError";
  }
}

type ImageWorkerResponse =
  | { type: "dimensions"; width: number; height: number }
  | { type: "error" };

export type ImageWorkerLike = {
  onmessage: ((event: MessageEvent<ImageWorkerResponse>) => void) | null;
  onerror: ((event: ErrorEvent) => void) | null;
  postMessage: (message: File) => void;
  terminate: () => void;
};

export type ImageWorkerFactory = () => ImageWorkerLike;

function createImageWorker(): ImageWorkerLike {
  return new Worker(
    new URL("../workers/image.worker.ts", import.meta.url),
    { type: "module" },
  ) as ImageWorkerLike;
}

function abortError(): DOMException {
  return new DOMException("Image inspection was cancelled.", "AbortError");
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw abortError();
}

export function inspectImageDimensions(
  file: File,
  signal?: AbortSignal,
  createWorker: ImageWorkerFactory = createImageWorker,
): Promise<ImageDimensions> {
  throwIfAborted(signal);
  if (createWorker === createImageWorker && typeof Worker === "undefined") {
    return Promise.reject(
      new ImageProcessingError("decoder-unavailable"),
    );
  }

  return new Promise((resolve, reject) => {
    let worker: ImageWorkerLike;
    try {
      worker = createWorker();
    } catch {
      reject(new ImageProcessingError("decoder-unavailable"));
      return;
    }

    let settled = false;
    const timeout = globalThis.setTimeout(() => {
      finish(() => reject(new ImageProcessingError("inspection-failed")));
    }, 20_000);

    function finish(callback: () => void) {
      if (settled) return;
      settled = true;
      globalThis.clearTimeout(timeout);
      signal?.removeEventListener("abort", handleAbort);
      worker.terminate();
      callback();
    }

    function handleAbort() {
      finish(() => reject(abortError()));
    }

    worker.onmessage = ({ data }) => {
      if (data.type === "dimensions") {
        finish(() => resolve({ width: data.width, height: data.height }));
      } else {
        finish(() => reject(new ImageProcessingError("corrupted-image")));
      }
    };
    worker.onerror = () => {
      finish(() => reject(new ImageProcessingError("corrupted-image")));
    };

    signal?.addEventListener("abort", handleAbort, { once: true });
    try {
      worker.postMessage(file);
    } catch {
      finish(() => reject(new ImageProcessingError("inspection-failed")));
    }
  });
}

function identifyFormat(file: File): SupportedImageFormat {
  const fileName = file.name.toLowerCase();
  const format = (Object.keys(imageTypes) as SupportedImageFormat[]).find(
    (candidate) => {
      const { mimeType, extensions } = imageTypes[candidate];
      return (
        extensions.some((extension) => fileName.endsWith(extension)) &&
        (!file.type || file.type.toLowerCase() === mimeType)
      );
    },
  );

  if (!format) throw new ImageProcessingError("unsupported-type");
  return format;
}

function hasExpectedSignature(
  format: SupportedImageFormat,
  bytes: Uint8Array,
): boolean {
  if (format === "jpeg") {
    return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }

  if (format === "png") {
    return (
      bytes.length >= 8 &&
      bytes[0] === 0x89 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x4e &&
      bytes[3] === 0x47 &&
      bytes[4] === 0x0d &&
      bytes[5] === 0x0a &&
      bytes[6] === 0x1a &&
      bytes[7] === 0x0a
    );
  }

  return (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  );
}

export async function validateImageFile(
  file: File,
  inspectDimensions: (
    file: File,
    signal?: AbortSignal,
  ) => Promise<ImageDimensions> = (image, signal) =>
    inspectImageDimensions(image, signal),
  signal?: AbortSignal,
): Promise<ValidatedImage> {
  throwIfAborted(signal);
  if (file.size === 0) throw new ImageProcessingError("empty-file");
  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    throw new ImageProcessingError("file-too-large");
  }

  const format = identifyFormat(file);
  const signature = new Uint8Array(
    await file.slice(0, 12).arrayBuffer(),
  );
  throwIfAborted(signal);
  if (!hasExpectedSignature(format, signature)) {
    throw new ImageProcessingError("corrupted-image");
  }

  let dimensions: ImageDimensions;
  try {
    dimensions = await inspectDimensions(file, signal);
  } catch (error) {
    if (signal?.aborted || (error instanceof DOMException && error.name === "AbortError")) {
      throw error;
    }
    if (error instanceof ImageProcessingError) throw error;
    throw new ImageProcessingError("corrupted-image");
  }

  throwIfAborted(signal);
  if (
    !Number.isSafeInteger(dimensions.width) ||
    !Number.isSafeInteger(dimensions.height) ||
    dimensions.width < 1 ||
    dimensions.height < 1
  ) {
    throw new ImageProcessingError("corrupted-image");
  }
  if (dimensions.width * dimensions.height > MAX_IMAGE_PIXELS) {
    throw new ImageProcessingError("dimensions-too-large");
  }

  return { file, format, ...dimensions };
}

export function createImagePreviewUrl(file: File): string {
  return URL.createObjectURL(file);
}

export function revokeImagePreviewUrl(url: string): void {
  URL.revokeObjectURL(url);
}
