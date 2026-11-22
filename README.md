# SeekHelp

SeekHelp is a privacy-first web application prototype exploring how someone
could communicate a small message to a trusted contact. It currently provides
the application shell and an experimental sender/recipient workflow. Image payload
handling is a feasibility prototype only.

SeekHelp is a prototype, not an emergency service, and has not been verified
for safety. Do not rely on it in an emergency.

## Requirements

- Node.js 20.9 or later
- npm

## Install and run

```bash
npm ci
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Checks

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

## Project structure

- `src/app/` — Next.js App Router routes, global styles, loading and error
  states
- `src/components/` — shared application shell, upload preview, and shadcn/ui
  primitives
- `src/lib/image-processing.ts` — client-side image validation, dimensions,
  and temporary preview URL helpers
- `src/lib/image-message-engine.ts` — isolated, experimental PNG payload
  encoder/decoder and typed validation results; encrypts before embedding and
  requires a passphrase to recover
- `src/lib/payload-encryption.ts` — browser Web Crypto AES-GCM encryption,
  PBKDF2 key derivation, versioned envelope validation, and recovery errors
- `src/lib/encode-image-client.ts` — cancellable worker client for sender
  encoding and output preview URLs
- `src/workers/image.worker.ts` — off-main-thread image decoding and dimension
  inspection
- `src/workers/encode.worker.ts` — off-main-thread payload encryption and
  experimental PNG encoding

## Privacy and scope

This prototype has no account system or database. Images are checked and
previewed in the browser only; the uploader accepts JPG, JPEG, PNG, and WebP
files up to 10 MB, and uses a short-lived Web Worker to inspect dimensions and
check that the browser can decode the image. Temporary preview URLs are
released when an image is replaced, removed, or its uploader unmounts. Nothing
is uploaded or stored by the application.

The standalone experiment validates a compact version-1 message payload:

| Key | Meaning |
| --- | --- |
| `v` | Format version (`1`) |
| `t` | Message kind (`text` or `preset`) |
| `x` | Message text (up to 160 characters) or preset identifier (up to 64) |
| `l` | Optional manually provided location note (up to 120 characters) |
| `i` | Eight-character hexadecimal CRC-32 over the canonical `v`, `t`, `x`, and optional `l` fields |

Before embedding, the payload JSON is encrypted with Web Crypto AES-256-GCM
(128-bit authentication tag). A fresh 128-bit salt and 96-bit IV are generated
for every encryption. The AES key is derived from the user-entered passphrase
with PBKDF2-HMAC-SHA-256 (600,000 iterations); the non-extractable key is held
only for the cryptographic operation. The versioned envelope and ciphertext
are stored in a custom PNG ancillary chunk named `seHp`. The envelope records
its format and version, algorithm, KDF and iteration count, salt, IV, and
ciphertext; the decoder rejects missing, unknown, or unsupported fields.
Passphrases are required and must be at least 12 characters. The sender clears
passphrase form state after an attempt; the recipient clears it after recovery.

The chunk is still visible metadata, not pixel-level concealment: tools can
identify it, and edits or format conversions may remove it. CRC-32 remains in
the inner format for compatibility/structural validation but is not relied on
for cryptographic authentication; AES-GCM authenticates ciphertext and fixed
envelope parameters. The recipient does not fall back to decoding legacy
plaintext chunks. PBKDF2 does not make a weak or guessable passphrase safe,
so share the passphrase through a separate trusted channel. This client-side
encryption cannot protect a compromised device, browser, or passphrase entry,
and does not verify who created or received a message. The experiment is not
suitable for real-world emergency reliance and does not dispatch emergency
assistance. Images, passphrases, keys, messages, and locations are not sent to
a server or written to browser storage by this feature.
