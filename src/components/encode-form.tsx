"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  Check,
  Download,
  Info,
  LoaderCircle,
  LockKeyhole,
  RotateCcw,
  X,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ImageUploader } from "@/components/ImageUploader";
import { PageHeading } from "@/components/page-heading";
import type { ValidatedImage } from "@/lib/image-processing";
import {
  IMAGE_MESSAGE_VERSION,
  MAX_IMAGE_MESSAGE_LENGTH,
  MAX_LOCATION_LENGTH,
  type EncodingProgress,
  type EncodingResult,
  type PayloadInput,
} from "@/lib/image-message-engine";
import {
  MAX_PASSPHRASE_LENGTH,
  MIN_PASSPHRASE_LENGTH,
} from "@/lib/payload-encryption";
import {
  createEncodedImageUrl,
  createImageEncodingTask,
  revokeEncodedImageUrl,
  type ImageEncodingTask,
} from "@/lib/encode-image-client";

const messagePresets = [
  { id: "need-help", label: "I need help." },
  { id: "contact-when-safe", label: "Please contact me when safe." },
  { id: "check-on-me", label: "I need someone to check on me." },
  { id: "may-be-in-danger", label: "I may be in danger." },
  { id: "emergency-assistance", label: "I need emergency assistance." },
] as const;

const progressLabels: Record<EncodingProgress["stage"], string> = {
  preparing: "Preparing the local encoding task…",
  checking: "Checking the PNG structure…",
  encrypting: "Encrypting the message locally…",
  writing: "Adding the encrypted message chunk…",
  complete: "Encoding complete.",
};

export function EncodeForm() {
  const [image, setImage] = useState<ValidatedImage | null>(null);
  const [uploaderKey, setUploaderKey] = useState(0);
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);
  const [useCustomMessage, setUseCustomMessage] = useState(false);
  const [customMessage, setCustomMessage] = useState("");
  const [locationEnabled, setLocationEnabled] = useState(false);
  const [locationNote, setLocationNote] = useState("");
  const [passphrase, setPassphrase] = useState("");
  const [passphraseConfirmation, setPassphraseConfirmation] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState<EncodingProgress>({
    stage: "preparing",
    percent: 0,
  });
  const [result, setResult] = useState<EncodingResult | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const taskRef = useRef<ImageEncodingTask | null>(null);
  const runIdRef = useRef(0);
  const resultUrlRef = useRef<string | null>(null);

  useEffect(
    () => () => {
      runIdRef.current += 1;
      taskRef.current?.cancel();
      if (resultUrlRef.current) {
        revokeEncodedImageUrl(resultUrlRef.current);
      }
    },
    [],
  );

  const preset = messagePresets.find(({ id }) => id === selectedPreset);
  const message = useCustomMessage ? customMessage : (preset?.label ?? "");
  const activePayload: PayloadInput | null =
    message.trim().length > 0
      ? {
          version: IMAGE_MESSAGE_VERSION,
          messageType: useCustomMessage ? "text" : "preset",
          message: useCustomMessage ? message.trim() : (selectedPreset ?? ""),
          ...(locationEnabled && locationNote.trim()
            ? { location: locationNote.trim() }
            : {}),
        }
      : null;

  function clearResult() {
    if (resultUrlRef.current) {
      revokeEncodedImageUrl(resultUrlRef.current);
      resultUrlRef.current = null;
    }
    setResultUrl(null);
    setResult(null);
  }

  function cancelEncoding() {
    runIdRef.current += 1;
    taskRef.current?.cancel();
    taskRef.current = null;
    setIsProcessing(false);
    setProgress({ stage: "preparing", percent: 0 });
    clearResult();
    setPassphrase("");
    setPassphraseConfirmation("");
    setError(null);
  }

  function resetWorkflow() {
    cancelEncoding();
    setImage(null);
    setUploaderKey((key) => key + 1);
    setSelectedPreset(null);
    setUseCustomMessage(false);
    setCustomMessage("");
    setLocationEnabled(false);
    setLocationNote("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    clearResult();

    if (!image) {
      setError("Choose an image before encoding.");
      return;
    }
    if (image.format !== "png") {
      setError(
        "This experiment can encode PNG images only. Choose a PNG image; JPG and WebP encoding is not supported.",
      );
      return;
    }
    if (!activePayload) {
      setError("Choose a message preset or write a short custom message.");
      return;
    }
    const passphraseLength = Array.from(passphrase).length;
    if (
      passphraseLength < MIN_PASSPHRASE_LENGTH ||
      passphraseLength > MAX_PASSPHRASE_LENGTH
    ) {
      setError(
        `Use a passphrase between ${MIN_PASSPHRASE_LENGTH} and ${MAX_PASSPHRASE_LENGTH} characters.`,
      );
      return;
    }
    if (passphrase !== passphraseConfirmation) {
      setError("The passphrase entries do not match.");
      return;
    }
    if (
      useCustomMessage &&
      customMessage.trim().length > MAX_IMAGE_MESSAGE_LENGTH
    ) {
      setError(
        `Custom messages must be ${MAX_IMAGE_MESSAGE_LENGTH} characters or fewer.`,
      );
      return;
    }
    if (locationEnabled && locationNote.trim().length > MAX_LOCATION_LENGTH) {
      setError(`Location notes must be ${MAX_LOCATION_LENGTH} characters or fewer.`);
      return;
    }

    const runId = runIdRef.current + 1;
    runIdRef.current = runId;
    setProgress({ stage: "preparing", percent: 0 });
    setIsProcessing(true);
    const task = createImageEncodingTask(
      image.file,
      activePayload,
      passphrase,
      (nextProgress) => {
        if (runId === runIdRef.current) setProgress(nextProgress);
      },
    );
    taskRef.current = task;

    try {
      const encodingResult = await task.promise;
      if (runId !== runIdRef.current) return;
      if (!encodingResult.ok) {
        setError(encodingResult.error.message);
        setProgress({ stage: "preparing", percent: 0 });
        return;
      }

      const outputUrl = createEncodedImageUrl(encodingResult);
      if (!outputUrl) {
        setError("The encoded image preview could not be prepared.");
        return;
      }
      resultUrlRef.current = outputUrl;
      setResultUrl(outputUrl);
      setResult(encodingResult);
    } catch (encodingError) {
      if (
        runId === runIdRef.current &&
        !(encodingError instanceof DOMException &&
          encodingError.name === "AbortError")
      ) {
        setError("Encoding could not be completed. Please try again.");
      }
    } finally {
      if (runId === runIdRef.current) {
        setPassphrase("");
        setPassphraseConfirmation("");
        taskRef.current = null;
        setIsProcessing(false);
      }
    }
  }

  return (
    <main
      id="main-content"
      className="mx-auto w-full max-w-6xl flex-1 px-5 py-10 sm:px-8 sm:py-14"
    >
      <PageHeading
        eyebrow="Encode · test-only experiment"
        title="Prepare a message"
        description="Select a PNG and a short message to create an experimental image. This is a feasibility prototype, not a dependable or verified way to ask for help."
      >
        <Alert role="note" className="mt-4 gap-3 border-primary/20 bg-secondary/60">
          <LockKeyhole aria-hidden="true" className="mt-0.5 text-primary" />
          <div className="grid gap-1">
            <AlertTitle>Test-only limitation</AlertTitle>
            <AlertDescription className="leading-6">
              The message is encrypted locally with AES-GCM before being added
              to a visible PNG metadata chunk. This is a prototype, not a
              verified safety tool; image tools can identify or remove the
              chunk, and encryption cannot protect a compromised device.
              Do not rely on it for emergency communication.
            </AlertDescription>
          </div>
        </Alert>
      </PageHeading>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(18rem,0.7fr)] lg:items-start">
        <Card className="border-border/80 shadow-sm">
          <CardHeader className="border-b border-border/70">
            <CardTitle className="text-lg">Message and original image</CardTitle>
          </CardHeader>
          <CardContent className="pt-5">
            <form onSubmit={handleSubmit} className="grid gap-7">
              <fieldset disabled={isProcessing} className="grid gap-3">
                <legend className="mb-3 text-sm font-medium">
                  1. Choose an original image
                </legend>
                <ImageUploader
                  key={uploaderKey}
                  image={image}
                  onImageChange={(nextImage) => {
                    setImage(nextImage);
                    clearResult();
                    setError(null);
                  }}
                />
                <p className="text-xs leading-5 text-muted-foreground">
                  Original image · unchanged until the experimental output is
                  created. PNG only for this encoder.
                </p>
                {image && image.format !== "png" && (
                  <p role="alert" className="text-sm text-destructive">
                    This experimental encoder accepts PNG only. Replace this
                    image with a PNG to continue.
                  </p>
                )}
              </fieldset>

              <fieldset disabled={isProcessing} className="grid gap-3">
                <legend className="mb-3 text-sm font-medium">
                  2. Choose a message preset
                </legend>
                <div className="grid gap-2 sm:grid-cols-2">
                  {messagePresets.map(({ id, label }) => (
                    <Button
                      key={id}
                      type="button"
                      variant={
                        !useCustomMessage && selectedPreset === id
                          ? "secondary"
                          : "outline"
                      }
                      className="h-auto min-h-12 justify-start whitespace-normal py-2.5 text-left"
                      aria-pressed={!useCustomMessage && selectedPreset === id}
                      onClick={() => {
                        setSelectedPreset(id);
                        setUseCustomMessage(false);
                        setError(null);
                        clearResult();
                      }}
                    >
                      {!useCustomMessage && selectedPreset === id && (
                        <Check aria-hidden="true" className="shrink-0" />
                      )}
                      {label}
                    </Button>
                  ))}
                </div>
                <Button
                  type="button"
                  variant={useCustomMessage ? "secondary" : "outline"}
                  className="h-auto min-h-11 justify-start whitespace-normal text-left"
                  aria-pressed={useCustomMessage}
                  onClick={() => {
                    setUseCustomMessage(true);
                    setSelectedPreset(null);
                    setError(null);
                    clearResult();
                  }}
                >
                  Write a custom message instead
                </Button>
                {useCustomMessage && (
                  <>
                    <label
                      htmlFor="custom-message"
                      className="mt-1 text-sm font-medium"
                    >
                      Custom message
                    </label>
                    <textarea
                      id="custom-message"
                      rows={3}
                      maxLength={MAX_IMAGE_MESSAGE_LENGTH}
                      value={customMessage}
                      onChange={(event) => {
                        setCustomMessage(event.currentTarget.value);
                        setError(null);
                        clearResult();
                      }}
                      placeholder="Write a brief message"
                      aria-describedby="message-count message-note"
                      className="w-full resize-y rounded-lg border border-input bg-background px-3 py-2.5 text-base leading-6 outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                    />
                    <div className="flex items-start justify-between gap-3 text-xs leading-5 text-muted-foreground">
                      <span id="message-note">
                        Keep it brief. The message is encrypted before it is
                        added to PNG metadata.
                      </span>
                      <span
                        id="message-count"
                        aria-live="polite"
                        className="shrink-0 tabular-nums"
                      >
                        {customMessage.length}/{MAX_IMAGE_MESSAGE_LENGTH}
                      </span>
                    </div>
                  </>
                )}
              </fieldset>

              <fieldset disabled={isProcessing} className="grid gap-3">
                <legend className="text-sm font-medium">
                  3. Location note{" "}
                  <span className="font-normal text-muted-foreground">
                    (optional)
                  </span>
                </legend>
                <label className="flex min-h-11 items-center gap-3 text-sm text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={locationEnabled}
                    onChange={(event) => {
                      const enabled = event.currentTarget.checked;
                      setLocationEnabled(enabled);
                      if (!enabled) setLocationNote("");
                      clearResult();
                    }}
                    className="size-4 accent-primary focus-visible:ring-2 focus-visible:ring-ring"
                  />
                  Add a location note manually
                </label>
                {locationEnabled && (
                  <>
                    <input
                      type="text"
                      maxLength={MAX_LOCATION_LENGTH}
                      value={locationNote}
                      onChange={(event) => {
                        setLocationNote(event.currentTarget.value);
                        clearResult();
                      }}
                      placeholder="A place name you choose"
                      aria-label="Optional location note"
                      aria-describedby="location-count"
                      className="h-11 w-full rounded-lg border border-input bg-background px-3 text-base outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm"
                    />
                    <p
                      id="location-count"
                      className="text-xs text-muted-foreground"
                    >
                      {locationNote.length}/{MAX_LOCATION_LENGTH}
                    </p>
                  </>
                )}
                <p className="text-xs leading-5 text-muted-foreground">
                  Off by default. SeekHelp does not request or determine your
                  device location.
                </p>
              </fieldset>

              <fieldset disabled={isProcessing} className="grid gap-3">
                <legend className="text-sm font-medium">
                  4. Set an encryption passphrase
                </legend>
                <p className="text-xs leading-5 text-muted-foreground">
                  Use at least {MIN_PASSPHRASE_LENGTH} characters and share it
                  with the recipient separately. SeekHelp does not save or
                  transmit it. A compromised device may expose it.
                </p>
                <label htmlFor="encryption-passphrase" className="text-sm">
                  Passphrase
                </label>
                <input
                  id="encryption-passphrase"
                  type="password"
                  autoComplete="new-password"
                  maxLength={MAX_PASSPHRASE_LENGTH}
                  value={passphrase}
                  onChange={(event) => {
                    setPassphrase(event.currentTarget.value);
                    setError(null);
                    clearResult();
                  }}
                  className="h-11 w-full rounded-lg border border-input bg-background px-3 text-base outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm"
                  required
                />
                <label htmlFor="encryption-passphrase-confirm" className="text-sm">
                  Confirm passphrase
                </label>
                <input
                  id="encryption-passphrase-confirm"
                  type="password"
                  autoComplete="new-password"
                  maxLength={MAX_PASSPHRASE_LENGTH}
                  value={passphraseConfirmation}
                  onChange={(event) => {
                    setPassphraseConfirmation(event.currentTarget.value);
                    setError(null);
                    clearResult();
                  }}
                  className="h-11 w-full rounded-lg border border-input bg-background px-3 text-base outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm"
                  required
                />
              </fieldset>

              <section aria-labelledby="payload-summary-heading">
                <h2
                  id="payload-summary-heading"
                  className="mb-3 text-sm font-medium"
                >
                  5. Payload summary
                </h2>
                <div className="grid gap-2 rounded-lg border border-border bg-muted/35 p-4 text-sm">
                  <p>
                    <span className="font-medium">Message: </span>
                    {message || (
                      <span className="text-muted-foreground">
                        Choose a preset or custom message
                      </span>
                    )}
                  </p>
                  <p>
                    <span className="font-medium">Type: </span>
                    {activePayload?.messageType ?? "Not selected"}
                  </p>
                  <p>
                    <span className="font-medium">Location: </span>
                    {activePayload?.location ?? "Not included"}
                  </p>
                </div>
              </section>

              {error && (
                <p role="alert" className="text-sm font-medium text-destructive">
                  {error}
                </p>
              )}
              {isProcessing && (
                <div className="grid gap-2" role="status" aria-live="polite">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <LoaderCircle
                      aria-hidden="true"
                      className="size-4 animate-spin motion-reduce:animate-none"
                    />
                    {progressLabels[progress.stage]}
                    <span className="ml-auto tabular-nums">
                      {progress.percent}%
                    </span>
                  </div>
                  <progress
                    aria-label="Encoding progress"
                    value={progress.percent}
                    max={100}
                    className="h-2 w-full accent-primary"
                  />
                </div>
              )}
              <div className="flex flex-col gap-3 sm:flex-row">
                <Button
                  type="submit"
                  size="lg"
                  disabled={
                    isProcessing ||
                    !image ||
                    image.format !== "png" ||
                    !activePayload ||
                    !passphrase ||
                    passphrase !== passphraseConfirmation
                  }
                  className="w-full sm:w-fit"
                >
                  {isProcessing ? "Encrypting and encoding…" : "Encrypt and encode"}
                </Button>
                {isProcessing ? (
                  <Button
                    type="button"
                    size="lg"
                    variant="outline"
                    onClick={cancelEncoding}
                  >
                    <X aria-hidden="true" />
                    Cancel
                  </Button>
                ) : (
                  <Button
                    type="button"
                    size="lg"
                    variant="outline"
                    onClick={resetWorkflow}
                  >
                    <RotateCcw aria-hidden="true" />
                    Reset
                  </Button>
                )}
              </div>
            </form>
          </CardContent>
        </Card>

        <div className="grid gap-5">
          <Card className="border-border/80 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Processed output</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              {result?.ok && resultUrl ? (
                <>
                  <p className="text-xs font-medium uppercase tracking-wide text-primary">
                    Experimental output · original unchanged
                  </p>
                  <div className="relative aspect-video overflow-hidden rounded-lg border border-border bg-muted">
                    <Image
                      src={resultUrl}
                      alt="Processed PNG output with experimental message metadata"
                      fill
                      unoptimized
                      sizes="(max-width: 1024px) 100vw, 30vw"
                      className="object-contain"
                    />
                  </div>
                  <p className="text-sm leading-6 text-muted-foreground">
                    {result.payload.messageType === "preset"
                      ? preset?.label
                      : result.payload.message}
                  </p>
                  <a
                    href={resultUrl}
                    download="seekhelp-experimental.png"
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground outline-none transition-colors hover:bg-primary/90 focus-visible:ring-3 focus-visible:ring-ring/50"
                  >
                    <Download aria-hidden="true" className="size-4" />
                    Download experimental PNG
                  </a>
                  <p className="text-xs leading-5 text-muted-foreground">
                    The downloaded file includes encrypted experimental
                    metadata. Downloading does not transmit the image or
                    passphrase.
                  </p>
                </>
              ) : (
                <div className="grid min-h-36 place-items-center rounded-lg border border-dashed border-border bg-muted/35 p-4 text-center">
                  <p className="max-w-sm text-sm leading-6 text-muted-foreground">
                    After encoding, the experimental PNG preview and download
                    will appear here. No output is retained after reset or
                    leaving this page.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
          <Alert role="note" className="gap-3">
            <Info aria-hidden="true" className="mt-0.5 text-primary" />
            <div className="grid gap-1">
              <AlertTitle>Not for emergency reliance</AlertTitle>
              <AlertDescription>
                This experiment does not send an alert, verify a recipient, or
                confirm that anyone receives or opens the image.
              </AlertDescription>
            </div>
          </Alert>
        </div>
      </div>
    </main>
  );
}
