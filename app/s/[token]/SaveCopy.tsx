"use client";

import { useActionState } from "react";
import { saveSharedCopy } from "@/app/actions";
import { Button, ErrorNote, Spinner } from "@/components/ui";
import type { ActionState } from "@/lib/types";

export function SaveCopy({ token, signedIn }: { token: string; signedIn: boolean }) {
  const [state, action, pending] = useActionState<ActionState>(saveSharedCopy.bind(null, token), {});
  return (
    <form action={action} className="space-y-4 border border-ls-ink bg-ls-surface p-5">
      <p className="max-w-prose text-[15px] leading-relaxed text-ls-muted">
        {signedIn
          ? "Save your own copy. It keeps the kitchen notes and every label, and you can send it on."
          : "Sign in (or sign up, it's free) to save your own copy to a lab book."}
      </p>
      {state.error && <ErrorNote>{state.error}</ErrorNote>}
      <Button type="submit" disabled={pending}>
        {pending && <Spinner />}
        {signedIn ? "Save to my lab book" : "Sign in to save a copy"}
      </Button>
    </form>
  );
}
