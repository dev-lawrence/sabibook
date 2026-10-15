import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

const base =
  "inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl px-5 text-lg font-semibold " +
  "transition-[background-color,transform] duration-150 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 " +
  "focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-ink";

const variants: Record<ButtonVariant, string> = {
  primary: "bg-money text-white hover:bg-money/90",
  secondary: "border border-rule bg-card text-ink hover:bg-paper-deep",
  ghost: "text-ink-soft hover:bg-paper-deep",
  danger: "text-owed hover:bg-owed-soft",
};

type Props = {
  variant?: ButtonVariant;
  /** Stretch to the full width of the column. */
  full?: boolean;
  /** Renders a link instead of a button. */
  href?: string;
  children: ReactNode;
  className?: string;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className">;

/** Big, finger-friendly button. Pass `href` to make it a link. Min height 56px. */
export function Button({ variant = "primary", full, href, className = "", children, ...rest }: Props) {
  const cls = `${base} ${variants[variant]} ${full ? "w-full" : ""} ${className}`;
  if (href) {
    return (
      <Link href={href} className={cls}>
        {children}
      </Link>
    );
  }
  return (
    <button type="button" className={cls} {...rest}>
      {children}
    </button>
  );
}
