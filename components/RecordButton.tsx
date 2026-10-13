"use client";

import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation } from "convex/react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Mic01Icon, StopIcon } from "@hugeicons/core-free-icons";
import { api } from "@/convex/_generated/api";
import { todayISO } from "@/lib/dates";
import { Spinner } from "@/components/ui/Spinner";

const TAP_MS = 350; // shorter than this counts as a tap, not a hold
const MIN_MS = 600; // shorter recordings are ignored
const MAX_MS = 60_000; // hard cap

type Phase = "idle" | "starting" | "recording" | "sending";

/** Pick the best format this browser can record. iOS Safari only does mp4. */
function pickMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  for (const t of ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"]) {
    if (MediaRecorder.isTypeSupported(t)) return t;
  }
  return undefined;
}

/**
 * The big record button. Hold to talk and let go to send, or tap once to start
 * and tap again to stop. Uploads the audio and opens the note page.
 */
export function RecordButton() {
  const router = useRouter();
  const begin = useMutation(api.voiceNotes.begin);
  const attachAudio = useMutation(api.voiceNotes.attachAudio);

  const [phase, setPhase] = useState<Phase>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [denied, setDenied] = useState(false);

  const phaseRef = useRef<Phase>("idle");
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef(0);
  const pressedAtRef = useRef(0);
  const holdingRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const cancelledRef = useRef(false);

  const setPhaseBoth = useCallback((p: Phase) => {
    phaseRef.current = p;
    setPhase(p);
  }, []);

  const releaseMic = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
  }, []);

  // Let go of the mic if the person leaves the page mid recording.
  useEffect(() => {
    return () => {
      cancelledRef.current = true;
      if (recorderRef.current?.state === "recording") recorderRef.current.stop();
      releaseMic();
    };
  }, [releaseMic]);

  const send = useCallback(
    async (blob: Blob, durationMs: number) => {
      setPhaseBoth("sending");
      try {
        const { voiceNoteId, uploadUrl } = await begin({ spokenOn: todayISO() });
        const res = await fetch(uploadUrl, {
          method: "POST",
          headers: { "Content-Type": blob.type || "audio/webm" },
          body: blob,
        });
        if (!res.ok) throw new Error("upload failed");
        const { storageId } = (await res.json()) as { storageId: string };
        await attachAudio({
          voiceNoteId,
          storageId: storageId as never,
          durationMs: Math.round(durationMs),
        });
        router.push(`/note/${voiceNoteId}`);
      } catch {
        setMessage("That did not send. Check your network and try again, or type it instead.");
        setPhaseBoth("idle");
      }
    },
    [begin, attachAudio, router, setPhaseBoth],
  );

  const stop = useCallback(() => {
    const rec = recorderRef.current;
    if (rec && rec.state === "recording") {
      navigator.vibrate?.(20);
      rec.stop();
    }
  }, []);

  const start = useCallback(async () => {
    setMessage(null);
    setDenied(false);
    setElapsed(0);
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setMessage("This browser cannot record sound. Please type it instead.");
      return;
    }
    setPhaseBoth("starting");
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      const name = err instanceof DOMException ? err.name : "";
      if (name === "NotAllowedError" || name === "SecurityError") {
        setDenied(true);
      } else {
        setMessage("We could not find a microphone. You can type it instead.");
      }
      setPhaseBoth("idle");
      return;
    }
    if (cancelledRef.current) {
      stream.getTracks().forEach((t) => t.stop());
      return;
    }
    streamRef.current = stream;
    chunksRef.current = [];
    const mimeType = pickMimeType();
    const rec = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    recorderRef.current = rec;
    rec.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    rec.onstop = () => {
      const durationMs = Date.now() - startedAtRef.current;
      const blob = new Blob(chunksRef.current, { type: rec.mimeType || mimeType || "audio/webm" });
      releaseMic();
      recorderRef.current = null;
      if (cancelledRef.current) return;
      if (durationMs < MIN_MS || blob.size === 0) {
        setMessage("That was too short. Hold the button and speak, then let go.");
        setPhaseBoth("idle");
        return;
      }
      void send(blob, durationMs);
    };
    startedAtRef.current = Date.now();
    rec.start();
    navigator.vibrate?.(20);
    setPhaseBoth("recording");
    timerRef.current = setInterval(() => {
      const ms = Date.now() - startedAtRef.current;
      setElapsed(Math.floor(ms / 1000));
      if (ms >= MAX_MS) stop();
    }, 250);
  }, [releaseMic, send, setPhaseBoth, stop]);

  function onPointerDown(e: PointerEvent<HTMLButtonElement>) {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    e.currentTarget.setPointerCapture(e.pointerId);
    pressedAtRef.current = Date.now();
    holdingRef.current = true;
    if (phaseRef.current === "recording") {
      // Second tap of tap-to-toggle mode.
      holdingRef.current = false;
      stop();
    } else if (phaseRef.current === "idle") {
      void start();
    }
  }

  function onPointerUp() {
    if (!holdingRef.current) return;
    holdingRef.current = false;
    const held = Date.now() - pressedAtRef.current;
    // A real hold ends the recording. A quick tap leaves it running.
    if (held >= TAP_MS && phaseRef.current === "recording") stop();
  }

  function onKeyDown(e: KeyboardEvent<HTMLButtonElement>) {
    if (e.key !== " " && e.key !== "Enter") return;
    e.preventDefault();
    if (e.repeat) return;
    if (phaseRef.current === "recording") stop();
    else if (phaseRef.current === "idle") void start();
  }

  const recording = phase === "recording";
  const busy = phase === "starting" || phase === "sending";

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative isolate flex size-52 items-center justify-center">
        <button
          type="button"
          aria-label={recording ? "Stop recording" : "Hold to talk"}
          aria-pressed={recording}
          disabled={phase === "sending"}
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onContextMenu={(e) => e.preventDefault()}
          onKeyDown={onKeyDown}
          className={`relative flex size-44 touch-none select-none flex-col items-center justify-center gap-1 rounded-full text-white shadow-[0_6px_0_0_var(--color-record-deep)] transition-transform active:translate-y-1 active:shadow-[0_2px_0_0_var(--color-record-deep)] focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-ink ${
            recording ? "record-pulse bg-record-deep" : "bg-record"
          } ${phase === "sending" ? "opacity-70" : ""}`}
        >
          {phase === "sending" ? (
            <Spinner size={44} />
          ) : (
            <HugeiconsIcon icon={recording ? StopIcon : Mic01Icon} size={56} />
          )}
          <span className="tabular text-lg font-bold">
            {recording ? `0:${String(elapsed).padStart(2, "0")}` : phase === "sending" ? "Sending" : "Hold to talk"}
          </span>
        </button>
      </div>

      <p className="min-h-6 text-center text-base text-ink-soft" aria-live="polite">
        {recording
          ? "Listening. Let go, or tap again, when you are done."
          : busy
            ? phase === "sending"
              ? "Sending your voice note"
              : "Opening the microphone"
            : "Or tap once to start, and tap again to stop."}
      </p>

      {denied && (
        <p role="alert" className="rounded-xl bg-owed-soft px-4 py-3 text-center text-base font-medium text-owed">
          SabiBook cannot use your microphone. Allow it in your browser settings, or{" "}
          <Link href="/type" className="font-bold underline underline-offset-4">
            type it instead
          </Link>
          .
        </p>
      )}
      {message && (
        <p role="alert" className="rounded-xl bg-flag px-4 py-3 text-center text-base font-medium text-flag-ink">
          {message}
        </p>
      )}
    </div>
  );
}
