"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { Spinner } from "@/components/ui/Spinner";
import { fieldClass } from "@/components/ui/Field";
import { todayISO } from "@/lib/dates";

const EXAMPLES = [
  "I sold three bags of rice to Mama Ngozi for 45k, she paid 35k",
  "Emeka pay me 10k for the money wey him dey owe",
  "I bought 2 cartons of Indomie for 18,000 cash",
];

export default function TypePage() {
  const router = useRouter();
  const submitText = useMutation(api.voiceNotes.submitText);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!text.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const id = await submitText({ text, spokenOn: todayISO() });
      router.push(`/note/${id}`);
    } catch {
      setError("That did not go through. Check your network and try again.");
      setBusy(false);
    }
  }

  return (
    <main className="flex flex-col gap-5">
      <PageHeader title="Type it instead" subtitle="Write it the way you would say it." backHref="/" />

      <label htmlFor="what-happened" className="sr-only">
        What happened
      </label>
      <textarea
        id="what-happened"
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={5}
        maxLength={1000}
        placeholder="I sold two bags of rice to Mama Ngozi for 30k..."
        className={`${fieldClass()} ruled resize-none leading-[2.45rem]`}
        style={{ paddingTop: 0, paddingBottom: 0 }}
      />

      <div className="flex flex-col gap-2">
        <p className="text-sm font-semibold text-ink-soft">Tap an example to start</p>
        {EXAMPLES.map((ex) => (
          <button
            key={ex}
            type="button"
            onClick={() => setText(ex)}
            className="min-h-14 rounded-2xl border border-rule bg-card px-4 py-2 text-left text-base text-ink transition-colors duration-150 hover:bg-paper-deep active:bg-paper-deep"
          >
            &ldquo;{ex}&rdquo;
          </button>
        ))}
      </div>

      {error && (
        <p role="alert" className="rounded-xl bg-owed-soft px-4 py-3 text-base font-medium text-owed">
          {error}
        </p>
      )}

      <Button full onClick={submit} disabled={!text.trim() || busy}>
        {busy ? <Spinner /> : null}
        Write it down
      </Button>
    </main>
  );
}
