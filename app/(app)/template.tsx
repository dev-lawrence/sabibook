import type { ReactNode } from "react";

/** Re-mounts on every navigation, so each screen eases in. The animation ends at
    `transform: none`, so it never leaves a containing block behind. */
export default function Template({ children }: { children: ReactNode }) {
  return <div className="page-enter">{children}</div>;
}
