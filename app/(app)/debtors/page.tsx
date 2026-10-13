"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowRight01Icon } from "@hugeicons/core-free-icons";
import { api } from "@/convex/_generated/api";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { MoneyFigure } from "@/components/ui/MoneyFigure";
import { StatusDots } from "@/components/ui/Spinner";

export default function DebtorsPage() {
  const debtors = useQuery(api.customers.debtors);
  const total = debtors?.reduce((sum, c) => sum + c.balance, 0) ?? 0;

  return (
    <main className="flex flex-col gap-6 pt-2">
      <header>
        <p className="text-base text-ink-soft">Total owed to you</p>
        <h1 className="text-4xl font-bold text-owed">
          {debtors ? <MoneyFigure amount={total} tone="owed" className="text-4xl" /> : <StatusDots />}
        </h1>
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
        <Card margin className="py-0">
          <ul>
            {debtors.map((c) => (
              <li key={c._id} className="border-b border-rule last:border-b-0">
                <Link
                  href={`/debtors/${c._id}`}
                  className="flex min-h-16 items-center justify-between gap-3 py-4 active:bg-paper-deep"
                >
                  <span className="min-w-0 truncate text-xl font-bold text-ink">{c.name}</span>
                  <span className="flex shrink-0 items-center gap-1">
                    <MoneyFigure amount={c.balance} tone="owed" />
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
