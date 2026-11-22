"use client";

import { Button } from "@/components/ui/button";

export default function Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main
      id="main-content"
      className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center px-5 py-20 text-center sm:px-8"
    >
      <h1 className="text-2xl font-semibold tracking-tight">
        This page could not be loaded
      </h1>
      <p className="mt-3 text-muted-foreground">
        Please try again. No message or image needs to be entered to continue.
      </p>
      <Button className="mt-6 self-center" onClick={() => reset()}>
        Try again
      </Button>
    </main>
  );
}
