export default function Loading() {
  return (
    <main
      id="main-content"
      aria-busy="true"
      aria-live="polite"
      className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-5 py-16 sm:px-8 sm:py-24"
    >
      <span className="sr-only">Loading SeekHelp</span>
      <div
        aria-hidden="true"
        className="h-10 w-48 animate-pulse rounded-full bg-muted motion-reduce:animate-none"
      />
      <div className="h-14 w-full max-w-2xl animate-pulse rounded-lg bg-muted motion-reduce:animate-none" />
      <div className="h-6 w-full max-w-xl animate-pulse rounded-lg bg-muted motion-reduce:animate-none" />
      <div className="mt-8 grid gap-4 md:grid-cols-3">
        {[1, 2, 3].map((item) => (
          <div
            key={item}
            aria-hidden="true"
            className="h-44 animate-pulse rounded-xl border border-border bg-card motion-reduce:animate-none"
          />
        ))}
      </div>
    </main>
  );
}
