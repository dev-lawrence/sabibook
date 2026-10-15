"use client";

import type { CSSProperties } from "react";
import Link from "next/link";
import { useQuery } from "convex/react";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowRight01Icon } from "@hugeicons/core-free-icons";
import { api } from "@/convex/_generated/api";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { MoneyFigure } from "@/components/ui/MoneyFigure";
import { StatusDots } from "@/components/ui/Spinner";

/** "Mama Ngozi" -> "MN", "Emeka" -> "EM". */
function initials(name: string): string {
  const words = name.trim().split(/\s+/);
  const letters = words.length > 1 ? words[0][0] + words[1][0] : name.slice(0, 2);
  return letters.toUpperCase();
}

export default function DebtorsPage() {
  const debtors = useQuery(api.customers.debtors);
  const total = debtors?.reduce((sum, c) => sum + c.balance, 0) ?? 0;

  return (
    <main className="flex flex-col gap-6 pt-2">
      <header className="flex flex-col gap-3">
        <h1 className="text-3xl font-semibold tracking-[-0.03em] text-ink">Debtors</h1>
        <div>
          <p className="text-sm font-medium text-ink-soft">Total owed to you</p>
          <p className="mt-1">
            {debtors ? <MoneyFigure amount={total} tone="owed" size="xl" /> : <StatusDots />}
          </p>
          {debtors && debtors.length > 0 && (
            <p className="mt-2 text-sm text-ink-soft">
              {debtors.length === 1 ? "1 customer" : `${debtors.length} customers`} still owe you
            </p>
          )}
        </div>
      </header>

      {debtors === undefined ? (
        <div className="py-10 text-center">
          <StatusDots label="Loading debtors" />
        </div>
      ) : debtors.length === 0 ? (
        <EmptyState
          title="Nobody owes you right now."
          body="When a customer takes goods on credit, they will show up here. Well done for keeping your book clean."
        />
      ) : (
        <Card className="py-0">
          <ul>
            {debtors.map((c, i) => (
              <li
                key={c._id}
                className="enter border-b border-rule/70 last:border-b-0"
                style={{ "--i": i } as CSSProperties}
              >
                <Link
                  href={`/debtors/${c._id}`}
                  className="-mx-2 flex min-h-16 items-center gap-3 rounded-xl px-2 py-3.5 transition-colors duration-150 active:bg-paper-deep"
                >
                  <span
                    aria-hidden
                    className="flex size-10 shrink-0 items-center justify-center rounded-full bg-owed-soft text-[0.9375rem] font-semibold text-owed"
                  >
                    {initials(c.name)}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[1.0625rem] font-semibold tracking-[-0.01em] text-ink">
                    {c.name}
                  </span>
                  <span className="flex shrink-0 items-center gap-1">
                    <MoneyFigure amount={c.balance} tone="owed" size="row" />
                    <HugeiconsIcon icon={ArrowRight01Icon} size={22} className="text-ink-soft" />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </main>
  );
}
