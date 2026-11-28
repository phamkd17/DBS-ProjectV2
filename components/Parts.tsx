"use client";

import { useState } from "react";
import { cleanPart } from "@/lib/types";
import { eyebrow, fieldClass, focusRing } from "./ui";

const chip = "inline-flex h-8 items-center border font-ls-sans text-[14px]";

/**
 * The parts of a recipe while editing (student, Nov 28): e.g. "Caramel sauce",
 * "Milk", "Egg mixture". Name them here (like tags), then pick a part on each row.
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
        Parts <span className="normal-case tracking-normal">(optional, e.g. Caramel, Custard)</span>
      </p>
      <ul aria-labelledby={`${idPrefix}-parts`} className="flex flex-wrap items-center gap-2">
        {parts.map((p) => (
          <li key={p} className={`${chip} border-ls-ink bg-ls-ink pl-2.5 text-ls-surface`}>
            <span>{p}</span>
            <button
              type="button"
              aria-label={`Remove part ${p}`}
              title="Remove part (its rows stay, with no part)"
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
                New part
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
                placeholder="Part name"
                className={`${chip} w-36 border-ls-ink bg-ls-surface px-2.5 text-ls-ink placeholder:text-ls-muted/80 placeholder:italic ${focusRing}`}
              />
            </>
          ) : (
            <button
              type="button"
              onClick={() => setAdding(true)}
              className={`${chip} cursor-pointer border-dashed border-ls-ink/50 px-2.5 text-ls-ink hover:border-ls-ink hover:bg-ls-surface ${focusRing}`}
            >
              + Part
            </button>
          )}
        </li>
      </ul>
    </div>
  );
}

/** Which part a row belongs to (shown only once the recipe has parts). */
export function PartSelect({
  id,
  label,
  parts,
  value,
  onChange,
}: {
  id: string;
  label: string;
  parts: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  if (parts.length === 0) return null;
  return (
    <div className="flex items-center gap-2">
      <label htmlFor={id} className={eyebrow}>
        Part<span className="sr-only"> of {label}</span>
      </label>
      <select
        id={id}
        value={parts.includes(value) ? value : ""}
        onChange={(e) => onChange(e.target.value)}
        className={`${fieldClass} w-auto min-w-0 py-1.5 text-[15px]`}
      >
        <option value="">No part</option>
        {parts.map((p) => (
          <option key={p} value={p}>
            {p}
          </option>
        ))}
      </select>
    </div>
  );
}
