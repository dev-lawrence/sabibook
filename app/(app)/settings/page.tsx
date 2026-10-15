"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowRight01Icon } from "@hugeicons/core-free-icons";
import { api } from "@/convex/_generated/api";
import { LANGUAGES, type Language } from "@/convex/model/languages";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusDots } from "@/components/ui/Spinner";
import { formatNaira } from "@/lib/format";

const ORDER: Language[] = ["en", "pcm", "yo", "ha", "ig"];

export default function SettingsPage() {
  const profile = useQuery(api.profile.me);
  const update = useMutation(api.profile.update);
  const { signOut } = useAuthActions();
  const router = useRouter();

  const [draftName, setName] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  function flashSaved() {
    setSaved(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setSaved(false), 2000);
  }

  async function save(patch: { language?: Language; businessName?: string }) {
    setError(null);
    try {
      await update(patch);
      flashSaved();
    } catch {
      setError("Could not save. Check your network and try again.");
    }
  }

  if (profile === undefined) {
    return (
      <main className="py-16 text-center">
        <StatusDots />
      </main>
    );
  }
  if (profile === null) return null;
  const name = draftName ?? profile.businessName ?? "";

  return (
    <main className="flex flex-col gap-6">
      <PageHeader title="Settings" action={<p aria-live="polite" className="pt-2 text-base font-semibold text-money">{saved ? "Saved" : ""}</p>} />
      {error && (
        <p role="alert" className="rounded-xl bg-flag px-4 py-3 text-base font-medium text-flag-ink">
          {error}
        </p>
      )}

      <Card>
        <Field label="Business name" htmlFor="biz" hint="Shown on receipts and reminders.">
          <Input
            id="biz"
            value={name}
            maxLength={80}
            autoComplete="organization"
            onChange={(e) => setName(e.target.value)}
            onBlur={() => {
              const next = name.trim();
              if (next !== (profile.businessName ?? "")) void save({ businessName: next });
            }}
          />
        </Field>
      </Card>

      <section aria-labelledby="lang-h" className="flex flex-col gap-2">
        <h2 id="lang-h" className="text-lg font-semibold tracking-[-0.02em] text-ink">Language you speak</h2>
        <div role="radiogroup" aria-labelledby="lang-h" className="flex flex-col gap-2">
          {ORDER.map((code) => {
            const l = LANGUAGES[code];
            const on = profile.language === code;
            return (
              <button
                key={code}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => {
                  if (!on) void save({ language: code });
                }}
                className={`flex min-h-14 items-center gap-3 rounded-2xl border px-4 text-left text-lg font-semibold transition-colors duration-150 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-ink ${
                  on ? "border-ink bg-ink text-paper" : "border-rule bg-card text-ink hover:bg-paper-deep"
                }`}
              >
                <span
                  className={`flex size-6 shrink-0 items-center justify-center rounded-full border transition-colors duration-150 ${
                    on ? "border-paper" : "border-ink-soft"
                  }`}
                >
                  {on && <span className="pop-in size-3 rounded-full bg-paper" />}
                </span>
                <span className="flex-1">{l.label}</span>
                {l.beta && (
                  <span className={`text-sm font-medium ${on ? "text-paper/70" : "text-flag-ink"}`}>Beta</span>
                )}
              </button>
            );
          })}
        </div>
        <p className="text-sm text-ink-soft">
          Yorùbá, Hausa and Igbo are in beta. Speech recognition is less accurate, so check each draft before you save.
        </p>
      </section>

      <Card>
        <p className="text-base font-semibold text-ink">Currency</p>
        <p className="mt-1 text-lg font-semibold text-ink">Nigerian naira (₦)</p>
        <p className="tabular text-base text-ink-soft">Example: {formatNaira(45000)}</p>
      </Card>

      <Link
        href="/how-it-works"
        className="flex min-h-14 items-center justify-between rounded-2xl border border-rule bg-card px-4 text-lg font-semibold text-ink transition-colors duration-150 hover:bg-paper-deep active:bg-paper-deep"
      >
        How SabiBook works
        <HugeiconsIcon icon={ArrowRight01Icon} size={22} />
      </Link>

      <Card>
        <h2 className="text-lg font-semibold tracking-[-0.02em] text-ink">Account</h2>
        <p className="mb-3 mt-1 text-base text-ink-soft">
          {profile.isAnonymous
            ? "You are using a guest demo book. Leave the demo when you are done looking around."
            : "You are signed in."}
        </p>
        <Button
          variant="secondary"
          full
          onClick={async () => {
            await signOut();
            router.push("/signin");
          }}
        >
          {profile.isAnonymous ? "Leave demo" : "Sign out"}
        </Button>
      </Card>
    </main>
  );
}
