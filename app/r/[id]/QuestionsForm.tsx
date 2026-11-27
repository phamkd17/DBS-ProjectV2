"use client";

import { useActionState, useState } from "react";
import { submitAnswers } from "@/app/actions";
import { AiBadge, Button, ErrorNote, eyebrow, fieldClass, focusRing, SourceBadge } from "@/components/ui";
import { Working } from "@/components/Working";
import type { ActionState, QuestionRow } from "@/lib/types";

const KIND_LABEL: Record<QuestionRow["kind"], string> = {
  amount: "How much?",
  missing_step: "Missing step",
  contradiction: "Said two ways",
  ambiguity: "Unclear",
  dictation_error: "Misheard word?",
};

type Mode = "own" | "suggestion";

export function QuestionsForm({
  recipeId,
  questions,
  cookName,
}: {
  recipeId: string;
  questions: QuestionRow[];
  cookName: string | null;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(submitAnswers.bind(null, recipeId), {});
  const saved = state.values ?? {};

  const [answers, setAnswers] = useState<Record<string, string>>(() =>
    Object.fromEntries(questions.map((q) => [q.id, saved[`answer_${q.id}`] ?? q.answer ?? ""]))
  );
  const [modes, setModes] = useState<Record<string, Mode>>(() =>
    Object.fromEntries(
      questions.map((q) => [
        q.id,
        ((saved[`mode_${q.id}`] as Mode) ??
          (q.answer_source === "suggestion_accepted" || q.answer_source === "suggestion_edited" ? "suggestion" : "own")) as Mode,
      ])
    )
  );

  const answered = questions.filter((q) => answers[q.id]?.trim()).length;

  if (pending) {
    return (
      <Working
        messages={["Reading your answers…", "Writing the final recipe…", "Labeling where each part came from…", "Almost done…"]}
      />
    );
  }

  return (
    <form id="questions-form" action={action} className="space-y-5">
      <p className="text-[15px] text-ls-muted" aria-live="polite">
        {questions.length === 0
          ? "No questions this time. The kitchen notes had everything a new cook needs."
          : `${answered} of ${questions.length} answered. Leave any blank if nobody knows. It will show as “not stated”.`}
      </p>

      <ol className="divide-y divide-ls-border border-y border-ls-ink">
        {questions.map((q, i) => {
          const id = `answer_${q.id}`;
          const mode = modes[q.id];
          return (
            <li key={q.id} className="space-y-3 py-6">
              <p className={eyebrow}>
                {String(i + 1).padStart(2, "0")} · {KIND_LABEL[q.kind]}
              </p>
              {q.quote && (
                <blockquote className="border-l-2 border-src-cook-ink bg-src-cook px-4 py-2 font-ls-serif text-lg italic text-src-cook-ink">
                  “{q.quote}”
                </blockquote>
              )}
              <label htmlFor={id} className="block font-ls-serif text-2xl leading-snug">
                {q.question}
              </label>
              {q.why_it_matters && <p className="text-[15px] text-ls-muted">{q.why_it_matters}</p>}

              {q.suggestion && mode !== "suggestion" && (
                <div className="flex flex-col gap-3 bg-src-suggested p-4 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-[15px] text-src-suggested-ink">
                    <span className="font-medium">Don&apos;t know? Suggestion:</span> {q.suggestion}
                  </p>
                  <Button
                    type="button"
                    variant="secondary"
                    className="shrink-0"
                    onClick={() => {
                      setAnswers((a) => ({ ...a, [q.id]: q.suggestion }));
                      setModes((m) => ({ ...m, [q.id]: "suggestion" }));
                    }}
                  >
                    Use suggestion
                  </Button>
                </div>
              )}

              {mode === "suggestion" && (
                <div className="flex flex-wrap items-center gap-2 text-[15px] text-ls-muted">
                  <SourceBadge source="suggested" />
                  <span>Will be labeled as a suggestion, not as {cookName || "the cook"}&apos;s. You can edit it.</span>
                  <button
                    type="button"
                    className={`min-h-11 px-2 text-ls-ink underline decoration-ls-rule underline-offset-4 hover:decoration-ls-ink active:text-ls-muted ${focusRing}`}
                    onClick={() => {
                      setAnswers((a) => ({ ...a, [q.id]: "" }));
                      setModes((m) => ({ ...m, [q.id]: "own" }));
                    }}
                  >
                    Clear
                  </button>
                </div>
              )}

              <textarea
                id={id}
                name={id}
                rows={2}
                value={answers[q.id]}
                onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))}
                placeholder="Your answer"
                className={fieldClass}
              />
              <input type="hidden" name={`mode_${q.id}`} value={mode} />
            </li>
          );
        })}
      </ol>

      {state.error && <ErrorNote>{state.error}</ErrorNote>}

      <div className="space-y-2">
        <Button type="submit" className="w-full sm:w-auto">
          {state.error ? "Try again with AI" : "Make the recipe with AI"}
        </Button>
        <p className="flex flex-wrap items-center gap-2 text-[15px] text-ls-muted">
          <AiBadge /> Uses one AI request, about 15 seconds. Your answers are saved first.
        </p>
      </div>
    </form>
  );
}
