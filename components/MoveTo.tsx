"use client";

import { useState, useTransition } from "react";
import { moveItem } from "@/app/actions";
import { STAGE_LABEL, STAGES, type Stage } from "@/lib/types";
import { eyebrow, focusRing } from "./ui";

/** "Move to: Development · Recipes": moves an idea or dictation between tabs. */
export function MoveTo({
  kind,
  id,
  current,
  hide = [],
}: {
  kind: "idea" | "dictation";
  id: string;
  current: Stage;
  /** Stages offered elsewhere on the page (avoid two controls for one action). */
  hide?: Stage[];
}) {
  const [pending, start] = useTransition();
  const [target, setTarget] = useState<Stage | null>(null);

  return (
    <div className="flex flex-wrap items-center gap-x-1" aria-busy={pending}>
      <span className={eyebrow}>{pending && target ? `Moving to ${STAGE_LABEL[target]}…` : "Move to"}</span>
      {!pending &&
        STAGES.filter((s) => s !== current && !hide.includes(s)).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => {
              setTarget(s);
              const fd = new FormData();
              fd.set("stage", s);
              start(() => moveItem(kind, id, fd));
            }}
            className={`min-h-11 cursor-pointer px-2 font-ls-sans text-xs font-medium uppercase tracking-[0.18em] text-ls-ink underline decoration-ls-rule underline-offset-4 transition-colors hover:decoration-ls-ink active:text-ls-muted ${focusRing}`}
          >
            {STAGE_LABEL[s]}
          </button>
        ))}
    </div>
  );
}
