export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-border/80">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-5 py-6 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <p>SeekHelp is a prototype, not an emergency service.</p>
        <p>Local experiments do not send alerts or verify delivery.</p>
      </div>
    </footer>
  );
}
