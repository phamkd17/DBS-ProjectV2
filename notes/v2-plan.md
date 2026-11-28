# Culinary Lab Book: Plan for v2

## What Culinary Lab Book is

> **From inspiration to recipe: type or dictate your dish, and AI makes recipe development easy, with the food science built in.**

An app to **track culinary inspiration**, a place to **quickly develop recipes
and iterations by voice and AI**, and a place to **store finished recipes**
with the food science behind each step. v2 builds on all three: photos for
inspiration (1), a clearer, faster path through development with built-in
instructions (2), iterations (3), and richer, organized finished recipes (4, 5, 6).

## Where v1 is

A new person can do the core task end to end, on a phone or a laptop:
**save an idea → in Development, add the cook's words (dictated by voice) → the
AI drafts a recipe and asks what it can't know → answer, or accept a
suggestion → a finished recipe, with the why behind each step one tap away →
keep it in your lab book, or send it by link.**

- Live: https://dbs-project-v1-omega.vercel.app · Repo: github.com/phamkd17/DBS-ProjectV1
- AI: two Gemini passes on prompt **p4**: **45/50** checks on Grandma's three
  real dictations, with every must-pass check passing (it catches the "10 in"
  Dannon starter and the missing cooling step).
- Lab book: **Ideas → Development → Finished**, Idea notes kept at every stage,
  and the cook's words as their own section.

## What we saw when people used v1

**From building and using it myself (Nov 13–15):** most of my changes this
week were about **flow, not features**. Each one was a spot where I got stuck
or the next step wasn't obvious:
- Two "New" buttons that did the same thing → merged into one.
- Editing opened a separate page → I wanted to edit right where I was (pencils).
- Notes disappeared when an idea moved to Development → now kept.
- The AI button was easy to hit by accident → now it only appears in
  Development, behind an "I'm ready" tick.

That's the main reason **streamlining the workflow** is a v2 priority. The
path from idea to recipe still takes too many decisions.

**From the evals:** the AI still misses things on long dictations: where the
prepped green onions go, how many parboils, "≈5 tomatoes", the kind of milk,
and fridge vs. freezer. All five are in the eval results, and none have a fix yet.

**From real users** (watched without helping). **Tester: my cousin**, who's
also the one who'll follow the yogurt recipe for the success test.
- **It was text heavy.** There was a lot to read before it made sense, especially
  **what the different tabs are** (Ideas / Development / Finished).
- **They wanted instructions:** a read-me, or a guide to using the app.
- **They wanted more pictures.**
- **They wanted a way to categorize recipes.**

**Where they got stuck:**
1. **The intro page took a while to read** before they started.
2. **After creating an idea, they didn't know what to do next.** The idea page
   didn't make the next step obvious.
3. **They didn't know how to create more than one idea.** After saving one,
   there was no clear way to add another.

These change the v2 priorities: **making the app understandable without
reading (2) moves to first**, photos (1) grow beyond ideas, and categories (6)
are new.

---

## What v2 adds and changes

### 1. Pictures: on ideas, recipes, and trials

**What:** add **several photos** wherever they help: on an **idea** (a dish I
tasted, a page from Grandma's pantry notebook, a plating to try), on a
**finished recipe** (what it should look like), and on each **trial** (see 3).
They show as a gallery, open full screen, and the first photo is used as the
cover in the lab book list.

**Why:** my cousin asked for **more pictures**. In my interviews, inspiration
*"gets lost… in all different places"*, and most of it is photos on my phone.
A note without the picture loses half of the idea, and a cook following a
recipe wants to see what "golden" or "set" looks like.

**How (sketch):** a private Supabase Storage bucket. Files live under each
user's id and follow the same owner-only rules as the rest of the lab book.
Photos are resized on the phone before upload to stay on the free tier, with a
`photos` table linking each one to its entry. Photos go to the AI only when the
user asks (see 4).

**Done when:** I can add 3 photos from my phone to an idea and to a recipe,
see a cover photo in the list, and another user can't open them, even with the
URL.

### 2. Understandable at a glance, and a streamlined path (first priority)

**What, part 1: less reading, plus built-in instructions** (from my cousin's
feedback):
- A short **"How it works" guide**: three steps with an icon each
  (**Ideas** → **Development** → **Finished**) and one line per step. It's
  shown the first time someone opens the app and is always reachable from a
  **?** in the header. There's also a **README** for the repo.
- **Cut the text on every screen** to one short line where a paragraph is now.
  Each tab gets a one-line hint ("Notes and links to come back to", "Add the
  cook's words and make the recipe", "Ready to cook and send").
- **Icons and the progress line do the explaining** instead of paragraphs.
- Test it: a new person can say what each tab is for **without reading more
  than one line**.

**Fixes for the three places my cousin got stuck:**
1. *Intro took a while to read* → a **shorter landing page**: the headline, one
   line, and the three-step "How it works" picture instead of a paragraph.
2. *Didn't know what to do after creating an idea* → right after saving, the
   idea page shows **"Saved to Ideas"** and **one clear next step**: "Add
   another idea", or "Ready to cook it? Move to Development".
3. *Didn't know how to create multiple ideas* → **"Save and add another"** on
   the idea form, and a **+ New idea** button on the Ideas tab and on every idea
   page, not only behind the New menu on the home page.

**What, part 2: the next step is obvious** at every stage:
- A **progress line** on each entry: Idea → Development → Finished, showing
  where it is and what's needed next ("Add the cook's words", "Answer 3
  questions", "Make the recipe").
- **One next-step button** in the same place on every screen. Fewer screens
  and fewer choices between saving words and getting a recipe.
- **Faster AI waits:** show the questions as soon as they're ready, instead of
  a ~30 s spinner.
- A pass on all the on-screen wording, in my own words.

**Why:** my cousin found it **text heavy** and needed to read a lot to
understand the tabs. Also see "What we saw": almost every v1 change was a flow
fix.

**Done when:** my cousin (or another new tester), without help:
- saves **three ideas in a row** and knows what to do after each one,
- explains the three tabs after reading only the "How it works" guide, and
- goes from a saved idea to a finished recipe without asking me what to do next.

The main screens also use at most half of v1's words.

### 3. Iterations in Development: what each change does to the dish

**What:** a **lab book of trials** for each recipe. Each time I (or a cousin)
make it, I log a trial:
- **What I changed**, picked from the recipe's own dials ("incubate 8 h → 10 h",
  "sugar ⅓ cup → ¼ cup"), or anything else
- **How it turned out**: notes, an optional photo, and how close it came
  ("Grandma: closer, but still not as sour")
- The **date**

Trials sit side by side, so I can see how each parameter changes the dish.

**Why:** this is the "lab" in Culinary Lab Book. Every interviewee already keeps
a trial log after a miss, on paper or in their head. The yogurt success test is
exactly this: my test batch → the cousin's batch → Grandma tastes. Grandma's
recipes are full of dials (onions 5 vs 7 min, yogurt 8 vs 12 h), and v1 shows
them but can't record what happened when you turned one.

**AI angle (course focus):** after a few trials, the AI summarizes what the
trials show ("longer incubation made it tangier; 10 h matched Grandma's best"),
labeled **Suggested**, never as fact or as Grandma's. It gets an eval of its
own: does the summary only claim what the trial notes say?

**Done when:** I can log 3 yogurt trials with changes, notes, and dates, see
them side by side, and get a labeled summary that passes its eval.

### 4. Recipe descriptions and variations, with notes and dates

**What:**
- A **description** on every finished recipe: what the dish is, where it comes
  from, when we make it. It's labeled like everything else: Grandma's words, a
  family answer, or a Suggested draft.
- **Variations of the same recipe:** "Grandma's original", "My less-sweet
  version", "Auntie's crispy tofu", each with its own changes, notes, and
  date. They're linked to the original and never overwrite it.

**Why:** families already make one dish several ways (the sister likes the
tofu creamy, Grandma likes it crispy; Grandpa likes the yogurt sour). v1 has a
single recipe per dish, so a change either overwrites Grandma's version or
gets lost. A variation keeps her original intact, which is the core promise.

**Done when:** a finished recipe has a description and two variations, each
with notes and a date, and the original is unchanged.

### 5. Nutrition facts and portion scaling

**What:**
- **Scale the recipe:** pick how many servings ("Makes 6 jars → make 12"), and
  every amount that can be scaled updates (½ gallon → 1 gallon). It switches
  between cups/spoons and grams.
- **Nutrition facts** per serving (calories, protein, fat, carbs, sugar,
  sodium), worked out from the ingredients.

**Why:** cousins and friends cook for different numbers of people than Grandma
does, and a recipe that can't be resized means guessing again, which is the
problem the app exists to fix. Both were on my proposal's "ambitious"
list ("portion scaling, nutrition label agent"), and they matter more once
recipes are shared beyond the family.

**The hard part, handled honestly:** Grandma's amounts are often "a little
bit" or not stated at all.
- Amounts that aren't numbers (**"a little bit of fish sauce"**) are shown
  unscaled, with a note, never turned into an invented number.
- Nutrition is labeled an **estimate** and lists which ingredients it couldn't
  count ("fish sauce: amount not stated").
- Accepted suggestions still count, and stay labeled **Suggested**.
- "How much does this make?" becomes one of the AI's questions in pass 1, since
  the dictations rarely say.

**How (sketch), with the AI angle:**
- The recipe format stores each amount as **number + unit** (plus the original
  words), so scaling and unit conversion are plain code, not AI. These are the
  `convert_units` tool from my proposal.
- A **nutrition step with tool calling:** the AI matches each ingredient to a
  food in USDA FoodData Central (free API), and code does the math. The AI
  never makes up nutrient numbers.
- **Evals:** scaling is unit-tested (½ gallon × 2 = 1 gallon; "a little bit"
  stays as is). Nutrition is checked against hand-computed totals for the yogurt.

**Done when:** I can make the yogurt for 12 instead of 6 and every measurable
amount doubles correctly, the vague ones stay as they are, and the nutrition
panel is labeled as an estimate and names what it left out.

### 6. Categories for recipes

**What:** tag each entry with **categories** ("Soup", "Breakfast",
"Vietnamese", "Grandma's", "Fermented"), pick several, and make your own. Filter
the lab book by category inside any tab, and search by title.

**Why:** my cousin asked for a way to categorize recipes. Once a lab book has more
than a handful of entries, three tabs aren't enough to find things.

**How (sketch):** a `categories` list on each entry (owner-only like
everything else), chips to filter the list, and the app suggesting categories
from the dish name, labeled **Suggested** and never applied without a tap.

**Done when:** I can tag the yogurt as "Breakfast" and "Fermented", filter the
Finished tab to "Fermented", and find it in two taps.

---

## Also fixing (from v1)

- **AI question recall** on long dictations (the 5 misses above): prompt p5,
  measured with the existing evals, plus a flan dictation as a fourth sample.
- **Cleanups:** retire the unused `ideas` table; use the project-scoped Supabase
  MCP (`.mcp.json`) instead of the account-wide connector.

## Schedule (Nov 17 → Dec 1)

| When | What |
|---|---|
| Nov 15–16 | ✓ Tested v1 with my cousin (findings above) |
| Week of Nov 17 | **2. "How it works" guide + less text** (from feedback), then the streamlined flow · **1. Photos** · **6. Categories** · AI recall fix (p5) |
| Week of Nov 24 (no class) | **3. Iterations** + AI trial summary and its eval · **5. Portion scaling** (amounts as number + unit) · my yogurt test batch, logged as trial 1 |
| Nov 28 – Dec 1 | **4. Descriptions + variations** · **5. Nutrition** (USDA tool) · cousin's batch as trial 2 · fair prep |

**If behind, cut in this order:** nutrition (keep scaling) → the AI trial
summary → variations (keep the description) → AI-suggested categories (keep
manual ones) → photos on trials (keep ideas and recipes). The "How it works"
guide and less text are **not** cuttable: they're my cousin's main feedback.

## Open questions

- Categories: a fixed starter list, fully custom, or both?
- Should Idea notes (and photos) ever be sent to the AI, or only the cook's words?
- Can trials and variations be shared with family by link, like recipes are now?
- Who logs the cousin's trial: the cousin in their own copy, or me in mine?
- Nutrition: is calories + the big four (protein, fat, carbs, sugar) enough, or
  does it need a full nutrition label?
