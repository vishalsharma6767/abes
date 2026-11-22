import type { ReactNode } from "react";

type PageHeadingProps = {
  eyebrow: string;
  title: string;
  description: string;
  children?: ReactNode;
};

export function PageHeading({
  eyebrow,
  title,
  description,
  children,
}: PageHeadingProps) {
  return (
    <div className="mb-8 max-w-2xl">
      <p className="mb-2 text-sm font-semibold uppercase tracking-wide text-primary">
        {eyebrow}
      </p>
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
        {title}
      </h1>
      <p className="mt-3 text-base leading-7 text-muted-foreground">
        {description}
      </p>
      {children}
    </div>
  );
}
