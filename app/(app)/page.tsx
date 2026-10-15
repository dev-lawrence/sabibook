"use client";

import type { CSSProperties } from "react";
import Link from "next/link";
import { useQuery } from "convex/react";
import { HugeiconsIcon } from "@hugeicons/react";
import { KeyboardIcon, ArrowRight01Icon } from "@hugeicons/core-free-icons";
import { api } from "@/convex/_generated/api";
import { LogoMark } from "@/components/Logo";
import { RecordButton } from "@/components/RecordButton";
import { EntryRow } from "@/components/EntryRow";
import { Card } from "@/components/ui/Card";
import { MoneyFigure } from "@/components/ui/MoneyFigure";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusDots } from "@/components/ui/Spinner";
import { ENTRY_TYPE_LABEL, formatNaira } from "@/lib/format";
import { todayISO } from "@/lib/dates";

export default function HomePage() {
  // Date is read once on the client; the page is a client component rendered after hydration.
  const today = todayISO();
  const totals = useQuery(api.totals.day, { date: today });
  const drafts = useQuery(api.entries.drafts);
  const recent = useQuery(api.entries.recent, { limit: 8 });
  const profile = useQuery(api.profile.me);
  const dateLabel = new Date().toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });

  return (
    <main className="flex flex-col gap-6 pt-2">
      <header className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <LogoMark size={28} className="shrink-0" />
          <p className="truncate text-[0.9375rem] font-medium text-ink-soft">{profile?.businessName ?? "Your book"}</p>
        </div>
        <p className="shrink-0 text-sm text-ink-soft">{dateLabel}</p>
      </header>

      <section aria-labelledby="today-heading" className="flex flex-col gap-3">
        <h1 id="today-heading" className="text-3xl font-semibold tracking-[-0.03em] text-ink">
          Today
        </h1>
        <Card flush>
          <dl>
            <div className="px-5 pb-4 pt-5">
              <dt className="text-sm font-medium text-ink-soft">Owed to you</dt>
              <dd className="mt-1">
                {totals ? (
                  <MoneyFigure amount={totals.owedToYou} tone="owed" size="xl" />
                ) : (
                  <StatusDots />
                )}
              </dd>
            </div>
            <div className="grid grid-cols-2 border-t border-rule/70">
              <div className="px-5 py-4">
                <dt className="text-sm font-medium text-ink-soft">Sales today</dt>
                <dd className="mt-0.5">{totals ? <MoneyFigure amount={totals.sales} tone="money" size="md" /> : <StatusDots />}</dd>
              </div>
              <div className="border-l border-rule/70 px-5 py-4">
                <dt className="text-sm font-medium text-ink-soft">Spent today</dt>
                <dd className="mt-0.5">
                  {totals ? <MoneyFigure amount={totals.expenses + totals.stock} size="md" /> : <StatusDots />}
                </dd>
              </div>
            </div>
          </dl>
        </Card>
      </section>

      <section className="flex flex-col items-center gap-2 py-2">
        <RecordButton />
        <p className="max-w-xs text-center text-sm text-ink-soft">
          Try saying: &ldquo;I sold three bags of rice to Mama Ngozi for 45k, she paid 35k&rdquo;
        </p>
        <Link
          href="/type"
          className="mt-1 inline-flex min-h-12 items-center gap-2 px-4 text-base font-semibold text-ink underline underline-offset-4 transition-colors duration-150 hover:text-ink-soft"
        >
          <HugeiconsIcon icon={KeyboardIcon} size={22} />
          Type it instead
        </Link>
      </section>

      {drafts && drafts.length > 0 && (
        <section aria-labelledby="drafts-heading" className="flex flex-col gap-2">
          <h2 id="drafts-heading" className="text-lg font-semibold tracking-[-0.02em] text-ink">
            Waiting for you to confirm
          </h2>
          <ul className="flex flex-col gap-2">
            {drafts.map((d, i) => (
              <li key={d._id} className="enter" style={{ "--i": i } as CSSProperties}>
                <Link
                  href={d.voiceNoteId ? `/note/${d.voiceNoteId}` : "/"}
                  className="flex min-h-14 items-center justify-between gap-3 rounded-2xl border border-flag-ink/30 bg-flag px-4 py-2 text-flag-ink transition-[filter,transform] duration-150 active:scale-[0.99] active:brightness-95"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-base font-semibold">
                      {ENTRY_TYPE_LABEL[d.type]}
                      {d.customerName ? `, ${d.customerName}` : ""}
                    </span>
                    <span className="tabular block text-sm">{formatNaira(d.total)}</span>
                  </span>
                  <HugeiconsIcon icon={ArrowRight01Icon} size={22} />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="recent-heading" className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between">
          <h2 id="recent-heading" className="text-lg font-semibold tracking-[-0.02em] text-ink">
            Recent entries
          </h2>
          <Link href="/ledger" className="min-h-12 content-center text-base font-semibold text-ink underline underline-offset-4">
            See all
          </Link>
        </div>
        {recent === undefined ? (
          <div className="py-6 text-center">
            <StatusDots />
          </div>
        ) : recent.length === 0 ? (
          <EmptyState
            title="Your book is empty"
            body="Press the red button and say your first sale. It takes a few seconds."
          />
        ) : (
          <Card className="py-1">
            <ul>
              {recent.map((e, i) => (
                <EntryRow key={e._id} entry={e} showDate index={i} href={`/entry/${e._id}`} />
              ))}
            </ul>
          </Card>
        )}
      </section>
    </main>
  );
}
