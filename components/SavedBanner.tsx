"use client";

import Link from "next/link";
import { useEffect } from "react";
import { buttonClass, textLink } from "./ui";

/**
 * Issue #2: right after saving an idea, say so and offer the next step.
 * Shown once: the ?saved=1 flag is removed from the address bar, so a refresh or
 * a later visit doesn't show it again.
 */
export function SavedBanner() {
  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.delete("saved");
    window.history.replaceState(window.history.state, "", url);
  }, []);
  return (
    <div role="status" className="flex flex-wrap items-center justify-between gap-3 border-l-2 border-ls-success bg-ls-surface px-4 py-3">
      <p className="text-[17px]">
        <span aria-hidden className="text-ls-success">✓ </span>Saved to Ideas.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/ideas/new" className={buttonClass("primary")}>
          Add another idea
        </Link>
        <Link href="/?tab=ideas" className={`min-h-11 px-1 py-3 font-ls-sans text-xs font-medium uppercase tracking-[0.18em] ${textLink}`}>
          See all ideas
        </Link>
      </div>
    </div>
  );
}
