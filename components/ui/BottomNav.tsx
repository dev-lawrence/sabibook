"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  BookOpen01Icon,
  Home01Icon,
  Settings02Icon,
  UserMultiple02Icon,
} from "@hugeicons/core-free-icons";

const TABS = [
  { href: "/", label: "Home", icon: Home01Icon },
  { href: "/ledger", label: "Ledger", icon: BookOpen01Icon },
  { href: "/debtors", label: "Debtors", icon: UserMultiple02Icon },
  { href: "/settings", label: "Settings", icon: Settings02Icon },
];

/** Fixed bottom bar with the four main tabs. Respects the phone's safe area. */
export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-20 border-t border-rule bg-card pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="mx-auto flex max-w-md">
        {TABS.map((tab) => {
          const active = tab.href === "/" ? pathname === "/" : pathname.startsWith(tab.href);
          return (
            <li key={tab.href} className="flex-1">
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={`relative flex min-h-16 flex-col items-center justify-center gap-0.5 text-sm transition-colors duration-150 ${
                  active ? "font-semibold text-ink" : "font-medium text-ink-soft"
                }`}
              >
                <span className="relative flex h-8 w-14 items-center justify-center">
                  {active && <span className="pill-in absolute inset-0 rounded-full bg-paper-deep" />}
                  <HugeiconsIcon
                    icon={tab.icon}
                    size={26}
                    strokeWidth={active ? 2.2 : 1.6}
                    className="relative"
                  />
                </span>
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
