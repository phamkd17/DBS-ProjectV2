# Build log — Culinary Lab Book v1

Picks up from the proposal's decision log (`notes/process.md` in
`phamkd17/DBS-project_proposal`). Each entry has the decision, the student's
answer (quoted), and why.

---

## Nov 13 — Setup and scope

### B1. Where the build lives
- **Decision:** its own repo, `phamkd17/DBS-ProjectV1` (created by the student).

### B2. Core task for v1
- **Draft (agent):** paste a dictation → the app asks what it can't know →
  answer, or accept/edit a suggestion → recipe page (her words · recipe ·
  labeled why) that someone else can open and cook from.
- **Kept:** sign-in, verbatim capture, two Gemini passes, recipe page with
  source labels, sharing, eval script on the 3 real dictations.
- **Left out of v1:** dials UI and the five tastes (dials still appear as text),
  photos, function-calling tools, lab book of trials, Playwright test.

### B3. Who it's for, and how sharing works
- **Student:** "I want this to be an app where people can send recipe to each
  other. Or have a labbook of their own. It could be multi-user or single user."
- **Decision:** every user gets a private lab book. This replaces the proposal's
  PROPOSED "Clerk Organizations = families."
- **Options offered:** (1) link → save a copy, (2) send by email to an inbox,
  (3) both.
- **Student chose:** "Link → save a copy."
- **Why:** simplest to build, works for solo users, nothing to look up. Tradeoff
  accepted: anyone with the link can read that one recipe until the owner turns
  the link off.

### B4. Accounts
- Clerk app, Supabase project, and Vercel ↔ GitHub: already set up.
- Gemini key: still to create (AI Studio).

### B5. Safety before keys
- `.claude/settings.json` denies agent reads of `.env` / `.env.*`.
- `.env.example` lists the variable names; the student creates `.env.local`.

### B6. The deny rule in action
- The agent tried to run `cp .env.example .env.local` itself; the permission
  system **denied** it. The student created `.env.local` and pasted the keys
  themselves. The agent has never read the keys.

### B7. Talking points
- **Student:** "Can you also keep notes of what we are doing so I can speak
  about it."
- **Decision:** `notes/talking-points.md`, a running draft organized around the
  questions the course asks in class (tracing a request, identity/access, where
  API calls happen, the failing test, what the agent was stopped from doing).

## Nov 13 — First eval run

### B8. Model choice
- `npm run models` listed 12 Flash models. Agent recommended `gemini-3.8-flash`
  (newest full Flash; Lite models reason less well about missing steps), with
  `gemini-2.5-flash` as the fallback if the free-tier quota is too low.

### B9. First run failed with a 400, and the harness hid why
- The error said only "unavailable (400)", and the summary wrongly printed "All
  must-pass checks passed" even though nothing ran.
- **Fixes:** errors now carry Gemini's raw message (for logs and evals only,
  never shown to users); the summary reports run errors instead of a false pass;
  the `$schema` key is stripped from the JSON Schema sent to Gemini.
- **Real cause:** a typo in `.env.local` (`GEMINI_MODEL=GEMINI_MODEL=…`). Found
  by printing only the model value, never the keys.

### B10. First real eval: yogurt, prompt p1, gemini-3.8-flash (14/17)
- **Both must-pass checks passed:** it asked about the "10 in" container
  ("What brand or size…?") and flagged the missing cooling step ("Do you let the
  milk cool down…?", suggestion ≈110–115°F).
- **Missed:** it didn't ask the incubator *temperature* (it asked what kind of
  incubator instead), and it didn't ask fridge vs. freezer.
- **Real bug, the one the product promises can't happen:** the accepted suggestion
  "whole pasteurized milk" ended up inside an ingredient labeled **cook**. The
  110°F from a suggestion was labeled as the family's answer.
  One label per ingredient couldn't hold mixed sources.
- **Fix (prompt p2):** ingredients and steps get a `suggested_detail` field for
  the parts that came from a suggestion. Pass 2 must surface every accepted
  suggestion there or in a "suggested" why. A new must-pass check fails if a
  suggestion hides under a cook/family label.
- **Too slow:** ~12 minutes for two calls. Added a 90 s request timeout, timing
  per pass, and a `GEMINI_THINKING` setting to compare thinking levels.

## Nov 13 — Connecting the services

### B11. Clerk ↔ Supabase
- New Clerk app "Culinary Lab Book" (development keys, email sign-in).
- Clerk's Supabase integration activated, so session tokens carry
  `role: authenticated`. Clerk domain (public, not a secret):
  `https://loved-lionfish-7298.clerk.accounts.dev`
- Supabase → Authentication → Third-Party Auth → Clerk, using that domain.
  RLS reads the Clerk user id from `auth.jwt() ->> 'sub'`.

### B12. Supabase project + keys
- The student created a new Supabase project (`zsfkpztpdxcowqsjfylu`, free
  plan) and added Clerk under Third-Party Auth.
- `npm run check-env` validates `.env.local` without printing secrets: formats,
  doubled names, a service-role key used by mistake, and that the Clerk key's
  domain matches. All passed.

### B13. How migrations get applied
- **Options offered:** connect the Supabase MCP, or paste into the SQL Editor.
- **Student chose:** "Connect Supabase MCP."
- Scoped to this one project (`project_ref=…` in `.mcp.json`, committed; no
  secrets in it, since login is OAuth in the browser).

### B14. Migration applied + RLS verified (Nov 13)
- `/mcp` connected the **claude.ai Supabase connector** (account-wide), not
  the project-scoped server in `.mcp.json`. The agent only used project
  `zsfkpztpdxcowqsjfylu`. To do: switch to the scoped server for v2.
- Before applying: pinned `search_path` on the helper functions, and revoked
  anon EXECUTE on `save_shared_recipe` (Supabase grants it to anon by default).
- **RLS checks** (`supabase/tests/rls_check.sql`, rolled back): user A sees 1
  own dictation; **user B sees 0; signed-out visitor sees 0**. The owner's
  attempt to edit the transcript changed 0 rows. A signed-out visitor with the
  link gets the recipe, and with a wrong token gets nothing. User B's "save a
  copy" creates their own recipe with the transcript unchanged.
- **Security advisor:** 3 warnings, all that `get_shared_recipe` /
  `save_shared_recipe` are callable. That's intentional (they are the
  share-link door), and both require the token.

### B15. Model comparison on prompt p4 (all 3 dictations)
| Model | Score | Must-pass | Time |
|---|---|---|---|
| gemini-3.5-flash | 45/50 | all ✓ | ~20 s per pass |
| gemini-3.7-flash | — | — | every call 504 (timed out) |
| gemini-3.8-flash | 14/17 (p1, yogurt only) | ✓ | ~12 min, then 504s |
| gemini-2.5-flash | — | — | 404: closed to new users |
- p3 → p4 on 3.5-flash: 42/50 → 45/50. Pork soup questions went 5 → 7 (the
  scan step), and the mango contradiction is now asked. Still missed: where the
  green onions go, the number of parboils, tomatoes ≈ 5, kind of milk, fridge or
  freezer.
- **Student chose:** "gemini-3.5-flash" for v1. Why: it passed every must-pass
  check and is fast enough for someone waiting on a phone.

## Nov 13 — Screens + first run of the core task

### B16. Screens built (one commit each)
Home (lab book + empty state + signed-out landing) → New dictation → Dictation
page (Create recipe, with a loading state that says what's happening) →
Questions (answer / Use suggestion / leave blank) → Recipe page (labeled why,
"What the app changed", her words, Send panel) → Shared link page (read +
"Save to my lab book").

### B17. First run, by the student, on localhost
- **Student:** "done, it worked"
- Yogurt, 4 questions: cooling step (used suggestion → **Suggested**), brand
  and size (answered → **Family answer**, Dannon credited), incubator
  (suggestion), fridge or freeze (answered). All labels saved correctly.
- Timing: create recipe 35 s, finish recipe 13 s.
- Agent found in the logs: a dev warning on every page (data fetched without a
  placeholder during navigation). Fixed by adding a `loading.tsx` skeleton to
  each route.
- Share link not tried yet in this run.

### B18. Deployed (Nov 13)
- Vercel: https://dbs-project-v1-omega.vercel.app, with all 6 env vars set in Vercel.
- Signed-out checks on the live site: home ✓; `/new` and recipe pages →
  Clerk sign-in ✓ (non-browser requests get a 404); fake share token → "isn't
  shared anymore" ✓; `/.env.local` → 404 ✓.

### B19. Phone + share link test (student, live site)
- **Student:** "done, it worked on my phone." Signed in on the phone, read the
  recipe, made a link, opened it signed out, and saw the recipe without getting
  into the lab book.

## Nov 14 — Security review

### B20. `/security-review` on the whole app (d5c7577..HEAD)
- One reviewer agent searched for vulnerabilities, and a second agent checked
  each finding for false positives.
- **Finding (MEDIUM, confirmed by both; 7/10 confidence, so just under the
  skill's 8/10 reporting bar):** the UPDATE policy on `recipe_questions`
  only checked `owner_id`. A user who saved a copy of someone's shared recipe
  could learn the original recipe id (`copied_from`), re-point one of their own
  questions at it, and `save_shared_recipe` would copy that fake Q&A,
  labeled "Family answer", into every later recipient's lab book. The same gap
  existed for `recipes.dictation_id` (no new data exposed).
- **Fixed anyway** (`20261114010000_tighten_updates.sql`): column-level UPDATE
  grants (questions: answer fields only; recipes: generated content + sharing
  only), the UPDATE policy re-checks the parent owner, and both share functions
  only follow rows with the same owner.
- **Proved:** `supabase/tests/repoint_attack.sql`. Both attacks are now
  "permission denied"; normal answering, sharing, and saving a copy still work.
- From here on, work happens on branches (`refine-v1`), each with its own
  Vercel preview link, merged after review.

## Nov 14 — Lab book tabs

### B21. Ideas / Development / Finished
- **Student:** "I want to add tabs for Ideas, Development, and Finished
  Recipes." Then: "I want the ideas to be where i can attached quick notes,
  pictures, links. Development is were I actively work on developing a recipe.
  And the finished have different iterations and notes."
- **Pushback (once):** v1 is due Tuesday, and user testing plus the v2 plan
  still have to happen. Photos are the biggest piece (upload, storage, privacy
  rules).
- **Options offered:** all 3 tabs with photos in v2 / everything now / tabs now
  with the rest in v2.
- **Student chose:** "Tabs now, the rest in v2."
- **Built:** the home page has three tabs with counts. Ideas = words saved, no
  recipe yet. Development = recipe with questions waiting. Finished = ready.
  It opens on the tab where the work is, and each tab has its own empty state.
- **v2 headline:** Ideas get notes, photos, and links, plus "Start developing";
  Finished recipes get iterations (each trial: what changed, how it turned out).

## Nov 14 — Line & Stone + browser verification

### B22. Visual style
- **Student:** "can you use line and stone" (their Assignment 2 design system).
- Restyled every screen from the A2 tokens and components: Limestone, Plaster,
  Ink, Slate, Stone hairlines, Aegean for the one primary action, Instrument
  Serif + Jost, square corners, no shadows, underline tabs.
- Source labels kept their meaning: cook = ochre, food science = Cypress tint,
  suggested = Aegean tint, family answer = ink outline, not stated = dashed.

### B23. "Constantly review" against the design checklist
- **Student:** "Can you constantly review for the following requirements"
  (brief step 6 Verify + Design Requirements). Written into AGENTS.md as a
  standing rule.
- `npm run verify` (Playwright): runs the whole core task as a test user and
  takes screenshots at 390px and 1440px of 16 screens, an axe WCAG AA scan, a
  keyboard Tab pass, and a sideways-scroll check.
- **Caught by looking at the screenshots, not by the automated checks:** the
  first run passed every check, but the screenshots showed none of the colors
  or fonts. The dev server was serving stale CSS (Tailwind's cache, after a
  production build ran alongside it). Restarted it with a clean cache.
- **Review fixes:** placeholders looked like filled-in values ("Yogurt",
  "Grandma"), so they now read "e.g. …" in italic. The "Made with model ·
  prompt" line moved inside "Questions the app asked" (Simplicity).
- **Result:** 0 axe violations on all 16 screens, no sideways scroll at 390px,
  a visible focus style on every Tab stop.
- **Known, left:** Clerk's default avatar is purple (only for accounts without a
  photo).

### B24. Primary color: Scarlet
- **Student:** "Instead of agean blue, I want a scarlet red/ burgundy for the
  design template." Agent made `notes/design/red-swatches.html` (Scarlet →
  Oxblood, with contrast ratios). **Student:** "I am between scarlet and
  crimsom." Agent made `red-swatches-2.html` (5 steps). **Student chose:**
  "Scarlet-leaning": `#ae1f2e` (hover `#941a27`, pressed `#7a1620`), 6.4:1.
- Everything else stays Line & Stone. Terracotta errors still read as
  different from the Scarlet button.

### B25. Verify found two more real problems
- **Stale CSS, again:** the dev server ignores `globals.css` edits (a
  Tailwind/Turbopack cache issue). `npm run verify` now starts with a test
  that compares every color token in `globals.css` to the served CSS, and
  fails with "restart the dev server" if they differ.
- **Finished recipes couldn't be deleted** (only ideas could). Added "Delete
  this recipe" with a confirmation. The verify run now deletes its own
  recipe and checks that it's gone.
- Next's floating dev badge covered the Delete button at 390px (dev only),
  so the badge is now off (`devIndicators: false`).

## Nov 15 — Ideas you can create, and Move to

### B26. New ideas + moving between tabs
- **Student:** "Can you add a way for me to create new ideas a move them between
  ideas, development and finished."
- **Built:** "New idea" (title, optional note, optional link; photos still v2)
  → idea page (note, link opens in a new tab, "Add the cook's words" starts a
  dictation with the dish name filled in, Edit, Delete). A **Move to** row on
  every item (list, dictation page, recipe page). Creating a recipe moves it to
  Development and finishing moves it to Finished automatically; the user can
  move anything afterwards. Moving only reorganizes and never deletes anything.
- **Database** (`20261115000000_ideas_and_stages.sql`): `ideas` table with
  owner-only RLS; links must be http(s) (a check constraint, plus server
  validation); `dictations.stage`, where owners may update **only** `stage`
  (column grant). Her words stay blocked by the grant + trigger. Copies saved
  from a link land in Finished. Tested: owner moves ✓, transcript edit
  blocked ✓, `javascript:` link rejected ✓, another user sees/moves 0 ✓.
- **Verify found:** Move gave no feedback (now shows "Moving to …"). Other
  failures were test issues: Next keeps hidden copies of past pages, and its
  screen-reader route announcer still holds the old title, so checks now count
  only visible text inside `<main>`.
- **Hit the Gemini free-tier rate limit** after many verify runs. The app
  showed its designed state ("The recipe helper is busy right now. Try again in
  a minute.") with Try again. Verify now fails fast with that message instead
  of waiting 4 minutes.

### B27. Limit Gemini calls during testing
- **Student:** "Can you limit the API call to Gemini during testing?"
- **Built:** a dev-only response cache (`lib/ai/cache.ts`), keyed by model +
  prompt + transcript + answers + schema. The same request reuses the saved
  answer; anything new still calls Gemini. Off in production (the live site
  always calls the model) and off for evals (they measure the model).
- **Measured:** two verify runs in a row = **0 Gemini calls** (2 cache hits
  each), and each run took about 35 s instead of over a minute.
- `npm run verify:fresh` clears it, for when a test should use the real model.

### B28. One "New" button
- **Student:** "arent these two buttons do the same thing? Can you merge with
  the option to add dictation in the New button."
- **Built:** a single Scarlet **New** button (the one primary action) that
  opens **Idea** ("A note, link, or dish to try later") or **Dictation** ("The
  cook's words, to turn into a recipe"). It's a disclosure button with
  `aria-expanded`; outside click or Escape closes it and returns focus. The
  first-run "Add your first dictation" became secondary, so there's still one
  primary per screen.
- **Verify found:** the menu was cut off at 390px (anchored right while the
  button sits left on phones), and the ▾ rendered as a dot. Fixed (left-anchored
  on mobile, an SVG chevron). Keyboard test: Enter opens ✓, Tab reaches Idea ✓,
  Escape closes and returns focus ✓. Page waits now time out at 30 s.

### B29. Edit ideas; make the AI step deliberate
- **Student:** "Add a way to edit ideas. The crete recipe should be more
  highlighted because it uses AI to generate the receipe. We do not want to hit
  that as offten untile we are ready."
- **Edit ideas:** an "Edit idea" button under the title → `/i/[id]/edit`
  (same form; Save changes returns to the idea, Cancel goes back). Replaced
  the folded "Edit idea" box that was easy to miss.
- **AI step:** Create recipe is its own panel with a **Uses AI** badge (blue
  tint = from AI, same as "Suggested"), a plain explanation, and a required
  "Their words are complete. I'm ready." checkbox. The button ("Create recipe
  with AI") stays disabled until it's ticked. "Make the recipe with AI" on the
  questions page is marked the same way. The home card hint now says "Words
  saved" instead of "Create recipe", since tapping it only opens the page.
- **Verify:** the button is disabled before the tick ✓ and enabled after ✓;
  edit idea saves and shows the new note ✓; 0 axe violations.

### B30. Dictations become editable (product rule changed)
- **Student** (looking at a dictation): "I don't see edit option."
- **Options offered:** editable until the AI uses them (recommended) / lock the
  words, edit names only / always editable.
- **Student chose:** "Always editable." This replaces the proposal's
  "her words are never edited."
- **How it stays honest:** the database keeps the first version
  (`original_transcript`, shown as "See the original words") and stamps
  `edited_at` (the client can't forge either). A recipe made before an edit
  shows "Their words were edited on …, after this recipe was made, so the
  recipe may not match them anymore." The label reads "Their words · edited
  <date>" instead of "exactly as said".
- **Tested:** in the DB, the first version is kept across two edits ✓, forging
  the original is blocked ✓, another user edits 0 ✓. Verify edits words after
  the recipe exists: notice ✓, original kept ✓, 0 Gemini calls.

### B31. The AI recipe step only lives in Development
- **Student:** "Only have genearte Create Recipe with AI in the development tab."
- **Built:** in Ideas (or Finished, with no recipe yet) a dictation shows
  "Ready to develop it? · Move to Development" instead of the AI panel. Once
  it's in Development, the "Create recipe with AI" panel appears (still behind
  the "I'm ready" tick). **Enforced on the server too:** `createRecipe` refuses
  unless the dictation's stage is development.
- **Verify found:** the "no AI button in Ideas" check first passed on the
  *loading skeleton* (a false pass), so it now waits for the panel. A
  duplicate "Move to: Development" link sat under the big button and was hidden
  (Simplicity). 0 Gemini calls per run.

### B32. Edit in place, no separate page
- **Student:** "I want to be able to edit the title and description and cooks
  word all in the same page ... I don't want to click on the edit idea and open
  up a whole new page."
- **Built:** an **Edit** button turns the idea (title, note, link) or the
  dictation (cook's words, dish name, whose words) into fields **in the same
  spot**. Save changes / Cancel return to the view on the same URL, and focus
  goes back to Edit. The recipe page has "Edit their words" in place too. The
  separate `/edit` pages were removed.
- **Verify found:** the breadcrumb overlapped the edit box (a negative-margin
  spacing trick), and while editing there were two red buttons (Save + "Add the
  cook's words" or "Create recipe with AI"). Fixed: the next-step panel hides
  while editing, so Save is the only primary action. In-place save ✓, focus
  returns ✓, URL unchanged ✓.

### B33. Pencil icons, and "Idea notes" for everything in Ideas
- **Student:** "I want to be able to click on a small icon next to french onion
  soup and Change it. For all ideas it should have a Idea notes. It does not
  need the [Cook · Their words, exactly as said panel]."
- **Built:** a pencil right after every title (ideas and dictations). The title
  becomes a field in place; Enter saves, Escape cancels. Every item in Ideas
  shows **Idea notes** with its own pencil (for an idea: note + link; for a
  dictation in Ideas: its words). The cook's-words panel only appears once
  it's in Development, with the hint "When you move this to Development, these
  notes become the cook's words the AI reads." The big Edit button is gone.
  In-place Save is the secondary style, so the page's one primary stays the
  next step.
- **Verify found:** the title field was much smaller than the title, and long
  titles were cut off in a one-line box. Now it's the same serif size and wraps
  (a textarea where Enter saves). Rename ✓, notes ✓, focus returns to the
  pencil ✓, no cook panel in Ideas ✓.

### B34. Idea notes and the cook's words are separate
- **Student:** "Keep ideas note when it is move to develompent. Have a new
  setction for Cook Their words. If it doesn't have one have a way to add it."
- **Data model change:** ideas and dictations became **one kind of entry**
  (`dictations`: title, `notes` + `link`, optional `transcript`). Existing
  ideas were migrated over (stage and date kept). Adding words for the first
  time doesn't count as an "edit" (the trigger was updated).
- **Every entry page:** title (pencil) · **Idea notes** (pencil, kept in every
  stage, also on the recipe page) · **Cook · Their words**: the words with "Edit
  their words", or a dashed "No cook's words yet" box with **Add the cook's
  words** (in place). The AI step appears only in Development **and** once
  words exist; `createRecipe` refuses without words.
- "Add the cook's words" is the primary button in Development (it's the next
  step) and secondary in Ideas (where "Move to Development" is primary).
- **Verify:** an idea moved to Development keeps its notes ✓, shows "No cook's
  words yet" with no AI button ✓; adding words in place shows them and the AI
  panel ✓; notes still there ✓. 0 Gemini calls.

### B35. v2 plan drafted
- **Student:** "Can you generate V2 proposal with this: V2 will include pictures
  in the idea generation; better UIUX to streamline the workflow from idea
  generation to development to final recipes; iterations and the development
  with notes on how different parameters changes the dish; recipe description
  and the different variation of the same recipes with notes and dates."
- Draft in `notes/v2-plan.md`: each feature with what / why (evidence from
  interviews, this week's flow fixes, evals) / how / done-when, plus the AI
  angle (a labeled trial summary with its own eval), a schedule to Dec 1, and
  a cut order. It has a placeholder for real-user test findings.
- **Student added:** "V2 will include nutritional facts from the ingredients and
  the ability to scale different portions." Added as feature 5, with how vague
  amounts are handled (never invented; nutrition labeled an estimate),
  amounts as number + unit for code-based scaling, and a USDA tool-calling
  nutrition step. Placed in the schedule, first in the cut order.

### B36. Edit ingredient amounts on a recipe
- **Student:** "Please have a way that I can edit the quantity in the
  ingredients list for the recepie."
- **Built:** a pencil next to each amount on your own finished recipe; it edits
  in place (Enter saves, Escape cancels, focus returns to the pencil).
- **Honest labels:** a changed amount becomes **Family answer** (no longer the
  cook's), and the ingredient note keeps the history ("Changed from “1/2
  gallon” (Grandma) on Nov 15."). Clearing it marks it "Not stated". Shared
  links stay read-only (no pencils).
- **Bug avoided:** saving an amount doesn't bump the recipe's `updated_at`,
  which would have hidden the "words edited after this recipe was made" notice.
- **Verify:** edit → "Family answer" ✓, history note ✓, focus ✓, no pencils
  on the shared page ✓.

### B37. One pencil for the whole ingredient list
- **Student:** "I want only one edit button to edit all the ingredients list."
- **Built:** a single pencil next to the "Ingredients" heading (the per-row
  pencils are gone). It opens the whole list as one form: edit any amount or
  name, × to remove, "+ Add ingredient", then Save ingredients / Cancel (Escape
  works too).
- **Labels:** a changed amount → Family answer + "Changed from “…” (Grandma) on
  …"; a renamed item → "Renamed from …"; an added one → Family answer + "Added on
  …"; a removed one → "Removed “…” (Grandma) on …" in "What the app changed".
  Shared links stay read-only.
- **Verify found:** at 390px the side-by-side boxes cut off names ("1 small
  contain…"). On phones each ingredient now stacks (name full width, amount
  below); wider screens keep the table. Change ✓, add ✓, remove ✓, focus
  returns ✓, no per-row pencils ✓.

### B38. A calmer recipe: sources behind a switch, why and dials behind icons
- **Student:** "Can you remove the cook, family answer, and suggested? In
  addition can you make a small Science icon that if the user clicks on it
  explains the food science and Adjust to taste as another icon where the user
  can expand if they want. Having everything shown is too busy." Then: "Only show
  the icon if they are relevant."
- **Pushback (once):** the labels are the proposal's differentiator and the
  AI-focus honesty promise. **Options offered:** hide them behind one "Show
  sources" switch / remove them entirely. **Student chose:** "Hidden, one 'Show
  sources' switch." Her quotes: **behind the Science icon** (her reason first,
  then the science).
- **Built:** the recipe shows only amounts, items, and instructions. A **Show
  sources** switch (`role="switch"`) reveals the labels, answer details, edit
  history, and "What the app changed" (`.src-only` + `[data-sources]`). Each
  step has a **flask** icon (Why it works: "Grandma's reason" → "The science")
  and a **sliders** icon (Adjust to taste), each only if there's real content
  (blank entries don't count). They sit at the end of the step's first line;
  `aria-expanded`, and solid ink when open.
- **Verify found:** stale CSS again. The guard only compared colors, so it now
  checks every custom rule in globals.css too. The icons first sat on their own
  line (big gaps), so they moved inline. Labels hidden by default ✓, science
  opens ✓, dials open ✓, Show sources reveals labels ✓.

## Nov 15 — Review and merge `refine-v1`

### B39. `/security-review` on the branch (origin/main...refine-v1)
- **Result: no findings** at or above the reporting bar. The reviewer agent
  checked: the dictations column grants + owner-only UPDATE policy (owner_id,
  copied_from, original_transcript, edited_at can't be changed); the
  edit-tracking trigger; the ideas → dictations migration (keeps each row's
  owner); share functions don't expose `notes`, `link`, or
  `original_transcript`; every server action goes through `requireUser()` +
  RLS, so tampered ids only reach your own rows; links are http(s) only (server
  check + DB constraint), with no `javascript:`; the dev-only AI cache is off in
  production, its file names are hashes (no path traversal), and keys include
  the full input (no cross-user leaks).
- Below the bar (not fixed): malformed `rows` JSON could make
  `updateIngredients` throw (a robustness issue only); the unused `ideas` table
  is still granted but fully owner-only.
- The Vercel preview build of the branch passed. Merged via a pull request.

### B40. Merged and live; user testing script
- PR #1 (`refine-v1` → `main`) merged. Vercel production deploy ✅. The live
  site serves the Scarlet accent (`--color-ls-accent:#ae1f2e`), the landing page
  loads, and signed-out `/ideas/new` → sign-in (307).
- **Student:** "write the user testing script while we wait." Draft in
  `notes/user-testing.md`: who (cousin, aunt, a new person), a read-aloud intro
  (think aloud, I won't help), 5 tasks worded without button names, what to
  watch for in each, after-task questions, a notes template, and the yogurt
  dictation to text.

### B41. Landing eyebrow
- **Student:** "A lab book for family recipes can you change to a lab book for
  receipe development." Now reads "A lab book for recipe development". Verify ✓.
- Landing paragraph updated to match the app (words are editable now; labels
  are behind Show sources). **Options offered:** A workflow / B short and plain /
  C lab-book voice. **Student chose:** "A: The workflow."
- **Student:** "When it's ready, send it to someone else to cook or save it for
  future use. The sending is only an option." Last sentence updated to their
  wording.

### B42. First-run: "Save an idea"
- **Student:** "Add Save an idea" (on the empty lab book's "Start with one dish").
- Added a **Save an idea** button (→ /ideas/new) before "Add your first
  dictation", both secondary (New stays the one primary). Reworded the
  paragraph (agent draft) to mention ideas and drop "keeps their words exactly",
  which is no longer true. Checked with a brand-new test account: 390/1440
  screenshots, 0 axe violations, button goes to /ideas/new.

### B43. First-run: two cards
- **Student:** "Can the first landing page have a different cards for Idea and
  have a similar explanation?"
- The empty lab book now shows "Start with one dish" with two matching cards:
  **Start with an idea** (Save an idea) and **Start with the cook's words** (Add
  the cook's words), side by side on wide screens and stacked on phones.
  Agent-drafted copy. Empty test account at 390/1440 ✓, 0 axe violations.

### B44. Ask the cook for ingredients and detailed steps
- **Student:** "Change this to have the cook dictate how they would make the
  dishes. If possible have ingredients and detailed steps dictated. The AI will
  format it into repeatable recipes."
- The empty "Their words" box now says "Have the cook dictate how they make the
  dish: the ingredients, then each step in detail. The AI will format it into a
  recipe anyone can repeat." The add-words hint asks the cook to talk through
  the ingredients and each step. Verify ✓.
- **Student:** "update in all places." The same ask (ingredients, then each step
  in detail; the AI formats it into a repeatable recipe) is now on the New
  dictation page intro, the dictation form tip, and the first-run "Start with the
  cook's words" card. Dropped "Their words are saved exactly as they are" (no
  longer true). Verify ✓ + empty-account check ✓.

### B45. The cook's words are added only in Development
- **Student:** "only have add cooks word in the development section."
- In Ideas, an entry shows title, Idea notes, and "Ready to develop it? · Move
  to Development" ("…to add the cook's words and create the recipe with AI").
  No cook's-words box. In Development, the words section appears (Add the cook's
  words → then the AI step). Words that already exist still show in any tab.
- To match, **New → Dictation now creates the entry in Development** (adding
  words is Development work). Verify ✓: no words box in Ideas, and a new dictation
  lands in Development with the AI panel.

### B46. New headline (the one-liner evolved)
- **Student:** "It is an app to track culinary inspiration, provides a platform
  for quickly developing recipes/iterations via voice/ai, and a place to store
  the recipes with incorporating food science."
- **Options offered:** A three verbs / B from inspiration to recipe / C your
  culinary lab. **Student chose:** B. The landing headline and page description
  are now "From inspiration to recipe: develop dishes by voice and AI, with the
  food science built in." Added `text-balance`, because verify showed "in."
  alone on the last line at 1440px. AGENTS.md records the change from the
  proposal's one-liner.
- **Student:** "update both." The v2 plan opens with "What Culinary Lab Book is"
  (new headline + the student's description), and its v1 summary matches the
  current flow. Talking points §1 now gives the one-liner, the current core task,
  and "how the one-liner evolved"; §2 adds the shift from family recipes to
  recipe development.

## Nov 16 — User feedback → v2 plan

### B47. First user feedback
- **Student:** "The feedback was it was text heavy so it was a lot of reading
  to understand what the different tabs are. v2 should have a read me or
  instructions on using the app. In addition, a way to add more pictures, a way
  to categorize the recipes would be nice too."
- Added to `notes/v2-plan.md` under "From real users" (who: left for the
  student to fill in), and v2 changes: #2 moves to first priority with a "How
  it works" guide, a header "?", a README, and less text (one line per screen,
  icons + progress line); #1 photos extend to recipes and trials (gallery,
  cover photo); new #6 categories (multi-tag, filter, AI-suggested but never
  auto-applied). Schedule and cut order updated; the guide + less text aren't
  cuttable.
- **Student:** "Cousin was the tester." Filled in the v2 plan's "From real users."
- **Student (cousin's session):** "They took a while to read the intro page.
  After they created an Idea they didn't know what to do next. They didn't know
  how to create multiple ideas." Added as "Where they got stuck" (1–3), each
  mapped to a v2 #2 fix: a shorter landing page with a how-it-works picture; a
  "Saved to Ideas" message plus one next step after saving; "Save and add
  another" and a + New idea button on the Ideas tab and idea pages. New done-when:
  saves three ideas in a row without help.

### B48. v2 plan finished
- **Student:** "Finish the V2 plan." The student removed the draft note
  themselves. Cleanup: "testers" → "my cousin" (one tester); removed the
  leftover placeholders; replaced the stale "polish from testers (to fill in)"
  line; the schedule marks testing done (Nov 15–16, cousin); split the run-on #2
  "Done when" into three checks; tidied the open questions.

---

# v2 (Nov 20 → Dec 1)

## Nov 20 — v2 repo

### V1. A new repo for v2
- **Student:** "I need to create a new repository for projectV2… I want to
  continue building off this session."
- **Options offered:** copy V1 with its history / copy the code with fresh
  history. **Student chose:** "Copy V1 with its history." The new repo is
  `phamkd17/DBS-ProjectV2` (public, like V1), with all v1 commits and a
  **`v1` tag** at the submitted state. This satisfies the brief's "commits that
  show your work since v1" (`git log v1..main`).
- **Options offered:** new Vercel + new Supabase / new Vercel, share V1's
  database. **Student chose:** "New Vercel, share V1's database."
  Consequence: **v2 migrations must be additive** so v1's live site keeps
  working (rule added to AGENTS.md).
- Safety: the `v1` remote's push URL is disabled in this folder.
- Started `notes/what-changed.md` (a brief requirement).

### V2. v2 live URL + issues
- Vercel project for v2: https://dbs-project-v2.vercel.app (same 6 env vars,
  same Clerk app and DB). Smoke test: home ✓, signed-out → sign-in ✓,
  `.env.local` 404 ✓, signed-in lab book loads ✓.
- v2 brief step 1: the plan became **GitHub issues #1–#15**, ordered with the
  cousin's stuck points first (#1–#4), then the required security work (#5
  rate limit + token cap, #6 security pass), then the features (#7 photos, #8
  categories, #9 iterations + AI eval, #10 variations, #11 scaling, #12 prompt
  p5, #13 progress line, #14 nutrition, labeled cut-first), then #15 What
  Changed + demo prep. Labels: stuck-point, security, feature, ai, polish,
  docs, cut-first. **Student:** "Create them in this order."

## Nov 20 — Issues #1–#4: where my cousin got stuck (branch `stuck-points`)

### V3. Stuck points fixed
- **Student:** "yes" (start with #1–#4 on one branch); "Be sure to commit often."
- **Baseline first:** `npm run words` counts visible words on the main screens:
  v1 = landing 81, empty lab book 99, new idea 34, new dictation 86 (**300**).
- **#1:** the landing page is the headline + `HowItWorks` (3 steps, icons) + one
  button, with no paragraph.
- **#2:** `createIdea` → `/d/[id]?saved=1` → `SavedBanner` ("✓ Saved to Ideas" +
  **Add another idea** as the one primary; "Move to Development" drops to
  secondary). The flag is stripped from the URL, so it shows once.
- **#3:** **Save and add another** (`intent=another`) → a fresh form with "Saved
  “X” to Ideas. Add the next one." (a key resets the form); **+ New idea** on the
  Ideas tab and on idea pages.
- **#4:** a **?** in the header opens a native `<dialog>` (Escape closes,
  focus returns); one-line tab hints and empty states; shorter intros and AI
  copy; dropped duplicate tips; README "How to use it". After: landing 50,
  empty lab book 39, new idea 25, new dictation 32 (**146**, under half).
- **Verify** covers each one (the dialog opens/closes with focus return; Saved
  banner; shown once; add-another clears the form; + New idea), 0 axe
  violations at 390/1440. Test fixes: exact name matching (#2 contains #1's
  name; the rename step), and cleanup of the second idea. `npm run verify` now
  runs only `verify.spec.ts`; the word count is `npm run words`.
- Renamed the V1 remote to `v1-repo` (the name "v1" clashed with the tag).
- **Student:** "I also want an option to be able to type it in." Every place
  that asks for the cook's words now says **type or dictate**. That pushed the
  main screens to 154 words (over the ≤150 target), so the New dictation intro
  was trimmed back to 149.
- **Student:** "Mention typing, mention that it makes recipe development easy."
  **Options offered:** A keeps the opening / B leads with easy / C shortest.
  **Student chose:** A: "From inspiration to recipe: type or dictate your dish,
  and AI makes recipe development easy, with the food science built in."
  Also updated AGENTS.md, the v2 plan, and the talking points.
- **Student:** "the text is too big. i want to minimize scrolling." The landing
  headline is now 2rem / 4xl / 5xl (phone / tablet / laptop), was 2.5rem / 7xl,
  with tighter spacing and more compact steps on small screens. Measured: the
  button is fully on screen at 390×844, 375×667, 768×1024, 1280×720, and
  1440×900 (0px scroll except 19px of bottom padding on the 375×667 phone).
- **Student:** "Are you able to add tabs at the top that people can always
  navigate between Ideas, Development and Finished. I don't like finished,
  what's any word?" **Options offered:** Recipes / Cookbook / Perfected /
  Library. **Student chose:** "Recipes." The label is renamed everywhere; the
  stored stage stays `finished` (shared DB with v1). `TopTabs` in the header
  (signed in) marks the open section (`aria-current`). The home page now always
  redirects to an explicit `?tab=`. The in-page tab bar was removed (it's in the
  header now), and the counts moved into the hint ("Ideas · 12 · …"). Verify ✓
  at 390/1440.
- Streamlined the start buttons (the student found New, Save an idea, and Add the
  cook's words redundant). Chosen: one button per tab. The first-run screen is
  now the heading + steps only; the extra + New idea next to the hint is gone.
  Tests point to the right tab for each button. Verify ✓; an empty account
  shows exactly one start link.
- Creating an idea felt indirect (tab → button → separate page). **Options:**
  quick-add box / clickable step cards / "+ New" in the header. **Chosen:**
  quick-add. `quickAddIdea` saves just the name (no redirect); the box resets
  and keeps focus, and a status line confirms it. The Ideas tab's "+ New idea"
  button is gone (the box replaces it); the full form (`/ideas/new`) is still
  reachable from New ▾ on Recipes. Verify ✓: empty Enter error, item appears,
  box clears and keeps focus, cleanup.
- Recipes can be added by hand in the same format as AI recipes.
  `createManualRecipe` saves an entry (stage finished) + a ready recipe
  (`model: "manual"`; everything labeled as the cook's, i.e. "Whose recipe?"; a
  why note → a cook-sourced why, so the science icon shows "<cook>'s reason").
  If the recipe insert fails, the entry is removed (no half-saved rows).
  `/recipes/new` form: rows for ingredients and steps, "+ Why it works" per
  step; errors clear when you edit that part; ids via useId (no hydration
  mismatch). The Recipes tab's button is now **+ New recipe**; the unused New
  menu was removed. Hand-typed recipes hide the cook's-words section. Verify ✓
  (errors, save, format, no words section, delete).
- A way to quit the AI questions. **Options:** both / save only / discard only.
  **Chosen:** both. `saveAnswersForLater` saves the non-empty answers (no AI
  call) → `/?tab=development`; untouched questions stay open. `discardDraft`
  deletes a draft recipe (questions cascade; a ready recipe can't be
  discarded this way) → back to the entry, where Create recipe shows again.
  "Save for later" submits the questions form via `form` + `formAction`.
  Verify ✓: the answer persists after save; after discard the draft URL is gone
  and the recipe can be recreated (dev cache, 0 Gemini calls).

## Nov 21 — Delete the cook's words; no original versions
- Delete their words: `deleteWords` sets the transcript to null; the entry, idea
  notes, and recipe stay. Not offered on the AI questions page (pass 2 needs
  the words). Confirm dialog. Edit comes before Delete when they wrap.
- The student doesn't need original versions kept. The trigger now never keeps
  `original_transcript`, sets `edited_at` on edit, and clears it on delete;
  existing originals were cleared (migrations `20261121000000`,
  `20261121010000`). The column stays (additive rule; v1 reads it and shows
  nothing). Removed "See the original words" and the "first version is kept"
  note. AGENTS.md rule 1 updated.
- Tested in the DB (rolled back): no copy after an edit, everything gone after a
  delete, another user deletes 0. Verify ✓.
- Saving the cook's words empty now deletes them (it used to be an error).
  `updateDictation` sets the transcript to null when empty, except while a draft
  has open AI questions ("The AI questions still need these words…"). The edit
  hint says clearing deletes. Verify ✓ for both cases.

## Nov 21 — Write the recipe yourself from Development
- "Or write the recipe yourself, no AI" under the AI panel and in the no-words
  box links to `/recipes/new?from=<id>`. The page loads the entry through RLS
  and prefills name, cook, and notes. `createManualRecipe` with `dictation_id`
  checks ownership, refuses if a recipe already exists (unless it failed),
  moves the entry to Recipes, and rolls the stage back if the recipe insert
  fails. A manual recipe shows the cook's words section only if words exist.
  Verify ✓.
- Shortcut (student's request): Enter in an ingredient field or a step adds a
  row right below and focuses it (Ingredient on phones, Amount at 640px+, the
  first field on screen). It doesn't submit the form, and it ignores Enter
  while an IME is composing. Shift+Enter is a new line in a step. A hint line
  sits under each heading. Verify ✓ (Enter adds row 3 with focus, no submit;
  Shift+Enter keeps one step).

## Nov 21 — Sections in the Recipes tab (issue #8, first part)
- Student's call: several sections per recipe, their own list (create/delete).
- Migration `20261121020000_sections.sql` (additive; v1 never reads it):
  `sections` (name 1–40, unique per owner ignoring case) and `entry_sections`
  (entry ↔ section). Owner-only RLS; inserting a link checks that **both** the
  entry and the section are yours (the Nov 14 re-pointing lesson). No UPDATE
  grant at all; anon gets nothing. Tested in the DB (rolled back): duplicate
  name blocked, another user sees 0, can't link into someone else's entry
  (42501), can't delete theirs, update and anon blocked, deleting a section
  keeps the entry and removes its links.
- Links hang off the entry (`dictations`), not the recipe, so they survive
  re-creating a recipe. Shared copies don't carry sections (they're personal).
- UI: Recipes tab filter chips (`?section=<id>`, `aria-current`), section names
  on each card; on a Recipes item, toggle chips (`aria-pressed`, optimistic)
  + "+ New section" (adds it and puts the recipe in it); `/sections` to add,
  count, and delete (confirm: the recipes stay). The starter list is offered
  only when you have no sections, so deleted ones never come back on their own.
  Chips are Ink when on, so Scarlet stays the one primary.
- Verify ✓ (axe clean at 390/1440). Fixed after the screenshot review: an
  "Added to …" line stayed on screen after the chip was toggled off, so it was removed.
- Still open in #8: search by title, AI-suggested sections.

## Nov 21 — Sections become Tags, with a type-to-add box
- Student's call after I suggested it: "tag" fits several-per-recipe, and typing
  scales better than a wall of chips. Labels, route (`/tags`), query param
  (`?tag=`), and code names changed. The tables keep their names
  (`sections`, `entry_sections`): no migration, nothing for v1 to notice.
- `TagPicker`: tags on the recipe are Ink chips with ×. One input: Enter adds.
  `tagEntry` reuses your tag with that name (any case) or makes a new one, then
  links it. Your other tags are listed below and narrow as you type; tap to add.
  With no tags yet, the starter names are offered (tapping one makes it).
  Optimistic updates; `aria-busy` while saving.
- Bug found by verify: removing a tag right after adding it sent its temporary
  id and failed. `untagEntry` now goes by name (the server looks the tag up).
- Verify ✓ (axe clean): type to add, Enter, focus stays, no duplicate in any
  case, ×, matching tags, saved after reload, filter, delete keeps the recipe.
  Cleaned leftover test tags and recipes from failed runs (verify names only).
- All tags (student's pick): `/tags` now lists each tag as a region with its
  recipes (one embedded query: tags → links → entries → recipes, all under
  RLS), linking to the recipe (or the entry if it has none). "Edit tags" links
  are now "All tags". Verify ✓ (the tag's region lists the recipe; an unused
  tag says "No recipes yet").

## Nov 27 — Photos on ideas (issue #7, first part)
- Student's request: add an idea as text, a photo, or both.
- Storage: a **private** `photos` bucket (2MB cap, JPEG/PNG/WebP only). Files
  live at `<user id>/<entry id>/<random>`; Storage RLS only allows your own
  folder (read, add, delete; no update). `entry_photos` records them; its insert
  policy checks the entry is yours and the path starts with your folder for
  that entry (`starts_with`, not LIKE, because Clerk ids contain `_`). Tested
  in the DB (rolled back): own folder ok; another user's folder, entry, or a
  `_`-wildcard path blocked; another user sees 0 files; anon sees nothing.
- Photos are shown with **1-hour signed URLs** made on the server, never public
  links. Not shared through recipe links.
- Phone photos are 3–12MB, but server actions are capped at 1MB. The browser
  shrinks each photo (longest side 1600px, JPEG under 900KB, keeps rotation)
  before upload. The server checks the real file bytes (magic numbers), not
  the name. "Not a photo" gives a friendly error. HEIC on desktop Chrome can't
  be decoded, so it gets the same message.
- Deleting a photo or an entry deletes the files too (`deletePhotos`), so
  nothing is left in Storage. Checked after verify: 0 files, 0 rows left.
- Quick-add: the camera button opens the picker (camera on phones), shows a
  preview with "Remove photo", and Enter or Add saves. A photo-only idea is
  called "Photo idea" everywhere. Up to 6 photos per idea.
- Verify ✓ (axe clean). Screenshot review: photos looked blank because the
  shot was taken before they loaded, so verify now waits until each image has
  really loaded (naturalWidth > 0). That also proves the signed URLs work.
  Cleaned up old verify test ideas.
- Student: zoom in on tap instead of opening a new tab, and don't crop
  thumbnails. The viewer is a native `<dialog>` (like the "?" guide): Escape,
  a tap outside, or × closes it, and focus returns to the thumbnail.
  Previous/Next and the arrow keys move between photos. The photo fits the
  screen (`object-contain`, max 100dvh minus the bars). Thumbnails changed
  from `object-cover` to `object-contain` on Plaster. Verify adds a tall
  portrait photo and covers open, arrows, Next, Escape, focus return, and no
  new tab. Axe clean.
- Student didn't like the empty bars from `object-contain` in square boxes.
  Thumbnails now keep each photo's own shape: the same max height (176px on
  phones, 224px wider), width auto, and the border hugs the photo. The list
  thumbnail is max 64×96. On a narrow photo the overlaid × covered half of it,
  so Delete moved below each photo as a text button. Verify ✓, axe clean.

## Nov 27 — "Kitchen notes"
- The student didn't like the cook's-words wording and picked **Kitchen notes**
  from four options. Recipe development = dictate or paste rough
  instructions. Renamed in every UI string, error message, confirm dialog, and
  the AI step ("The kitchen notes are complete. I'm ready."). The COOK badge was
  dropped from the empty box heading. It stays on the notes themselves and on
  recipe parts, where it's the source label (rule 4).
- `KitchenNotesTip` (draft): "include amounts (2 cups flour, 1 tsp salt) and as
  much detail as you can: times, temperatures, what it should look like." It
  shows in the empty box and under the field label (`aria-describedby`). The
  placeholder example now has amounts and temperatures.
- Code names (`transcript`, `DictationEditor`) and the AI prompt are unchanged;
  reframing the prompt is #12 and needs an eval run.
- The page title "Kitchen notes" repeated the field label, so it's now "New
  kitchen notes". Verify ✓, axe clean.
- "Idea notes" → **Inspiration** (my suggestion, the student's call): the
  heading, pencil ("Edit inspiration"), field labels, and empty state ("Nothing
  yet. Tap the pencil to note what inspired it."). Errors that meant the
  transcript now say "kitchen notes". The `notes` column is unchanged.
- Tip trimmed at the student's request: "include amounts and as much detail as
  you can, like times and temperatures. The more detail, the better the recipe."
  Verify ✓.
