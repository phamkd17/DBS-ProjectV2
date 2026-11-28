import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import type { Source } from "@/lib/ai/schema";
import { ClampText } from "./ClampText";

// Line & Stone building blocks (from Assignment 2's design system).

/** Small uppercase label, used for section eyebrows and field captions. */
export const eyebrow = "font-ls-sans text-[11px] font-medium uppercase tracking-[0.22em] text-ls-muted";

export const focusRing =
  "focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-ls-ink";

// ---------------------------------------------------------------------------
// Source labels. Each source has one look, used everywhere.
// ---------------------------------------------------------------------------
const SOURCE_STYLE: Record<Source, string> = {
  cook: "bg-src-cook text-src-cook-ink border-transparent",
  food_science: "bg-src-science text-src-science-ink border-transparent",
  suggested: "bg-src-suggested text-src-suggested-ink border-transparent",
  user_answer: "bg-ls-surface text-ls-ink border-ls-ink",
  not_stated: "bg-transparent text-ls-muted border-dashed border-ls-border",
};

export function sourceLabel(source: Source, cookName?: string | null) {
  switch (source) {
    case "cook":
      return cookName || "Cook";
    case "food_science":
      return "Food science";
    case "suggested":
      return "Suggested";
    case "user_answer":
      return "Family answer";
    case "not_stated":
      return "Not stated";
  }
}

export function SourceBadge({ source, cookName }: { source: Source; cookName?: string | null }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center border px-2 py-0.5 font-ls-sans text-[11px] font-medium uppercase leading-4 tracking-[0.16em] ${SOURCE_STYLE[source]}`}
    >
      {sourceLabel(source, cookName)}
    </span>
  );
}

/** Marks anything that calls the AI. Same blue tint as "Suggested": blue = from AI. */
export function AiBadge({ children = "Uses AI" }: { children?: ReactNode }) {
  return (
    <span className="inline-flex shrink-0 items-center bg-src-suggested px-2 py-0.5 font-ls-sans text-[11px] font-medium uppercase leading-4 tracking-[0.16em] text-src-suggested-ink">
      {children}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Buttons
// ---------------------------------------------------------------------------
const BUTTON_BASE = `inline-flex min-h-11 items-center justify-center gap-2 px-6 font-ls-sans text-xs font-medium uppercase tracking-[0.18em] transition-colors duration-150 select-none cursor-pointer disabled:cursor-not-allowed ${focusRing}`;

const BUTTON_VARIANT = {
  /** The one main action on a screen. */
  primary:
    "bg-ls-accent text-ls-surface hover:bg-ls-accent-hover active:translate-y-px active:bg-ls-accent-pressed disabled:bg-ls-disabled disabled:text-ls-muted",
  secondary:
    "border border-ls-ink text-ls-ink hover:bg-ls-ink/[0.06] active:translate-y-px active:bg-ls-ink/[0.12] disabled:border-ls-border disabled:text-ls-muted",
  quiet:
    "px-3 text-ls-ink underline decoration-ls-rule underline-offset-4 hover:decoration-ls-ink active:text-ls-muted disabled:text-ls-muted",
  danger:
    "px-3 text-ls-error underline decoration-ls-error/40 underline-offset-4 hover:decoration-ls-error active:opacity-80",
};
export type ButtonVariant = keyof typeof BUTTON_VARIANT;

export function buttonClass(variant: ButtonVariant = "primary", extra = "") {
  return `${BUTTON_BASE} ${BUTTON_VARIANT[variant]} ${extra}`;
}

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ComponentProps<"button"> & { variant?: ButtonVariant }) {
  return <button className={buttonClass(variant, className)} {...props} />;
}

export function LinkButton({
  variant = "primary",
  className = "",
  ...props
}: ComponentProps<typeof Link> & { variant?: ButtonVariant }) {
  return <Link className={buttonClass(variant, className)} {...props} />;
}

export const textLink = `underline decoration-ls-rule underline-offset-4 transition-colors hover:decoration-ls-ink active:text-ls-muted ${focusRing}`;

/** A square, hairline chip. "On" is Ink-filled (Scarlet stays for the one primary action). */
export function chipClass(on: boolean) {
  return `inline-flex min-h-11 cursor-pointer items-center gap-1.5 border px-3 font-ls-sans text-[15px] transition-colors duration-150 active:translate-y-px ${focusRing} ${
    on
      ? "border-ls-ink bg-ls-ink text-ls-surface hover:bg-ls-ink/85"
      : "border-ls-ink/40 bg-ls-surface text-ls-ink hover:border-ls-ink hover:bg-white active:bg-ls-ink/[0.08]"
  }`;
}

// ---------------------------------------------------------------------------
// Form fields
// ---------------------------------------------------------------------------
export const fieldClass = `w-full border border-ls-ink bg-ls-surface px-3 py-2.5 font-ls-sans text-base text-ls-ink placeholder:text-ls-muted/80 placeholder:italic transition-colors duration-150 hover:bg-white ${focusRing} aria-invalid:border-ls-error aria-invalid:border-2`;

// ---------------------------------------------------------------------------
// States
// ---------------------------------------------------------------------------
export function ErrorNote({ children, id }: { children: ReactNode; id?: string }) {
  return (
    <p id={id} role="alert" className="border-l-2 border-ls-error bg-ls-surface px-4 py-3 text-[15px] text-ls-error">
      {children}
    </p>
  );
}

/** A thin indeterminate line, Line & Stone's loading indicator. */
export function ProgressLine() {
  return (
    <span aria-hidden className="relative block h-0.5 w-full overflow-hidden bg-ls-rule/40">
      <span className="ls-progress absolute inset-y-0 left-0 w-2/5 bg-ls-ink" />
    </span>
  );
}

export function Spinner() {
  return (
    <span
      aria-hidden
      className="inline-block size-3.5 animate-spin rounded-full border-2 border-current border-r-transparent motion-reduce:animate-none"
    />
  );
}

// ---------------------------------------------------------------------------
// Kitchen notes (the rough instructions the AI turns into a recipe; first
// called "the cook's words"). Renamed by the student, Nov 27.
// ---------------------------------------------------------------------------
/** The tip shown wherever kitchen notes are added. Draft wording: for the student to review. */
export function KitchenNotesTip({ id }: { id?: string }) {
  return (
    <p id={id} className="border-l-2 border-ls-rule pl-3 text-[15px] text-ls-muted">
      <span className="font-medium text-ls-ink">Tip:</span> Include amounts and as much detail as you can, such as cooking
      times and temperatures. The more detail, the better the recipe.
    </p>
  );
}
/** The kitchen notes, exactly as saved. */
export function Transcript({
  text,
  cookName,
  open = false,
  editedAt,
}: {
  text: string;
  cookName?: string | null;
  open?: boolean;
  editedAt?: string | null;
}) {
  return (
    <details open={open} className="group border border-ls-border bg-ls-surface">
      <summary
        className={`flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 hover:bg-ls-ink/[0.04] active:bg-ls-ink/[0.08] ${focusRing}`}
      >
        <span className="flex items-center gap-3">
          <SourceBadge source="cook" cookName={cookName} />
          <span className="text-[15px]">
            {editedAt ? `Kitchen notes · edited ${formatDate(editedAt)}` : "Kitchen notes"}
          </span>
        </span>
        <span aria-hidden className="text-sm text-ls-muted transition-transform group-open:rotate-180">
          ▾
        </span>
      </summary>
      <div className="border-t border-ls-border px-4 pt-3 pb-1">
        <ClampText text={text} className="text-[17px] leading-relaxed" />
      </div>
    </details>
  );
}

export function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
