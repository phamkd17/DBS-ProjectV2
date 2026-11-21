"use client";

import { useRef, type ReactNode } from "react";
import { focusRing } from "./ui";

/**
 * Issue #4: a "?" in the header that opens "How it works" anywhere.
 * Native <dialog>: Escape closes it, focus stays inside, and focus returns to the "?".
 */
export function HelpButton({ children }: { children: ReactNode }) {
  const dialog = useRef<HTMLDialogElement>(null);
  return (
    <>
      <button
        type="button"
        aria-haspopup="dialog"
        aria-label="How it works"
        title="How it works"
        onClick={() => dialog.current?.showModal()}
        className={`inline-grid size-11 cursor-pointer place-items-center rounded-full font-ls-serif text-xl text-ls-ink hover:bg-ls-ink/[0.06] active:bg-ls-ink/[0.12] ${focusRing}`}
      >
        <span aria-hidden className="grid size-7 place-items-center rounded-full border border-ls-ink leading-none">
          ?
        </span>
      </button>
      <dialog
        ref={dialog}
        aria-labelledby="how-it-works-title"
        onClick={(e) => {
          if (e.target === e.currentTarget) dialog.current?.close(); // click on the backdrop
        }}
        className="m-auto w-[min(44rem,calc(100vw-2.5rem))] border border-ls-ink bg-ls-bg p-0 text-ls-ink backdrop:bg-ls-ink/40"
      >
        <div className="space-y-5 p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <h2 id="how-it-works-title" className="font-ls-serif text-3xl leading-tight">
              How it works
            </h2>
            <button
              type="button"
              aria-label="Close"
              onClick={() => dialog.current?.close()}
              className={`-mt-2 -mr-2 grid size-11 cursor-pointer place-items-center text-2xl text-ls-muted hover:bg-ls-ink/[0.06] hover:text-ls-ink ${focusRing}`}
            >
              <span aria-hidden>×</span>
            </button>
          </div>
          {children}
        </div>
      </dialog>
    </>
  );
}
