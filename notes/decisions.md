# My decisions and guidance

> What I decided and how I directed the agent while building Culinary Lab Book.
> The agent's implementation notes are in `notes/build-log.md`.

---

## How I work with the agent

- **Commit and push after every edit**, so the history shows my process.
- **Keep notes I can present from** in class and at the fair (`notes/talking-points.md`).
- **Review every UI change** against the course design checklist, in a real
  browser at 390 and 1440 px (`npm run verify`).
- **Use my own design system** (Line & Stone), not the agent's default look.
- **Limit Gemini calls during testing** (a dev-only response cache).
- **Guide me step by step** through account and service setup.
- **Nothing merges to the live site without my approval**, one pull request at a time.
- **Iterate on localhost** first, then deploy.
- **Keep building in the same session**, so the context carries from v1 into v2.

## Product decisions

| Date | Decision | Options considered |
|---|---|---|
| Nov 13 | Anyone can keep a private lab book or send recipes to others, not just one family | One family (Clerk orgs, from the proposal) |
| Nov 13 | Send a recipe with a private link; the recipient saves their own copy | Email to an inbox; both |
| Nov 13 | Connect the Supabase MCP for database work | Paste SQL into the editor |
| Nov 14 | Gemini 3.5 Flash as the model | 3.8 Flash (too slow, timed out); 2.5 Flash (closed to new users) |
| Nov 14 | Organize the lab book into tabs (Ideas, Development, Finished); the rest goes to v2 | All three with photos in v2; everything at once |
| Nov 14 | Tab meaning: Ideas = quick notes, pictures, links; Development = actively working on a recipe; Finished = recipes with iterations and notes | |
| Nov 14 | Create ideas, and move anything between tabs | |
| Nov 14 | No per-person daily AI limit for now | A 10-recipes-a-day cap |
| Nov 14 | One "New" button (Idea or Dictation) instead of two | |
| Nov 14 | The AI step is deliberate: highlighted, behind an "I'm ready" tick, and only in Development | |
| Nov 14 | The cook's words are always editable (replaces the proposal's "never edited" rule; at first the first version was kept, dropped Nov 21) | Editable until the AI uses them; lock the words |
| Nov 14 | Edit in place with small pencil icons, not on separate pages | |
| Nov 15 | Idea notes and the cook's words are separate sections; notes stay at every stage; the words can be added later | |
| Nov 15 | One edit button for the whole ingredient list | One pencil per ingredient |
| Nov 15 | A calmer recipe page: source labels behind a **Show sources** switch; food science and adjust-to-taste behind small icons, shown only when relevant | Remove the labels entirely |
| Nov 15 | The cook's reasons go behind the science icon | Keep them visible |
| Nov 15 | Ask the cook for the ingredients, then detailed steps; the AI formats it into a repeatable recipe, worded the same everywhere | |
| Nov 15 | The cook's words are added only in Development | |
| Nov 20 | The cook's words can be typed as well as dictated | |
| Nov 20 | Tabs at the top of every page; rename "Finished" to **Recipes** | Cookbook, Perfected, Library |
| Nov 20 | One start button per tab, matching what you do there: quick-add (Ideas), **+ Cook's words** (Development), **+ New recipe** (Recipes); no duplicate start buttons | Keep only the New menu; hide New on an empty lab book |
| Nov 20 | Creating an idea shouldn't mean going to the Ideas tab, tapping a button, and filling in a separate page: a **quick-add box** at the top of the Ideas tab (type, Enter, done; notes and a link later with the pencil) | Clickable step cards; a "+ New" in the header |
| Nov 20 | Recipes can be added by hand, in the same format as AI recipes (ingredients, numbered steps, optional "why it works"), with no AI call; **+ New recipe** is the Recipes tab's start button | |
| Nov 20 | A way out of the AI questions: **Save for later** (keeps typed answers, back to Development) and **Discard questions** (with a confirm; deletes the AI draft so the recipe can be created again) | Save for later only; discard only |
| Nov 21 | The cook's words can be **deleted**, with the Delete button or by saving them empty; the idea notes and any finished recipe stay | |
| Nov 21 | **No original versions are kept**: editing just replaces the words, and deleting removes them completely (only the "edited after this recipe was made" warning remains) | Keep the first version (the previous rule) |
| Nov 21 | In Development, an item's recipe can also be **written by hand** ("Or write the recipe yourself" under the AI panel and in the no-words box): the form opens with the item's name, cook, and notes, and saving moves it to Recipes | |
| Nov 21 | A shortcut when writing a recipe by hand: **Enter adds the next ingredient or step** and moves the cursor there (Shift+Enter is a new line inside a step) | |
| Nov 21 | **Sections** to organize the Recipes tab (like American, Indian, Mexican, Desserts): I create and delete my own, and a recipe can be in **several** | One section per recipe, like folders |
| Nov 21 | Call them **Tags** instead of sections (a recipe can have several), and add them by **typing**: Enter adds a tag, my existing tags narrow as I type, a new name makes a new tag, × removes it | Keep "sections" with tap-only chips |
| Nov 21 | A way to **see all tags**: the Tags page ("All tags") lists every tag with its recipes under it | A Tags tab in the top bar; a "See all tags" button in a recipe's tag box |
| Nov 27 | An idea can be **text, a photo, or both**: a camera button in the Ideas quick-add box; more photos (up to 6) can be added on the idea | |
| Nov 27 | Tapping a photo **opens it large on the same page** (not a new tab), and thumbnails show the **whole photo, never cropped**, at its own shape with no empty bars around it | Square boxes with bars (tried first) |
| Nov 27 | "The cook's words" become **Kitchen notes** everywhere: recipes are developed by dictating or pasting rough instructions. A tip asks for amounts and detail, since more detail makes a better recipe | Rough instructions; Rough draft; How it's made |
| Nov 27 | "Idea notes" become **Inspiration**, so they aren't confused with kitchen notes; the tip is shortened to amounts, times, and temperatures | |
| Nov 27 | Add the inspiration **in the same step** as the idea: an Inspiration box is always shown under the name in the quick-add (fewer taps) | Box appears as you type; a "+ Inspiration" button |
| Nov 27 | **Compact lists**: "Move to" is no longer repeated under every item (it stays on each item's page); rows show just the name, date, and one preview line | A ⋯ menu per row; select several, then move |
| Nov 27 | No date on list rows; tapping a list thumbnail **zooms in on the photo** (the name still opens the item); a normal pointer, not a magnifying-glass cursor | |

## What the app is

| Date | Decision |
|---|---|
| Nov 15 | A lab book for **recipe development**, not just family recipes |
| Nov 15 | Sending a recipe is optional; saving it for later is just as valid |
| Nov 16 | It tracks culinary inspiration, makes it quick to develop recipes and iterations by voice or text with AI, and stores recipes with the food science built in |
| Nov 20 | Headline: **From inspiration to recipe: type or dictate your dish, and AI makes recipe development easy, with the food science built in.** |

## Design decisions

| Date | Decision | Options considered |
|---|---|---|
| Nov 14 | Line & Stone, my Assignment 2 design system | The agent's default style |
| Nov 14 | Scarlet-leaning red (`#ae1f2e`) as the main action color instead of Aegean blue | Scarlet, Crimson, Garnet, Burgundy, Oxblood (`notes/design/red-swatches*.html`) |
| Nov 15 | Separate starting cards for an idea and for the cook's words | |
| Nov 20 | Less text and minimal scrolling: the landing page fits on one screen | |

## v2 decisions

| Date | Decision | Options considered |
|---|---|---|
| Nov 15 | v2 features: photos, a streamlined flow, iterations, recipe descriptions and variations, nutrition facts, portion scaling | |
| Nov 16 | Tester feedback (my cousin) drives the plan: too text heavy, tabs unclear, needs instructions, more pictures, categories, plus three stuck points (long intro, no next step after an idea, no way to add more ideas) | |
| Nov 20 | A new repo that keeps v1's full history, tagged `v1` | Copy the code with fresh history |
| Nov 20 | A new live site that shares v1's database (v2 changes must not break v1) | A new database too |
| Nov 20 | Build from GitHub issues #1–#15, with the stuck points first | Reorder first |
