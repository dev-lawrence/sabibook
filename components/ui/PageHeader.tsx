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
    <header className="flex flex-col gap-0.5 pb-4 pt-2">
      <div className="flex min-h-12 items-center gap-2">
        {backHref && (
          <Link
            href={backHref}
            aria-label="Go back"
            className="-ml-3 flex size-12 shrink-0 items-center justify-center rounded-full text-ink transition-colors duration-150 hover:bg-paper-deep active:bg-paper-deep"
          >
            <HugeiconsIcon icon={ArrowLeft01Icon} size={24} />
          </Link>
        )}
        <h1 className="min-w-0 flex-1 text-2xl font-semibold leading-tight tracking-[-0.02em] text-ink">{title}</h1>
        {action}
      </div>
      {subtitle && <p className={`text-base text-ink-soft ${backHref ? "pl-11" : ""}`}>{subtitle}</p>}
    </header>
  );
}
