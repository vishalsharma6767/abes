import { describe, expect, it } from "vitest";
import {
  decodeImage,
  encodeImage,
  MAX_IMAGE_MESSAGE_LENGTH,
  PNG_MESSAGE_CHUNK_TYPE,
  serializePayload,
  validatePayload,
  deserializePayload,
  type EncodedPayload,
  type PayloadInput,
} from "./image-message-engine";
import { MAX_IMAGE_SIZE_BYTES } from "./image-processing";

const pngFixture = Uint8Array.of(
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
  0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
  0x08, 0x04, 0x00, 0x00, 0x00, 0xb5, 0x1c, 0x0c,
  0x02, 0x00, 0x00, 0x00, 0x0b, 0x49, 0x44, 0x41,
  0x54, 0x78, 0xda, 0x63, 0xfc, 0xff, 0x1f, 0x00,
  0x03, 0x03, 0x02, 0x00, 0xef, 0xa2, 0xa7, 0x5b,
  0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44,
  0xae, 0x42, 0x60, 0x82,
);
const testPassphrase = "a sample passphrase for tests";

function createPngBlob(bytes: Uint8Array = pngFixture): Blob {
  const buffer = new ArrayBuffer(bytes.length);
  new Uint8Array(buffer).set(bytes);
  return new Blob([buffer], { type: "image/png" });
}

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  const table = new Uint32Array(256);
  for (let index = 0; index < table.length; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      value = (value >>> 1) ^ (value & 1 ? 0xedb88320 : 0);
    }
    table[index] = value >>> 0;
  }
  for (const byte of bytes) {
    crc = table[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function createPngWithChunk(typeName: string, data: Uint8Array): Blob {
  const type = new TextEncoder().encode(typeName);
  const chunkBody = new Uint8Array(type.length + data.length);
  chunkBody.set(type);
  chunkBody.set(data, type.length);

  const chunk = new Uint8Array(12 + data.length);
  const view = new DataView(chunk.buffer);
  view.setUint32(0, data.length);
  chunk.set(type, 4);
  chunk.set(data, 8);
  view.setUint32(8 + data.length, crc32(chunkBody));

  const bytes = new Uint8Array(pngFixture.length + chunk.length);
  bytes.set(pngFixture.slice(0, 56));
  bytes.set(chunk, 56);
  bytes.set(pngFixture.slice(56), 56 + chunk.length);
  return createPngBlob(bytes);
}

function createPngWithPayload(serialized: string): Blob {
  return createPngWithChunk(
    PNG_MESSAGE_CHUNK_TYPE,
    new TextEncoder().encode(serialized),
  );
}

function inputPayload(overrides: Partial<PayloadInput> = {}): PayloadInput {
  return {
    version: 1,
    messageType: "text",
    message: "Please call me when you can.",
    ...overrides,
  };
}

function asEncodedPayload(input: PayloadInput): EncodedPayload {
  const compact = JSON.parse(serializePayload(input)) as {
    v: 1;
    t: "text" | "preset";
    x: string;
    l?: string;
    i: string;
  };
  return {
    version: compact.v,
    messageType: compact.t,
    message: compact.x,
    ...(compact.l === undefined ? {} : { location: compact.l }),
    integrity: compact.i,
  };
}

describe("payload format", () => {
  it("serializes and validates a text payload with optional location", () => {
    const serialized = serializePayload(
      inputPayload({ location: "Riverside library" }),
    );
    const result = deserializePayload(serialized);

    expect(result).toEqual({
      valid: true,
      payload: {
        ...inputPayload({ location: "Riverside library" }),
        integrity: expect.stringMatching(/^[0-9a-f]{8}$/),
      },
    });
  });

  it("serializes and validates preset identifiers", () => {
    const payload = asEncodedPayload(
      inputPayload({ messageType: "preset", message: "need-support" }),
    );
    expect(validatePayload(payload)).toEqual({ valid: true, payload });
  });

  it("rejects malformed, unsupported, or oversized payloads", () => {
    expect(validatePayload(null).valid).toBe(false);
    expect(
      validatePayload({
        ...asEncodedPayload(inputPayload()),
        extra: "unexpected",
      }),
    ).toMatchObject({ valid: false });
    expect(
      validatePayload({
        version: 1,
        messageType: "text",
        message: "m".repeat(MAX_IMAGE_MESSAGE_LENGTH + 1),
        integrity: "00000000",
      }),
    ).toMatchObject({ valid: false, error: { code: "invalid-payload" } });
    expect(
      validatePayload({
        ...asEncodedPayload(inputPayload()),
        integrity: "00000000",
      }),
    ).toMatchObject({ valid: false, error: { code: "invalid-payload" } });
    expect(deserializePayload("{not json")).toMatchObject({
      valid: false,
      error: { code: "invalid-payload" },
    });
    expect(deserializePayload("x".repeat(1025))).toMatchObject({
      valid: false,
      error: { code: "payload-too-large" },
    });
  });
});

describe("PNG image message experiment", () => {
  it("encodes and decodes a text payload without changing the PNG pixels", async () => {
    const payload = inputPayload({ location: "North entrance" });
    const encoded = await encodeImage(createPngBlob(), payload, testPassphrase);

    expect(encoded.ok).toBe(true);
    if (!encoded.ok) return;

    expect(encoded.format).toBe("png");
    expect(encoded.image.type).toBe("image/png");
    expect(encoded.image.size).toBeGreaterThan(pngFixture.length);
    const decoded = await decodeImage(encoded.image, testPassphrase);
    expect(decoded).toEqual({
      ok: true,
      format: "png",
      payload: encoded.payload,
    });

    const encodedBytes = new Uint8Array(await encoded.image.arrayBuffer());
    expect(encodedBytes.slice(0, 56)).toEqual(pngFixture.slice(0, 56));
    expect(new TextDecoder().decode(encodedBytes)).toContain(PNG_MESSAGE_CHUNK_TYPE);
    expect(new TextDecoder().decode(encodedBytes)).not.toContain(payload.message);
  });

  it("replaces an existing experiment chunk rather than duplicating it", async () => {
    const first = await encodeImage(
      createPngBlob(),
      inputPayload(),
      testPassphrase,
    );
    expect(first.ok).toBe(true);
    if (!first.ok) return;

    const second = await encodeImage(
      first.image,
      inputPayload({ message: "A new sample message." }),
      testPassphrase,
    );
    expect(second.ok).toBe(true);
    if (!second.ok) return;

    expect(await decodeImage(second.image, testPassphrase)).toMatchObject({
      ok: true,
      payload: { message: "A new sample message." },
    });
  });

  it("fails closed when the passphrase is wrong", async () => {
    const encoded = await encodeImage(
      createPngBlob(),
      inputPayload(),
      testPassphrase,
    );
    expect(encoded.ok).toBe(true);
    if (!encoded.ok) return;

    await expect(
      decodeImage(encoded.image, "a different passphrase for recovery"),
    ).resolves.toMatchObject({
      ok: false,
      error: {
        code: "recovery-failed",
        message:
          "Unable to recover the message. Check the passphrase and image, then try again.",
      },
    });
  });

  it("returns a payload-not-found result for a PNG without a message chunk", async () => {
    await expect(decodeImage(createPngBlob(), testPassphrase)).resolves.toMatchObject({
      ok: false,
      error: { code: "payload-not-found" },
    });
  });

  it("rejects malformed or checksum-mismatched embedded payloads", async () => {
    await expect(
      decodeImage(createPngWithPayload("{bad json"), testPassphrase),
    ).resolves.toMatchObject({
      ok: false,
      error: { code: "invalid-payload", message: expect.stringContaining("Unable to recover") },
    });

    const serialized = serializePayload(inputPayload()).replace(
      "Please call me",
      "Please leave me",
    );
    await expect(
      decodeImage(createPngWithPayload(serialized), testPassphrase),
    ).resolves.toMatchObject({
      ok: false,
      error: { code: "invalid-payload" },
    });
  });

  it("rejects unsupported image formats without throwing", async () => {
    const jpeg = new Blob([Uint8Array.of(0xff, 0xd8, 0xff)], {
      type: "image/jpeg",
    });
    await expect(encodeImage(jpeg, inputPayload(), testPassphrase)).resolves.toMatchObject({
      ok: false,
      error: { code: "unsupported-image" },
    });
    await expect(decodeImage(jpeg, testPassphrase)).resolves.toMatchObject({
      ok: false,
      error: { code: "unsupported-image" },
    });
  });

  it("returns a malformed-image error when PNG data is corrupted", async () => {
    const corrupted = pngFixture.slice();
    corrupted[20] ^= 0xff;

    await expect(decodeImage(createPngBlob(corrupted), testPassphrase)).resolves.toMatchObject({
      ok: false,
      error: { code: "corrupted-image" },
    });
  });

  it("rejects images over the existing 10 MB limit", async () => {
    const oversized = new Blob([new Uint8Array(MAX_IMAGE_SIZE_BYTES + 1)], {
      type: "image/png",
    });
    await expect(encodeImage(oversized, inputPayload(), testPassphrase)).resolves.toMatchObject({
      ok: false,
      error: { code: "image-too-large" },
    });
    await expect(decodeImage(oversized, testPassphrase)).resolves.toMatchObject({
      ok: false,
      error: { code: "image-too-large" },
    });
  });

  it("rejects output that would exceed the 10 MB image limit", async () => {
    const dataLength = MAX_IMAGE_SIZE_BYTES - pngFixture.length - 12;
    const oversizedOutputInput = createPngWithChunk(
      "npAD",
      new Uint8Array(dataLength),
    );
    expect(oversizedOutputInput.size).toBe(MAX_IMAGE_SIZE_BYTES);

    await expect(
      encodeImage(oversizedOutputInput, inputPayload(), testPassphrase),
    ).resolves.toMatchObject({
      ok: false,
      error: { code: "image-too-large" },
    });
  });
});
