"use client";

import { use } from "react";
import { useQuery } from "convex/react";
import { HugeiconsIcon } from "@hugeicons/react";
import { PrinterIcon, WhatsappIcon } from "@hugeicons/core-free-icons";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/Button";
import { StatusDots } from "@/components/ui/Spinner";
import { formatNaira } from "@/lib/format";
import { formatDayLabel } from "@/lib/dates";

export default function ReceiptPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const receipt = useQuery(api.receipts.get, { token });

  if (receipt === undefined) {
    return (
      <main className="flex min-h-dvh items-center justify-center">
        <StatusDots label="Loading receipt" />
      </main>
    );
  }
  if (receipt === null) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-2 px-6 text-center">
        <h1 className="text-2xl font-semibold tracking-[-0.02em] text-ink">Receipt not found</h1>
        <p className="text-base text-ink-soft">This link may be wrong, or the receipt was removed. Please ask the seller to send it again.</p>
      </main>
    );
  }

  const owed = receipt.balance !== null && receipt.balance > 0;
  const business = receipt.businessName ?? "Receipt";
  const isPayment = receipt.type === "payment_received";

  function sendWhatsApp() {
    const text = `Receipt from ${business}${receipt?.customerName ? ` for ${receipt.customerName}` : ""}. Total ${formatNaira(receipt?.total)}. ${window.location.href}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener");
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-5 px-4 py-6 print:max-w-none print:p-0">
      <article className="enter rounded-card border border-rule bg-card px-5 py-6 print:border-0">
        <header className="text-center">
          <h1 className="text-2xl font-semibold tracking-[-0.02em] text-ink">{business}</h1>
          <p className="mt-1 text-base font-semibold text-ink-soft">
            {isPayment ? "Payment receipt" : "Receipt"}
          </p>
          <p className="mt-1 text-base text-ink-soft">{formatDayLabel(receipt.occurredOn)}</p>
        </header>

        {receipt.customerName && (
          <p className="mt-4 text-base text-ink">
            <span className="text-ink-soft">For: </span>
            <span className="font-semibold">{receipt.customerName}</span>
          </p>
        )}

        {receipt.items.length > 0 && (
          <ul className="mt-4 border-t border-dashed border-rule">
            {receipt.items.map((item, i) => (
              <li key={i} className="flex items-baseline justify-between gap-3 border-b border-dashed border-rule py-2.5">
                <span className="min-w-0 text-lg text-ink">
                  {item.name}
                  {item.qty && item.qty !== 1 ? <span className="text-ink-soft"> x {item.qty}</span> : null}
                </span>
                <span className="tabular shrink-0 text-lg font-semibold text-ink">{formatNaira(item.amount)}</span>
              </li>
            ))}
          </ul>
        )}

        <dl className="mt-4 flex flex-col gap-2">
          <div className="flex items-baseline justify-between">
            <dt className="text-lg font-semibold text-ink">Total</dt>
            <dd className="tabular text-2xl font-semibold text-ink">{formatNaira(receipt.total)}</dd>
          </div>
          {!isPayment && (
            <div className="flex items-baseline justify-between">
              <dt className="text-base text-ink-soft">Paid</dt>
              <dd className="tabular text-lg font-semibold text-money">{formatNaira(receipt.paid)}</dd>
            </div>
          )}
          {!isPayment && (
            <div className="flex items-baseline justify-between">
              <dt className="text-base text-ink-soft">{owed ? "Balance owed" : "Balance"}</dt>
              <dd className={`tabular text-lg font-semibold ${owed ? "text-owed" : "text-money"}`}>
                {owed ? formatNaira(receipt.balance) : "Paid in full"}
              </dd>
            </div>
          )}
        </dl>

        <div className="my-5 border-t border-dashed border-ink-soft" aria-hidden />
        <p className="text-center text-sm text-ink-soft">Written with SabiBook</p>
      </article>

      <div className="flex flex-col gap-3 print:hidden">
        <Button full onClick={sendWhatsApp}>
          <HugeiconsIcon icon={WhatsappIcon} size={24} />
          Send on WhatsApp
        </Button>
        <Button full variant="secondary" onClick={() => window.print()}>
          <HugeiconsIcon icon={PrinterIcon} size={22} />
          Print
        </Button>
      </div>
    </main>
  );
}
