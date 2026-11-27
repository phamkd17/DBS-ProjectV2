"use client";

import { useId, useState, type ReactNode } from "react";
import type { Recipe } from "@/lib/ai/schema";
import { eyebrow, focusRing } from "./ui";

// ---------------------------------------------------------------------------
// "Show sources": the recipe is calm by default. Turning this on reveals the
// labels (Grandma / Family answer / Suggested / Food science) and the history
// notes, via [data-sources] on the wrapper and the .src-only class.
// ---------------------------------------------------------------------------
export function SourcesScope({ children }: { children: ReactNode }) {
  const [show, setShow] = useState(false);
  return (
    <div data-sources={show ? "shown" : "hidden"} className="group/sources space-y-2">
      <div className="flex justify-end">
        <button
          type="button"
          role="switch"
          aria-checked={show}
          onClick={() => setShow((s) => !s)}
          className={`inline-flex min-h-11 cursor-pointer items-center gap-3 px-1 font-ls-sans text-xs font-medium uppercase tracking-[0.18em] text-ls-muted hover:text-ls-ink ${focusRing}`}
        >
          <span
            aria-hidden
            className={`relative h-5 w-9 shrink-0 rounded-full border border-ls-ink transition-colors ${show ? "bg-ls-ink" : "bg-ls-surface"}`}
          >
            <span
              className={`absolute top-1/2 left-[3px] size-3 -translate-y-1/2 rounded-full transition-transform duration-150 motion-reduce:transition-none ${
                show ? "translate-x-4 bg-ls-surface" : "bg-ls-ink"
              }`}
            />
          </span>
          Show sources
        </button>
      </div>
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Icons
// ---------------------------------------------------------------------------
function FlaskIcon() {
  return (
    <svg aria-hidden viewBox="0 0 20 20" className="size-[18px]">
      <path
        d="M8 2.5h4M8.6 2.5v5L4 15.3a1.5 1.5 0 0 0 1.3 2.2h9.4a1.5 1.5 0 0 0 1.3-2.2L11.4 7.5v-5M6.2 12h7.6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SlidersIcon() {
  return (
    <svg aria-hidden viewBox="0 0 20 20" className="size-[18px]">
      <path
        d="M3 5.5h8M15 5.5h2M3 14.5h2M9 14.5h8M13 3.5v4M7 12.5v4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconToggle({
  open,
  onClick,
  controls,
  label,
  children,
}: {
  open: boolean;
  onClick: () => void;
  controls: string;
  label: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-expanded={open}
      aria-controls={controls}
      aria-label={label}
      title={label}
      onClick={onClick}
      className={`inline-grid size-11 cursor-pointer place-items-center border transition-colors ${focusRing} ${
        open
          ? "border-ls-ink bg-ls-ink text-ls-surface"
          : "border-transparent text-ls-muted hover:bg-ls-ink/[0.06] hover:text-ls-ink active:bg-ls-ink/[0.12]"
      }`}
    >
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Per step: a Science icon (why: her reason first, then the food science) and
// an Adjust-to-taste icon (dials). Both closed by default.
// ---------------------------------------------------------------------------
export function StepExtras({
  step,
  number,
  cookName,
}: {
  step: Recipe["steps"][number];
  number: number;
  cookName?: string | null;
}) {
  const [open, setOpen] = useState<"why" | "dials" | null>(null);
  const id = useId();
  // Only show an icon when there's something real behind it (blank entries don't count).
  const cookWhy = step.why.filter((w) => w.source === "cook" && w.quote?.trim());
  const otherWhy = step.why.filter((w) => !(w.source === "cook" && w.quote?.trim()) && w.text?.trim());
  const realDials = step.dials.filter((d) => d.setting?.trim() && d.effect?.trim());
  const hasWhy = cookWhy.length + otherWhy.length > 0;
  const hasDials = realDials.length > 0;
  const text = <p className="flex-1 text-[17px] leading-relaxed">{step.text}</p>;
  if (!hasWhy && !hasDials) return text;
  const toggle = (k: "why" | "dials") => setOpen((o) => (o === k ? null : k));
  const who = cookName || "The cook";

  return (
    <div className="space-y-3">
      {/* Icons sit at the end of the step's first line, so steps stay compact. */}
      <div className="flex items-start gap-2">
        {text}
        <div className="-mt-2 flex shrink-0">
        {hasWhy && (
          <IconToggle open={open === "why"} onClick={() => toggle("why")} controls={`${id}-why`} label={`Why step ${number} works`}>
            <FlaskIcon />
          </IconToggle>
        )}
        {hasDials && (
          <IconToggle open={open === "dials"} onClick={() => toggle("dials")} controls={`${id}-dials`} label={`Adjust step ${number} to taste`}>
            <SlidersIcon />
          </IconToggle>
        )}
        </div>
      </div>

      {hasWhy && (
        <div id={`${id}-why`} hidden={open !== "why"} className="space-y-3 border-l-2 border-ls-ink pl-4">
          <p className={eyebrow}>Why it works</p>
          {cookWhy.map((w, j) => (
            <div key={`c${j}`} className="space-y-0.5">
              <p className="text-[13px] font-medium text-ls-muted">{who}&apos;s reason</p>
              <q className="font-ls-serif text-lg italic">{w.quote}</q>
            </div>
          ))}
          {otherWhy.map((w, j) => (
            <div key={`o${j}`} className="space-y-0.5">
              <p className="text-[13px] font-medium text-ls-muted">
                {w.source === "food_science" ? "The science" : w.source === "suggested" ? "A suggestion" : "From the family"}
              </p>
              <p className="text-[15px] leading-relaxed">{w.text}</p>
            </div>
          ))}
        </div>
      )}

      {hasDials && (
        <div id={`${id}-dials`} hidden={open !== "dials"} className="space-y-1.5">
          <p className={eyebrow}>Adjust to taste</p>
          <ul className="divide-y divide-ls-rule/60 border border-ls-border bg-ls-surface">
            {realDials.map((d, j) => (
              <li key={j} className="flex flex-wrap items-baseline gap-x-2 px-3 py-2 text-[15px]">
                <span className="font-medium">{d.setting}</span>
                <span aria-hidden className="text-ls-muted">
                  →
                </span>
                <span>{d.effect}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
