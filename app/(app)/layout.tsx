"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { api } from "@/convex/_generated/api";
import { BottomNav } from "@/components/ui/BottomNav";
import { todayISO } from "@/lib/dates";

/** The signed-in shell: a narrow phone-style column with the bottom tab bar. */
export default function AppLayout({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useConvexAuth();
  const ensure = useMutation(api.profile.ensure);
  const me = useQuery(api.profile.me);
  const { signOut } = useAuthActions();
  const router = useRouter();
  const ensured = useRef(false);

  // Make sure a profile exists (and seed the demo book for guests) once per visit.
  useEffect(() => {
    if (!isAuthenticated || ensured.current) return;
    ensured.current = true;
    ensure({ today: todayISO() }).catch(() => {
      ensured.current = false;
    });
  }, [isAuthenticated, ensure]);

  async function leaveDemo() {
    await signOut();
    router.replace("/signin");
  }

  return (
    <div className="mx-auto min-h-dvh max-w-md px-4 pb-[calc(6.5rem+env(safe-area-inset-bottom))] pt-[max(0.5rem,env(safe-area-inset-top))]">
      {me?.isAnonymous && (
        <div className="-mx-4 mb-2 flex items-center justify-between gap-3 bg-paper-deep px-4 py-1.5 text-sm text-ink-soft">
          <span>Guest demo. Sample sales are in your book.</span>
          <button
            type="button"
            onClick={leaveDemo}
            className="min-h-10 shrink-0 font-semibold text-ink underline underline-offset-4"
          >
            Leave demo
          </button>
        </div>
      )}
      {children}
      <BottomNav />
    </div>
  );
}
