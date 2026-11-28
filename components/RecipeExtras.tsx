"use client";

import { createContext, useContext, useEffect, useId, useRef, useState, type ReactNode } from "react";
import type { Recipe } from "@/lib/ai/schema";
import { eyebrow, focusRing } from "./ui";

// ---------------------------------------------------------------------------
// Source labels (Grandma / Family answer / Suggested / Food science) and the
// history notes are marked .src-only and hidden. The student removed the
// "Show sources" switch (Nov 27).
// ---------------------------------------------------------------------------
// "Show all notes" (student, Nov 28): one switch opens or closes every note at
// once. Each note can still be opened on its own. `gen` changes on every flip,
// so the notes follow the switch even if one was opened or closed by hand.
const AllNotes = createContext<{ all: boolean; gen: number }>({ all: false, gen: 0 });

/** Follow the "Show all notes" switch: returns [open, setOpen] that resets whenever it flips. */
function useFollowAll(): [boolean, (f: (o: boolean) => boolean) => void] {
  const { all, gen } = useContext(AllNotes);
  const [open, setOpen] = useState(all);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    setOpen(all);
  }, [all, gen]);
  return [open, setOpen];
}

/** Shares the "All notes" switch between the breadcrumb line and the recipe below it. */
export function AllNotesProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState({ all: false, gen: 0 });
  return (
    <AllNotesSet.Provider value={setState}>
      <AllNotes.Provider value={state}>{children}</AllNotes.Provider>
    </AllNotesSet.Provider>
  );
}
const AllNotesSet = createContext<((f: (s: { all: boolean; gen: number }) => { all: boolean; gen: number }) => void) | null>(null);

/** The "All notes" switch (student, Nov 28: on the breadcrumb line, not its own row). */
export function AllNotesSwitch() {
  const { all } = useContext(AllNotes);
  const set = useContext(AllNotesSet);
  if (!set) return null;
  return (
    <button
      type="button"
      role="switch"
      aria-checked={all}
      onClick={() => set((s) => ({ all: !s.all, gen: s.gen + 1 }))}
      className={`-my-3 inline-flex min-h-11 shrink-0 cursor-pointer items-center gap-2 px-1 font-ls-sans text-xs font-medium uppercase tracking-[0.18em] text-ls-muted hover:text-ls-ink ${focusRing}`}
    >
      <span aria-hidden className={`relative h-4 w-7 shrink-0 rounded-full border border-ls-ink transition-colors ${all ? "bg-ls-ink" : "bg-ls-surface"}`}>
        <span
          className={`absolute top-1/2 left-[2px] size-2.5 -translate-y-1/2 rounded-full transition-transform duration-150 motion-reduce:transition-none ${
            all ? "translate-x-3 bg-ls-surface" : "bg-ls-ink"
          }`}
        />
      </span>
      All notes
    </button>
  );
}

export function SourcesScope({ children, hasNotes = false, ownSwitch = true }: { children: ReactNode; hasNotes?: boolean; ownSwitch?: boolean }) {
  // The "Show sources" switch was removed (student, Nov 27: not needed). The
  // labels are still saved with every recipe; they're just never shown.
  const body = <div data-sources="hidden" className="group/sources">{children}</div>;
  // The owner's recipe page puts the switch on its breadcrumb line (ownSwitch = false).
  if (!ownSwitch) return body;
  return (
    <AllNotesProvider>
      {hasNotes && (
        <div className="mb-2 flex justify-end">
          <AllNotesSwitch />
        </div>
      )}
      {body}
    </AllNotesProvider>
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
          ? "border-transparent bg-ls-ink/[0.08] text-ls-ink" // muted when open (student, Nov 28)
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
  const [whyOpen, setWhyOpen] = useFollowAll();
  const [dialsOpen, setDialsOpen] = useFollowAll();
  const id = useId();
  // Only show an icon when there's something real behind it (blank entries don't count).
  const cookWhy = step.why.filter((w) => w.source === "cook" && w.quote?.trim());
  const otherWhy = step.why.filter((w) => !(w.source === "cook" && w.quote?.trim()) && w.text?.trim());
  const realDials = step.dials.filter((d) => d.setting?.trim() && d.effect?.trim());
  const hasWhy = cookWhy.length + otherWhy.length > 0;
  const hasDials = realDials.length > 0;
  const text = <p className="flex-1 text-[17px] leading-relaxed">{step.text}</p>;
  if (!hasWhy && !hasDials) return text;

  const who = cookName || "The cook";

  return (
    <div className="space-y-2">
      {/* Icons sit at the end of the step's first line, so steps stay compact. */}
      <div className="flex items-start gap-2">
        {text}
        <div className="-mt-2 flex shrink-0">
        {hasWhy && (
          <IconToggle open={whyOpen} onClick={() => setWhyOpen((o) => !o)} controls={`${id}-why`} label={`Why step ${number} works`}>
            <FlaskIcon />
          </IconToggle>
        )}
        {hasDials && (
          <IconToggle open={dialsOpen} onClick={() => setDialsOpen((o) => !o)} controls={`${id}-dials`} label={`Adjust step ${number} to taste`}>
            <SlidersIcon />
          </IconToggle>
        )}
        </div>
      </div>

      {hasWhy && (
        // Muted (student, Nov 28): a thin rule, no tint. The flask icon and the heading tell it apart.
        <div id={`${id}-why`} hidden={!whyOpen} className="space-y-2 border-l border-ls-rule pl-4">
          <p className={eyebrow}>Why it works</p>
          {cookWhy.map((w, j) => (
            <div key={`c${j}`} className="space-y-0.5">
              <p className="text-[13px] font-medium text-ls-muted">{who}&apos;s reason</p>
              <q className="text-[17px] italic">{w.quote}</q>
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
        // Adjust to taste: the same muted look; the sliders icon and the heading tell it apart.
        <div id={`${id}-dials`} hidden={!dialsOpen} className="space-y-1 border-l border-ls-rule pl-4">
          <p className={eyebrow}>Adjust to taste</p>
          <ul className="space-y-0.5">
            {realDials.map((d, j) => (
              <li key={j} className="flex flex-wrap items-baseline gap-x-2 text-[15px]">
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

// Notes about how much to use are adjustments (sliders); anything else is a plain note.
// The flask is kept for food science only (student, Nov 28).
const TASTE = /\b(to taste|less|more|optional|prefer|preferred|adjust|if you like|sweeter|tangier|to your liking)\b/i;

function NoteIcon() {
  return (
    <svg aria-hidden viewBox="0 0 20 20" className="size-[18px]">
      <path d="M5 3.5h10v13H5zM7.5 7.5h5M7.5 10.5h5M7.5 13.5h3" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** An ingredient row whose extra note hides behind an icon: sliders for taste notes, a note icon otherwise. */
export function IngredientNote({ note, item, children }: { note: string; item: string; children: ReactNode }) {
  const [open, setOpen] = useFollowAll();
  const id = useId();
  const taste = TASTE.test(note);
  const label = taste ? `Adjust ${item} to taste` : `Note about ${item}`;
  return (
    <div className="w-full space-y-1">
      <div className="flex items-start justify-between gap-2">
        {children}
        <div className="-my-2 shrink-0">
          <IconToggle open={open} onClick={() => setOpen((o) => !o)} controls={`${id}-note`} label={label}>
            {taste ? <SlidersIcon /> : <NoteIcon />}
          </IconToggle>
        </div>
      </div>
      <p
        id={`${id}-note`}
        hidden={!open}
        className="border-l border-ls-rule pl-3 text-[15px] text-ls-muted"
      >
        {taste && <span className="font-medium">Adjust to taste: </span>}
        {note}
      </p>
    </div>
  );
}
