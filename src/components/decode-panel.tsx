"use client";

import { useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Info,
  LoaderCircle,
  ScanLine,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ImageUploader } from "@/components/ImageUploader";
import { PageHeading } from "@/components/page-heading";
import type { ValidatedImage } from "@/lib/image-processing";
import { decodeImage, type DecodingResult } from "@/lib/image-message-engine";
import { MAX_PASSPHRASE_LENGTH } from "@/lib/payload-encryption";

const presetLabels: Record<string, string> = {
  "need-help": "I need help.",
  "contact-when-safe": "Please contact me when safe.",
  "check-on-me": "I need someone to check on me.",
  "may-be-in-danger": "I may be in danger.",
  "emergency-assistance": "I need emergency assistance.",
};

export function DecodePanel() {
  const [image, setImage] = useState<ValidatedImage | null>(null);
  const [passphrase, setPassphrase] = useState("");
  const [isDecoding, setIsDecoding] = useState(false);
  const [result, setResult] = useState<DecodingResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function decode() {
    if (!image) {
      setError("Choose an image before starting recovery.");
      return;
    }
    if (!passphrase) {
      setError("Enter the passphrase shared by the sender.");
      return;
    }

    setError(null);
    setResult(null);
    setIsDecoding(true);
    try {
      const decodingResult = await decodeImage(image.file, passphrase);
      if (decodingResult.ok) {
        setResult(decodingResult);
      } else {
        setError(decodingResult.error.message);
      }
    } catch {
      setError(
        "Unable to recover the message. Check the passphrase and image, then try again.",
      );
    } finally {
      setPassphrase("");
      setIsDecoding(false);
    }
  }

  const recoveredPayload = result?.ok ? result.payload : null;

  return (
    <main
      id="main-content"
      className="mx-auto w-full max-w-6xl flex-1 px-5 py-10 sm:px-8 sm:py-14"
    >
      <PageHeading
        eyebrow="Decode · test-only experiment"
        title="Open a received image"
        description="Try to recover an encrypted experimental payload from a PNG using the passphrase shared by its sender."
      >
        <p className="mt-4 flex items-start gap-2 rounded-lg bg-secondary/70 p-3 text-sm leading-6 text-secondary-foreground">
          <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          This prototype does not contact anyone or verify receipt. A generic
          recovery error may mean the passphrase is wrong, the data changed, or
          the image does not contain a supported encrypted payload.
        </p>
      </PageHeading>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(18rem,0.85fr)] lg:items-start">
        <Card className="border-border/80 shadow-sm">
          <CardHeader className="border-b border-border/70">
            <CardTitle className="text-lg">Received image</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-5 pt-5">
            <ImageUploader
              image={image}
              onImageChange={(nextImage) => {
                setImage(nextImage);
                setPassphrase("");
                setResult(null);
                setError(null);
              }}
            />
            <div className="grid gap-2">
              <label htmlFor="recovery-passphrase" className="text-sm font-medium">
                Passphrase
              </label>
              <input
                id="recovery-passphrase"
                type="password"
                autoComplete="off"
                maxLength={MAX_PASSPHRASE_LENGTH}
                value={passphrase}
                onChange={(event) => {
                  setPassphrase(event.currentTarget.value);
                  setResult(null);
                  setError(null);
                }}
                disabled={isDecoding}
                className="h-11 w-full rounded-lg border border-input bg-background px-3 text-base outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50 md:text-sm"
              />
              <p className="text-xs leading-5 text-muted-foreground">
                Used only in this browser for this recovery attempt. It is not
                saved or transmitted.
              </p>
            </div>
            {error && (
              <p role="alert" className="text-sm font-medium text-destructive">
                {error}
              </p>
            )}
            <Button
              type="button"
              size="lg"
              disabled={!image || !passphrase || isDecoding}
              onClick={() => void decode()}
            >
              {isDecoding ? (
                <>
                  <LoaderCircle
                    aria-hidden="true"
                    className="animate-spin motion-reduce:animate-none"
                  />
                  Recovering message…
                </>
              ) : (
                <>
                  <ScanLine aria-hidden="true" />
                  Decrypt and recover
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        <div className="grid gap-5">
          <Card
            aria-live="polite"
            className="min-h-48 border-border/80 shadow-sm"
          >
            <CardHeader>
              <CardTitle className="text-base">Recovery result</CardTitle>
            </CardHeader>
            <CardContent>
              {isDecoding ? (
                <div
                  role="status"
                  className="flex min-h-24 items-center gap-3 text-sm text-muted-foreground"
                >
                  <LoaderCircle
                    aria-hidden="true"
                    className="size-5 animate-spin text-primary motion-reduce:animate-none"
                  />
                  Attempting local decryption…
                </div>
              ) : recoveredPayload ? (
                <Alert className="border-primary/20 bg-secondary/40">
                  <CheckCircle2 aria-hidden="true" className="text-primary" />
                  <div className="grid gap-2">
                    <AlertTitle>Encrypted payload recovered</AlertTitle>
                    <AlertDescription className="grid gap-2 rounded-md bg-background p-3 text-foreground">
                      <span>
                        {recoveredPayload.messageType === "preset"
                          ? presetLabels[recoveredPayload.message] ??
                            recoveredPayload.message
                          : recoveredPayload.message}
                      </span>
                      {recoveredPayload.location && (
                        <span className="text-sm text-muted-foreground">
                          Location note: {recoveredPayload.location}
                        </span>
                      )}
                    </AlertDescription>
                    <p className="text-xs leading-5 text-muted-foreground">
                      Recovery is local and does not confirm that anyone has
                      received or acted on this message.
                    </p>
                  </div>
                </Alert>
              ) : error ? (
                <Alert variant="destructive">
                  <AlertCircle aria-hidden="true" />
                  <div className="grid gap-1">
                    <AlertTitle>Message not recovered</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                  </div>
                </Alert>
              ) : (
                <div className="grid min-h-24 place-items-center rounded-lg border border-dashed border-border bg-muted/35 p-4 text-center">
                  <p className="max-w-sm text-sm leading-6 text-muted-foreground">
                    The result will appear here after a recovery attempt.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-border/80 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Need support?</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3">
              <p className="text-sm leading-6 text-muted-foreground">
                This prototype cannot contact anyone or request emergency
                assistance. See the help page for general resource information.
              </p>
              <Button asChild variant="outline" className="w-full">
                <Link href="/help">
                  View help information
                  <ArrowRight aria-hidden="true" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}
