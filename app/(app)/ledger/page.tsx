"use client";

import { useMemo, useState, type CSSProperties } from "react";
import { useQuery, usePaginatedQuery } from "convex/react";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowLeft01Icon, ArrowRight01Icon } from "@hugeicons/core-free-icons";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { EntryRow } from "@/components/EntryRow";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { MoneyFigure } from "@/components/ui/MoneyFigure";
import { StatusDots } from "@/components/ui/Spinner";
import { formatNaira, isMoneyIn } from "@/lib/format";
import { formatDayLabel, shiftISO, todayISO } from "@/lib/dates";

type Tab = "day" | "week";

export default function LedgerPage() {
  const [tab, setTab] = useState<Tab>("day");
  return (
    <main className="flex flex-col gap-5 pt-2">
      <h1 className="text-3xl font-semibold tracking-[-0.03em] text-ink">Ledger</h1>
      <div role="tablist" aria-label="Ledger view" className="grid grid-cols-2 gap-1 rounded-2xl bg-paper-deep p-1">
        {(
          [
            ["day", "By day"],
            ["week", "This week"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={`min-h-14 rounded-xl text-lg font-semibold transition-colors duration-150 ${
              tab === key ? "bg-card text-ink" : "text-ink-soft"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === "day" ? <ByDay /> : <ThisWeek />}
    </main>
  );
}

type LedgerEntry = Doc<"entries">;

/** Cash that actually moved: sales count what was paid, not what is still owed. */
function moneyIn(e: LedgerEntry): number {
  if (e.type === "sale") return e.paid ?? e.total ?? 0;
  return isMoneyIn(e.type) ? (e.total ?? 0) : 0;
}
function moneyOut(e: LedgerEntry): number {
  return isMoneyIn(e.type) ? 0 : (e.total ?? 0);
}

function ByDay() {
  const { results, status, loadMore } = usePaginatedQuery(api.entries.ledger, {}, { initialNumItems: 30 });

  const days = useMemo(() => {
    const out: { date: string; entries: LedgerEntry[] }[] = [];
    for (const e of results) {
      const last = out[out.length - 1];
      if (last && last.date === e.occurredOn) last.entries.push(e);
      else out.push({ date: e.occurredOn, entries: [e] });
    }
    return out;
  }, [results]);

  if (status === "LoadingFirstPage") {
    return (
      <div className="py-10 text-center">
        <StatusDots />
      </div>
    );
  }
  if (days.length === 0) {
    return (
      <EmptyState
        title="Nothing in your book yet"
        body="Press the red record button on Home and say your first sale."
        action={<Button href="/">Go to Home</Button>}
      />
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {days.map((day, i) => {
        const inSum = day.entries.reduce((s, e) => s + moneyIn(e), 0);
        const outSum = day.entries.reduce((s, e) => s + moneyOut(e), 0);
        return (
          <section
            key={day.date}
            aria-label={formatDayLabel(day.date)}
            className="enter"
            style={{ "--i": i } as CSSProperties}
          >
            <div className="sticky top-0 z-10 flex items-baseline justify-between gap-3 bg-paper py-2">
              <h2 className="text-lg font-semibold tracking-[-0.02em] text-ink">{formatDayLabel(day.date)}</h2>
              <p className="tabular text-sm font-semibold">
                <span className="text-money">In {formatNaira(inSum)}</span>
                <span className="text-ink-soft">{"  "}Out {formatNaira(outSum)}</span>
              </p>
            </div>
            <Card className="py-1">
              <ul>
                {day.entries.map((e) => (
                  <EntryRow key={e._id} entry={e} href={`/entry/${e._id}`} />
                ))}
              </ul>
            </Card>
          </section>
        );
      })}
      {status === "CanLoadMore" && (
        <Button variant="secondary" full onClick={() => loadMore(30)}>
          Load more
        </Button>
      )}
      {status === "LoadingMore" && (
        <div className="py-4 text-center">
          <StatusDots />
        </div>
      )}
    </div>
  );
}

function ThisWeek() {
  const today = todayISO();
  const [offset, setOffset] = useState(0); // 0 = week ending today, 1 = week before, ...
  const to = shiftISO(today, -7 * offset);
  const from = shiftISO(to, -6);
  const rows = useQuery(api.totals.range, { from, to });

  const days = (() => {
    const byDate = new Map((rows ?? []).map((r) => [r.date, r]));
    return Array.from({ length: 7 }, (_, i) => {
      const date = shiftISO(from, i);
      const r = byDate.get(date);
      return { date, sales: r?.sales ?? 0, cashIn: r?.cashIn ?? 0, spent: (r?.expenses ?? 0) + (r?.stock ?? 0) };
    });
  })();

  const totalSales = days.reduce((s, d) => s + d.sales, 0);
  const totalCash = days.reduce((s, d) => s + d.cashIn, 0);
  const totalSpent = days.reduce((s, d) => s + d.spent, 0);
  const best = days.reduce((b, d) => (d.sales > b.sales ? d : b), days[0]);
  const max = Math.max(1, ...days.flatMap((d) => [d.sales, d.spent]));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          aria-label="Earlier week"
          onClick={() => setOffset((o) => o + 1)}
          className="flex size-14 items-center justify-center rounded-2xl border border-rule bg-card text-ink transition-colors duration-150 hover:bg-paper-deep active:bg-paper-deep"
        >
          <HugeiconsIcon icon={ArrowLeft01Icon} size={26} />
        </button>
        <p className="text-center text-base font-semibold text-ink">
          {offset === 0 ? "Last 7 days" : `${formatDayLabel(from)} to ${formatDayLabel(to)}`}
        </p>
        <button
          type="button"
          aria-label="Later week"
          disabled={offset === 0}
          onClick={() => setOffset((o) => Math.max(0, o - 1))}
          className="flex size-14 items-center justify-center rounded-2xl border border-rule bg-card text-ink transition-colors duration-150 hover:bg-paper-deep active:bg-paper-deep disabled:opacity-30"
        >
          <HugeiconsIcon icon={ArrowRight01Icon} size={26} />
        </button>
      </div>

      {rows === undefined ? (
        <div className="py-10 text-center">
          <StatusDots />
        </div>
      ) : (
        <>
          <Card>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
              <div className="col-span-2">
                <dt className="text-sm font-semibold text-ink-soft">Total sales</dt>
                <dd>
                  <MoneyFigure amount={totalSales} tone="money" size="lg" />
                </dd>
              </div>
              <div>
                <dt className="text-sm font-semibold text-ink-soft">Cash in</dt>
                <dd>
                  <MoneyFigure amount={totalCash} tone="money" />
                </dd>
              </div>
              <div>
                <dt className="text-sm font-semibold text-ink-soft">Spent</dt>
                <dd>
                  <MoneyFigure amount={totalSpent} tone="owed" />
                </dd>
              </div>
              <div className="col-span-2 border-t border-rule pt-3">
                <dt className="text-sm font-semibold text-ink-soft">Best day</dt>
                <dd className="text-lg font-semibold text-ink">
                  {best.sales > 0 ? `${formatDayLabel(best.date)}, ${formatNaira(best.sales)}` : "No sales yet"}
                </dd>
              </div>
            </dl>
          </Card>

          <Card>
            <ul className="flex flex-col gap-4">
              {days.map((d) => (
                <li key={d.date}>
                  <div className="mb-1 text-sm font-semibold text-ink-soft">{formatDayLabel(d.date)}</div>
                  <div className="flex flex-col gap-1">
                    <Bar value={d.sales} max={max} color="bg-money" thick />
                    <Bar value={d.spent} max={max} color="bg-owed" />
                  </div>
                </li>
              ))}
            </ul>
            <p className="mt-4 flex gap-4 text-sm text-ink-soft">
              <span className="flex items-center gap-1.5">
                <span className="inline-block size-3 rounded-sm bg-money" /> Sales
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block size-3 rounded-sm bg-owed" /> Spent
              </span>
            </p>
          </Card>
        </>
      )}
    </div>
  );
}

function Bar({ value, max, color, thick }: { value: number; max: number; color: string; thick?: boolean }) {
  const pct = value > 0 ? Math.max(2, Math.round((value / max) * 100)) : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1">
        <div className={`${color} ${thick ? "h-4" : "h-2"} rounded-full transition-[width] duration-300 ease-out`} style={{ width: `${pct}%` }} />
      </div>
      <span
        className={`tabular w-24 shrink-0 text-right ${thick ? "text-base font-semibold text-ink" : "text-sm font-semibold text-owed"}`}
      >
        {formatNaira(value)}
      </span>
    </div>
  );
}
