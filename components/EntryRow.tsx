import Link from "next/link";
import type { Doc } from "@/convex/_generated/dataModel";
import { MoneyFigure } from "@/components/ui/MoneyFigure";
import { ENTRY_TYPE_LABEL, formatNaira, isMoneyIn, summariseItems } from "@/lib/format";
import { formatDayLabel } from "@/lib/dates";

type EntryLike = Pick<Doc<"entries">, "type" | "items" | "total" | "balance" | "occurredOn"> & {
  customerName?: string | null;
};

/** One line of the ledger: type, who, what, amount, and an amber badge if money is still owed. */
export function EntryRow({ entry, showDate, href }: { entry: EntryLike; showDate?: boolean; href?: string }) {
  const detail = summariseItems(entry.items);
  const owed = entry.balance !== null && entry.balance > 0;
  const content = (
    <>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-ink-soft">
          {ENTRY_TYPE_LABEL[entry.type]}
          {showDate ? ` · ${formatDayLabel(entry.occurredOn)}` : ""}
        </p>
        <p className="truncate text-lg font-bold text-ink">{entry.customerName ?? "No name"}</p>
        {detail && <p className="truncate text-base text-ink-soft">{detail}</p>}
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <MoneyFigure amount={entry.total} tone={isMoneyIn(entry.type) ? "money" : "ink"} />
        {owed && (
          <span className="tabular rounded-full bg-owed-soft px-2.5 py-0.5 text-sm font-bold text-owed">
            Owes {formatNaira(entry.balance)}
          </span>
        )}
      </div>
    </>
  );
  return (
    <li className="border-b border-rule last:border-b-0">
      {href ? (
        <Link href={href} className="flex min-h-14 items-start justify-between gap-3 py-3 active:bg-paper-deep">
          {content}
        </Link>
      ) : (
        <div className="flex items-start justify-between gap-3 py-3">{content}</div>
      )}
    </li>
  );
}
