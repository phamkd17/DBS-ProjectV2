"use client";

import { useState } from "react";
import { cleanPart } from "@/lib/types";
import { eyebrow, focusRing } from "./ui";

const chip = "inline-flex h-8 items-center border font-ls-sans text-[14px]";

/**
 * The components of a recipe while editing (student, Nov 28; first called "parts"):
 * e.g. "Caramel sauce", "Milk", "Egg mixture". Name them here (like tags), then
 * tap one on each row (one tap, no dropdown).
 */
export function PartsBar({
  parts,
  onAdd,
  onRemove,
  idPrefix,
}: {
  parts: string[];
  onAdd: (name: string) => void;
  onRemove: (name: string) => void;
  idPrefix: string;
}) {
  const [adding, setAdding] = useState(false);
  const [text, setText] = useState("");
  const add = () => {
    const name = cleanPart(text);
    if (name && !parts.some((p) => p.toLowerCase() === name.toLowerCase())) onAdd(name);
    setText("");
  };
  return (
    <div className="space-y-1">
      <p className={eyebrow} id={`${idPrefix}-parts`}>
        Components <span className="normal-case tracking-normal">(optional, e.g. Caramel, Custard)</span>
      </p>
      <ul aria-labelledby={`${idPrefix}-parts`} className="flex flex-wrap items-center gap-2">
        {parts.map((p) => (
          <li key={p} className={`${chip} border-ls-ink bg-ls-ink pl-2.5 text-ls-surface`}>
            <span>{p}</span>
            <button
              type="button"
              aria-label={`Remove component ${p}`}
              title="Remove component (its rows stay, with none)"
              onClick={() => onRemove(p)}
              className={`grid h-full w-7 cursor-pointer place-items-center text-base hover:bg-ls-surface/15 ${focusRing}`}
            >
              <span aria-hidden>×</span>
            </button>
          </li>
        ))}
        <li>
          {adding ? (
            <>
              <label htmlFor={`${idPrefix}-new-part`} className="sr-only">
                New component
              </label>
              <input
                id={`${idPrefix}-new-part`}
                autoFocus
                value={text}
                maxLength={60}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault(); // don't submit the form
                    add();
                  }
                  if (e.key === "Escape") {
                    e.stopPropagation(); // close this box, not the whole editor
                    setAdding(false);
                    setText("");
                  }
                }}
                onBlur={() => {
                  add();
                  setAdding(false);
                }}
                placeholder="Component name"
                className={`${chip} w-36 border-ls-ink bg-ls-surface px-2.5 text-ls-ink placeholder:text-ls-muted/80 placeholder:italic ${focusRing}`}
              />
            </>
          ) : (
            <button
              type="button"
              onClick={() => setAdding(true)}
              className={`${chip} cursor-pointer border-dashed border-ls-ink/50 px-2.5 text-ls-ink hover:border-ls-ink hover:bg-ls-surface ${focusRing}`}
            >
              + Component
            </button>
          )}
        </li>
      </ul>
    </div>
  );
}

/**
 * Which component a row belongs to: one tap on a chip (student, Nov 28: a dropdown
 * took two). Shown only once the recipe has components.
 */
export function PartSelect({
  id,
  label,
  parts,
  value,
  onChange,
  selected,
  onSelect,
}: {
  id: string;
  label: string;
  parts: string[];
  value: string;
  onChange: (v: string) => void;
  /** Bulk move (student, Nov 28): tick several rows, then pick a component once. */
  selected?: boolean;
  onSelect?: (on: boolean) => void;
}) {
  if (parts.length === 0) return null;
  const current = parts.includes(value) ? value : "";
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {onSelect && (
        <label className="-my-2 -ml-1 inline-flex min-h-11 cursor-pointer items-center px-1">
          <input
            type="checkbox"
            checked={!!selected}
            onChange={(e) => onSelect(e.target.checked)}
            className="size-5 cursor-pointer accent-ls-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ls-ink"
          />
          <span className="sr-only">Select {label}</span>
        </label>
      )}
    <div id={id} role="radiogroup" aria-label={`Component of ${label}`} className="flex flex-wrap gap-1.5">
      {["", ...parts].map((p) => {
        const on = current === p;
        return (
          <button
            key={p || "_none"}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(p)}
            className={`inline-flex h-7 cursor-pointer items-center border px-2 font-ls-sans text-[13px] transition-colors ${focusRing} ${
              on ? "border-ls-ink bg-ls-ink text-ls-surface" : "border-ls-ink/30 text-ls-muted hover:border-ls-ink hover:text-ls-ink"
            }`}
          >
            {p || "None"}
          </button>
        );
      })}
    </div>
    </div>
  );
}

/** Shown while rows are ticked: move them all into one component with one tap. Sticks to the bottom while you scroll. */
export function BulkMoveBar({
  count,
  parts,
  noun,
  onMove,
  onClear,
}: {
  count: number;
  parts: string[];
  noun: string;
  onMove: (part: string) => void;
  onClear: () => void;
}) {
  if (count === 0 || parts.length === 0) return null;
  return (
    <div role="group" aria-label={`Move ${count} selected ${noun}`} className="sticky bottom-0 z-10 -mx-4 flex flex-wrap items-center gap-1.5 border-t border-ls-ink bg-ls-bg px-4 py-2">
      <span className="mr-1 font-ls-sans text-xs font-medium uppercase tracking-[0.18em] text-ls-ink">
        Move {count} to
      </span>
      {["", ...parts].map((p) => (
        <button
          key={p || "_none"}
          type="button"
          onClick={() => onMove(p)}
          className={`inline-flex h-8 cursor-pointer items-center border border-ls-ink bg-ls-surface px-2.5 font-ls-sans text-[14px] text-ls-ink hover:bg-white active:bg-ls-ink/[0.08] ${focusRing}`}
        >
          {p || "None"}
        </button>
      ))}
      <button type="button" onClick={onClear} className={`ml-auto min-h-11 cursor-pointer px-1 font-ls-sans text-xs font-medium uppercase tracking-[0.18em] text-ls-muted underline underline-offset-4 ${focusRing}`}>
        Clear
      </button>
    </div>
  );
}
