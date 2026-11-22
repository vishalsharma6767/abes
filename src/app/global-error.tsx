"use client";

import { Button } from "@/components/ui/button";
import "./globals.css";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="flex min-h-screen items-center justify-center bg-background px-5 text-foreground">
        <main className="w-full max-w-lg text-center">
          <h1 className="text-2xl font-semibold tracking-tight">
            SeekHelp could not start
          </h1>
          <p className="mt-3 text-muted-foreground">
            Please try loading the page again.
          </p>
          <Button className="mt-6" onClick={() => reset()}>
            Try again
          </Button>
        </main>
      </body>
    </html>
  );
}
