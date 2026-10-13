import type { ReactNode } from "react";
import Link from "next/link";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowLeft01Icon } from "@hugeicons/core-free-icons";

/** Page title with an optional back link and a right-hand action slot. */
export function PageHeader({
  title,
  subtitle,
  backHref,
  action,
}: {
  title: string;
  subtitle?: string;
  backHref?: string;
  action?: ReactNode;
}) {
  return (
    <header className="flex items-start gap-3 pb-4 pt-2">
      {backHref && (
        <Link
          href={backHref}
          aria-label="Go back"
          className="-ml-2 flex size-12 shrink-0 items-center justify-center rounded-full text-ink hover:bg-paper-deep"
        >
          <HugeiconsIcon icon={ArrowLeft01Icon} size={26} />
        </Link>
      )}
      <div className="min-w-0 flex-1">
        <h1 className="text-2xl font-bold leading-tight text-ink">{title}</h1>
        {subtitle && <p className="mt-0.5 text-base text-ink-soft">{subtitle}</p>}
      </div>
      {action}
    </header>
  );
}
