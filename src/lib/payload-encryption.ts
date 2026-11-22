export const ENCRYPTED_PAYLOAD_FORMAT = "seekhelp-encrypted-payload" as const;
export const ENCRYPTED_PAYLOAD_VERSION = 1 as const;
export const PAYLOAD_KDF_ITERATIONS = 600_000;
export const MIN_PASSPHRASE_LENGTH = 12;
export const MAX_PASSPHRASE_LENGTH = 128;
export const MAX_ENCRYPTED_PAYLOAD_BYTES = 4096;

const AES_GCM_ALGORITHM = "AES-GCM" as const;
const KDF_ALGORITHM = "PBKDF2-SHA-256" as const;
const SALT_LENGTH = 16;
const IV_LENGTH = 12;
const AUTHENTICATION_TAG_LENGTH = 128;
const ENVELOPE_AAD = new TextEncoder().encode(
  JSON.stringify({
    format: ENCRYPTED_PAYLOAD_FORMAT,
    version: ENCRYPTED_PAYLOAD_VERSION,
    algorithm: AES_GCM_ALGORITHM,
    kdf: KDF_ALGORITHM,
    iterations: PAYLOAD_KDF_ITERATIONS,
  }),
);
const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder("utf-8", { fatal: true });

export type EncryptedPayload = {
  format: typeof ENCRYPTED_PAYLOAD_FORMAT;
  version: typeof ENCRYPTED_PAYLOAD_VERSION;
  algorithm: typeof AES_GCM_ALGORITHM;
  kdf: typeof KDF_ALGORITHM;
  iterations: typeof PAYLOAD_KDF_ITERATIONS;
  salt: string;
  iv: string;
  ciphertext: string;
};

export type PayloadEncryptionErrorCode =
  | "invalid-passphrase"
  | "crypto-unavailable"
  | "invalid-payload"
  | "recovery-failed";

export type PayloadEncryptionError = {
  code: PayloadEncryptionErrorCode;
  message: string;
};

export type EncryptionResult =
  | { ok: true; envelope: EncryptedPayload }
  | { ok: false; error: PayloadEncryptionError };

export type DecryptionResult =
  | { ok: true; plaintext: string }
  | { ok: false; error: PayloadEncryptionError };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function encodeBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

function decodeBase64Url(value: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) return null;
  try {
    const base64 = value.replaceAll("-", "+").replaceAll("_", "/");
    const binary = atob(base64 + "=".repeat((4 - (base64.length % 4)) % 4));
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    return encodeBase64Url(bytes) === value ? bytes : null;
  } catch {
    return null;
  }
}

function validPassphrase(passphrase: string): boolean {
  if (typeof passphrase !== "string") return false;
  const length = Array.from(passphrase).length;
  return length >= MIN_PASSPHRASE_LENGTH && length <= MAX_PASSPHRASE_LENGTH;
}

function passphraseError(): PayloadEncryptionError {
  return {
    code: "invalid-passphrase",
    message: `Use a passphrase between ${MIN_PASSPHRASE_LENGTH} and ${MAX_PASSPHRASE_LENGTH} characters.`,
  };
}

function isCryptoAvailable(): boolean {
  return (
    typeof globalThis.crypto !== "undefined" &&
    typeof globalThis.crypto.getRandomValues === "function" &&
    typeof globalThis.crypto.subtle !== "undefined"
  );
}

async function deriveKey(
  passphrase: string,
  salt: Uint8Array,
  usage: KeyUsage,
): Promise<CryptoKey> {
  const material = await globalThis.crypto.subtle.importKey(
    "raw",
    textEncoder.encode(passphrase),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return globalThis.crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: new Uint8Array(salt),
      iterations: PAYLOAD_KDF_ITERATIONS,
      hash: "SHA-256",
    },
    material,
    { name: AES_GCM_ALGORITHM, length: 256 },
    false,
    [usage],
  );
}

export async function encryptPayload(
  plaintext: string,
  passphrase: string,
): Promise<EncryptionResult> {
  if (!validPassphrase(passphrase)) {
    return { ok: false, error: passphraseError() };
  }
  if (
    typeof plaintext !== "string" ||
    plaintext.length === 0 ||
    textEncoder.encode(plaintext).length > MAX_ENCRYPTED_PAYLOAD_BYTES
  ) {
    return {
      ok: false,
      error: {
        code: "invalid-payload",
        message: "The message payload is invalid or too large to encrypt.",
      },
    };
  }
  if (!isCryptoAvailable()) {
    return {
      ok: false,
      error: {
        code: "crypto-unavailable",
        message: "Encryption is unavailable in this browser.",
      },
    };
  }

  try {
    const salt = globalThis.crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
    const iv = globalThis.crypto.getRandomValues(new Uint8Array(IV_LENGTH));
    const key = await deriveKey(passphrase, salt, "encrypt");
    const encrypted = await globalThis.crypto.subtle.encrypt(
      {
        name: AES_GCM_ALGORITHM,
        iv,
        additionalData: ENVELOPE_AAD,
        tagLength: AUTHENTICATION_TAG_LENGTH,
      },
      key,
      textEncoder.encode(plaintext),
    );
    const envelope: EncryptedPayload = {
      format: ENCRYPTED_PAYLOAD_FORMAT,
      version: ENCRYPTED_PAYLOAD_VERSION,
      algorithm: AES_GCM_ALGORITHM,
      kdf: KDF_ALGORITHM,
      iterations: PAYLOAD_KDF_ITERATIONS,
      salt: encodeBase64Url(salt),
      iv: encodeBase64Url(iv),
      ciphertext: encodeBase64Url(new Uint8Array(encrypted)),
    };
    return { ok: true, envelope };
  } catch {
    return {
      ok: false,
      error: {
        code: "crypto-unavailable",
        message: "Encryption could not be completed in this browser.",
      },
    };
  }
}

function validateEnvelope(value: unknown):
  | { valid: true; envelope: EncryptedPayload; salt: Uint8Array; iv: Uint8Array; ciphertext: Uint8Array }
  | { valid: false } {
  if (!isRecord(value)) return { valid: false };
  const allowedKeys = new Set([
    "format",
    "version",
    "algorithm",
    "kdf",
    "iterations",
    "salt",
    "iv",
    "ciphertext",
  ]);
  if (
    Object.keys(value).length !== allowedKeys.size ||
    Object.keys(value).some((key) => !allowedKeys.has(key)) ||
    value.format !== ENCRYPTED_PAYLOAD_FORMAT ||
    value.version !== ENCRYPTED_PAYLOAD_VERSION ||
    value.algorithm !== AES_GCM_ALGORITHM ||
    value.kdf !== KDF_ALGORITHM ||
    value.iterations !== PAYLOAD_KDF_ITERATIONS ||
    typeof value.salt !== "string" ||
    typeof value.iv !== "string" ||
    typeof value.ciphertext !== "string" ||
    value.ciphertext.length > MAX_ENCRYPTED_PAYLOAD_BYTES * 2
  ) {
    return { valid: false };
  }

  const salt = decodeBase64Url(value.salt);
  const iv = decodeBase64Url(value.iv);
  const ciphertext = decodeBase64Url(value.ciphertext);
  if (
    !salt ||
    salt.length !== SALT_LENGTH ||
    !iv ||
    iv.length !== IV_LENGTH ||
    !ciphertext ||
    ciphertext.length < AUTHENTICATION_TAG_LENGTH / 8 ||
    ciphertext.length > MAX_ENCRYPTED_PAYLOAD_BYTES + AUTHENTICATION_TAG_LENGTH / 8
  ) {
    return { valid: false };
  }
  return {
    valid: true,
    envelope: {
      format: ENCRYPTED_PAYLOAD_FORMAT,
      version: ENCRYPTED_PAYLOAD_VERSION,
      algorithm: AES_GCM_ALGORITHM,
      kdf: KDF_ALGORITHM,
      iterations: PAYLOAD_KDF_ITERATIONS,
      salt: value.salt,
      iv: value.iv,
      ciphertext: value.ciphertext,
    },
    salt,
    iv,
    ciphertext,
  };
}

export async function decryptPayload(
  value: unknown,
  passphrase: string,
): Promise<DecryptionResult> {
  if (!validPassphrase(passphrase)) {
    return { ok: false, error: passphraseError() };
  }
  const validated = validateEnvelope(value);
  if (!validated.valid) {
    return {
      ok: false,
      error: {
        code: "invalid-payload",
        message: "Unable to recover the message. Check the passphrase and image, then try again.",
      },
    };
  }
  if (!isCryptoAvailable()) {
    return {
      ok: false,
      error: {
        code: "crypto-unavailable",
        message: "Message recovery is unavailable in this browser.",
      },
    };
  }

  try {
    const key = await deriveKey(passphrase, validated.salt, "decrypt");
    const plaintext = await globalThis.crypto.subtle.decrypt(
      {
        name: AES_GCM_ALGORITHM,
        iv: new Uint8Array(validated.iv),
        additionalData: ENVELOPE_AAD,
        tagLength: AUTHENTICATION_TAG_LENGTH,
      },
      key,
      new Uint8Array(validated.ciphertext),
    );
    return { ok: true, plaintext: textDecoder.decode(plaintext) };
  } catch {
    return {
      ok: false,
      error: {
        code: "recovery-failed",
        message: "Unable to recover the message. Check the passphrase and image, then try again.",
      },
    };
  }
}
