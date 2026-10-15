import type { CSSProperties } from "react";
import Link from "next/link";
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";
import { MoneyReceive02Icon, Package01Icon, ReceiptIcon, ShoppingBag01Icon } from "@hugeicons/core-free-icons";
import type { Doc } from "@/convex/_generated/dataModel";
import { MoneyFigure } from "@/components/ui/MoneyFigure";
import { ENTRY_TYPE_LABEL, formatNaira, isMoneyIn, summariseItems, type EntryType } from "@/lib/format";
import { formatDayLabel } from "@/lib/dates";

type EntryLike = Pick<Doc<"entries">, "type" | "items" | "total" | "balance" | "occurredOn"> & {
  customerName?: string | null;
};

const TYPE_ICON: Record<EntryType, IconSvgElement> = {
  sale: ShoppingBag01Icon,
  payment_received: MoneyReceive02Icon,
  expense: ReceiptIcon,
  stock_purchase: Package01Icon,
};

/** One line of the ledger: a type icon, who and what, the amount, and what is still owed. */
export function EntryRow({ entry, showDate, href, index }: { entry: EntryLike; showDate?: boolean; href?: string; index?: number }) {
  const detail = summariseItems(entry.items);
  const owed = entry.balance !== null && entry.balance > 0;
  const moneyIn = isMoneyIn(entry.type);
  // The icon shows the type, so the line under the name leads with the date and what was sold.
  const meta = [showDate ? formatDayLabel(entry.occurredOn) : null, detail || ENTRY_TYPE_LABEL[entry.type]]
    .filter(Boolean)
    .join(" · ");
  const content = (
    <>
      <span
        aria-hidden
        className={`mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-full ${
          moneyIn ? "bg-money-soft text-money" : "bg-paper-deep text-ink-soft"
        }`}
      >
        <HugeiconsIcon icon={TYPE_ICON[entry.type]} size={20} strokeWidth={1.8} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[1.0625rem] font-semibold tracking-[-0.01em] text-ink">
          {entry.customerName ?? "No name"}
        </p>
        <p className="truncate text-sm text-ink-soft">
          <span className="sr-only">{ENTRY_TYPE_LABEL[entry.type]}, </span>
          {meta}
        </p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-0.5 pt-0.5">
        <MoneyFigure amount={entry.total} tone={moneyIn ? "money" : "ink"} size="row" />
        {owed && <span className="tabular text-sm font-medium text-owed">Owes {formatNaira(entry.balance)}</span>}
      </div>
    </>
  );
  const row = "flex min-h-16 items-start gap-3 py-3.5";
  return (
    <li
      className={`border-b border-rule/70 last:border-b-0 ${index === undefined ? "" : "enter"}`}
      style={index === undefined ? undefined : ({ "--i": index } as CSSProperties)}
    >
      {href ? (
        <Link href={href} className={`${row} -mx-2 rounded-xl px-2 transition-colors duration-150 active:bg-paper-deep`}>
          {content}
        </Link>
      ) : (
        <div className={row}>{content}</div>
      )}
    </li>
  );
}
