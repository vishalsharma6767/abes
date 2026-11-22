import { MAX_IMAGE_SIZE_BYTES } from "./image-processing";
import {
  decryptPayload,
  encryptPayload,
  type PayloadEncryptionErrorCode,
} from "./payload-encryption";

export const IMAGE_MESSAGE_VERSION = 1 as const;
export const MAX_IMAGE_MESSAGE_LENGTH = 160;
export const MAX_PRESET_ID_LENGTH = 64;
export const MAX_LOCATION_LENGTH = 120;
export const MAX_SERIALIZED_PAYLOAD_BYTES = 1024;
export const PNG_MESSAGE_CHUNK_TYPE = "seHp";

export type PayloadMessageType = "text" | "preset";

export type PayloadInput = {
  version: typeof IMAGE_MESSAGE_VERSION;
  messageType: PayloadMessageType;
  message: string;
  location?: string;
};

export type EncodedPayload = PayloadInput & {
  integrity: string;
};

export type ImageMessageErrorCode =
  | "unsupported-image"
  | "image-too-large"
  | "corrupted-image"
  | "payload-not-found"
  | "invalid-payload"
  | "payload-too-large"
  | PayloadEncryptionErrorCode;

export type ImageMessageError = {
  code: ImageMessageErrorCode;
  message: string;
};

export type PayloadValidationResult =
  | { valid: true; payload: EncodedPayload }
  | { valid: false; error: ImageMessageError };

export type EncodingResult =
  | {
      ok: true;
      image: Blob;
      payload: EncodedPayload;
      format: "png";
    }
  | { ok: false; error: ImageMessageError };

export type DecodingResult =
  | { ok: true; payload: EncodedPayload; format: "png" }
  | { ok: false; error: ImageMessageError };

export type EncodingProgress = {
  stage: "preparing" | "checking" | "encrypting" | "writing" | "complete";
  percent: number;
};

export type EncodeImageOptions = {
  onProgress?: (progress: EncodingProgress) => void;
};

type PngChunk = {
  type: string;
  data: Uint8Array;
};

const pngSignature = Uint8Array.of(
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
);
const encoder = new TextEncoder();
const decoder = new TextDecoder("utf-8", { fatal: true });
const crcTable = new Uint32Array(256);
for (let index = 0; index < crcTable.length; index += 1) {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) {
    value = (value >>> 1) ^ (value & 1 ? 0xedb88320 : 0);
  }
  crcTable[index] = value >>> 0;
}

function failure(
  code: ImageMessageErrorCode,
  message: string,
): ImageMessageError {
  return { code, message };
}

function isImageMessageErrorCode(value: string): value is ImageMessageErrorCode {
  switch (value) {
    case "unsupported-image":
    case "image-too-large":
    case "corrupted-image":
    case "payload-not-found":
    case "invalid-payload":
    case "payload-too-large":
    case "invalid-passphrase":
    case "crypto-unavailable":
    case "recovery-failed":
      return true;
    default:
      return false;
  }
}

function validateImageSize(image: Blob): ImageMessageError | null {
  if (image.size > MAX_IMAGE_SIZE_BYTES) {
    return failure(
      "image-too-large",
      "This PNG is larger than 10 MB. Choose a smaller image.",
    );
  }
  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function uint32Bytes(value: number): Uint8Array {
  const bytes = new Uint8Array(4);
  new DataView(bytes.buffer).setUint32(0, value);
  return bytes;
}

function readUint32(bytes: Uint8Array, offset: number): number {
  return new DataView(bytes.buffer, bytes.byteOffset + offset, 4).getUint32(0);
}

function joinBytes(...parts: Uint8Array[]): Uint8Array {
  const totalLength = parts.reduce((total, part) => total + part.length, 0);
  const joined = new Uint8Array(totalLength);
  let offset = 0;
  for (const part of parts) {
    joined.set(part, offset);
    offset += part.length;
  }
  return joined;
}

function corePayloadBytes(payload: PayloadInput): Uint8Array {
  const core: Record<string, unknown> = {
    v: payload.version,
    t: payload.messageType,
    x: payload.message,
  };
  if (payload.location !== undefined) core.l = payload.location;
  return encoder.encode(JSON.stringify(core));
}

function checksumFor(payload: PayloadInput): string {
  return crc32(corePayloadBytes(payload)).toString(16).padStart(8, "0");
}

function payloadInputFromUnknown(
  value: Record<string, unknown>,
): PayloadInput | null {
  const allowedKeys = new Set([
    "version",
    "messageType",
    "message",
    "location",
    "integrity",
  ]);
  if (Object.keys(value).some((key) => !allowedKeys.has(key))) return null;
  if (
    value.version !== IMAGE_MESSAGE_VERSION ||
    (value.messageType !== "text" && value.messageType !== "preset") ||
    typeof value.message !== "string"
  ) {
    return null;
  }
  if (value.location !== undefined && typeof value.location !== "string") {
    return null;
  }

  return {
    version: IMAGE_MESSAGE_VERSION,
    messageType: value.messageType,
    message: value.message,
    ...(value.location === undefined ? {} : { location: value.location }),
  };
}

function validateInput(input: PayloadInput): ImageMessageError | null {
  const messageLimit =
    input.messageType === "text"
      ? MAX_IMAGE_MESSAGE_LENGTH
      : MAX_PRESET_ID_LENGTH;

  if (
    input.version !== IMAGE_MESSAGE_VERSION ||
    (input.messageType !== "text" && input.messageType !== "preset") ||
    typeof input.message !== "string" ||
    input.message.trim().length === 0 ||
    input.message.length > messageLimit
  ) {
    return failure(
      "invalid-payload",
      "The message payload is empty, too long, or has an unsupported version or type.",
    );
  }
  if (
    input.location !== undefined &&
    (typeof input.location !== "string" ||
      input.location.trim().length === 0 ||
      input.location.length > MAX_LOCATION_LENGTH)
  ) {
    return failure(
      "invalid-payload",
      "The optional location must contain 1 to 120 characters.",
    );
  }
  return null;
}

export function validatePayload(value: unknown): PayloadValidationResult {
  if (!isRecord(value)) {
    return {
      valid: false,
      error: failure("invalid-payload", "The payload must be a JSON object."),
    };
  }

  const payloadInput = payloadInputFromUnknown(value);
  if (!payloadInput || typeof value.integrity !== "string") {
    return {
      valid: false,
      error: failure(
        "invalid-payload",
        "The payload fields or integrity value are missing or unsupported.",
      ),
    };
  }

  const inputError = validateInput(payloadInput);
  if (inputError) return { valid: false, error: inputError };

  if (
    !/^[0-9a-f]{8}$/.test(value.integrity) ||
    value.integrity !== checksumFor(payloadInput)
  ) {
    return {
      valid: false,
      error: failure(
        "invalid-payload",
        "The payload integrity check failed. Its contents may be incomplete or changed.",
      ),
    };
  }

  return {
    valid: true,
    payload: { ...payloadInput, integrity: value.integrity },
  };
}

export function serializePayload(input: PayloadInput): string {
  const inputError = validateInput(input);
  if (inputError) throw new TypeError(inputError.message);

  const payload: EncodedPayload = {
    ...input,
    integrity: checksumFor(input),
  };
  const serialized = JSON.stringify({
    v: payload.version,
    t: payload.messageType,
    x: payload.message,
    ...(payload.location === undefined ? {} : { l: payload.location }),
    i: payload.integrity,
  });
  if (encoder.encode(serialized).length > MAX_SERIALIZED_PAYLOAD_BYTES) {
    throw new RangeError("The serialized message payload is too large.");
  }
  return serialized;
}

export function deserializePayload(serialized: string): PayloadValidationResult {
  if (
    typeof serialized !== "string" ||
    encoder.encode(serialized).length > MAX_SERIALIZED_PAYLOAD_BYTES
  ) {
    return {
      valid: false,
      error: failure("payload-too-large", "The embedded payload is too large."),
    };
  }

  try {
    const compactValue: unknown = JSON.parse(serialized);
    if (!isRecord(compactValue)) {
      return {
        valid: false,
        error: failure("invalid-payload", "The payload must be a JSON object."),
      };
    }

    const allowedKeys = new Set(["v", "t", "x", "l", "i"]);
    if (Object.keys(compactValue).some((key) => !allowedKeys.has(key))) {
      return {
        valid: false,
        error: failure("invalid-payload", "The payload has unsupported fields."),
      };
    }

    return validatePayload({
      version: compactValue.v,
      messageType: compactValue.t,
      message: compactValue.x,
      ...(compactValue.l === undefined ? {} : { location: compactValue.l }),
      integrity: compactValue.i,
    });
  } catch {
    return {
      valid: false,
      error: failure(
        "invalid-payload",
        "The embedded payload is not valid UTF-8 JSON.",
      ),
    };
  }
}

function parsePng(bytes: Uint8Array): PngChunk[] {
  if (bytes.length < pngSignature.length) {
    throw failure("unsupported-image", "Choose a PNG image for this experiment.");
  }
  for (let index = 0; index < pngSignature.length; index += 1) {
    if (bytes[index] !== pngSignature[index]) {
      throw failure(
        "unsupported-image",
        "This experiment supports PNG images only. JPG and WebP are not supported.",
      );
    }
  }

  const chunks: PngChunk[] = [];
  let offset = pngSignature.length;
  let sawHeader = false;
  let sawImageData = false;
  let sawEnd = false;

  while (offset < bytes.length) {
    if (bytes.length - offset < 12) {
      throw failure("corrupted-image", "The PNG image is incomplete.");
    }
    const length = readUint32(bytes, offset);
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;
    const chunkEnd = dataEnd + 4;
    if (dataEnd < dataStart || chunkEnd > bytes.length) {
      throw failure("corrupted-image", "The PNG image contains an invalid chunk.");
    }

    const typeBytes = bytes.subarray(offset + 4, offset + 8);
    const type = String.fromCharCode(...typeBytes);
    if (!/^[A-Za-z]{4}$/.test(type)) {
      throw failure("corrupted-image", "The PNG image contains an invalid chunk.");
    }
    const chunkData = bytes.slice(dataStart, dataEnd);
    const expectedCrc = readUint32(bytes, dataEnd);
    const actualCrc = crc32(joinBytes(typeBytes, chunkData));
    if (actualCrc !== expectedCrc) {
      throw failure(
        "corrupted-image",
        "The PNG image failed its internal integrity check.",
      );
    }

    if (!sawHeader) {
      if (type !== "IHDR" || length !== 13) {
        throw failure("corrupted-image", "The PNG image header is invalid.");
      }
      sawHeader = true;
    } else if (type === "IHDR") {
      throw failure("corrupted-image", "The PNG image contains multiple headers.");
    }

    if (type === "IDAT") sawImageData = true;
    if (type === "IEND") {
      if (length !== 0 || !sawImageData || chunkEnd !== bytes.length) {
        throw failure("corrupted-image", "The PNG image ending is invalid.");
      }
      sawEnd = true;
      chunks.push({ type, data: chunkData });
      break;
    }

    chunks.push({ type, data: chunkData });
    offset = chunkEnd;
  }

  if (!sawHeader || !sawImageData || !sawEnd) {
    throw failure("corrupted-image", "The PNG image is incomplete.");
  }
  return chunks;
}

function createPngChunk(type: string, data: Uint8Array): Uint8Array {
  const typeBytes = encoder.encode(type);
  const checksum = uint32Bytes(crc32(joinBytes(typeBytes, data)));
  return joinBytes(uint32Bytes(data.length), typeBytes, data, checksum);
}

function serializePng(chunks: PngChunk[]): Blob {
  const parts: Uint8Array[] = [pngSignature];
  for (const chunk of chunks) {
    parts.push(createPngChunk(chunk.type, chunk.data));
  }
  const blobParts = parts.map((part) => {
    const buffer = new ArrayBuffer(part.length);
    new Uint8Array(buffer).set(part);
    return buffer;
  });
  return new Blob(blobParts, { type: "image/png" });
}

function toImageMessageError(error: unknown): ImageMessageError {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    "message" in error &&
    typeof error.code === "string" &&
    isImageMessageErrorCode(error.code) &&
    typeof error.message === "string"
  ) {
    return {
      code: error.code,
      message: error.message,
    };
  }
  return failure(
    "corrupted-image",
    "The image could not be processed. Choose a valid PNG image and try again.",
  );
}

export async function encodeImage(
  image: Blob,
  input: PayloadInput,
  passphrase: string,
  options: EncodeImageOptions = {},
): Promise<EncodingResult> {
  try {
    options.onProgress?.({ stage: "preparing", percent: 5 });
    const imageSizeError = validateImageSize(image);
    if (imageSizeError) return { ok: false, error: imageSizeError };

    const inputError = validateInput(input);
    if (inputError) return { ok: false, error: inputError };

    const serialized = serializePayload(input);
    options.onProgress?.({ stage: "checking", percent: 30 });
    const chunks = parsePng(new Uint8Array(await image.arrayBuffer()));
    const existingPayloads = chunks.filter(
      (chunk) => chunk.type === PNG_MESSAGE_CHUNK_TYPE,
    );
    if (existingPayloads.length > 1) {
      return {
        ok: false,
        error: failure(
          "corrupted-image",
          "The PNG contains multiple experimental message chunks.",
        ),
      };
    }

    options.onProgress?.({ stage: "encrypting", percent: 55 });
    const encryptedResult = await encryptPayload(serialized, passphrase);
    if (!encryptedResult.ok) return { ok: false, error: encryptedResult.error };
    const payloadBytes = encoder.encode(JSON.stringify(encryptedResult.envelope));
    if (payloadBytes.length > MAX_SERIALIZED_PAYLOAD_BYTES) {
      return {
        ok: false,
        error: failure("payload-too-large", "The message payload is too large."),
      };
    }

    const payload: EncodedPayload = {
      ...input,
      integrity: checksumFor(input),
    };
    const filteredChunks = chunks.filter(
      (chunk) => chunk.type !== PNG_MESSAGE_CHUNK_TYPE,
    );
    const endIndex = filteredChunks.findIndex((chunk) => chunk.type === "IEND");
    filteredChunks.splice(endIndex, 0, {
      type: PNG_MESSAGE_CHUNK_TYPE,
      data: payloadBytes,
    });

    options.onProgress?.({ stage: "writing", percent: 75 });
    const encodedImage = serializePng(filteredChunks);
    if (encodedImage.size > MAX_IMAGE_SIZE_BYTES) {
      return {
        ok: false,
        error: failure(
          "image-too-large",
          "The PNG plus its experimental payload would exceed 10 MB.",
        ),
      };
    }

    options.onProgress?.({ stage: "complete", percent: 100 });
    return {
      ok: true,
      image: encodedImage,
      payload,
      format: "png",
    };
  } catch (error) {
    return { ok: false, error: toImageMessageError(error) };
  }
}

export async function decodeImage(
  image: Blob,
  passphrase: string,
): Promise<DecodingResult> {
  try {
    const imageSizeError = validateImageSize(image);
    if (imageSizeError) return { ok: false, error: imageSizeError };

    const chunks = parsePng(new Uint8Array(await image.arrayBuffer()));
    const payloadChunks = chunks.filter(
      (chunk) => chunk.type === PNG_MESSAGE_CHUNK_TYPE,
    );

    if (payloadChunks.length === 0) {
      return {
        ok: false,
        error: failure(
          "payload-not-found",
          "No SeekHelp experimental payload was found in this PNG.",
        ),
      };
    }
    if (payloadChunks.length !== 1) {
      return {
        ok: false,
        error: failure(
          "invalid-payload",
          "The PNG contains multiple experimental message chunks.",
        ),
      };
    }

    let envelope: unknown;
    try {
      const value: unknown = JSON.parse(decoder.decode(payloadChunks[0].data));
      if (!isRecord(value)) {
        return {
          ok: false,
          error: failure(
            "invalid-payload",
            "Unable to recover the message. Check the passphrase and image, then try again.",
          ),
        };
      }
      envelope = value;
    } catch {
      return {
        ok: false,
        error: failure(
          "invalid-payload",
          "Unable to recover the message. Check the passphrase and image, then try again.",
        ),
      };
    }
    const decryption = await decryptPayload(envelope, passphrase);
    if (!decryption.ok) return { ok: false, error: decryption.error };
    const result = deserializePayload(decryption.plaintext);
    if (!result.valid) return { ok: false, error: result.error };
    return { ok: true, payload: result.payload, format: "png" };
  } catch (error) {
    return { ok: false, error: toImageMessageError(error) };
  }
}
