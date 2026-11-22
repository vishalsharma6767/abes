"use client";

import Image from "next/image";
import { RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ValidatedImage } from "@/lib/image-processing";

type ImagePreviewProps = {
  image: ValidatedImage;
  previewUrl: string;
  onReplace: () => void;
  onRemove: () => void;
};

export function ImagePreview({
  image,
  previewUrl,
  onReplace,
  onRemove,
}: ImagePreviewProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
      <div className="flex min-w-0 items-center gap-3">
        <div className="relative size-16 shrink-0 overflow-hidden rounded-lg bg-muted">
          <Image
            src={previewUrl}
            alt={`Preview of ${image.file.name}`}
            fill
            unoptimized
            sizes="64px"
            className="object-cover"
          />
        </div>
        <div className="min-w-0">
          <p className="truncate font-medium">{image.file.name}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {image.width.toLocaleString()} × {image.height.toLocaleString()} px
            {" · "}
            {(image.file.size / 1024 / 1024).toFixed(2)} MB
          </p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onReplace}>
          <RefreshCw aria-hidden="true" />
          Replace
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onRemove}
          aria-label="Remove selected image"
        >
          <X aria-hidden="true" />
          Remove
        </Button>
      </div>
    </div>
  );
}
