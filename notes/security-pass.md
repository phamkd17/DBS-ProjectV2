# Security pass (v2)

> What I checked, what I found, and what I fixed (v2 brief). Nov 28, branch
> `ai-limits`. Draft for me to review.

## How the app is protected

- **Who you are:** Clerk. Every page except the landing page, sign-in, and
  shared links (`/s/…`) requires sign-in (`proxy.ts`).
- **What you can see and change:** the database decides, not the app. The app
  talks to Supabase only with the public anon key plus your Clerk sign-in, and
  **Row Level Security (RLS)** on every table limits every read and write to
  your own rows. There is no service-role key anywhere.
- **Shared recipes:** a link works through two database functions that return
  or copy only that one recipe.
- **AI:** Gemini is called only from the server; the key never reaches the
  browser.

## Checklist

| Check | Result | How it was checked |
|---|---|---|
| Every server action checks who's signed in | ✓ 27 of 27 | Script over `app/actions.ts` (26 use `requireUser()`; `saveSharedCopy` uses `auth()` so it can send you back to the link after sign-in). No API routes. |
| Every table has RLS + grants | ✓ 8 of 8 tables, RLS on, owner-only policies | Queried the live database (`pg_class`, `pg_policies`, grants). |
| Photos are private | ✓ | Bucket `photos` is private (2 MB, JPEG/PNG/WebP only); you can only read, add, or delete files in your own folder. Tested as two users. |
| No keys in the repo; `.env` deny rule | ✓ | `git grep` for key patterns found none; `.env.local` is git-ignored; `.claude/settings.json` denies reading `.env*`. |
| AI rate limit + token cap (#5) | ✓ | See below; `npm run verify:limits`. |
| Fresh-session review of the whole project | ✓ No findings at confidence ≥ 7 | A new agent with no context reviewed every file and migration (below). |

## Findings, most serious first, and fixes

No exploitable issues were found. These were tightened anyway:

1. **The AI limit didn't count retries** (low). When Gemini returned a
   temporary error, the app retried up to 2 more times, but only the first try
   counted. *Fix:* every attempt now counts (`lib/ai/pipeline.ts`). *Checked:*
   `npm run verify:limits` and `npm run verify` pass.
2. **A very large prompt was possible on the second AI step** (low). The
   kitchen notes are capped at 20,000 characters, but the second step also
   sends the draft and the questions, which someone could inflate by writing
   to the database directly with their own sign-in. Each call still counted
   toward their limit. *Fix:* the whole prompt is capped at 80,000 characters
   (a real recipe is well under; the instructions are about 4,000).
   *Checked:* typecheck; verify passes.
3. **The four v1 tables had broader grants than needed** (low, not
   exploitable). Supabase's defaults let signed-out visitors try to read and
   write (RLS blocked them, since every policy is for signed-in users only),
   and gave TRUNCATE (which skips RLS, but the app's data API can't run it).
   *Fix:* migration `20261128020000_tighten_v1_grants.sql` removed them, so
   these tables now match the v2 ones. *Checked:* verify passes (including a
   shared link opened while signed out), and both live sites, v1 and v2, still
   load.

Found and fixed earlier (v1, Nov 14): a user could re-point their own
question at another user's shared recipe, which the copy function would then
copy to others. Fixed by limiting which columns can be updated and
re-checking the parent's owner (`20261114010000_tighten_updates.sql`).

## AI rate limit and token cap (#5)

- **Limit:** 20 AI requests per person per hour and 50 per day (a recipe
  uses 1–2). Checked on the server **before** calling Gemini; over the limit,
  the person sees "You can make more in about N minutes. Your kitchen notes
  are saved." and no model call is made.
- **Can't be reset:** each call is a row in `ai_calls`; users can add rows
  but can't change or delete them, or set who or when.
- **Token cap:** every call sets `maxOutputTokens` 16,384; input is capped
  (kitchen notes 20,000 characters, each answer 2,000, the whole prompt
  80,000).
- **Proof:** `npm run verify:limits` fills one test user's hour, tries to
  create a recipe, and sees the message with no recipe made; the server log
  shows no Gemini call. The main test user's count stayed at zero, so one
  person's limit doesn't affect another's.

## Database changes in v2 (all additive; v1 keeps working)

Each was tested in a rolled-back transaction as two users plus a signed-out
visitor: `sections`/`entry_sections` (tags), `photos` bucket + `entry_photos`,
`entry_photos.kind` (dish photo), `ai_calls`, and the v1 grant tightening.

## What the fresh-session review verified as safe

Every server action checks the user; RLS on every table; no row can be
pointed at another user's data; the two shared-recipe functions are safe
(fixed search path, only the one shared recipe); the AI limit can't be reset
or skipped; storage is private and paths are built on the server; uploads are
checked by their actual bytes; no XSS path (no raw HTML; links limited to
http/https); public pages show nothing private; no SSRF or injection; logs
hold no secrets.

## Follow-up review: instructions, components, iterations (Nov 28)

A fresh agent reviewed everything after PR 18 (`edit-instructions` +
`iterations`): editable instructions, components, prompt p5, the iterations
table and actions, the summary page, and the logo/icon.

- **Findings at confidence ≥ 8: none.**
- **Checked safe:** another user's iteration or recipe id finds nothing (RLS),
  so no one can read, copy, or change someone else's versions; new iterations
  can only be added to your own entries; an iteration can't be moved to another
  entry (no update grant on `dictation_id`); shared links never show iterations;
  inputs are capped; no raw HTML; the SVG icon is static.
- **Tightened:** an iteration is now only read or saved through its own
  recipe's entry (before, a user could point an edit at one of *their own*
  iterations from a different recipe: a correctness quirk, not a security hole).
  *Checked:* verify passes.
- **Noted, not changed:** a signed-in owner calling the database directly could
  write odd recipe JSON into *their own* iteration (same trust model as the
  original recipe; only that user ever sees it, and React escapes it).
