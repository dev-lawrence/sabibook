import type { Doc } from "@/convex/_generated/dataModel";
import { MoneyFigure } from "@/components/ui/MoneyFigure";
import { ENTRY_TYPE_LABEL, formatNaira, isMoneyIn, summariseItems } from "@/lib/format";
import { formatDayLabel } from "@/lib/dates";

type EntryLike = Pick<Doc<"entries">, "type" | "items" | "total" | "balance" | "occurredOn"> & {
  customerName?: string | null;
};

/** One line of the ledger: type, who, what, amount, and an amber badge if money is still owed. */
export function EntryRow({ entry, showDate }: { entry: EntryLike; showDate?: boolean }) {
  const detail = summariseItems(entry.items);
  const owed = entry.balance !== null && entry.balance > 0;
  return (
    <li className="flex items-start justify-between gap-3 border-b border-rule py-3 last:border-b-0">
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
    </li>
  );
}
