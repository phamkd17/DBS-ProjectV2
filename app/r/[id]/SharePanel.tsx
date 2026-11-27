"use client";

import { useState, useTransition } from "react";
import { setSharing } from "@/app/actions";
import { Button, Spinner } from "@/components/ui";

export function SharePanel({ recipeId, url, title }: { recipeId: string; url: string | null; title: string }) {
  const [pending, start] = useTransition();
  const [copied, setCopied] = useState(false);

  const toggle = (on: boolean) => start(() => setSharing(recipeId, on));

  return (
    <section aria-labelledby="send" className="space-y-3 border border-ls-ink bg-ls-surface p-4">
      <h2 id="send" className="font-ls-serif text-2xl leading-tight">
        Send this recipe
      </h2>

      {!url ? (
        <>
          <p className="max-w-prose text-[15px] leading-relaxed text-ls-muted">
            Make a private link to text or email. Anyone with the link can read this recipe and save a copy to their
            own lab book. You can turn the link off at any time.
          </p>
          <Button onClick={() => toggle(true)} disabled={pending}>
            {pending && <Spinner />} Make a link
          </Button>
        </>
      ) : (
        <>
          <label htmlFor="share-url" className="block text-[15px] font-medium">
            Private link
          </label>
          <input
            id="share-url"
            readOnly
            value={url}
            onFocus={(e) => e.currentTarget.select()}
            className="w-full border border-ls-border bg-ls-bg px-3 py-2.5 text-[15px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ls-ink"
          />
          <div className="flex flex-wrap gap-2">
            <Button
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
              variant="secondary"
              onClick={async () => {
                await navigator.clipboard.writeText(url);
                setCopied(true);
              }}
            >
              {copied ? "Copied ✓" : "Copy link"}
            </Button>
            <Button variant="quiet" onClick={() => toggle(false)} disabled={pending}>
              {pending && <Spinner />} Turn off link
            </Button>
          </div>
          <p aria-live="polite" className="text-[15px] text-ls-muted">
            {copied ? "Link copied. Paste it into a text or email." : "Only people you send it to will have the link."}
          </p>
        </>
      )}
    </section>
  );
}
