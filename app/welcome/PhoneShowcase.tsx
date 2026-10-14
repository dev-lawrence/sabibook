"use client";

import { useEffect, useState } from "react";
import { PhoneFrame } from "./PhoneFrame";

export type Screen = { id: string; src: string; alt: string; caption: string };

/**
 * A phone that follows the reader. Each section on the page names a screen with
 * `data-screen`, and whichever one crosses the middle of the viewport is shown.
 * The matching section also gets `data-active`, which the steps use for colour.
 */
export function PhoneShowcase({ screens }: { screens: Screen[] }) {
  const [active, setActive] = useState(screens[0].id);

  useEffect(() => {
    const sections = Array.from(document.querySelectorAll<HTMLElement>("[data-screen]"));
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const el = entry.target as HTMLElement;
          el.toggleAttribute("data-active", entry.isIntersecting);
          if (entry.isIntersecting && el.dataset.screen) setActive(el.dataset.screen);
        }
      },
      { rootMargin: "-49% 0px -50% 0px" },
    );
    sections.forEach((s) => observer.observe(s));
    return () => observer.disconnect();
  }, []);

  const current = screens.find((s) => s.id === active) ?? screens[0];

  return (
    <figure className="flex flex-col items-center gap-4">
      <PhoneFrame className="max-w-[17.5rem]">
        {screens.map((s, i) => (
          <PhoneFrame.Screen key={s.id} src={s.src} alt={s.alt} visible={s.id === active} eager={i === 0} />
        ))}
      </PhoneFrame>
      <figcaption aria-live="polite" className="text-sm text-ink-soft">
        {current.caption}
      </figcaption>
    </figure>
  );
}
