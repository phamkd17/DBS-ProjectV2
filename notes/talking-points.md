# Talking points: what we did and why

> Draft notes, written by the agent as we go, for you to speak from in class
> (Nov 17) and at the fair (Dec 1). Put them in your own words before you
> present. The decisions are logged in `notes/build-log.md`.
>
> The course asks you to be ready to explain: **tracing a request, where
> identity and access are decided, where API calls happen and why, what the
> failing test looked like, and what you stopped the agent from doing.** Each
> section below points to one of those.

---

## 1. What it is, and what v1 does

> **From inspiration to recipe: type or dictate your dish, and AI makes recipe development easy, with the food science built in.**

In my words: an app to track culinary inspiration, a platform for quickly
developing recipes and iterations by voice and AI, and a place to store the
recipes, with food science built in.

**The core task in v1:** save an idea → move it to Development → dictate the
cook's words (ingredients, then each step) → the AI drafts a recipe and asks
what a new cook couldn't know → answer, or accept a suggestion → a finished
recipe, with a science icon on each step and where each part came from behind
"Show sources" → keep it, or send it by link (the person who opens it can save
their own copy).

**Why this is the smallest complete version:** it covers the whole path,
inspiration → development → stored recipe, once. Photos, iterations, variations,
scaling, and nutrition build on top (see the v2 plan), and the recipe format
already has room for them.

**How the one-liner evolved:** the proposal said *"Culinary Lab Book helps
cooks turn what they say while they cook into recipes that can be shared for
others to repeat."* Building and using v1 showed the real job was broader: not
only Grandma's dictations, but also my own inspiration and recipe development.
So the landing page now says "a lab book for recipe development", and the
headline changed with it.

## 2. Scope changes since the proposal

- **Proposal:** one family, built on Clerk Organizations.
- **v1:** everyone gets their own **private lab book** and can **send** a
  recipe by link. *"I want this to be an app where people can send recipe to
  each other. Or have a labbook of their own."*
- **Why a link instead of email:** simplest, works for someone using it alone,
  nothing to look up. **Tradeoff:** anyone with the link can read that one
  recipe until the owner turns the link off.
- **From family recipes to recipe development:** Ideas → Development →
  Finished tabs, Idea notes kept at every stage, and the cook's words added in
  Development, where the AI step lives.

## 3. Riskiest part first: the AI pipeline (my focus area)

We built and tested the AI **before any screens**, following the brief: *"make
sure the most challenging part works first."*

**Two passes** (`lib/ai/pipeline.ts`):
1. **Pass 1:** transcript → draft recipe + **questions** (amount, dictation
   error, missing step, contradiction, ambiguity), each with a suggestion.
2. **Pass 2:** draft + answers → final recipe. Every amount and every why is
   labeled `cook`, `user_answer`, `suggested`, or `food_science`.

**Structured output:** the recipe format is defined once with Zod
(`lib/ai/schema.ts`), sent to Gemini as a JSON Schema, and every response is
checked against it. A bad response becomes an error state instead of a broken
page.

**Errors are designed:** a 429 (free-tier rate limit) is retried twice with a
wait, then shown as *"The recipe helper is busy right now. Try again in a
minute."*

**Prompt versioning:** `PROMPT_VERSION` is saved with every eval run, so prompt
changes can be compared.

## 4. Evals: how I know the AI works

`npm run eval` runs Grandma's 3 real dictations through the pipeline and scores
deterministic checks (`evals/run.ts`).

- **Must-pass (yogurt):** it asks about the "10 in" container (it's Dannon), and
  it flags the **missing cooling step** (she cools the milk but left it out).
- **Honesty checks on every recipe:**
  - Every reason labeled as the cook's has to **quote the transcript exactly**,
    so the AI can't put words in her mouth.
  - Every amount labeled as hers can only use numbers she actually said.
- **Pass 2 uses scripted answers** (our confirmed facts: plain Dannon, she cools
  the milk) and accepts the suggestion for everything else. Then it checks that
  accepted suggestions stay labeled **Suggested**.
- **Not teaching to the test:** the eval answers are kept *out* of the prompt.
  If the prompt said "10 in means Dannon," the eval would pass without measuring
  anything.

**First run (Nov 13, yogurt, prompt p1, gemini-3.8-flash): 14/17.**
- Both must-pass checks passed. It asked *"What brand or size was the 'small 10
  in yogurt container'?"* and *"Do you let the milk cool down before stirring in
  the yogurt starter?"*
- **The eval caught a real labeling bug.** An accepted suggestion ("whole
  pasteurized milk") was folded into an ingredient labeled as the cook's: the
  exact thing the product promises never happens. The cause was one label per
  ingredient, when one line can mix sources (her amount plus a suggested kind of
  milk). The fix: a `suggested_detail` field, a prompt change (p2), and a new
  must-pass check.
- **The harness also caught itself.** On the very first run it printed "All
  must-pass checks passed" even though nothing ran (a config typo). Now a run
  error can never show up as a pass.
- **Speed is a design problem:** about 12 minutes for both passes on 3.8 Flash.
  We're comparing thinking levels and models next.

## 4b. Picking the model with evals, not hype

The newest model wasn't the best one for this app:

| Model | Score (prompt p4) | Time |
|---|---|---|
| **gemini-3.5-flash** (chosen) | 45/50, all must-pass ✓ | ~20 s per pass |
| gemini-3.7-flash | every call timed out | — |
| gemini-3.8-flash | passed must-pass (p1) | ~12 min, then timeouts |
| gemini-2.5-flash | closed to new users | — |

**Prompt history: every change came from a failing check.**
- **p1:** caught the cooling step, but hid a suggestion under the cook's label.
- **p2:** suggestions get their own label.
- **p3:** a misheard brand gets asked as *which brand*, not just the size.
- **p4:** "scan the transcript first," so the pork soup questions went from 5 to
  7, and the mango contradiction is now caught.

**Still missed (honest list for v2):** where the prepped green onions go, the
number of parboils, tomatoes ≈ 5, kind of milk, fridge or freezer.

## 4c. Where identity and access are decided

- **Clerk** signs people in. **Supabase trusts Clerk's token** (third-party
  auth), so the database itself knows who is asking.
- **Row-level security on every table:** a row is visible only when its
  `owner_id` matches the Clerk user id in the token (`auth.jwt() ->> 'sub'`).
- **Proved it with a test** (`supabase/tests/rls_check.sql`, rolled back):
  user A sees 1 dictation; **user B sees 0; a signed-out visitor sees 0.**
- **Her words can't be edited:** there's no UPDATE policy on dictations, plus a
  trigger. The owner's own edit attempt changed 0 rows.
- **Share links are one narrow door:** a database function returns one finished
  recipe *only* for the right token (a wrong token gets nothing). Saving a copy
  is a second function that needs a signed-in user.
- **No service-role key anywhere:** the app talks to Supabase *as the user*.

## 4d. Security review found a real hole (and how we fixed it)

`/security-review` (one agent finds issues, a second checks each for false
positives) found that the UPDATE policy on questions checked only *who owned
the row*, not *which recipe it pointed to*. Someone who saved a copy of your
shared recipe could re-point one of their questions at your original, and every
later recipient would get that fake Q&A labeled "Family answer".
**Fix:** people can now edit only the answer fields (column-level grants), the
policy re-checks the parent recipe's owner, and the share functions follow only
rows that belong to the same owner. **Proof:** `supabase/tests/repoint_attack.sql`
now gets "permission denied".

## 4e. Design: my own style, checked in a real browser every time

- **Visual style:** the app uses **Line & Stone**, my design system from
  Assignment 2 (Limestone, Ink hairlines, Instrument Serif + Jost, square
  corners). I swapped its blue for a **Scarlet** primary (`#ae1f2e`) after
  comparing 10 reds side by side (`notes/design/red-swatches*.html`), with
  contrast ratios.
- **Verify on every change:** `npm run verify` (Playwright) runs the whole core
  task as a new user and screenshots 20+ screens at **390px and 1440px**, with
  an axe accessibility/contrast scan and a keyboard Tab pass.
- **What looking at the screenshots caught, that passing checks didn't:**
  the dev server served stale CSS (it "passed" while showing none of my style);
  placeholders looked like filled-in values; finished recipes couldn't be
  deleted; "Move to" gave no feedback. Each one was fixed and re-verified.
- **Real error state seen live:** after many test runs we hit Gemini's
  free-tier rate limit, and the app showed its designed message: "The recipe
  helper is busy right now. Try again in a minute."

## 4f. The lab book: Ideas → Development → Finished

- **Ideas:** quick notes and links to come back to (photos in v2).
- **Development:** recipes I'm working out with the app's questions.
- **Finished:** ready to cook and send.
- The app moves things forward automatically, and I can **move anything**
  myself (e.g. send a finished recipe back to Development to rework it).
  Links must be http(s), enforced in the database too, so a saved link can't
  run code.

## 5. Keys and safety (what I stopped the agent from doing)

- Before any key existed, we added a **deny rule** in `.claude/settings.json`
  that blocks the agent from reading `.env` files.
- **It worked:** when the agent tried to create `.env.local` itself, the
  command was **denied**, so I created the file and pasted the keys myself.
  The agent has never seen a key.
- `.env.local` is git-ignored. `.env.example` lists only the variable names.
- The Gemini key is used **only in server code**, never sent to the browser.
- Gemini free tier with **no billing attached**, so it can't be charged.

## 6. Process evidence

- Small commits after each step, pushed to GitHub.
- Decisions logged with my answers quoted in `notes/build-log.md`.

---

## Coming next (sections to fill in as we build)

- **Tracing a request:** phone → Next.js server route → Supabase (RLS) / Gemini → page
- **Where identity and access are decided:** Clerk session → Supabase RLS policies
- **Where API calls happen and why:** server-only, so the key never reaches the phone
- **Testing with real users:** who, what they did, where they got stuck
- **Plan for v2:** see `notes/v2-plan.md` (photos in ideas, a streamlined
  idea → development → recipe flow, iterations/trials with what each change does,
  descriptions + variations with notes and dates, and portion scaling +
  nutrition facts)
