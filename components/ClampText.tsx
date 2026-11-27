"use client";

import { useLayoutEffect, useRef, useState } from "react";

/**
 * Long text (the kitchen notes) shows its first few lines with "Show all", so
 * the next step isn't pushed far down the page (student, Nov 27: compact).
 */
export function ClampText({ text, className = "" }: { text: string; className?: string }) {
  const p = useRef<HTMLParagraphElement>(null);
  const [open, setOpen] = useState(false);
  const [long, setLong] = useState(false);
  useLayoutEffect(() => {
    const el = p.current;
    if (el && !open) setLong(el.scrollHeight > el.clientHeight + 1);
  }, [text, open]);
  return (
    <div>
      <p ref={p} className={`whitespace-pre-wrap ${open ? "" : "line-clamp-6"} ${className}`}>
        {text}
      </p>
      {(long || open) && (
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          className={`mt-1 min-h-11 cursor-pointer font-ls-sans text-xs font-medium uppercase tracking-[0.18em] underline decoration-ls-rule underline-offset-4 hover:decoration-ls-ink focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-ls-ink`}
        >
          {open ? "Show less" : "Show all"}
        </button>
      )}
    </div>
  );
}
