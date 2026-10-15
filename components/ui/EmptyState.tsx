import type { ReactNode } from "react";

/** A friendly blank page: a short title, one line of help, and an optional action. */
export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-card border border-dashed border-rule px-6 py-10 text-center">
      <p className="text-xl font-semibold tracking-[-0.02em] text-ink">{title}</p>
      {body && <p className="max-w-xs text-base text-ink-soft">{body}</p>}
      {action}
    </div>
  );
}
