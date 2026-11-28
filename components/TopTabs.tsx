"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { focusRing } from "./ui";

// The three lab-book sections, always one tap away (student, Nov 20).
const TABS = [
  { key: "ideas", label: "Ideas" },
  { key: "development", label: "Development" },
  { key: "finished", label: "Recipes" }, // stored stage stays "finished" (v1 shares the DB)
] as const;

export function TopTabs() {
  const path = usePathname();
  const tab = useSearchParams().get("tab");
  return (
    <nav aria-label="Lab book sections" className="border-t border-ls-border">
      <ul className="mx-auto flex max-w-3xl gap-6 px-5 sm:gap-8">
        {TABS.map((t) => {
          const active = path === "/" && tab === t.key;
          return (
            <li key={t.key}>
              <Link
                href={`/?tab=${t.key}`}
                aria-current={active ? "page" : undefined}
                className={`-mb-px inline-flex min-h-11 items-center border-b-2 px-1 font-ls-sans text-xs font-medium uppercase tracking-[0.18em] transition-colors duration-150 ${focusRing} ${
                  active
                    ? "border-ls-ink text-ls-ink"
                    : "border-transparent text-ls-muted hover:border-ls-rule hover:text-ls-ink active:border-ls-border"
                }`}
              >
                {t.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
