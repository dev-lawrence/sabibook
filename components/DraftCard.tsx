"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import { HugeiconsIcon } from "@hugeicons/react";
import { Add01Icon, CheckmarkCircle02Icon, Delete02Icon } from "@hugeicons/core-free-icons";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field, Input, fieldClass } from "@/components/ui/Field";
import { MoneyFigure } from "@/components/ui/MoneyFigure";
import { Spinner, StatusDots } from "@/components/ui/Spinner";
import { ENTRY_TYPES, ENTRY_TYPE_LABEL, formatNaira, parseAmount, type EntryType } from "@/lib/format";
import { formatDayLabel } from "@/lib/dates";

type Entry = Omit<Doc<"entries">, "userId"> & { transcript: string | null; source: "voice" | "text" | null; receiptToken: string | null };

type FormItem = { name: string; qty: string; amount: string };
type Form = {
  type: EntryType;
  occurredOn: string;
  customerName: string;
  items: FormItem[];
  total: string;
  paid: string;
  note: string;
};

const numStr = (n: number | null) => (n === null ? "" : String(n));

function toForm(e: Entry): Form {
  return {
    type: e.type,
    occurredOn: e.occurredOn,
    customerName: e.customerName ?? "",
    items: e.items.map((i) => ({ name: i.name, qty: numStr(i.qty), amount: numStr(i.amount) })),
    total: numStr(e.total),
    paid: numStr(e.paid),
    note: e.note ?? "",
  };
}

/** Turns the text fields into the exact shape entries.updateDraft expects. */
function toPayload(f: Form) {
  const total = parseAmount(f.total);
  const qtyOf = (s: string) => {
    const n = parseFloat(s.replace(",", "."));
    return Number.isFinite(n) && n > 0 ? n : null;
  };
  return {
    type: f.type,
    occurredOn: f.occurredOn,
    customerName: f.customerName.trim() || null,
    items: f.items.map((i) => ({ name: i.name.trim(), qty: qtyOf(i.qty), amount: parseAmount(i.amount) })),
    total,
    // A payment received is one amount, so paid always follows the total.
    paid: f.type === "payment_received" ? total : parseAmount(f.paid),
    note: f.note.trim() || null,
  };
}

function errorText(err: unknown): string {
  if (err instanceof ConvexError && typeof err.data === "string") return err.data;
  return "That did not go through. Check your network and try again.";
}

/** Shows the transcript, editable fields with flags, a live balance, and Save or Discard. */
export function DraftCard({ entryId, showTranscript = true }: { entryId: Id<"entries">; showTranscript?: boolean }) {
  const entry = useQuery(api.entries.get, { entryId });
  const [justSaved, setJustSaved] = useState<{ owed: number } | null>(null);

  if (justSaved) return <SavedPanel owed={justSaved.owed} />;
  if (entry === undefined) {
    return (
      <div className="py-10 text-center">
        <StatusDots label="Loading your entry" />
      </div>
    );
  }
  if (entry.status === "confirmed") return <ConfirmedSummary entry={entry} />;
  return (
    <DraftForm
      key={entry._id}
      entry={entry}
      showTranscript={showTranscript}
      onSaved={(owed) => setJustSaved({ owed })}
    />
  );
}

function SavedPanel({ owed }: { owed: number }) {
  const router = useRouter();
  useEffect(() => {
    const t = setTimeout(() => router.push("/"), 1600);
    return () => clearTimeout(t);
  }, [router]);
  return (
    <Card className="flex flex-col items-center gap-3 py-10 text-center">
      <span className="text-money">
        <HugeiconsIcon icon={CheckmarkCircle02Icon} size={64} />
      </span>
      <p className="text-2xl font-bold text-ink">Saved to your book</p>
      {owed > 0 && <p className="text-base text-owed">{formatNaira(owed)} is still owed on this one.</p>}
      <Button href="/" variant="secondary">
        Back home
      </Button>
    </Card>
  );
}

function ConfirmedSummary({ entry }: { entry: Entry }) {
  const owed = entry.balance ?? 0;
  return (
    <Card margin className="flex flex-col gap-3">
      <p className="text-sm font-semibold text-ink-soft">
        {ENTRY_TYPE_LABEL[entry.type]} &middot; {formatDayLabel(entry.occurredOn)}
      </p>
      <p className="text-xl font-bold text-ink">{entry.customerName ?? "No name"}</p>
      {entry.items.length > 0 && (
        <ul className="text-base text-ink">
          {entry.items.map((i, idx) => (
            <li key={idx} className="flex justify-between gap-3 border-b border-rule py-1.5 last:border-b-0">
              <span>
                {i.qty && i.qty !== 1 ? `${i.qty} x ` : ""}
                {i.name}
              </span>
              <span className="tabular">{formatNaira(i.amount)}</span>
            </li>
          ))}
        </ul>
      )}
      <dl className="grid grid-cols-2 gap-2 border-t border-rule pt-3 text-base">
        <dt className="text-ink-soft">Total</dt>
        <dd className="text-right"><MoneyFigure amount={entry.total} size="sm" /></dd>
        <dt className="text-ink-soft">Paid</dt>
        <dd className="text-right"><MoneyFigure amount={entry.paid} size="sm" tone="money" /></dd>
        {owed > 0 && (
          <>
            <dt className="text-ink-soft">Still owed</dt>
            <dd className="text-right"><MoneyFigure amount={owed} size="sm" tone="owed" /></dd>
          </>
        )}
      </dl>
      {entry.note && <p className="text-base text-ink-soft">{entry.note}</p>}
      <div className="flex flex-col gap-2 pt-1">
        <Button href="/ledger" variant="secondary" full>
          See it in my ledger
        </Button>
        {entry.receiptToken && (
          <Link href={`/r/${entry.receiptToken}`} className="min-h-12 content-center text-center text-base font-semibold text-ink underline underline-offset-4">
            Open receipt
          </Link>
        )}
      </div>
    </Card>
  );
}

function DraftForm({
  entry,
  showTranscript,
  onSaved,
}: {
  entry: Entry;
  showTranscript: boolean;
  onSaved: (owed: number) => void;
}) {
  const router = useRouter();
  const customers = useQuery(api.customers.list);
  const updateDraft = useMutation(api.entries.updateDraft);
  const confirm = useMutation(api.entries.confirm);
  const discard = useMutation(api.entries.discard);

  const [form, setForm] = useState<Form>(() => toForm(entry));
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const [working, setWorking] = useState<"confirm" | "discard" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const payload = useMemo(() => toPayload(form), [form]);
  const payloadKey = JSON.stringify(payload);
  const savedKey = useRef(payloadKey);
  const latest = useRef({ payload, payloadKey });
  useEffect(() => {
    latest.current = { payload, payloadKey };
  });

  /** Sends the current edits if they differ from what the server has. */
  const flush = useCallback(async () => {
    const { payload: p, payloadKey: k } = latest.current;
    if (k === savedKey.current) return;
    setSaveState("saving");
    await updateDraft({ entryId: entry._id, ...p });
    savedKey.current = k;
    setSaveState("saved");
  }, [entry._id, updateDraft]);

  // Save about 600ms after the last change so the server can refresh its flags.
  useEffect(() => {
    if (payloadKey === savedKey.current) return;
    const t = setTimeout(() => {
      flush().catch((e) => {
        setSaveState("idle");
        setError(errorText(e));
      });
    }, 600);
    return () => clearTimeout(t);
  }, [payloadKey, flush]);

  // Do not lose edits made in the last moment before leaving the page.
  useEffect(() => {
    return () => {
      void flush().catch(() => {});
    };
  }, [flush]);

  const flagFor = (field: string) => entry.flags.find((f) => f.field === field)?.message ?? null;
  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm((f) => ({ ...f, [key]: value }));
  const setItem = (idx: number, patch: Partial<FormItem>) =>
    setForm((f) => ({ ...f, items: f.items.map((it, i) => (i === idx ? { ...it, ...patch } : it)) }));

  const isPayment = form.type === "payment_received";
  const total = payload.total;
  const paid = payload.paid;
  const balance = isPayment ? 0 : total !== null && paid !== null ? total - paid : null;

  const missing =
    total === null
      ? isPayment
        ? "Add the amount you received to save."
        : "Add the total to save."
      : paid === null
        ? "Add how much was paid, even if it is zero."
        : null;

  async function onConfirm() {
    setWorking("confirm");
    setError(null);
    try {
      await flush();
      await confirm({ entryId: entry._id });
      onSaved(balance && balance > 0 ? balance : 0);
    } catch (e) {
      setError(errorText(e));
      setWorking(null);
    }
  }

  async function onDiscard() {
    setWorking("discard");
    setError(null);
    try {
      // Stop the unmount flush from trying to edit an entry that is about to be gone.
      savedKey.current = latest.current.payloadKey;
      await discard({ entryId: entry._id });
      router.push("/");
    } catch (e) {
      setError(errorText(e));
      setWorking(null);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {showTranscript && entry.transcript && <Transcript text={entry.transcript} />}

      <Card className="flex flex-col gap-5">
        <fieldset className="flex flex-col gap-1.5">
          <legend className="mb-1.5 text-base font-semibold text-ink">What kind of entry is it?</legend>
          <div className="grid grid-cols-2 gap-2" role="radiogroup">
            {ENTRY_TYPES.map((t) => {
              const on = form.type === t;
              return (
                <button
                  key={t}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => set("type", t)}
                  className={`min-h-14 rounded-xl border-2 px-2 text-base font-semibold ${
                    on ? "border-ink bg-ink text-paper" : "border-rule bg-card text-ink hover:bg-paper-deep"
                  }`}
                >
                  {ENTRY_TYPE_LABEL[t]}
                </button>
              );
            })}
          </div>
        </fieldset>

        <Field label="Date" htmlFor="draft-date">
          <Input
            id="draft-date"
            type="date"
            value={form.occurredOn}
            onChange={(e) => e.target.value && set("occurredOn", e.target.value)}
          />
        </Field>

        <Field
          label={isPayment ? "Who paid you?" : form.type === "sale" ? "Customer" : "Who or where from (optional)"}
          htmlFor="draft-customer"
          flag={flagFor("customerName")}
        >
          <Input
            id="draft-customer"
            list="customers-list"
            value={form.customerName}
            onChange={(e) => set("customerName", e.target.value)}
            flagged={!!flagFor("customerName")}
            autoComplete="off"
            placeholder="Name"
          />
          <datalist id="customers-list">
            {customers?.map((c) => (
              <option key={c._id} value={c.name} />
            ))}
          </datalist>
        </Field>

        {!isPayment && (
          <section aria-labelledby="items-heading" className="flex flex-col gap-3">
            <h3 id="items-heading" className="text-base font-semibold text-ink">
              Items
            </h3>
            {form.items.map((item, idx) => {
              const amountFlag = flagFor(`items.${idx}.amount`);
              return (
                <div key={idx} className="flex flex-col gap-2 rounded-xl border border-rule bg-paper p-3">
                  <div className="flex items-center gap-2">
                    <Input
                      aria-label={`Item ${idx + 1} name`}
                      value={item.name}
                      onChange={(e) => setItem(idx, { name: e.target.value })}
                      placeholder="What was it?"
                    />
                    <button
                      type="button"
                      aria-label={`Remove item ${idx + 1}`}
                      onClick={() => setForm((f) => ({ ...f, items: f.items.filter((_, i) => i !== idx) }))}
                      className="flex size-14 shrink-0 items-center justify-center rounded-xl text-owed hover:bg-owed-soft"
                    >
                      <HugeiconsIcon icon={Delete02Icon} size={24} />
                    </button>
                  </div>
                  <div className="grid grid-cols-[6rem_1fr] gap-2">
                    <Input
                      aria-label={`Item ${idx + 1} quantity`}
                      inputMode="decimal"
                      value={item.qty}
                      onChange={(e) => setItem(idx, { qty: e.target.value })}
                      placeholder="Qty"
                    />
                    <Input
                      aria-label={`Item ${idx + 1} amount in naira`}
                      inputMode="numeric"
                      value={item.amount}
                      onChange={(e) => setItem(idx, { amount: e.target.value })}
                      flagged={!!amountFlag}
                      placeholder="Amount"
                    />
                  </div>
                  <p className="tabular text-sm text-ink-soft">{formatNaira(parseAmount(item.amount))}</p>
                  {amountFlag && (
                    <p role="alert" className="text-base font-medium text-flag-ink">
                      {amountFlag}
                    </p>
                  )}
                </div>
              );
            })}
            {flagFor("items") && (
              <p role="alert" className="rounded-lg bg-flag px-3 py-2 text-base font-medium text-flag-ink">
                {flagFor("items")}
              </p>
            )}
            <Button
              variant="secondary"
              className="min-h-12"
              onClick={() => setForm((f) => ({ ...f, items: [...f.items, { name: "", qty: "", amount: "" }] }))}
            >
              <HugeiconsIcon icon={Add01Icon} size={22} />
              Add an item
            </Button>
          </section>
        )}

        <Field label={isPayment ? "Amount received" : "Total"} htmlFor="draft-total" flag={flagFor("total")}>
          <Input
            id="draft-total"
            inputMode="numeric"
            value={form.total}
            onChange={(e) => set("total", e.target.value)}
            flagged={!!flagFor("total")}
            placeholder="0"
          />
          <p className="tabular text-sm text-ink-soft">{formatNaira(total)}</p>
        </Field>

        {!isPayment && (
          <Field label="Paid now" htmlFor="draft-paid" flag={flagFor("paid")}>
            <Input
              id="draft-paid"
              inputMode="numeric"
              value={form.paid}
              onChange={(e) => set("paid", e.target.value)}
              flagged={!!flagFor("paid")}
              placeholder="0"
            />
            <p className="tabular text-sm text-ink-soft">{formatNaira(paid)}</p>
          </Field>
        )}

        <div
          className={`flex items-center justify-between rounded-xl px-4 py-3 ${
            balance !== null && balance > 0 ? "bg-owed-soft" : "bg-money-soft"
          }`}
          aria-live="polite"
        >
          <span className="text-base font-semibold text-ink">
            {balance !== null && balance > 0 ? "Still owed" : "Nothing owed"}
          </span>
          <MoneyFigure amount={balance === null ? null : Math.max(balance, 0)} tone={balance !== null && balance > 0 ? "owed" : "money"} />
        </div>

        <Field label="Note (optional)" htmlFor="draft-note">
          <textarea
            id="draft-note"
            rows={2}
            value={form.note}
            onChange={(e) => set("note", e.target.value)}
            className={`${fieldClass()} resize-none`}
          />
        </Field>
      </Card>

      {error && (
        <p role="alert" className="rounded-xl bg-owed-soft px-4 py-3 text-base font-medium text-owed">
          {error}
        </p>
      )}

      <div className="flex flex-col gap-2">
        {missing && <p className="text-center text-base font-medium text-flag-ink">{missing}</p>}
        <Button full onClick={onConfirm} disabled={!!missing || working !== null} className="min-h-16 text-xl">
          {working === "confirm" ? <Spinner /> : null}
          Save to my book
        </Button>
        <p className="min-h-5 text-center text-sm text-ink-soft" aria-live="polite">
          {saveState === "saving" ? "Saving changes..." : saveState === "saved" ? "Changes saved" : ""}
        </p>
        <Button variant="danger" full onClick={onDiscard} disabled={working !== null}>
          {working === "discard" ? <Spinner /> : null}
          Discard this
        </Button>
      </div>
    </div>
  );
}

/** What the trader said, written out like a note on lined paper. */
export function Transcript({ text }: { text: string }) {
  return (
    <Card ruled className="py-0">
      <p className="text-sm font-semibold leading-[2.45rem] text-ink-soft">I heard</p>
      <p className="pb-[0.4rem] text-xl font-medium italic leading-[2.45rem] text-ink">&ldquo;{text}&rdquo;</p>
    </Card>
  );
}
