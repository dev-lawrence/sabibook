import type { InputHTMLAttributes, ReactNode } from "react";

/** Shared look for inputs, textareas and selects. Flagged fields turn yellow. */
export function fieldClass(flagged?: boolean): string {
  return (
    "min-h-14 w-full rounded-xl border px-4 transition-colors duration-150 py-3 text-lg text-ink placeholder:text-ink-soft/70 " +
    "focus:outline-3 focus:outline-offset-1 focus:outline-ink " +
    (flagged ? "border-flag-ink/60 bg-flag" : "border-rule bg-card")
  );
}

/** A label, the control, and (if flagged) the reason in flag-ink under it. */
export function Field({
  label,
  htmlFor,
  flag,
  hint,
  children,
}: {
  label: string;
  htmlFor?: string;
  /** Message from the server flags for this field. */
  flag?: string | null;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-base font-semibold text-ink">
        {label}
      </label>
      {children}
      {hint && !flag && <p className="text-sm text-ink-soft">{hint}</p>}
      {flag && (
        <p role="alert" className="text-base font-medium text-flag-ink">
          {flag}
        </p>
      )}
    </div>
  );
}

/** A text-like input styled for the ledger. Set `flagged` to highlight it. */
export function Input({
  flagged,
  className = "",
  ...rest
}: { flagged?: boolean } & InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`${fieldClass(flagged)} ${className}`} {...rest} />;
}
