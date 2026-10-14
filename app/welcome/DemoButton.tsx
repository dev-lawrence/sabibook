"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthActions } from "@convex-dev/auth/react";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowRight02Icon } from "@hugeicons/core-free-icons";
import { Spinner } from "@/components/ui/Spinner";

/** Signs in as a guest with a sample book, the same as "Try the demo" on /signin. */
export function DemoButton({ size = "large" }: { size?: "large" | "small" }) {
  const { signIn } = useAuthActions();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function start() {
    setBusy(true);
    setFailed(false);
    try {
      await signIn("anonymous");
      // `/` now resolves to the app home instead of this page.
      router.replace("/");
      router.refresh();
    } catch {
      setFailed(true);
      setBusy(false);
    }
  }

  const small = size === "small";
  return (
    <span className="inline-flex flex-col gap-2">
      <button
        type="button"
        onClick={start}
        disabled={busy}
        className={`group inline-flex items-center justify-center gap-2 rounded-full bg-record font-semibold text-white transition-colors hover:bg-record-deep focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:opacity-70 ${
          small ? "min-h-10 px-4 text-[0.9375rem]" : "min-h-14 px-7 text-lg"
        }`}
      >
        {busy ? <Spinner size={small ? 16 : 20} /> : null}
        Try the demo
        {!small && !busy && (
          <HugeiconsIcon
            icon={ArrowRight02Icon}
            size={20}
            className="transition-transform duration-300 group-hover:translate-x-0.5 motion-reduce:transition-none"
          />
        )}
      </button>
      {failed && (
        <span role="alert" className="text-sm text-owed">
          The demo did not open. Check your network and try again.
        </span>
      )}
    </span>
  );
}
