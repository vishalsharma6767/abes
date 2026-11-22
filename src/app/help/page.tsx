import Link from "next/link";
import {
  ArrowUpRight,
  HeartHandshake,
  Info,
  Phone,
  ShieldCheck,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PageHeading } from "@/components/page-heading";

export default function HelpPage() {
  return (
    <main id="main-content" className="mx-auto w-full max-w-6xl flex-1 px-5 py-10 sm:px-8 sm:py-14">
      <PageHeading
        eyebrow="Help and resources"
        title="Find support that works for you"
        description="If you may be in immediate danger, consider contacting local emergency services or a trusted person when it is safe to do so."
      >
        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          Resource availability and emergency numbers depend on where you are.
          SeekHelp cannot determine your location or contact services for you.
        </p>
      </PageHeading>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="border-border/80 shadow-sm">
          <CardHeader>
            <div className="mb-2 flex size-11 items-center justify-center rounded-xl bg-secondary text-primary">
              <Phone aria-hidden="true" className="size-5" />
            </div>
            <CardTitle>Emergency services</CardTitle>
            <CardDescription className="leading-6">
              Use the emergency number for your area. 112 is available in some
              countries; check local guidance if you are unsure.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <Button asChild className="w-full sm:w-fit">
              <a href="tel:112">
                <Phone aria-hidden="true" />
                Call 112 (where available)
              </a>
            </Button>
            <p className="text-xs leading-5 text-muted-foreground">
              This link opens your device&apos;s call handler. SeekHelp does not
              dispatch assistance or confirm that a call connected.
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/80 shadow-sm">
          <CardHeader>
            <div className="mb-2 flex size-11 items-center justify-center rounded-xl bg-secondary text-primary">
              <HeartHandshake aria-hidden="true" className="size-5" />
            </div>
            <CardTitle>Talk with a support service</CardTitle>
            <CardDescription className="leading-6">
              A directory can help you find support lines and services by
              country. Availability and response times vary.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline" className="w-full sm:w-fit">
              <a
                href="https://findahelpline.com/"
                target="_blank"
                rel="noreferrer"
              >
                Find a helpline
                <ArrowUpRight aria-hidden="true" />
                <span className="sr-only">(opens in a new tab)</span>
              </a>
            </Button>
          </CardContent>
        </Card>

        <Card className="border-border/80 shadow-sm">
          <CardHeader>
            <div className="mb-2 flex size-11 items-center justify-center rounded-xl bg-secondary text-primary">
              <ShieldCheck aria-hidden="true" className="size-5" />
            </div>
            <CardTitle>Consider your immediate safety</CardTitle>
            <CardDescription className="leading-6">
              Choose what feels manageable for your situation. If using a
              device or seeking help could increase risk, pause and consider a
              safer time or a trusted person.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm leading-6 text-muted-foreground">
            If possible, reach out to someone you trust and agree on a way to
            check in. Avoid sharing more details than you want to.
          </CardContent>
        </Card>

        <Alert role="note" className="h-fit gap-3 border-primary/20 bg-secondary/40 p-5">
          <Info aria-hidden="true" className="mt-0.5 text-primary" />
          <div className="grid gap-2">
            <AlertTitle>Prototype disclaimer</AlertTitle>
            <AlertDescription className="leading-6">
              SeekHelp is an early prototype, not an emergency service,
              counseling provider, or verified safety tool. Its demo
              interactions may process content locally but do not send alerts or
              request assistance. External resources are independent of
              SeekHelp.
            </AlertDescription>
          </div>
        </Alert>
      </div>

      <p className="mt-8 text-sm text-muted-foreground">
        <Link
          href="/"
          className="rounded-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          Return to SeekHelp home
        </Link>
      </p>
    </main>
  );
}
