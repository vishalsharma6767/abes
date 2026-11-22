"use client";

import { useEffect, useRef, useState } from "react";
import { FileImage, ImagePlus, LoaderCircle } from "lucide-react";
import { ImagePreview } from "@/components/ImagePreview";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  createImagePreviewUrl,
  ImageProcessingError,
  revokeImagePreviewUrl,
  validateImageFile,
  type ValidatedImage,
} from "@/lib/image-processing";

type ImageUploaderProps = {
  image: ValidatedImage | null;
  onImageChange: (image: ValidatedImage | null) => void;
};

const acceptedImageTypes =
  ".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp";

export function ImageUploader({ image, onImageChange }: ImageUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const previewUrlRef = useRef<string | null>(null);
  const requestIdRef = useRef(0);
  const abortControllerRef = useRef<AbortController | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(
    () => () => {
      requestIdRef.current += 1;
      abortControllerRef.current?.abort();
      if (previewUrlRef.current) {
        revokeImagePreviewUrl(previewUrlRef.current);
      }
    },
    [],
  );

  function removeImage() {
    requestIdRef.current += 1;
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    if (previewUrlRef.current) {
      revokeImagePreviewUrl(previewUrlRef.current);
      previewUrlRef.current = null;
    }
    setPreviewUrl(null);
    setIsValidating(false);
    setError(null);
    onImageChange(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  async function selectFile(file: File | undefined) {
    if (!file) return;

    requestIdRef.current += 1;
    const requestId = requestIdRef.current;
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;
    setIsValidating(true);
    setError(null);

    try {
      const validatedImage = await validateImageFile(
        file,
        undefined,
        controller.signal,
      );
      if (requestId !== requestIdRef.current) return;

      const nextPreviewUrl = createImagePreviewUrl(file);
      if (previewUrlRef.current) {
        revokeImagePreviewUrl(previewUrlRef.current);
      }
      previewUrlRef.current = nextPreviewUrl;
      setPreviewUrl(nextPreviewUrl);
      onImageChange(validatedImage);
    } catch (validationError) {
      if (requestId !== requestIdRef.current) return;
      if (
        validationError instanceof DOMException &&
        validationError.name === "AbortError"
      ) {
        return;
      }
      setError(
        validationError instanceof ImageProcessingError
          ? validationError.message
          : "This image could not be checked. Try another image.",
      );
    } finally {
      if (requestId === requestIdRef.current) {
        setIsValidating(false);
        abortControllerRef.current = null;
      }
    }
  }

  return (
    <div className="grid gap-3">
      <div
        onDragEnter={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
            setIsDragging(false);
          }
        }}
        onDrop={(event) => {
          event.preventDefault();
          setIsDragging(false);
          void selectFile(event.dataTransfer.files[0]);
        }}
        aria-busy={isValidating}
        className={cn(
          "rounded-xl border border-dashed p-5 transition-colors sm:p-7",
          isDragging
            ? "border-primary bg-secondary/60"
            : "border-border bg-muted/35 hover:border-primary/50",
        )}
      >
        {isValidating ? (
          <div
            role="status"
            className="flex min-h-24 flex-col items-center justify-center gap-2 text-center text-sm text-muted-foreground"
          >
            <LoaderCircle
              aria-hidden="true"
              className="size-6 animate-spin text-primary motion-reduce:animate-none"
            />
            Checking the image on this device…
          </div>
        ) : image && previewUrl ? (
          <ImagePreview
            image={image}
            previewUrl={previewUrl}
            onReplace={() => inputRef.current?.click()}
            onRemove={removeImage}
          />
        ) : (
          <div className="flex flex-col items-center text-center">
            <span className="mb-3 flex size-12 items-center justify-center rounded-xl bg-secondary text-primary">
              {isDragging ? (
                <ImagePlus aria-hidden="true" className="size-6" />
              ) : (
                <FileImage aria-hidden="true" className="size-6" />
              )}
            </span>
            <p className="font-medium">Drop an image here</p>
            <p className="mt-1 text-sm text-muted-foreground">
              JPG, JPEG, PNG, or WebP · up to 10 MB
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={() => inputRef.current?.click()}
            >
              Choose image
            </Button>
          </div>
        )}
        <input
          ref={inputRef}
          type="file"
          accept={acceptedImageTypes}
          className="sr-only"
          aria-label="Choose a JPG, PNG, or WebP image"
          onChange={(event) => {
            void selectFile(event.currentTarget.files?.[0]);
            event.currentTarget.value = "";
          }}
        />
      </div>
      {error && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      )}
      <p className="text-xs leading-5 text-muted-foreground">
        Image checks and previews stay in this browser. The image is not
        uploaded or saved by SeekHelp.
      </p>
    </div>
  );
}
