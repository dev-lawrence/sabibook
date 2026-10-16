import type { Metadata } from "next";
import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowUpRight01Icon, GithubIcon } from "@hugeicons/core-free-icons";
import { Logo } from "@/components/Logo";
import { DemoButton } from "./DemoButton";
import { PhoneFrame } from "./PhoneFrame";
import { PhoneShowcase, type Screen } from "./PhoneShowcase";

// Signed-out visitors see this page at `/`. proxy.ts rewrites to it.

export const metadata: Metadata = {
  title: "SabiBook: say what you sold, it writes it down",
  description:
    "A voice-first sales and debt book for small traders. Say a sale in Pidgin or English, check the draft, tap Save.",
};

const REPO_URL = "https://github.com/dev-lawrence/sabibook";

const SCREENS: Screen[] = [
  { id: "home", src: "/landing/home-v2.png", alt: "SabiBook home screen with the red Hold to talk button", caption: "Home, with the one button" },
  { id: "draft", src: "/landing/draft-v2.png", alt: "Draft card showing the sentence it heard and the fields it filled in", caption: "The draft card" },
  { id: "save", src: "/landing/draft-save-v2.png", alt: "Bottom of the draft card: total, paid now, still owed, and the Save button", caption: "Nothing is saved until you tap Save" },
  { id: "debtors", src: "/landing/debtors-v2.png", alt: "Debtors screen listing each customer and how much they owe", caption: "Who owes you, and how much" },
];

const STEPS = [
  {
    screen: "home",
    title: "Hold the button and talk",
    body: "Say it the way you would tell a friend. “I sold three bags of rice to Mama Ngozi for forty five thousand, she paid thirty five.”",
  },
  {
    screen: "draft",
    title: "Check the draft",
    body: "A card shows what it heard and what it wrote: the customer, the items, the total, what was paid and what is still owed. You can change any field.",
  },
  {
    screen: "debtors",
    title: "Tap Save",
    body: "The entry goes into your book. If money is still owed, it is added to that customer on your Debtors list, ready for a reminder on WhatsApp.",
  },
];

export default function WelcomePage() {
  return (
    <div className="min-h-dvh bg-paper text-ink">
      <SiteHeader />

      <main className="mx-auto max-w-6xl px-5 sm:px-8 lg:grid lg:grid-cols-[minmax(0,1fr)_17.5rem] lg:gap-x-20 lg:px-10 xl:gap-x-28">
        <div className="min-w-0">
          {/* Hero */}
          <section data-screen="home" className="pb-14 pt-12 sm:pt-16 lg:pb-24 lg:pt-28">
            <h1
              className="rise text-balance text-[2.5rem] font-semibold leading-[1.04] tracking-[-0.035em] sm:text-[3.25rem] lg:text-[3.5rem] xl:text-[3.75rem]"
              style={{ "--d": "0ms" } as CSSProperties}
            >
              <span className="sm:block">Say what you sold.</span> <span className="sm:block">SabiBook writes it down.</span>
            </h1>
            <p
              className="rise mt-6 max-w-[34rem] text-lg leading-relaxed text-ink-soft sm:text-xl sm:leading-relaxed"
              style={{ "--d": "90ms" } as CSSProperties}
            >
              A sales and debt book for small traders. Hold one button, say the sale in Pidgin or English, check
              the draft and tap Save. It keeps count of who still owes you.
            </p>
            <div
              className="rise mt-9 flex flex-wrap items-center gap-x-7 gap-y-4"
              style={{ "--d": "180ms" } as CSSProperties}
            >
              <DemoButton />
              <a
                href={REPO_URL}
                className="inline-flex min-h-12 items-center gap-2 text-lg font-semibold text-ink underline decoration-rule decoration-2 underline-offset-[6px] transition-colors hover:decoration-ink"
              >
                <HugeiconsIcon icon={GithubIcon} size={20} />
                View the code
              </a>
            </div>
            <p className="rise mt-4 text-[0.9375rem] text-ink-soft" style={{ "--d": "240ms" } as CSSProperties}>
              No sign up. The demo opens a sample book you can play with.
            </p>
          </section>

          {/* On phones and tablets the app sits under the hero, once. */}
          <div className="rise -mt-2 mb-16 flex justify-center lg:hidden" style={{ "--d": "300ms" } as CSSProperties}>
            <figure className="flex w-full flex-col items-center gap-3">
              <PhoneFrame className="max-w-[16.5rem]">
                <PhoneFrame.Screen src="/landing/draft-v2.png" alt={SCREENS[1].alt} eager />
              </PhoneFrame>
              <figcaption className="text-sm text-ink-soft">The draft card, from the real app</figcaption>
            </figure>
          </div>

          <VideoSlot />

          <Section title="For the trader whose book is full of credit">
            <p>
              You run a provision shop or a stall in the market. Regular customers take goods today and pay next
              week, and the record lives in an exercise book, a WhatsApp chat with yourself, or your head. On a busy
              day entries get skipped and nobody remembers if Emeka paid the second half. Typing is slow with
              customers in front of you. Talking takes a few seconds.
            </p>
          </Section>

          <Section title="From your voice to your book">
            <ol className="mt-2 flex flex-col">
              {STEPS.map((step, i) => (
                <li
                  key={step.title}
                  data-screen={step.screen}
                  className="step grid grid-cols-[2.75rem_minmax(0,1fr)] gap-x-3 border-t border-rule py-7 first:border-t-0 first:pt-2 sm:grid-cols-[4rem_minmax(0,1fr)]"
                >
                  <span className="step-num tabular pt-0.5 text-lg font-semibold text-ink-soft/60">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <div>
                    <h3 className="text-xl font-semibold tracking-[-0.01em] text-ink">{step.title}</h3>
                    <p className="mt-2 text-[1.0625rem] leading-relaxed text-ink-soft">{step.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </Section>

          <Section title="What it never does" screen="save">
            <div className="mt-2 grid gap-x-10 gap-y-8 sm:grid-cols-2">
              <Rule title="It never invents a figure.">
                Every amount on the draft has to be one you said. If the model comes back with a number you did not
                say, the field is marked &ldquo;I did not hear this&rdquo;. The balance is plain arithmetic, total
                minus paid, worked out in code.
              </Rule>
              <Rule title="Nothing is saved until you tap Save.">
                The draft waits on your screen. Fix what is wrong, or throw it away. Your book only changes when you
                say so.
              </Rule>
            </div>
          </Section>

          <Section title="Open models, on your own machine" screen="debtors">
            <p>
              Whisper turns your voice into words. Gemma 4 reads the words and fills in the ledger entry. Both are
              open-weight models, and both run on your own laptop or server, so a trader&rsquo;s book does not have
              to leave the shop. There is no bill per sentence.
            </p>
            <dl className="mt-8 border-y border-rule text-base">
              <ModelRow job="Speech to text" model="Whisper large v3 turbo" licence="MIT" />
              <ModelRow job="Words to entry" model="Gemma 4 E4B, through Ollama" licence="Gemma licence" />
            </dl>
            <p className="mt-6 text-base">
              Extraction eval: 35 of 40 exact.{" "}
              <a
                href={`${REPO_URL}/blob/main/eval/results.md`}
                className="font-semibold text-ink underline decoration-rule decoration-2 underline-offset-4 transition-colors hover:decoration-ink"
              >
                See the results
              </a>
            </p>
            <p className="mt-2 text-base">
              <Link
                href="/how-it-works"
                className="font-semibold text-ink underline decoration-rule decoration-2 underline-offset-4 transition-colors hover:decoration-ink"
              >
                How it works, step by step
              </Link>
            </p>
          </Section>

          <section className="reveal border-t border-rule py-16 lg:py-24">
            <h2 className="max-w-[18ch] text-balance text-[2rem] font-semibold leading-[1.1] tracking-[-0.03em] sm:text-[2.5rem]">
              Open the sample book and say a sale.
            </h2>
            <div className="mt-8 flex flex-wrap items-center gap-x-7 gap-y-4">
              <DemoButton />
              <a
                href={REPO_URL}
                className="inline-flex min-h-12 items-center gap-2 text-lg font-semibold text-ink underline decoration-rule decoration-2 underline-offset-[6px] transition-colors hover:decoration-ink"
              >
                Run it yourself
                <HugeiconsIcon icon={ArrowUpRight01Icon} size={20} />
              </a>
            </div>
          </section>
        </div>

        {/* Desktop: the phone stays beside the copy and changes screen as you read. */}
        <aside className="hidden lg:block">
          <div
            className="rise sticky pt-16"
            style={{ "--d": "200ms", top: "max(4.5rem, calc(50vh - 19.5rem))" } as CSSProperties}
          >
            <PhoneShowcase screens={SCREENS} />
          </div>
        </aside>
      </main>

      <SiteFooter />
    </div>
  );
}

function SiteHeader() {
  return (
    <header className="border-b border-rule">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-5 sm:px-8 lg:px-10">
        <Link href="/" aria-label="SabiBook home">
          <Logo />
        </Link>
        <nav aria-label="Site" className="flex items-center gap-5 sm:gap-7">
          <Link href="/how-it-works" className="hidden text-[0.9375rem] text-ink-soft transition-colors hover:text-ink sm:inline">
            How it works
          </Link>
          <a
            href={REPO_URL}
            aria-label="SabiBook on GitHub"
            className="inline-flex items-center gap-1.5 text-[0.9375rem] text-ink-soft transition-colors hover:text-ink"
          >
            <HugeiconsIcon icon={GithubIcon} size={20} />
            <span className="hidden sm:inline">GitHub</span>
          </a>
          <DemoButton size="small" />
        </nav>
      </div>
    </header>
  );
}

function VideoSlot() {
  return (
    <section aria-label="Demo video" className="reveal mb-16 lg:mb-24">
      <video
        className="aspect-video w-full rounded-card border border-rule bg-paper-deep"
        src="/landing/demo.mp4"
        poster="/landing/demo-poster.jpg"
        controls
        muted
        playsInline
        preload="none"
      >
        <track kind="captions" src="/landing/demo.vtt" srcLang="en" label="English" default />
      </video>
      <p className="mt-3 text-sm text-ink-soft">
        A real run on a laptop. The voice is a text-to-speech recording played into the microphone, and the
        waits while the models work are cut, with the cuts marked.
      </p>
    </section>
  );
}

function Section({ title, screen, children }: { title: string; screen?: string; children: ReactNode }) {
  return (
    <section data-screen={screen} className="reveal border-t border-rule py-16 lg:py-24">
      <h2 className="max-w-[22ch] text-balance text-[1.75rem] font-semibold leading-[1.15] tracking-[-0.025em] sm:text-[2.125rem]">
        {title}
      </h2>
      <div className="mt-6 max-w-[38rem] text-[1.0625rem] leading-relaxed text-ink-soft sm:text-lg sm:leading-relaxed">
        {children}
      </div>
    </section>
  );
}

function Rule({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="border-l-[3px] border-margin pl-5">
      <h3 className="text-lg font-semibold leading-snug text-ink">{title}</h3>
      <p className="mt-2 text-base leading-relaxed text-ink-soft">{children}</p>
    </div>
  );
}

function ModelRow({ job, model, licence }: { job: string; model: string; licence: string }) {
  return (
    <div className="grid grid-cols-1 gap-y-0.5 border-t border-rule py-4 first:border-t-0 sm:grid-cols-[10rem_minmax(0,1fr)_auto] sm:gap-x-6">
      <dt className="text-ink-soft">{job}</dt>
      <dd className="font-semibold text-ink">{model}</dd>
      <dd className="text-ink-soft">{licence}</dd>
    </div>
  );
}

function SiteFooter() {
  return (
    <footer className="border-t border-rule">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-5 py-10 text-[0.9375rem] text-ink-soft sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-10">
        <p>
          SabiBook is open source under the{" "}
          <a href={`${REPO_URL}/blob/main/LICENSE`} className="underline underline-offset-4 hover:text-ink">
            MIT licence
          </a>
          .
        </p>
        <nav aria-label="Footer" className="flex gap-6">
          <Link href="/how-it-works" className="hover:text-ink">
            How it works
          </Link>
          <a href={REPO_URL} className="hover:text-ink">
            GitHub
          </a>
        </nav>
      </div>
    </footer>
  );
}
