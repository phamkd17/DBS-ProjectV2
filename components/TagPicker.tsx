"use client";

import { useOptimistic, useRef, useState, useTransition } from "react";
import { tagEntry, untagEntry } from "@/app/actions";
import { STARTER_TAGS, type TagRow } from "@/lib/types";
import { eyebrow, focusRing } from "./ui";

type Tag = { id: string; name: string };
type Change = { add: Tag } | { remove: string }; // remove = by name

/**
 * Tags on a recipe (student, Nov 21): type a tag and press Enter. Your other
 * tags are listed below and narrow as you type; tap one to add it. A new name
 * becomes a new tag. × takes a tag off this recipe.
 */
export function TagPicker({ dictationId, allTags, selected }: { dictationId: string; allTags: TagRow[]; selected: string[] }) {
  const byId = new Map(allTags.map((t) => [t.id, t]));
  const initial = selected.map((id) => byId.get(id)).filter((t): t is TagRow => !!t);
  const [tags, change] = useOptimistic<Tag[], Change>(initial, (cur, c) =>
    "add" in c
      ? cur.some((t) => t.name.toLowerCase() === c.add.name.toLowerCase())
        ? cur
        : [...cur, c.add]
      : cur.filter((t) => t.name.toLowerCase() !== c.remove.toLowerCase()),
  );
  const [saving, start] = useTransition();
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const plus = useRef<HTMLButtonElement>(null);

  const typed = text.trim().replace(/\s+/g, " ");
  const on = new Set(tags.map((t) => t.name.toLowerCase()));
  // No tags yet? Offer the starter list (tapping one makes it).
  const pool: Tag[] = allTags.length ? allTags : STARTER_TAGS.map((name) => ({ id: `starter-${name}`, name }));
  const suggestions = pool.filter((t) => !on.has(t.name.toLowerCase()) && t.name.toLowerCase().includes(typed.toLowerCase()));
  const isNew = typed !== "" && !allTags.some((t) => t.name.toLowerCase() === typed.toLowerCase());

  const add = (name: string) => {
    const clean = name.trim().replace(/\s+/g, " ").slice(0, 40);
    if (!clean) return;
    setError(null);
    setText("");
    input.current?.focus();
    start(async () => {
      const existing = allTags.find((t) => t.name.toLowerCase() === clean.toLowerCase());
      change({ add: existing ?? { id: `new-${clean}`, name: clean } });
      const result = await tagEntry(dictationId, clean);
      if (!result.ok) {
        setError(result.error);
        setText(clean); // keep what was typed
      }
    });
  };
  const remove = (t: Tag) => {
    setError(null);
    start(async () => {
      change({ remove: t.name });
      const { ok } = await untagEntry(dictationId, t.name);
      if (!ok) setError(`Couldn't remove “${t.name}”. Try again.`);
    });
  };

  const close = () => {
    setEditing(false);
    setText("");
    setError(null);
    requestAnimationFrame(() => plus.current?.focus());
  };

  // Mobile-app style (student, Nov 28): one row of small chips ending in "+ Tag";
  // tapping it turns into a small box in the row. Suggestions show only while typing.
  const chip = "inline-flex h-8 items-center border font-ls-sans text-[14px]";
  return (
    <section aria-labelledby="tags-heading" aria-busy={saving} className="space-y-2">
      {/* No "All tags" link here (student, Nov 28); it's on the Recipes tab. */}
      <h2 id="tags-heading" className={eyebrow}>
        Tags
      </h2>

      <ul className="flex flex-wrap items-center gap-2" aria-label="Tags on this recipe">
        {tags.map((t) => (
          <li key={t.id} className={`${chip} border-ls-ink bg-ls-ink pl-2.5 text-ls-surface`}>
            <span>{t.name}</span>
            <button
              type="button"
              aria-label={`Remove ${t.name}`}
              title="Remove"
              onClick={() => remove(t)}
              className={`grid h-full w-7 cursor-pointer place-items-center text-base hover:bg-ls-surface/15 active:bg-ls-surface/25 ${focusRing}`}
            >
              <span aria-hidden>×</span>
            </button>
          </li>
        ))}
        <li>
          {editing ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                add(text);
              }}
            >
              <label htmlFor="tag-input" className="sr-only">
                Add a tag
              </label>
              <input
                ref={input}
                id="tag-input"
                autoFocus
                value={text}
                onChange={(e) => {
                  setText(e.target.value);
                  setError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Escape") close();
                }}
                onBlur={(e) => {
                  // Close when you tap away from the tags with nothing typed (tapping a tag or suggestion keeps it open).
                  const next = e.relatedTarget as Node | null;
                  if (!text.trim() && !(next && e.currentTarget.closest("section")?.contains(next))) {
                    setEditing(false);
                    setError(null);
                  }
                }}
                maxLength={40}
                autoComplete="off"
                enterKeyHint="done"
                placeholder="New tag"
                aria-invalid={!!error}
                aria-describedby="tag-hint"
                className={`${chip} w-36 border-ls-ink bg-ls-surface px-2.5 text-ls-ink placeholder:text-ls-muted/80 placeholder:italic ${focusRing}`}
              />
            </form>
          ) : (
            <button
              ref={plus}
              type="button"
              onClick={() => setEditing(true)}
              className={`${chip} cursor-pointer border-dashed border-ls-ink/50 px-2.5 text-ls-ink hover:border-ls-ink hover:bg-ls-surface active:bg-ls-ink/[0.08] ${focusRing}`}
            >
              + Tag
            </button>
          )}
        </li>
      </ul>

      {editing && (
        <div className="space-y-1.5">
          <p id="tag-hint" aria-live="polite" className="text-[14px]">
            {error ? (
              <span className="text-ls-error">{error}</span>
            ) : isNew ? (
              <span className="text-ls-muted">Press Enter to make the new tag “{typed}”.</span>
            ) : (
              <span className="text-ls-muted">Type a tag and press Enter, or tap one below.</span>
            )}
          </p>
          {suggestions.length > 0 && (
            <ul data-tag-suggestions className="flex flex-wrap gap-2" aria-label="Tap a tag to add it">
              {suggestions.map((t) => (
                <li key={t.id}>
                  <button
                    type="button"
                    onClick={() => add(t.name)}
                    className={`${chip} cursor-pointer border-ls-ink/40 bg-ls-surface px-2.5 text-ls-ink hover:border-ls-ink hover:bg-white ${focusRing}`}
                  >
                    <span aria-hidden>+&nbsp;</span>
                    <span className="sr-only">Add </span>
                    {t.name}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
