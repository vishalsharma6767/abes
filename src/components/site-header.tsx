import Link from "next/link";
import { HeartHandshake } from "lucide-react";

const navigation = [
  { href: "/", label: "Home" },
  { href: "/encode", label: "Encode" },
  { href: "/decode", label: "Decode" },
  { href: "/help", label: "Help" },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-border/80 bg-background/95 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <Link
          href="/"
          className="inline-flex min-h-10 w-fit items-center gap-2 rounded-md text-lg font-semibold tracking-tight text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="SeekHelp home"
        >
          <HeartHandshake aria-hidden="true" className="size-6 text-primary" />
          SeekHelp
        </Link>
        <nav aria-label="Main navigation">
          <ul className="flex flex-wrap items-center gap-x-2 gap-y-0.5 sm:gap-x-4">
            {navigation.map(({ href, label }) => (
              <li key={href}>
                <Link
                  href={href}
                  className="inline-flex min-h-10 items-center rounded-md px-2 text-sm font-medium text-muted-foreground underline-offset-4 outline-none transition-colors hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </header>
  );
}
