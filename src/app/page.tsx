import Link from "next/link";
import {
  ArrowRight,
  HeartHandshake,
  ImageUp,
  LockKeyhole,
  ScanLine,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const steps = [
  {
    icon: ImageUp,
    title: "Choose an image",
    description:
      "Select a PNG from your device. Image checks and processing happen in this browser.",
  },
  {
    icon: HeartHandshake,
    title: "Prepare a short message",
    description:
      "Choose a preset or short message, optionally add a location note, and encrypt it with a passphrase.",
  },
  {
    icon: ScanLine,
    title: "Recipient may attempt recovery",
    description:
      "Export the experimental PNG and share the passphrase separately. Image tools may remove its metadata.",
  },
];

export default function Home() {
  return (
    <main id="main-content" className="flex-1">
      <section className="relative overflow-hidden border-b border-border/70">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_75%_0%,oklch(0.9_0.04_165/0.55),transparent_50%)]"
        />
        <div className="relative mx-auto grid w-full max-w-6xl gap-10 px-5 py-14 sm:px-8 sm:py-20 lg:grid-cols-[1.15fr_0.85fr] lg:items-center lg:gap-16">
          <div className="max-w-2xl">
            <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-border bg-background/80 px-3 py-1.5 text-sm font-medium text-primary">
              A client-side test prototype
            </p>
            <h1 className="max-w-xl text-4xl font-semibold leading-tight tracking-tight text-foreground sm:text-5xl">
              A little more connection, when it matters.
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-8 text-muted-foreground">
              SeekHelp explores preparing an encrypted short message in an
              image and attempting to recover it in a browser. This experimental
              workflow is not a dependable way to ask for help.
            </p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg">
                <Link href="/encode">
                  Start encoding
                  <ArrowRight aria-hidden="true" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/decode">Decode a received image</Link>
              </Button>
            </div>
          </div>

          <Alert
            role="note"
            className="relative gap-3 border-primary/15 bg-card p-5 shadow-sm sm:p-6"
          >
            <HeartHandshake
              aria-hidden="true"
              className="mt-0.5 size-5 text-primary"
            />
            <div className="grid gap-2">
              <AlertTitle className="text-base">Prototype limitation</AlertTitle>
              <AlertDescription className="text-sm leading-6">
                The sender and recipient pages perform a local feasibility
                experiment. The visible metadata may be removed by image tools;
                no alert is sent and no receipt is verified. SeekHelp is not an
                emergency service or verified safety tool.
              </AlertDescription>
            </div>
          </Alert>
        </div>
      </section>

      <section
        aria-labelledby="how-it-works"
        className="mx-auto w-full max-w-6xl px-5 py-14 sm:px-8 sm:py-18"
      >
        <div className="mb-8 max-w-2xl">
          <p className="mb-2 text-sm font-semibold uppercase tracking-wide text-primary">
            How it could work
          </p>
          <h2
            id="how-it-works"
            className="text-2xl font-semibold tracking-tight sm:text-3xl"
          >
            A simple idea, being carefully explored
          </h2>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {steps.map(({ icon: Icon, title, description }, index) => (
            <Card key={title} className="h-full border-border/80 shadow-sm">
              <CardHeader>
                <div className="mb-3 flex size-11 items-center justify-center rounded-xl bg-secondary text-primary">
                  <Icon aria-hidden="true" className="size-5" />
                </div>
                <CardTitle className="text-base">
                  <span className="mr-2 text-sm font-medium text-muted-foreground">
                    0{index + 1}
                  </span>
                  {title}
                </CardTitle>
                <CardDescription className="text-sm leading-6">
                  {description}
                </CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      </section>

      <section
        id="privacy"
        aria-labelledby="privacy-heading"
        className="border-t border-border/70 bg-secondary/45"
      >
        <div className="mx-auto grid w-full max-w-6xl gap-4 px-5 py-12 sm:px-8 sm:py-16 md:grid-cols-[0.7fr_1.3fr] md:items-start">
          <div className="flex items-center gap-3">
            <LockKeyhole
              aria-hidden="true"
              className="size-6 shrink-0 text-primary"
            />
            <h2
              id="privacy-heading"
              className="text-2xl font-semibold tracking-tight"
            >
              Privacy is part of the plan.
            </h2>
          </div>
          <p className="max-w-2xl leading-7 text-muted-foreground">
            Images are processed in your browser and the prototype does not send
            them, passphrases, or messages to a service. Encryption cannot
            protect a compromised device, and visible image metadata may be
            removed. This is not a guarantee of safety.
          </p>
        </div>
      </section>
    </main>
  );
}
