"use client";

import { use, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Tick02Icon } from "@hugeicons/core-free-icons";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { DraftCard, Transcript } from "@/components/DraftCard";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { Spinner, StatusDots } from "@/components/ui/Spinner";

type StepState = "done" | "active" | "waiting";

function Step({ label, state }: { label: string; state: StepState }) {
  return (
    <li className="flex items-center gap-3 py-1.5" aria-current={state === "active" ? "step" : undefined}>
      <span
        className={`flex size-8 shrink-0 items-center justify-center rounded-full border-2 ${
          state === "done"
            ? "border-money bg-money text-white"
            : state === "active"
              ? "border-ink text-ink"
              : "border-rule text-rule"
        }`}
      >
        {state === "done" ? <HugeiconsIcon icon={Tick02Icon} size={18} /> : state === "active" ? <Spinner size={16} /> : null}
      </span>
      <span className={`text-lg ${state === "waiting" ? "text-ink-soft" : "font-semibold text-ink"}`}>{label}</span>
    </li>
  );
}

export default function NotePage(props: PageProps<"/note/[voiceNoteId]">) {
  const { voiceNoteId } = use(props.params);
  const id = voiceNoteId as Id<"voiceNotes">;
  const note = useQuery(api.voiceNotes.get, { voiceNoteId: id });
  const retry = useMutation(api.voiceNotes.retry);
  const [retrying, setRetrying] = useState(false);

  if (note === undefined) {
    return (
      <main>
        <PageHeader title="Your note" backHref="/" />
        <div className="py-10 text-center">
          <StatusDots />
        </div>
      </main>
    );
  }

  const failed = note.status === "failed";
  const isVoice = note.source === "voice";
  // Where we are in the pipeline: 0 listening, 1 writing, 2 ready.
  const stage =
    note.status === "ready" ? 2 : note.status === "extracting" ? 1 : failed ? (note.transcript ? 1 : 0) : 0;
  const stateOf = (i: number): StepState =>
    note.status === "ready" || i < stage ? "done" : i === stage && !failed ? "active" : "waiting";

  async function onRetry() {
    setRetrying(true);
    try {
      await retry({ voiceNoteId: id });
    } finally {
      setRetrying(false);
    }
  }

  return (
    <main className="flex flex-col gap-5">
      <PageHeader
        title={note.status === "ready" ? "Check and save" : failed ? "That did not work" : "Writing it down"}
        subtitle={note.status === "ready" ? "Fix anything that looks wrong, then save." : undefined}
        backHref="/"
      />

      {note.status !== "ready" && (
        <Card>
          <ol>
            {isVoice && <Step label="Listening" state={stateOf(0)} />}
            <Step label="Writing it down" state={isVoice ? stateOf(1) : failed ? "waiting" : "active"} />
            <Step label="Ready to confirm" state="waiting" />
          </ol>
        </Card>
      )}

      {note.transcript && <Transcript text={note.transcript} />}

      {failed && (
        <Card className="flex flex-col gap-3">
          <p role="alert" className="text-lg font-semibold text-owed">
            {note.error ?? "We could not read that one."}
          </p>
          <p className="text-base text-ink-soft">Your words are safe. Try again, or type it instead.</p>
          <Button full onClick={onRetry} disabled={retrying}>
            {retrying ? <Spinner /> : null}
            Try again
          </Button>
          <Button href="/type" variant="secondary" full>
            Type it instead
          </Button>
        </Card>
      )}

      {note.status === "ready" && note.entryId && <DraftCard entryId={note.entryId} showTranscript={false} />}
    </main>
  );
}
