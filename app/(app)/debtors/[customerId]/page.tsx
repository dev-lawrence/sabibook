"use client";

import { use, useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  CheckmarkCircle02Icon,
  Copy01Icon,
  WhatsappIcon,
} from "@hugeicons/core-free-icons";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { RecordButton } from "@/components/RecordButton";
import { EntryRow } from "@/components/EntryRow";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field, Input, fieldClass } from "@/components/ui/Field";
import { MoneyFigure } from "@/components/ui/MoneyFigure";
import { PageHeader } from "@/components/ui/PageHeader";
import { Spinner, StatusDots } from "@/components/ui/Spinner";
import { formatNaira, parseAmount } from "@/lib/format";
import { todayISO } from "@/lib/dates";

function errorText(err: unknown): string {
  if (err instanceof ConvexError && typeof err.data === "string") return err.data;
  return "That did not go through. Check your network and try again.";
}

/** "2348031234567" -> "+234 803 123 4567" */
function formatPhone(p: string): string {
  if (p.startsWith("234") && p.length === 13) {
    return `+234 ${p.slice(3, 6)} ${p.slice(6, 9)} ${p.slice(9)}`;
  }
  return `+${p}`;
}

export default function DebtorPage({ params }: { params: Promise<{ customerId: string }> }) {
  const { customerId: rawId } = use(params);
  const customerId = rawId as Id<"customers">;
  const customer = useQuery(api.customers.get, { customerId });
  const entries = useQuery(api.entries.forCustomer, { customerId });

  if (customer === undefined) {
    return (
      <main className="py-16 text-center">
        <StatusDots label="Loading" />
      </main>
    );
  }
  if (customer === null) {
    return (
      <main>
        <PageHeader title="Not found" backHref="/debtors" />
        <p className="text-lg text-ink-soft">We could not find this customer.</p>
      </main>
    );
  }

  const balance = customer.balance;

  return (
    <main className="flex flex-col gap-6">
      <PageHeader title={customer.name} backHref="/debtors" />

      <Card margin>
        {balance > 0 ? (
          <div>
            <p className="text-base font-semibold text-ink-soft">Owes you</p>
            <MoneyFigure amount={balance} tone="owed" className="text-5xl" />
          </div>
        ) : balance === 0 ? (
          <p className="flex items-center gap-2 text-3xl font-bold text-money">
            <HugeiconsIcon icon={CheckmarkCircle02Icon} size={32} />
            All settled
          </p>
        ) : (
          <div>
            <p className="text-base font-semibold text-ink-soft">You owe them</p>
            <MoneyFigure amount={-balance} tone="ink" className="text-5xl" />
          </div>
        )}
      </Card>

      {balance > 0 && <PaymentSection customerId={customerId} balance={balance} name={customer.name} />}
      {balance > 0 && <ReminderSection customerId={customerId} phone={customer.phone ?? null} />}
      <PhoneSection customerId={customerId} phone={customer.phone ?? null} />

      <section className="flex flex-col gap-2">
        <h2 className="text-xl font-bold text-ink">History</h2>
        {entries === undefined ? (
          <div className="py-6 text-center">
            <StatusDots label="Loading history" />
          </div>
        ) : entries.length === 0 ? (
          <p className="text-base text-ink-soft">Nothing written for this customer yet.</p>
        ) : (
          <Card margin className="py-0">
            <ul>
              {entries.map((e) => (
                <EntryRow key={e._id} entry={e} showDate href={`/entry/${e._id}`} />
              ))}
            </ul>
          </Card>
        )}
      </section>
    </main>
  );
}

function PaymentSection({
  customerId,
  balance,
  name,
}: {
  customerId: Id<"customers">;
  balance: number;
  name: string;
}) {
  const recordPayment = useMutation(api.customers.recordPayment);
  const [amount, setAmount] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<number | null>(null);

  const parsed = parseAmount(amount);
  const half = Math.round(balance / 2);
  const showHalf = balance >= 2 && half > 0 && half < balance;
  const spokenName = name.trim() || "Customer";

  async function save() {
    if (!parsed || parsed <= 0) {
      setError("Enter how much they paid.");
      return;
    }
    setSaving(true);
    setError(null);
    setSaved(null);
    try {
      await recordPayment({ customerId, amount: parsed, occurredOn: todayISO() });
      setSaved(parsed);
      setAmount("");
    } catch (err) {
      setError(errorText(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="flex flex-col gap-4">
      <h2 className="text-xl font-bold text-ink">Record payment</h2>

      <div className="flex flex-col gap-3">
        <Field label="Amount paid" htmlFor="pay-amount" flag={error}>
          <Input
            id="pay-amount"
            inputMode="numeric"
            placeholder="0"
            value={amount}
            onChange={(e) => {
              setAmount(e.target.value);
              setSaved(null);
            }}
            flagged={!!error}
          />
        </Field>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setAmount(String(balance))}
            className="min-h-12 rounded-full border-2 border-ink bg-card px-4 text-base font-bold text-ink active:bg-paper-deep"
          >
            Full {formatNaira(balance)}
          </button>
          {showHalf && (
            <button
              type="button"
              onClick={() => setAmount(String(half))}
              className="min-h-12 rounded-full border-2 border-ink bg-card px-4 text-base font-bold text-ink active:bg-paper-deep"
            >
              Half {formatNaira(half)}
            </button>
          )}
        </div>
        <Button full onClick={save} disabled={saving || !parsed}>
          {saving ? <Spinner /> : null}
          Save payment
        </Button>
        {saved !== null && (
          <p role="status" className="flex items-center gap-2 rounded-xl bg-money-soft px-4 py-3 text-base font-semibold text-money">
            <HugeiconsIcon icon={CheckmarkCircle02Icon} size={22} />
            Saved. {formatNaira(saved)} received.
          </p>
        )}
      </div>

      <div className="flex items-center gap-3 border-t border-rule pt-3">
        <RecordButton size="compact" hint="" />
        <div className="min-w-0 flex-1">
          <p className="text-base font-semibold text-ink">Or just say it</p>
          <p className="text-sm text-ink-soft">Say “{spokenName} paid 5k”. You will check it before it saves.</p>
        </div>
      </div>
    </Card>
  );
}

function ReminderSection({ customerId, phone }: { customerId: Id<"customers">; phone: string | null }) {
  const draft = useAction(api.reminders.draft);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [copied, setCopied] = useState(false);

  async function write() {
    setLoading(true);
    setError(false);
    setCopied(false);
    try {
      const res = await draft({ customerId });
      setMessage(res.message);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  function openWhatsApp() {
    if (!message) return;
    const base = phone ? `https://wa.me/${phone}` : "https://wa.me/";
    window.open(`${base}?text=${encodeURIComponent(message)}`, "_blank", "noopener");
  }

  async function copy() {
    if (!message) return;
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <Card className="flex flex-col gap-3">
      <h2 className="text-xl font-bold text-ink">Send reminder</h2>

      {loading ? (
        <p role="status" className="flex items-center gap-3 py-3 text-lg text-ink-soft">
          <Spinner />
          Writing a polite message...
        </p>
      ) : message === null ? (
        <>
          <p className="text-base text-ink-soft">We write a kind WhatsApp message for you. You can change it before sending.</p>
          {error && (
            <p role="alert" className="rounded-xl bg-flag px-4 py-3 text-base font-medium text-flag-ink">
              We could not write the message just now. Please try again.
            </p>
          )}
          <Button full variant="secondary" onClick={write}>
            {error ? "Try again" : "Write a reminder"}
          </Button>
        </>
      ) : (
        <>
          <label htmlFor="reminder-text" className="sr-only">
            Reminder message
          </label>
          <textarea
            id="reminder-text"
            rows={7}
            value={message}
            onChange={(e) => {
              setMessage(e.target.value);
              setCopied(false);
            }}
            className={fieldClass()}
          />
          {!phone && (
            <p className="text-sm text-ink-soft">No number saved yet. WhatsApp will let you pick the contact.</p>
          )}
          <Button full onClick={openWhatsApp} disabled={!message.trim()}>
            <HugeiconsIcon icon={WhatsappIcon} size={24} />
            Open WhatsApp
          </Button>
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={copy}>
              <HugeiconsIcon icon={copied ? CheckmarkCircle02Icon : Copy01Icon} size={22} />
              {copied ? "Copied" : "Copy"}
            </Button>
            <Button variant="ghost" className="flex-1" onClick={write}>
              Write again
            </Button>
          </div>
        </>
      )}
    </Card>
  );
}

function PhoneSection({ customerId, phone }: { customerId: Id<"customers">; phone: string | null }) {
  const setPhone = useMutation(api.customers.setPhone);
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      await setPhone({ customerId, phone: value });
      setEditing(false);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setSaving(false);
    }
  }

  if (!editing) {
    return (
      <Card className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-ink-soft">WhatsApp number</p>
          <p className="tabular truncate text-lg font-bold text-ink">{phone ? formatPhone(phone) : "Not added yet"}</p>
        </div>
        <Button
          variant="secondary"
          onClick={() => {
            setValue(phone ? `0${phone.slice(3)}` : "");
            setError(null);
            setEditing(true);
          }}
        >
          {phone ? "Change" : "Add"}
        </Button>
      </Card>
    );
  }

  return (
    <Card className="flex flex-col gap-3">
      <Field label="WhatsApp number" htmlFor="phone" flag={error} hint="Like 0803 123 4567">
        <Input
          id="phone"
          type="tel"
          inputMode="tel"
          autoComplete="off"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          flagged={!!error}
        />
      </Field>
      <div className="flex gap-2">
        <Button className="flex-1" onClick={save} disabled={saving || !value.trim()}>
          {saving ? <Spinner /> : null}
          Save
        </Button>
        <Button variant="ghost" className="flex-1" onClick={() => setEditing(false)}>
          Cancel
        </Button>
      </div>
    </Card>
  );
}
