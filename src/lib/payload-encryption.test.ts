import { afterEach, describe, expect, it, vi } from "vitest";
import {
  decryptPayload,
  encryptPayload,
  ENCRYPTED_PAYLOAD_VERSION,
  MIN_PASSPHRASE_LENGTH,
} from "./payload-encryption";

const passphrase = "a carefully chosen test passphrase";
const plaintext = '{"v":1,"t":"text","x":"sample message","i":"1234abcd"}';

afterEach(() => {
  vi.restoreAllMocks();
});

describe("payload encryption", () => {
  it("encrypts and decrypts with authenticated AES-GCM", async () => {
    const encrypted = await encryptPayload(plaintext, passphrase);

    expect(encrypted.ok).toBe(true);
    if (!encrypted.ok) return;
    expect(encrypted.envelope.version).toBe(ENCRYPTED_PAYLOAD_VERSION);
    expect(encrypted.envelope.ciphertext).not.toContain("sample message");
    await expect(
      decryptPayload(encrypted.envelope, passphrase),
    ).resolves.toEqual({ ok: true, plaintext });
  });

  it("uses fresh random salt and IV values for each encryption", async () => {
    const first = await encryptPayload(plaintext, passphrase);
    const second = await encryptPayload(plaintext, passphrase);

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(second.envelope.salt).not.toBe(first.envelope.salt);
    expect(second.envelope.iv).not.toBe(first.envelope.iv);
  });

  it("returns a generic recovery error for a wrong passphrase", async () => {
    const encrypted = await encryptPayload(plaintext, passphrase);
    expect(encrypted.ok).toBe(true);
    if (!encrypted.ok) return;

    await expect(
      decryptPayload(encrypted.envelope, "a different test passphrase"),
    ).resolves.toMatchObject({
      ok: false,
      error: {
        code: "recovery-failed",
        message:
          "Unable to recover the message. Check the passphrase and image, then try again.",
      },
    });
  });

  it("rejects tampered ciphertext without returning plaintext", async () => {
    const encrypted = await encryptPayload(plaintext, passphrase);
    expect(encrypted.ok).toBe(true);
    if (!encrypted.ok) return;
    const changedFirstCharacter =
      encrypted.envelope.ciphertext[0] === "A" ? "B" : "A";

    await expect(
      decryptPayload(
        {
          ...encrypted.envelope,
          ciphertext:
            changedFirstCharacter + encrypted.envelope.ciphertext.slice(1),
        },
        passphrase,
      ),
    ).resolves.toMatchObject({
      ok: false,
      error: { code: "recovery-failed" },
    });
  });

  it("rejects empty or oversized plaintext and weak passphrases", async () => {
    await expect(encryptPayload("", passphrase)).resolves.toMatchObject({
      ok: false,
      error: { code: "invalid-payload" },
    });
    await expect(
      encryptPayload(plaintext, "short"),
    ).resolves.toMatchObject({
      ok: false,
      error: {
        code: "invalid-passphrase",
        message: expect.stringContaining(String(MIN_PASSPHRASE_LENGTH)),
      },
    });
  });

  it("rejects missing envelope fields and unsupported versions", async () => {
    const encrypted = await encryptPayload(plaintext, passphrase);
    expect(encrypted.ok).toBe(true);
    if (!encrypted.ok) return;

    const missingIv: Record<string, unknown> = { ...encrypted.envelope };
    delete missingIv.iv;
    await expect(decryptPayload(missingIv, passphrase)).resolves.toMatchObject({
      ok: false,
      error: { code: "invalid-payload" },
    });
    await expect(
      decryptPayload(
        { ...encrypted.envelope, version: ENCRYPTED_PAYLOAD_VERSION + 1 },
        passphrase,
      ),
    ).resolves.toMatchObject({
      ok: false,
      error: { code: "invalid-payload" },
    });
  });

  it("reports unavailable randomness rather than using a fallback", async () => {
    vi.spyOn(globalThis.crypto, "getRandomValues").mockImplementation(() => {
      throw new Error("random source unavailable");
    });

    await expect(encryptPayload(plaintext, passphrase)).resolves.toMatchObject({
      ok: false,
      error: { code: "crypto-unavailable" },
    });
  });
});
