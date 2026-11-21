<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# AGENTS.md — Culinary Lab Book

**From inspiration to recipe: type or dictate your dish, and AI makes recipe development easy, with the food science built in.** (Landing headline, Nov 16, student's pick. The proposal's
original one-liner was "Culinary Lab Book helps cooks turn what they say while
they cook into recipes that can be shared for others to repeat." In the
student's words, it's now "an app to track culinary inspiration, provides a
platform for quickly developing recipes/iterations via voice/ai, and a place to
store the recipes with incorporating food science.")

Design, Build, Ship (MPCS 51238, Autumn 2026). **This is the v2 repo**
(`phamkd17/DBS-ProjectV2`), copied from v1 with full history; the `v1` tag marks
v1 as submitted (Nov 17). **v2 due Dec 1, 5:30 PM**, with a demo at the fair.
v2 brief: `~/Desktop/Design-Ship-Build-Assignments/Project/ProjectV2/Design, Build, Ship - Project v2.pdf`.
Plan: `notes/v2-plan.md`. Requirements: live URL, commits since v1, **What
Changed** (`notes/what-changed.md`), a **security pass** (incl. a model
**rate limit and token cap**), the fair demo, and a project interview in week 9.

## ⚠️ Shared database with v1 (decided Nov 20)

v2 uses **the same Supabase project as v1** (`zsfkpztpdxcowqsjfylu`), and the
v1 live site (dbs-project-v1-omega.vercel.app, repo DBS-ProjectV1) must keep
working for grading. So **every v2 migration must be additive and
backward-compatible**: add tables or nullable/defaulted columns, never rename,
drop, or tighten anything v1's code uses. Check v1's code (`git show v1:<file>`)
before any schema change. Never push to the `v1` remote (its push URL is disabled).
Course focus: **AI** (model calls, tools, **evals**), held to a higher standard.

- Proposal: https://dbs-projectproposal.vercel.app · repo `phamkd17/DBS-project_proposal`
- Decision log: `notes/build-log.md` (keep it current)

## Core task (v1)

Paste a dictation → the app asks what it can't know → the user answers, or
accepts/edits a suggestion → a recipe page (her words · recipe · why labeled by
source) → optionally **send** it by link; the recipient saves a copy into their
own lab book.

## How to work with the student

- One question at a time; multiple-choice for real decisions (recommendation first).
- Push back once on vague answers, then accept their call.
- User-facing text is **theirs**: draft it, label it as a draft, have them review it.
- Use their terms: AI **"suggestions"** (never "guesses").
- Commit and push regularly (one-shot work is marked incomplete). End messages
  with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Prefer the simplest option. **Free tiers only**, with usage limits and alerts.

## Product rules (non-negotiable)

1. **The cook's words are the user's to edit or delete.** (Student, Nov 14 → 21.)
   Editing replaces them; deleting removes them; **no original versions are
   kept**. Only `edited_at` is recorded, so a recipe made before an edit says
   so. The AI's corrections still happen only in the generated recipe.
2. **Ask, don't guess.** Unrecoverable amounts, contradictions, missing steps,
   and ambiguous dictation become questions.
3. **Unknown → suggestion.** If no one knows, offer a suggestion the user
   accepts or edits. It stays labeled **Suggested**, never shown as the cook's.
4. **Label every why by source:** `cook` (her quote), `user_answer`,
   `suggested`, `food_science`.
5. Capture and recipe creation are **separate moments**. Capture asks nothing.

## Lab-book entries (decided Nov 15)

- One kind of entry (`public.dictations`): **title** (`dish_name`), **Idea
  notes** (`notes` + `link`, the user's own, kept in every stage), and **Cook ·
  Their words** (`transcript`, optional until added). "New → Idea" starts with
  notes; "New → Dictation" starts with words. `public.ideas` is no longer used.
- Tabs = `stage`: Ideas → Development → Finished (move freely). The AI recipe
  step only runs in Development and only once the cook's words exist (checked
  in the UI and in `createRecipe`). Idea notes are not sent to the AI.

## Sharing model (decided Nov 13)

- Every user has a **private lab book** (single-user works on its own).
- **Send = private link → save a copy.** The owner turns on a link
  (`share_token`); anyone with it can read that one recipe; a signed-in
  recipient can **save a copy** to their own lab book. Copies keep the
  transcript and every source label. The owner can turn the link off.
- Clerk Organizations / families are **not** used in v1.

## Stack

| Piece | Choice |
|---|---|
| App | Next.js (App Router) + Tailwind on Vercel Hobby. **Mobile-first, 390px.** |
| Capture | Phone keyboard dictation into a text box (no STT API) |
| Auth | Clerk (development keys) |
| Data | Supabase Postgres, Clerk third-party auth, **RLS on every table**, migrations in `supabase/migrations/` |
| AI | Gemini API free tier (Flash), called only from server code. Key server-side only. |
| Evals | `evals/samples/*.md` (verbatim; never edit) run by `npm run eval` |

## Course requirements

- Keys in `.env.local` only; `.claude/settings.json` denies reading `.env*`.
  The **student** creates `.env.local` (template: `.env.example`).
- Signed-out visitors see no one's data (except a recipe whose link is on).
- Work on a branch; run `/security-review` before merging.
- Design loading / empty / error states, incl. Gemini rate-limited (429) and down.
- Forms: one column, labels, errors next to fields, keep typed input;
  keyboard access; contrast; hover/focus/pressed states.
- Supabase free projects pause after a week unused.

## Visual style: Line & Stone (the student's own system)

From Assignment 2 (`~/Desktop/Design-Ship-Build-Assignments/Assignment2/DBS-Assignment2`,
`components/line-and-stone/`). Tokens live in `app/globals.css` (`ls-*`, `src-*`).
- Limestone page, Plaster surfaces, Ink text and lines, Slate secondary text.
- **Scarlet `#ae1f2e` = the one primary action per screen, nothing else.**
  (Student swapped it for A2's Aegean blue on Nov 14; see `notes/design/red-swatches-2.html`.)
- Instrument Serif for headings, Jost for body and UI. Small uppercase tracked
  labels (`eyebrow`). Square corners, 1px hairlines, no shadows.
- Source labels have one look each: cook = ochre, food science = Cypress tint,
  suggested = blue tint, family answer = ink outline, not stated = dashed.
- Don't introduce Tailwind default palettes (stone, sky, amber…) or rounded cards.

## Design checklist: check on EVERY UI change (student's standing request)

After any UI change: run `npm run verify` (Playwright: core task at **390px and
1440px**, screenshots, axe contrast scan, keyboard Tab pass), **look at the
screenshots**, and report what's broken against this list:

- **Visual hierarchy:** it's clear what to look at first.
- **Type:** a few sizes and weights, used the same way throughout; comfortable to read.
- **Color:** a small palette where each color has a purpose.
- **Accessibility:** text contrast is legible (axe shows no contrast violations).
- **Layout:** aligned intentionally, related elements grouped, works on desktop and mobile (no sideways scroll at 390px).
- **Affordances:** interactions are obvious.
- **States:** controls respond to hover, focus, and press (every Tab stop has a visible focus style).
- **Visual style:** it looks like Line & Stone, not the agent's default.
- **Simplicity:** nothing extra. If a word or an image doesn't help, remove it.

Then the student checks it themselves, including with the keyboard.

### Saving Gemini quota while testing
- `lib/ai/cache.ts`: **dev-only** cache of Gemini responses in `.ai-cache/`
  (git-ignored), keyed by the exact request. Off in production and for
  `npm run eval` (`AI_CACHE=off`). `npm run verify` reuses responses: 0 calls
  after the first run.
- `npm run verify:fresh` clears the cache to test with the real model (do this
  after changing a prompt; the key includes the prompt, so it would miss anyway).
- The dev server logs `[ai] calling Gemini` / `[ai] cache hit` for each request.
