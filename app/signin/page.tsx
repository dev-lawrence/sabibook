"use client";

import { useState, type CSSProperties, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useAuthActions } from "@convex-dev/auth/react";
import { LogoMark } from "@/components/Logo";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { Spinner } from "@/components/ui/Spinner";

type Flow = "signIn" | "signUp";

/** Turns the auth library's terse errors into something a trader can act on. */
function friendlyError(err: unknown, flow: Flow): string {
  const text = err instanceof Error ? err.message : String(err);
  if (/InvalidSecret|InvalidAccountId/i.test(text)) {
    return flow === "signIn"
      ? "That email and password do not match. Check them and try again."
      : "We could not create that account. Try a different email.";
  }
  if (/already exists|AccountAlreadyExists/i.test(text)) {
    return "That email already has an account. Try signing in instead.";
  }
  if (/password/i.test(text) && /(8|short|least|invalid)/i.test(text)) {
    return "Pick a password with at least 8 characters.";
  }
  return "Something went wrong on our side. Please try again in a moment.";
}

export default function SignInPage() {
  const { signIn } = useAuthActions();
  const router = useRouter();
  const [flow, setFlow] = useState<Flow>("signIn");
  const [busy, setBusy] = useState<"demo" | "form" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function tryDemo() {
    setBusy("demo");
    setError(null);
    try {
      await signIn("anonymous");
      router.replace("/");
    } catch {
      setError("We could not open the demo just now. Check your network and try again.");
      setBusy(null);
    }
  }

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy("form");
    setError(null);
    const formData = new FormData(e.currentTarget);
    formData.set("flow", flow);
    try {
      await signIn("password", formData);
      router.replace("/");
    } catch (err) {
      setError(friendlyError(err, flow));
      setBusy(null);
    }
  }

  const creating = flow === "signUp";

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-8 px-5 pb-10 pt-12">
      <header className="rise flex flex-col gap-4">
        <LogoMark size={56} />
        <div>
          <h1 className="text-4xl font-semibold tracking-[-0.03em] text-ink">SabiBook</h1>
          <p className="mt-2 text-xl leading-snug text-ink-soft">
            Just say what you sold. SabiBook writes it down and remembers who still owes you.
          </p>
        </div>
      </header>

      <section className="rise flex flex-col gap-2" style={{ "--d": "80ms" } as CSSProperties}>
        <Button full onClick={tryDemo} disabled={busy !== null} className="min-h-16 text-xl">
          {busy === "demo" ? <Spinner /> : null}
          Try the demo
        </Button>
        <p className="text-center text-base text-ink-soft">
          No sign up. You get a sample book to play with.
        </p>
      </section>

      <div className="flex items-center gap-3 text-ink-soft" aria-hidden>
        <span className="h-px flex-1 bg-rule" />
        <span className="text-sm">or keep your own book</span>
        <span className="h-px flex-1 bg-rule" />
      </div>

      <form onSubmit={submit} className="rise flex flex-col gap-4" style={{ "--d": "160ms" } as CSSProperties}>
        <Field label="Email" htmlFor="email">
          <Input id="email" name="email" type="email" autoComplete="email" required placeholder="you@example.com" />
        </Field>
        <Field label="Password" htmlFor="password" hint={creating ? "At least 8 characters." : undefined}>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete={creating ? "new-password" : "current-password"}
            required
            minLength={8}
          />
        </Field>

        {error && (
          <p role="alert" className="rounded-xl bg-owed-soft px-4 py-3 text-base font-medium text-owed">
            {error}
          </p>
        )}

        <Button type="submit" variant="secondary" full disabled={busy !== null}>
          {busy === "form" ? <Spinner /> : null}
          {creating ? "Create my account" : "Sign in"}
        </Button>
        <button
          type="button"
          onClick={() => {
            setFlow(creating ? "signIn" : "signUp");
            setError(null);
          }}
          className="min-h-12 text-base font-semibold text-ink underline underline-offset-4 transition-colors duration-150 hover:text-ink-soft"
        >
          {creating ? "I already have an account" : "New here? Create an account"}
        </button>
      </form>
    </main>
  );
}
