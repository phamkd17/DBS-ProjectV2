"use client";

import Link from "next/link";
import { useOptimistic, useRef, useState, useTransition } from "react";
import { tagEntry, untagEntry } from "@/app/actions";
import { STARTER_TAGS, type TagRow } from "@/lib/types";
import { Button, chipClass, eyebrow, fieldClass, focusRing, textLink } from "./ui";

type Tag = { id: string; name: string };
type Change = { add: Tag } | { remove: string };

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
      : cur.filter((t) => t.id !== c.remove),
  );
  const [, start] = useTransition();
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

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
    input.current?.focus();
    start(async () => {
      change({ remove: t.id });
      const { ok } = await untagEntry(dictationId, t.id);
      if (!ok) setError(`Couldn't remove “${t.name}”. Try again.`);
    });
  };

  return (
    <section aria-labelledby="tags-heading" className="space-y-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="tags-heading" className={eyebrow}>
          Tags
        </h2>
        {allTags.length > 0 && (
          <Link href="/tags" className={`font-ls-sans text-xs font-medium uppercase tracking-[0.18em] ${textLink}`}>
            Edit tags
          </Link>
        )}
      </div>

      {tags.length > 0 && (
        <ul className="flex flex-wrap gap-2" aria-label="Tags on this recipe">
          {tags.map((t) => (
            <li key={t.id} className="inline-flex min-h-11 items-center border border-ls-ink bg-ls-ink pl-3 font-ls-sans text-[15px] text-ls-surface">
              {t.name}
              <button
                type="button"
                aria-label={`Remove ${t.name}`}
                title="Remove"
                onClick={() => remove(t)}
                className={`grid size-11 cursor-pointer place-items-center text-lg hover:bg-ls-surface/15 active:bg-ls-surface/25 ${focusRing}`}
              >
                <span aria-hidden>×</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          add(text);
        }}
        className="space-y-1.5"
      >
        <label htmlFor="tag-input" className="sr-only">
          Add a tag
        </label>
        <div className="flex gap-2">
          <input
            ref={input}
            id="tag-input"
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setError(null);
            }}
            maxLength={40}
            autoComplete="off"
            enterKeyHint="done"
            placeholder={tags.length ? "Add another tag" : "Add a tag, like Desserts"}
            aria-invalid={!!error}
            aria-describedby="tag-hint"
            className={`${fieldClass} min-w-0 flex-1`}
          />
          <Button type="submit" variant="secondary" disabled={!typed} className="shrink-0">
            Add
          </Button>
        </div>
        <p id="tag-hint" aria-live="polite" className="text-[15px]">
          {error ? (
            <span className="text-ls-error">{error}</span>
          ) : isNew ? (
            <span className="text-ls-muted">Press Enter to make the new tag “{typed}”.</span>
          ) : null}
        </p>
      </form>

      {suggestions.length > 0 && (
        <div className="space-y-2">
          <p className={eyebrow}>{typed ? "Matching tags" : allTags.length ? "Your tags" : "Ideas to start with"}</p>
          <ul className="flex flex-wrap gap-2" aria-label="Tap a tag to add it">
            {suggestions.map((t) => (
              <li key={t.id}>
                <button type="button" onClick={() => add(t.name)} className={chipClass(false)}>
                  <span aria-hidden>+</span>
                  <span className="sr-only">Add </span>
                  {t.name}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
