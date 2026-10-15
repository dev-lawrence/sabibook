import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
  /** Lined exercise-book paper, good for handwriting such as transcripts. */
  ruled?: boolean;
  /** No padding, for cards split into their own sections. */
  flush?: boolean;
  className?: string;
};

/** A paper card with a hairline border, like a page torn from an exercise book. */
export function Card({ children, ruled, flush, className = "" }: Props) {
  return (
    <div
      className={`rounded-card border border-rule bg-card ${flush ? "" : "p-4"} ${ruled ? "ruled" : ""} ${className}`}
    >
      {children}
    </div>
  );
}
