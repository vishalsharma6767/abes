import Link from "next/link";

export default function NotFound() {
  return (
    <main
      id="main-content"
      className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center px-5 py-20 text-center sm:px-8"
    >
      <p className="text-sm font-semibold uppercase tracking-wide text-primary">
        404
      </p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">
        We couldn&apos;t find that page
      </h1>
      <p className="mt-3 text-muted-foreground">
        The link may be out of date, or the page may have moved.
      </p>
      <Link
        href="/"
        className="mt-6 inline-flex min-h-11 items-center justify-center self-center rounded-md px-4 font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        Return to SeekHelp
      </Link>
    </main>
  );
}
