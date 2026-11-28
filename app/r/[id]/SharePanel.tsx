"use client";

import { useState, useTransition } from "react";
import { setSharing } from "@/app/actions";
import { Button, eyebrow, focusRing, Spinner } from "@/components/ui";

export function SharePanel({ recipeId, url, title }: { recipeId: string; url: string | null; title: string }) {
  const [pending, start] = useTransition();
  const [copied, setCopied] = useState(false);

  const toggle = (on: boolean) => start(() => setSharing(recipeId, on));

  // Buttons aren't red: on the recipe page, red is kept for Save while editing (student, Nov 28).
  // One line (student, Nov 28): "Send this recipe" + Make a link; once it's on,
  // Send… / Copy link / Turn off, with one short line about who can open it.
  return (
    <section aria-labelledby="send" className="space-y-1 border-b border-ls-ink py-2">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <h2 id="send" className={eyebrow}>
          {url ? "Send · link on" : "Send this recipe"}
        </h2>
        {!url ? (
          <Button variant="secondary" onClick={() => toggle(true)} disabled={pending} className="min-h-10 px-4">
            {pending && <Spinner />} Make a link
          </Button>
        ) : (
          <div className="-mr-3 flex flex-wrap items-center">
            <Button
              variant="secondary"
              className="min-h-10 px-4"
              onClick={async () => {
                if (navigator.share) {
                  await navigator.share({ title, text: `Here's the recipe for ${title}`, url }).catch(() => {});
                } else {
                  await navigator.clipboard.writeText(url);
                  setCopied(true);
                }
              }}
            >
              Send…
            </Button>
            <Button
              variant="quiet"
              onClick={async () => {
                await navigator.clipboard.writeText(url);
                setCopied(true);
              }}
            >
              {copied ? "Copied ✓" : "Copy link"}
            </Button>
            <Button variant="quiet" onClick={() => toggle(false)} disabled={pending}>
              {pending && <Spinner />} Turn off
            </Button>
          </div>
        )}
      </div>
      {url && (
        <>
          <label htmlFor="share-url" className="sr-only">
            Private link
          </label>
          <input
            id="share-url"
            readOnly
            value={url}
            onFocus={(e) => e.currentTarget.select()}
            className={`block w-full truncate bg-transparent text-[13px] text-ls-muted ${focusRing}`}
          />
          <p aria-live="polite" className="text-[14px] text-ls-muted">
            {copied ? "Link copied. Paste it into a text or email." : "Anyone with the link can read it and save a copy. Turn it off any time."}
          </p>
        </>
      )}
    </section>
  );
}
