"use client";

import type { CSSProperties } from "react";
import Link from "next/link";
import { useQuery } from "convex/react";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowLeft01Icon, ArrowDown01Icon } from "@hugeicons/core-free-icons";
import { api } from "@/convex/_generated/api";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusDots } from "@/components/ui/Spinner";

const REPO_URL = process.env.NEXT_PUBLIC_REPO_URL ?? "https://github.com/dev-lawrence/sabibook";
const RESULTS_URL = `${REPO_URL}/blob/main/eval/results.md`;

const STEPS = [
  { title: "Your phone records", body: "The browser records your voice as a small webm/opus file." },
  { title: "Convex stores the audio", body: "The recording is saved with your book so nothing is lost if the network drops." },
  { title: "Speaches (faster-whisper) writes the words", body: "A speech model turns the sound into a transcript." },
  { title: "Gemma 4 E4B on Ollama makes a ledger entry", body: "A language model reads the transcript and fills in a form (a JSON schema): who, what, how much, how much was paid." },
  { title: "Plain code checks the sums", body: "Ordinary code adds up the items and flags any amount or name you did not actually say." },
  { title: "You confirm", body: "Nothing goes into your book until you look at it and press confirm." },
];

const MODELS = [
  { job: "Speech", model: "Whisper large v3 turbo", note: "English", licence: "MIT" },
  {
    job: "Speech",
    model: "NaijaVox 2.0 by Axiveri",
    note: "Pidgin, Yorùbá, Hausa, Igbo (beta), converted for faster-whisper",
    licence: "Apache 2.0",
  },
  { job: "Language", model: "Gemma 4 E4B via Ollama", note: "Turns words into a ledger entry", licence: "Gemma licence" },
];

function median(values: number[]): number | null {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}
const secs = (ms: number | null) => (ms === null ? "n/a" : `${(ms / 1000).toFixed(1)}s`);

function LiveSpeed() {
  const latency = useQuery(api.voiceNotes.recentLatency);

  if (latency === undefined) {
    return (
      <div className="py-6 text-center">
        <StatusDots />
      </div>
    );
  }
  if (latency.length === 0) {
    return <EmptyState title="No voice notes yet" body="No voice notes yet. Record one and come back." />;
  }

  const asr = median(latency.map((n) => n.asrMs).filter((v): v is number => v !== null));
  const llm = median(latency.map((n) => n.llmMs).filter((v): v is number => v !== null));
  const models = [...new Set(latency.flatMap((n) => [n.asrModel, n.llmModel]).filter((m): m is string => !!m))];

  return (
    <div className="flex flex-col gap-3">
      <Card>
        <dl className="grid grid-cols-3 gap-3">
          <div>
            <dt className="text-sm font-semibold text-ink-soft">Listening</dt>
            <dd className="tabular text-2xl font-semibold text-ink">{secs(asr)}</dd>
          </div>
          <div>
            <dt className="text-sm font-semibold text-ink-soft">Writing</dt>
            <dd className="tabular text-2xl font-semibold text-ink">{secs(llm)}</dd>
          </div>
          <div>
            <dt className="text-sm font-semibold text-ink-soft">Notes</dt>
            <dd className="tabular text-2xl font-semibold text-ink">{latency.length}</dd>
          </div>
        </dl>
        <p className="mt-3 text-sm text-ink-soft">
          Median listening time and median writing time over the last {latency.length} notes.
        </p>
        {models.length > 0 && (
          <p className="mt-1 text-sm text-ink-soft">Models seen: {models.join(", ")}</p>
        )}
      </Card>
      <Card className="overflow-x-auto p-0">
        <table className="tabular w-full text-left text-sm">
          <caption className="sr-only">The last 10 voice notes</caption>
          <thead>
            <tr className="border-b border-rule text-ink-soft">
              <th scope="col" className="px-4 py-2 font-semibold">Note</th>
              <th scope="col" className="px-2 py-2 font-semibold">Length</th>
              <th scope="col" className="px-2 py-2 font-semibold">Listen</th>
              <th scope="col" className="px-4 py-2 font-semibold">Write</th>
            </tr>
          </thead>
          <tbody>
            {latency.slice(0, 10).map((n, i) => (
              <tr key={n.at} className="border-b border-rule last:border-0">
                <td className="px-4 py-2 text-ink-soft">{i + 1}</td>
                <td className="px-2 py-2">{secs(n.durationMs)}</td>
                <td className="px-2 py-2">{secs(n.asrMs)}</td>
                <td className="px-4 py-2">{secs(n.llmMs)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

export default function HowItWorksPage() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-8 px-4 pb-16 pt-4">
      <header className="enter flex flex-col gap-2">
        <Link
          href="/"
          className="inline-flex min-h-12 items-center gap-1 self-start text-base font-semibold text-ink underline underline-offset-4 transition-colors duration-150 hover:text-ink-soft"
        >
          <HugeiconsIcon icon={ArrowLeft01Icon} size={22} />
          Back to your book
        </Link>
        <h1 className="text-3xl font-semibold tracking-[-0.03em] text-ink">How SabiBook works</h1>
        <p className="text-base text-ink-soft">
          You talk, it writes the entry, you check it. Here is what happens in between and which models do the work.
        </p>
      </header>

      <section aria-labelledby="flow-heading" className="flex flex-col gap-3">
        <h2 id="flow-heading" className="text-xl font-semibold tracking-[-0.02em] text-ink">What happens when you talk</h2>
        <ol className="flex flex-col items-stretch">
          {STEPS.map((s, i) => (
            <li
              key={s.title}
              className="enter flex flex-col items-center"
              style={{ "--i": i } as CSSProperties}
            >
              <div className="w-full rounded-card border border-rule bg-card p-4">
                <p className="text-base font-semibold text-ink">
                  <span className="tabular mr-2 text-margin">{i + 1}.</span>
                  {s.title}
                </p>
                <p className="mt-1 text-sm text-ink-soft">{s.body}</p>
              </div>
              {i < STEPS.length - 1 && (
                <span aria-hidden className="py-1 text-ink-soft">
                  <HugeiconsIcon icon={ArrowDown01Icon} size={22} />
                </span>
              )}
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="models-heading" className="flex flex-col gap-3">
        <h2 id="models-heading" className="text-xl font-semibold tracking-[-0.02em] text-ink">Models</h2>
        <p className="text-base text-ink-soft">All three are open weight, so you can download them and run them yourself.</p>
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-rule text-ink-soft">
                <th scope="col" className="px-4 py-2 font-semibold">Job</th>
                <th scope="col" className="px-2 py-2 font-semibold">Model</th>
                <th scope="col" className="px-4 py-2 font-semibold">Licence</th>
              </tr>
            </thead>
            <tbody>
              {MODELS.map((m) => (
                <tr key={m.model} className="border-b border-rule align-top last:border-0">
                  <td className="px-4 py-3 font-semibold text-ink">{m.job}</td>
                  <td className="px-2 py-3">
                    <span className="block font-semibold text-ink">{m.model}</span>
                    <span className="block text-ink-soft">{m.note}</span>
                  </td>
                  <td className="px-4 py-3 text-ink">{m.licence}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </section>

      <section aria-labelledby="speed-heading" className="flex flex-col gap-3">
        <h2 id="speed-heading" className="text-xl font-semibold tracking-[-0.02em] text-ink">Live speed</h2>
        <LiveSpeed />
      </section>

      <section aria-labelledby="accuracy-heading" className="flex flex-col gap-3">
        <h2 id="accuracy-heading" className="text-xl font-semibold tracking-[-0.02em] text-ink">How accurate is it</h2>
        <p className="text-base text-ink">
          We test the models on fixed sets and publish the results, including the misses. For the language model we
          check each field of the ledger entry (type, date, customer, total, paid, balance, items, flags) for every
          model we try. For speech we measure word error rate and how often the amounts come out right, because a
          wrong amount matters more than a wrong word.
        </p>
        <a
          href={RESULTS_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="min-h-12 content-center self-start text-base font-semibold text-ink underline underline-offset-4 transition-colors duration-150 hover:text-ink-soft"
        >
          Read the eval results on GitHub
        </a>
      </section>

      <section aria-labelledby="open-heading" className="flex flex-col gap-3">
        <h2 id="open-heading" className="text-xl font-semibold tracking-[-0.02em] text-ink">Why open models</h2>
        <p className="text-base text-ink">
          A trader&rsquo;s sales and debts are private. With open models the whole stack can run on a laptop or a small
          server in Lagos that you control, so your data stays with models you run yourself.
        </p>
        <p className="text-base text-ink">
          There is no per-request bill. A small business margin should not shrink every time you record a sale.
        </p>
        <p className="text-base text-ink">
          Open weights can also be fine-tuned for how Nigerians actually speak. That is what NaijaVox did for Pidgin,
          Yorùbá, Hausa and Igbo, and it is still beta, so check what it writes.
        </p>
      </section>
    </main>
  );
}
