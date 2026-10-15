"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ArrowRight01Icon,
  CheckmarkCircle02Icon,
  Copy01Icon,
  Delete02Icon,
  ReceiptDollarIcon,
  WhatsappIcon,
} from "@hugeicons/core-free-icons";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { DraftCard, Transcript } from "@/components/DraftCard";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { MoneyFigure } from "@/components/ui/MoneyFigure";
import { PageHeader } from "@/components/ui/PageHeader";
import { Spinner, StatusDots } from "@/components/ui/Spinner";
import { ENTRY_TYPE_LABEL, formatNaira, isMoneyIn } from "@/lib/format";
import { formatDayLabel } from "@/lib/dates";

function errorText(err: unknown): string {
  if (err instanceof ConvexError && typeof err.data === "string") return err.data;
  return "That did not go through. Check your network and try again.";
}

export default function EntryPage({ params }: { params: Promise<{ entryId: string }> }) {
  const { entryId: rawId } = use(params);
  const entryId = rawId as Id<"entries">;
  const entry = useQuery(api.entries.get, { entryId });

  if (entry === undefined) {
    return (
      <main className="py-16 text-center">
        <StatusDots label="Loading entry" />
      </main>
    );
  }
  if (entry.status !== "confirmed") {
    return (
      <main>
        <DraftCard entryId={entryId} />
      </main>
    );
  }

  const owed = entry.balance !== null && entry.balance > 0;

  return (
    <main className="flex flex-col gap-6">
      <PageHeader
        title={ENTRY_TYPE_LABEL[entry.type]}
        subtitle={formatDayLabel(entry.occurredOn)}
        backHref="/ledger"
      />

      <Card className="flex flex-col gap-4">
        {entry.customerName && (
          <div>
            <p className="text-sm font-semibold text-ink-soft">Customer</p>
            {entry.customerId ? (
              <Link
                href={`/debtors/${entry.customerId}`}
                className="flex min-h-12 items-center gap-1 text-xl font-semibold tracking-[-0.02em] text-ink underline underline-offset-4 transition-colors duration-150 hover:text-ink-soft"
              >
                {entry.customerName}
                <HugeiconsIcon icon={ArrowRight01Icon} size={20} />
              </Link>
            ) : (
              <p className="text-xl font-semibold tracking-[-0.02em] text-ink">{entry.customerName}</p>
            )}
          </div>
        )}

        {entry.items.length > 0 && (
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-rule text-sm text-ink-soft">
                <th className="py-1 font-semibold">Item</th>
                <th className="py-1 text-right font-semibold">Qty</th>
                <th className="py-1 text-right font-semibold">Amount</th>
              </tr>
            </thead>
            <tbody>
              {entry.items.map((item, i) => (
                <tr key={i} className="border-b border-rule last:border-b-0">
                  <td className="py-2 pr-2 text-lg text-ink">{item.name}</td>
                  <td className="tabular py-2 text-right text-lg text-ink">{item.qty ?? "-"}</td>
                  <td className="tabular py-2 pl-2 text-right text-lg font-semibold text-ink">
                    {formatNaira(item.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <dl className="flex flex-col gap-2 border-t border-ink pt-3">
          <div className="flex items-baseline justify-between">
            <dt className="text-lg font-semibold text-ink">Total</dt>
            <dd>
              <MoneyFigure amount={entry.total} tone={isMoneyIn(entry.type) ? "money" : "ink"} size="lg" />
            </dd>
          </div>
          {entry.type !== "payment_received" && (
            <>
              <div className="flex items-baseline justify-between">
                <dt className="text-base text-ink-soft">Paid</dt>
                <dd>
                  <MoneyFigure amount={entry.paid} size="md" />
                </dd>
              </div>
              <div className="flex items-baseline justify-between">
                <dt className="text-base text-ink-soft">{owed ? "Still owed" : "Balance"}</dt>
                <dd>
                  <MoneyFigure amount={entry.balance} tone={owed ? "owed" : "ink"} size="md" />
                </dd>
              </div>
            </>
          )}
        </dl>

        {entry.note && (
          <div>
            <p className="text-sm font-semibold text-ink-soft">Note</p>
            <p className="text-lg text-ink">{entry.note}</p>
          </div>
        )}
      </Card>

      {entry.transcript && <Transcript text={entry.transcript} />}

      <ShareSection entryId={entryId} token={entry.receiptToken} customerName={entry.customerName ?? null} total={entry.total} />
      <DeleteSection entryId={entryId} />
    </main>
  );
}

function ShareSection({
  entryId,
  token: existingToken,
  customerName,
  total,
}: {
  entryId: Id<"entries">;
  token: string | null;
  customerName: string | null;
  total: number | null;
}) {
  const create = useMutation(api.receipts.create);
  const business = useQuery(api.profile.me)?.businessName;
  const [created, setCreated] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const token = created ?? existingToken;

  async function share() {
    setLoading(true);
    setError(null);
    try {
      setCreated(await create({ entryId }));
    } catch (err) {
      setError(errorText(err));
    } finally {
      setLoading(false);
    }
  }

  const url = token ? `${window.location.origin}/r/${token}` : "";

  function openWhatsApp() {
    const hello = customerName ? `Hello ${customerName}. ` : "";
    const from = business ? ` from ${business}` : "";
    const text = `${hello}Here is your receipt${from} for ${formatNaira(total)}: ${url}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener");
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  if (!token) {
    return (
      <div className="flex flex-col gap-2">
        <Button full onClick={share} disabled={loading}>
          {loading ? <Spinner /> : <HugeiconsIcon icon={ReceiptDollarIcon} size={24} />}
          Share receipt
        </Button>
        {error && (
          <p role="alert" className="rounded-xl bg-flag px-4 py-3 text-base font-medium text-flag-ink">
            {error}
          </p>
        )}
      </div>
    );
  }

  return (
    <Card className="enter flex flex-col gap-3">
      <h2 className="text-xl font-semibold tracking-[-0.02em] text-ink">Receipt link</h2>
      <p className="tabular break-all rounded-xl bg-paper-deep px-4 py-3 text-base text-ink">{url}</p>
      <Button full onClick={openWhatsApp}>
        <HugeiconsIcon icon={WhatsappIcon} size={24} />
        Send on WhatsApp
      </Button>
      <Button full variant="secondary" onClick={copy}>
        <HugeiconsIcon icon={copied ? CheckmarkCircle02Icon : Copy01Icon} size={22} />
        {copied ? "Link copied" : "Copy link"}
      </Button>
    </Card>
  );
}

function DeleteSection({ entryId }: { entryId: Id<"entries"> }) {
  const router = useRouter();
  const remove = useMutation(api.entries.remove);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function doDelete() {
    setBusy(true);
    setError(null);
    try {
      await remove({ entryId });
      router.replace("/ledger");
    } catch (err) {
      setError(errorText(err));
      setBusy(false);
    }
  }

  if (!confirming) {
    return (
      <Button full variant="danger" onClick={() => setConfirming(true)}>
        <HugeiconsIcon icon={Delete02Icon} size={22} />
        Delete entry
      </Button>
    );
  }

  return (
    <Card className="enter flex flex-col gap-3 border-owed">
      <p className="text-lg font-semibold tracking-[-0.02em] text-ink">Delete this entry?</p>
      <p className="text-base text-ink-soft">Your totals and balances will change back. This cannot be undone.</p>
      {error && (
        <p role="alert" className="rounded-xl bg-flag px-4 py-3 text-base font-medium text-flag-ink">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <Button
          className="flex-1 bg-owed text-white hover:bg-owed/90"
          onClick={doDelete}
          disabled={busy}
        >
          {busy ? <Spinner /> : null}
          Yes, delete
        </Button>
        <Button variant="secondary" className="flex-1" onClick={() => setConfirming(false)} disabled={busy}>
          Keep it
        </Button>
      </div>
    </Card>
  );
}
