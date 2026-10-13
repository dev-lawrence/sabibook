import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
  /** Lined exercise-book paper, good for handwriting such as transcripts. */
  ruled?: boolean;
  /** Red margin line down the left edge, used for lists of entries. */
  margin?: boolean;
  className?: string;
};

/** A paper card with a soft border, like a page torn from an exercise book. */
export function Card({ children, ruled, margin, className = "" }: Props) {
  return (
    <div
      className={`rounded-card border border-rule bg-card p-4 ${ruled ? "ruled" : ""} ${
        margin ? "margin-rule pl-5" : ""
      } ${className}`}
    >
      {children}
    </div>
  );
}
