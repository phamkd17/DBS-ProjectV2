/**
 * Design + interaction check in a real browser (Playwright / Chromium).
 * Runs the core task as a new person, and at every screen:
 *   - screenshots at 390px (mobile) and 1440px (desktop)
 *   - axe accessibility scan (WCAG 2 A/AA, incl. color contrast)
 *   - keyboard pass: Tab through, note anything without a visible focus style
 * Output: verify/screenshots/*.png and verify/report.md (both git-ignored).
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import AxeBuilder from "@axe-core/playwright";
import { clerk, clerkSetup } from "@clerk/testing/playwright";
import { createClerkClient } from "@clerk/backend";
import { expect, test, type Page } from "@playwright/test";

const SHOTS = "verify/screenshots";
const TEST_EMAIL = "labbook-tester+clerk_test@example.com";
// Unique per run, so leftovers from a failed run never match this run's checks.
const RUN = new Date().toISOString().slice(5, 19).replace("T", " ");
const IDEA = `Caramelized onion crunch (verify ${RUN})`;
// Constant, so the dev-only AI cache can reuse responses (the dish name is part of the prompt).
const DISH = "Yogurt (verify run)";
const MANUAL = `Typed-in yogurt (verify ${RUN})`;
const YOGURT =
  "Yogurt is a very simple dish you need about 1/2 gallon jug of milk and then one of these small 10 in yogurt container that is not flavored at all uh you heat up the milk make sure it doesn't boil uh just until it steams a little bit and then from there you add 1/3 a cup of sugar maybe less if you like it less sweet and then you mix in the yogurt with the milk you stir it into everything blends and then you put it into these little jars and then you put all these little jars into this incubator and you let it sit for about 8 hours if you don't like it too tangy but I like it at 12 hours super tangy and then from there you can either keep it in the fridge or freeze it and then serve";

const report: string[] = ["# Verify report", "", `Run: ${new Date().toISOString()}`, ""];
let n = 0;

async function check(page: Page, name: string, opts: { keyboard?: boolean } = {}) {
  n += 1;
  const id = `${String(n).padStart(2, "0")}-${name}`;
  report.push(`## ${id}`, `URL: ${new URL(page.url()).pathname}${new URL(page.url()).search}`);

  for (const [label, size] of [
    ["mobile", { width: 390, height: 844 }],
    ["desktop", { width: 1440, height: 900 }],
  ] as const) {
    await page.setViewportSize(size);
    await page.waitForTimeout(150);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    if (overflow) report.push(`- ⚠️ ${label}: page scrolls sideways (horizontal overflow)`);
    await page.screenshot({ path: `${SHOTS}/${id}-${label}.png`, fullPage: true });
  }
  await page.setViewportSize({ width: 390, height: 844 });

  const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
  if (axe.violations.length === 0) report.push("- axe: no violations");
  for (const v of axe.violations) {
    report.push(`- ⚠️ axe ${v.impact}: ${v.id}: ${v.help} (${v.nodes.length}×)`);
    for (const node of v.nodes.slice(0, 3)) report.push(`  - \`${node.target.join(" ")}\` ${node.failureSummary?.split("\n")[1] ?? ""}`);
  }

  if (opts.keyboard) {
    await page.locator("body").click({ position: { x: 1, y: 1 } });
    const seen: string[] = [];
    const noFocusStyle: string[] = [];
    for (let i = 0; i < 25; i++) {
      await page.keyboard.press("Tab");
      const info = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        if (!el || el === document.body) return null;
        const cs = getComputedStyle(el);
        const visible =
          (cs.outlineStyle !== "none" && parseFloat(cs.outlineWidth) > 0) || cs.boxShadow !== "none";
        const text = (el.getAttribute("aria-label") || el.textContent || (el as HTMLInputElement).placeholder || el.tagName)
          .trim()
          .replace(/\s+/g, " ")
          .slice(0, 40);
        return { key: `${el.tagName.toLowerCase()}:${text}`, visible };
      });
      if (!info) continue;
      if (seen.includes(info.key)) break;
      seen.push(info.key);
      if (!info.visible) noFocusStyle.push(info.key);
    }
    report.push(`- keyboard: ${seen.length} stops: ${seen.join(" → ")}`);
    if (noFocusStyle.length) report.push(`- ⚠️ no visible focus style: ${noFocusStyle.join(", ")}`);
    await page.keyboard.press("Tab");
    await page.screenshot({ path: `${SHOTS}/${id}-focus.png` });
  }
  report.push("");
}


/** Wait for an AI step to finish, or fail fast if the app shows its error state. */
async function waitForAi(page: Page, done: () => Promise<unknown>) {
  const alert = page.locator("main [role=alert]").filter({ visible: true });
  const result = await Promise.race([
    done().then(() => "done" as const),
    alert.waitFor({ timeout: 4 * 60_000 }).then(() => "error" as const),
  ]);
  if (result === "error") {
    throw new Error(`App showed its AI error state: "${(await alert.innerText()).trim()}" (likely the Gemini free-tier rate limit).`);
  }
}

test.beforeAll(async () => {
  mkdirSync(SHOTS, { recursive: true });
  await clerkSetup();
  // Make sure the test user exists (Clerk test emails never send real mail).
  const clerkApi = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
  const { data } = await clerkApi.users.getUserList({ emailAddress: [TEST_EMAIL] });
  if (data.length === 0) await clerkApi.users.createUser({ emailAddress: [TEST_EMAIL], skipPasswordRequirement: true });
});

test.afterAll(() => {
  writeFileSync("verify/report.md", report.join("\n"));
});

test("served CSS matches app/globals.css (dev server not stale)", async ({ page }) => {
  // The dev server has served stale Tailwind CSS before. Compare every color token.
  const src = readFileSync("app/globals.css", "utf8");
  const tokens = [...src.matchAll(/(--color-[a-z0-9-]+):\s*(#[0-9a-f]{6})/gi)].map((m) => [m[1], m[2].toLowerCase()]);
  await page.goto("/", { timeout: 60_000 });
  const served = await page.evaluate(() =>
    Array.from(document.styleSheets)
      .map((s) => {
        try {
          return Array.from(s.cssRules).map((r) => r.cssText).join("\n");
        } catch {
          return "";
        }
      })
      .join("\n")
  );
  const stale = tokens.filter(([name, hex]) => served.includes(name) && !served.includes(`${name}: ${hex}`));
  // Also every custom rule outside @theme (e.g. [data-sources="hidden"] .src-only).
  const selectors = [...src.matchAll(/^([.[][^{\n]+?)\s*\{/gm)].map((m) => m[1].trim().replace(/"/g, ""));
  const missing = selectors.filter((sel) => !served.replace(/"/g, "").includes(sel));
  expect(
    [...stale.map((t) => t.join(" ")), ...missing],
    "Stale CSS: the dev server isn't serving app/globals.css. Restart it (rm -rf .next)."
  ).toEqual([]);
});

test("core task as a new person, every screen at 390 and 1440", async ({ page, browser }) => {
  // ---- Signed out ----
  await page.goto("/");
  // First load after an edit can take a while in dev while the page recompiles.
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible({ timeout: 30_000 });
  // #1: the landing page explains the app with three steps, not a paragraph.
  await expect(page.locator("main").getByRole("heading", { name: "Development", exact: true })).toBeVisible();
  await check(page, "landing-signed-out", { keyboard: true });

  // #4: the ? in the header opens "How it works"; Escape closes it and returns focus.
  const help = page.getByRole("button", { name: "How it works" });
  await help.click();
  const guide = page.getByRole("dialog", { name: "How it works" });
  await expect(guide).toBeVisible();
  await check(page, "how-it-works-dialog");
  await page.keyboard.press("Escape");
  await expect(guide).toBeHidden();
  await expect(help).toBeFocused();

  await page.goto("/s/11111111-1111-1111-1111-111111111111");
  await expect(page.getByRole("heading", { name: /isn.t shared anymore/ })).toBeVisible();
  await check(page, "share-link-off");

  // ---- Sign in ----
  await page.goto("/");
  await clerk.signIn({ page, emailAddress: TEST_EMAIL });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Your lab book" })).toBeVisible();
  // Tabs at the top of every page; the open section is marked.
  const topTabs = page.getByRole("navigation", { name: "Lab book sections" });
  await expect(topTabs.getByRole("link", { name: "Recipes" })).toBeVisible();
  await expect(topTabs.locator('[aria-current="page"]')).toHaveCount(1); // home always opens a named tab
  await topTabs.getByRole("link", { name: "Ideas" }).click();
  await expect(topTabs.getByRole("link", { name: "Ideas" })).toHaveAttribute("aria-current", "page");
  await check(page, "home", { keyboard: true });

  // Ideas tab: a quick-add box instead of a button and a separate page.
  const quick = page.getByRole("textbox", { name: "New idea" });
  await quick.press("Enter");
  await expect(page.getByText(/Type the idea first/)).toBeVisible();
  await quick.fill(`${IDEA} (quick)`);
  await quick.press("Enter");
  await expect(page.getByText(`Added “${IDEA} (quick)”`, { exact: false })).toBeVisible();
  await expect(page.locator("main").getByText(`${IDEA} (quick)`, { exact: true })).toBeVisible(); // in the list
  await expect(quick).toHaveValue(""); // ready for the next one
  await expect(quick).toBeFocused();
  await check(page, "ideas-quick-add", { keyboard: true });
  await expect(page.locator("main").getByRole("link", { name: "+ New idea" })).toHaveCount(0); // the box replaces it
  // Development tab: "+ Cook's words".
  await page.goto("/?tab=development");
  await expect(page.locator("main").getByRole("link", { name: "+ Cook's words" })).toBeVisible();

  // ---- Ideas: create, validate, move, delete ----
  // ---- Recipes tab: add a recipe by hand (same format as AI recipes, no AI) ----
  await page.goto("/?tab=finished");
  await page.locator("main").getByRole("link", { name: "+ New recipe" }).click();
  await page.waitForURL(/\/recipes\/new/);
  const rf = page.locator("main").filter({ visible: true });
  await rf.getByRole("button", { name: "Save recipe" }).click();
  await expect(rf.getByText("Give the recipe a name.")).toBeVisible();
  await expect(rf.getByText("Add at least one ingredient.")).toBeVisible();
  await expect(rf.getByText("Add at least one step.")).toBeVisible();
  await rf.getByLabel("Recipe name").fill(MANUAL);
  await expect(rf.getByText("Give the recipe a name.")).toHaveCount(0); // clears as soon as it's fixed
  await rf.getByLabel(/Whose recipe/).fill("Grandma");
  await rf.getByLabel("Amount 1", { exact: true }).fill("1/2 gallon");
  await rf.getByLabel("Ingredient 1", { exact: true }).fill("whole milk");
  await rf.getByLabel("Amount 2", { exact: true }).fill("1/3 cup");
  await rf.getByLabel("Ingredient 2", { exact: true }).fill("sugar");
  await rf.getByLabel("Step 1", { exact: true }).fill("Heat the milk until it steams. Don't let it boil.");
  await rf.getByRole("button", { name: "+ Why it works" }).first().click();
  await rf.getByLabel(/Why it works/).fill("Boiling can scorch the milk.");
  await rf.getByRole("button", { name: "+ Add step" }).click();
  await rf.getByLabel("Step 2", { exact: true }).fill("Stir in the sugar.");
  await check(page, "manual-recipe-form", { keyboard: true });
  await rf.getByRole("button", { name: "Save recipe" }).click();
  await page.waitForURL(/\/r\//);
  const manualUrl = page.url();
  const mr = page.locator("main").filter({ visible: true });
  await expect(mr.getByRole("heading", { name: MANUAL })).toBeVisible();
  await expect(mr.getByText("whole milk")).toBeVisible();
  await expect(mr.getByRole("button", { name: "Why step 1 works" })).toBeVisible(); // same format as AI recipes
  await expect(mr.getByText("Their words")).toHaveCount(0); // no cook's-words section on hand-typed recipes
  await check(page, "manual-recipe", { keyboard: true });
  page.once("dialog", (d) => d.accept());
  await mr.getByRole("button", { name: "Delete this recipe" }).click();
  await page.waitForURL((u) => u.pathname === "/");
  await page.goto(manualUrl);
  await expect(page.getByRole("heading", { name: "Not in your lab book" })).toBeVisible();

  // ---- The full idea form (note + link) ----
  await page.goto("/ideas/new");
  await page.getByRole("button", { name: "Save idea" }).click();
  await expect(page.getByText(/Give the idea a short name/)).toBeVisible();
  await page.getByLabel("Idea", { exact: true }).fill(IDEA);
  await page.getByLabel(/Note/).fill("Had it on pho. Crunchy and sweet. Try drying in a low oven?");
  await page.getByLabel(/Link/).fill("javascript:alert(1)");
  await page.getByRole("button", { name: "Save idea" }).click();
  await expect(page.getByText(/doesn't look like a web link/)).toBeVisible();
  await check(page, "idea-new-errors", { keyboard: true });
  await page.getByLabel(/Link/).fill("example.com/onions");
  await page.getByRole("button", { name: "Save idea" }).click();
  await page.waitForURL(/\/d\//); // an idea is an entry with notes and no cook's words yet
  // #2: right after saving, say so and offer the next step (once).
  const savedView = page.locator("main").filter({ visible: true });
  await expect(savedView.getByRole("status").filter({ hasText: "Saved to Ideas" })).toBeVisible();
  await expect(savedView.getByRole("link", { name: "Add another idea" })).toBeVisible();
  await check(page, "idea-just-saved", { keyboard: true });
  await expect.poll(() => new URL(page.url()).searchParams.get("saved")).toBeNull(); // shown once
  const ideaUrl = page.url();

  // #3: "Save and add another" clears the form for the next idea.
  await savedView.getByRole("link", { name: "Add another idea" }).click();
  await page.waitForURL(/\/ideas\/new/);
  const formView = page.locator("main").filter({ visible: true });
  await formView.getByLabel("Idea", { exact: true }).fill(`${IDEA} #2`);
  await formView.getByRole("button", { name: "Save and add another" }).click();
  await expect(formView.getByRole("status").filter({ hasText: `Saved “${IDEA} #2”` })).toBeVisible();
  await expect(formView.getByLabel("Idea", { exact: true })).toHaveValue(""); // fresh form
  await check(page, "idea-saved-add-another", { keyboard: true });
  await page.goto("/?tab=ideas");
  await expect(page.getByRole("textbox", { name: "New idea" })).toBeVisible(); // quick-add on the Ideas tab
  await page.goto(ideaUrl);
  await expect(page.locator("main").filter({ visible: true }).getByRole("status")).toHaveCount(0); // not again
  await expect(page.getByRole("link", { name: /example\.com\/onions/ })).toBeVisible();
  await check(page, "idea", { keyboard: true });
  // In Ideas there's no cook's-words box, only "Move to Development".
  const ideaView = page.locator("main").filter({ visible: true });
  await expect(ideaView.getByRole("heading", { name: "Ready to develop it?" })).toBeVisible();
  await expect(ideaView.getByText(/No cook's words yet/)).toHaveCount(0);
  await expect(ideaView.getByRole("button", { name: "Add the cook's words" })).toHaveCount(0);

  // Edit in place: same page, no navigation.
  // Next keeps hidden copies of earlier pages (e.g. the New idea form), so act on the visible <main>.
  const view = page.locator("main").filter({ visible: true });
  // Pencil next to the title: Enter saves.
  await view.getByRole("button", { name: "Edit title" }).click();
  await view.getByRole("textbox", { name: "Title" }).fill(`${IDEA} (renamed)`);
  await check(page, "idea-title-editing", { keyboard: true });
  await view.getByRole("textbox", { name: "Title" }).press("Enter");
  await expect(view.getByRole("heading", { level: 1 })).toContainText("(renamed)");
  await expect(view.getByRole("button", { name: "Edit title" })).toBeFocused(); // focus returns

  // Pencil on Idea notes.
  await view.getByRole("button", { name: "Edit idea notes" }).click();
  await view.getByRole("textbox", { name: "Idea notes" }).fill("Had it on pho. Crunchy and sweet. Dry at 200°F for 2 hours?");
  await check(page, "idea-notes-editing", { keyboard: true });
  await view.getByRole("button", { name: "Save", exact: true }).click();
  await expect(view.getByText(/Dry at 200°F/)).toBeVisible();
  await expect(view.getByRole("button", { name: "Edit idea notes" })).toBeFocused();
  expect(page.url()).toBe(ideaUrl);

  await page.goto("/?tab=ideas");
  const ideaRow = page.getByRole("listitem").filter({ has: page.getByText(`${IDEA} (renamed)`, { exact: true }), visible: true });
  await expect(ideaRow).toBeVisible();
  await check(page, "home-ideas-with-idea");
  await ideaRow.getByRole("button", { name: "Development" }).click();
  await expect(ideaRow).toHaveCount(0); // it leaves the Ideas tab once moved
  await page.goto("/?tab=development");
  await expect(page.getByRole("listitem").filter({ has: page.getByText(`${IDEA} (renamed)`, { exact: true }), visible: true })).toBeVisible();
  await check(page, "home-development-moved-idea");

  // In Development, the idea keeps its notes and offers "Add the cook's words".
  await page.goto(ideaUrl);
  await expect(view.getByText(/Dry at 200°F/)).toBeVisible(); // notes kept after the move
  await expect(view.getByText(/No cook's words yet/)).toBeVisible();
  await expect(view.getByRole("button", { name: "Create recipe with AI" })).toHaveCount(0);
  await check(page, "idea-in-development-no-words", { keyboard: true });
  await view.getByRole("button", { name: "Add the cook's words" }).click();
  await view.getByLabel("The cook's words", { exact: true }).fill("You slice the onions thin and cook them low for an hour until deep brown, then dry them in the oven.");
  await view.getByLabel(/Whose words/).fill("Auntie");
  await view.getByRole("button", { name: "Save changes" }).click();
  await expect(view.getByText("Their words, exactly as said")).toBeVisible();
  await expect(view.getByRole("heading", { name: "Ready to make it a recipe?" })).toBeVisible(); // AI step now offered
  await expect(view.getByText(/Dry at 200°F/)).toBeVisible(); // notes still there
  await check(page, "idea-with-words-added");

  page.once("dialog", (d) => d.accept());
  await view.getByRole("button", { name: "Delete", exact: true }).click();
  await page.waitForURL((u) => u.pathname === "/");
  // Scope to <main>: Next keeps hidden copies of past pages, and its screen-reader
  // route announcer still holds the old title.
  await expect(page.locator("main").getByText(`${IDEA} (renamed)`, { exact: true }).filter({ visible: true })).toHaveCount(0);
  // Remove the quick-added idea too.
  await page.goto("/?tab=ideas");
  await page.locator("main").getByText(`${IDEA} (quick)`, { exact: true }).first().click();
  await page.waitForURL(/\/d\//);
  page.once("dialog", (d) => d.accept());
  await page.locator("main").filter({ visible: true }).getByRole("button", { name: "Delete", exact: true }).click();
  await page.waitForURL((u) => u.pathname === "/");
  // Also remove the second idea from the "Save and add another" check.
  await page.goto("/?tab=ideas");
  await page.locator("main").getByText(`${IDEA} #2`, { exact: true }).first().click();
  await page.waitForURL(/\/d\//);
  page.once("dialog", (d) => d.accept());
  await page.locator("main").filter({ visible: true }).getByRole("button", { name: "Delete", exact: true }).click();
  await page.waitForURL((u) => u.pathname === "/");

  // ---- Capture ----
  await page.goto("/?tab=development");
  await page.locator("main").getByRole("link", { name: "+ Cook's words" }).click();
  await page.waitForURL(/\/new$/);
  await page.getByRole("button", { name: /Save their words/ }).click();
  await expect(page.getByText(/Type, paste, or dictate/)).toBeVisible();
  await check(page, "new-empty-error", { keyboard: true });

  await page.getByLabel("The cook's words").fill(YOGURT);
  await page.getByLabel(/Dish name/).fill(DISH);
  await page.getByLabel(/Whose words/).fill("Grandma");
  await page.getByRole("button", { name: /Save their words/ }).click();
  await page.waitForURL(/\/d\//);
  // A new dictation starts in Development (adding the cook's words is Development work).
  // Wait for the real page, not the loading skeleton.
  await expect(view.getByRole("heading", { name: "Ready to make it a recipe?" })).toBeVisible();
  await expect(view.getByRole("link", { name: "Development" }).first()).toBeVisible(); // breadcrumb
  // Idea notes and the cook's words are separate sections.
  await expect(view.getByRole("heading", { name: "Idea notes" })).toBeVisible();
  await expect(view.getByText("Their words, exactly as said")).toBeVisible();
  await check(page, "dictation", { keyboard: true });

  await page.goto("/?tab=development");
  await expect(page.getByText(DISH).first()).toBeVisible();
  await check(page, "home-development-with-dictation");
  await page.getByText(DISH).first().click();
  await page.waitForURL(/\/d\//);

  // ---- Create recipe (pass 1) ----

  // The AI step stays off until the user confirms they're ready.
  const createBtn = view.getByRole("button", { name: "Create recipe with AI" });
  await expect(createBtn).toBeDisabled();
  await page.getByLabel(/Their words are complete/).check();
  await expect(createBtn).toBeEnabled();
  await check(page, "dictation-ready-to-create", { keyboard: true });
  await createBtn.click();
  await expect(page.getByRole("status")).toBeVisible();
  await check(page, "creating-loading");
  await waitForAi(page, () => page.waitForURL(/\/r\//, { timeout: 4 * 60_000 }));
  let recipeUrl = page.url();
  await expect(page.getByRole("heading", { name: /questions/i })).toBeVisible();
  await check(page, "questions", { keyboard: true });

  // ---- Quit the questions: Save for later keeps typed answers ----
  const qv = page.locator("main").filter({ visible: true });
  await qv.getByPlaceholder("Your answer").first().fill("Saved for later (verify)");
  await qv.getByRole("button", { name: "Save for later" }).click();
  await page.waitForURL(/tab=development/);
  await check(page, "home-development-tab");
  await page.goto(recipeUrl);
  await expect(page.locator("main").filter({ visible: true }).getByPlaceholder("Your answer").first()).toHaveValue("Saved for later (verify)");

  // ---- Discard questions: the draft goes away, back to the cook's words ----
  page.once("dialog", (d) => d.accept());
  await page.locator("main").filter({ visible: true }).getByRole("button", { name: "Discard questions" }).click();
  await page.waitForURL(/\/d\//);
  await expect(page.locator("main").filter({ visible: true }).getByRole("heading", { name: "Ready to make it a recipe?" })).toBeVisible();
  await page.goto(recipeUrl);
  await expect(page.getByRole("heading", { name: "Not in your lab book" })).toBeVisible(); // draft is gone
  // Create it again (the dev cache answers, no Gemini call).
  await page.goBack();
  await page.waitForURL(/\/d\//);
  await page.getByLabel(/Their words are complete/).check();
  await page.locator("main").filter({ visible: true }).getByRole("button", { name: "Create recipe with AI" }).click();
  await waitForAi(page, () => page.waitForURL(/\/r\//, { timeout: 4 * 60_000 }));
  recipeUrl = page.url();
  await expect(page.getByRole("heading", { name: /questions/i })).toBeVisible();

  // ---- Answer: one suggestion, one typed, rest blank ----
  await page.getByRole("button", { name: "Use suggestion" }).first().click();
  await check(page, "questions-suggestion-used");
  const boxes = page.getByPlaceholder("Your answer");
  if ((await boxes.count()) > 1) await boxes.nth(1).fill("Plain Dannon, the small single cup.");
  await page.getByRole("button", { name: /Make the recipe with AI/ }).click();
  await expect(page.getByRole("status")).toBeVisible();
  await check(page, "finishing-loading");
  await waitForAi(page, () =>
    page.getByRole("heading", { name: "Ingredients" }).waitFor({ timeout: 4 * 60_000 })
  );
  // Calm by default: no source labels until "Show sources".
  const main = page.locator("main").filter({ visible: true });
  await expect(main.getByText("Where each part came from:")).toBeHidden();
  await expect(main.getByRole("switch", { name: "Show sources" })).toHaveAttribute("aria-checked", "false");
  await check(page, "recipe-finished", { keyboard: true });

  // Science icon: opens "Why it works" for that step only.
  const why = main.getByRole("button", { name: /^Why step \d+ works$/ }).first();
  await why.click();
  await expect(why).toHaveAttribute("aria-expanded", "true");
  await expect(main.getByText("Why it works").first()).toBeVisible();
  const dials = main.getByRole("button", { name: /^Adjust step \d+ to taste$/ }).first();
  if (await dials.count()) {
    await dials.click();
    await expect(dials).toHaveAttribute("aria-expanded", "true");
    await expect(main.getByText("Adjust to taste").first()).toBeVisible();
  }
  await check(page, "recipe-science-and-dials-open");

  // ---- Edit the whole ingredient list from one pencil ----
  await page.getByRole("button", { name: "Edit ingredients" }).click();
  const firstAmount = page.getByRole("textbox", { name: /^Amount of / }).first();
  await firstAmount.fill("2 cups (verify)");
  const lastItemBefore = page.getByRole("textbox", { name: /^Ingredient \d+/ }).last();
  const removedName = await lastItemBefore.inputValue();
  await page.getByRole("button", { name: `Remove ${removedName}` }).click();
  await page.getByRole("button", { name: "+ Add ingredient" }).click();
  await page.getByRole("textbox", { name: /^Amount of new ingredient/ }).fill("1 pinch");
  await page.getByRole("textbox", { name: /^Ingredient \d+/ }).last().fill("salt (verify)");
  await check(page, "recipe-ingredients-editing", { keyboard: true });
  await page.getByRole("button", { name: "Save ingredients" }).click();

  const list = page.locator("main").filter({ visible: true });
  // Labels and history are behind "Show sources".
  await list.getByRole("switch", { name: "Show sources" }).click();
  await expect(list.getByText("Where each part came from:")).toBeVisible();
  const changed = list.getByRole("listitem").filter({ hasText: "2 cups (verify)" });
  await expect(changed).toBeVisible();
  await expect(changed.getByText("Family answer").first()).toBeVisible(); // relabeled: no longer the cook's amount
  await expect(changed.getByText(/Changed from|Amount added/)).toBeVisible(); // the old amount is kept
  const added = list.getByRole("listitem").filter({ hasText: "salt (verify)" });
  await expect(added.getByText(/Added on/)).toBeVisible();
  await expect(list.getByText(new RegExp(`Removed “[^”]*${removedName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`))).toBeVisible();
  await expect(page.getByRole("button", { name: "Edit ingredients" })).toBeFocused();
  await expect(page.getByRole("button", { name: /^Edit amount of / })).toHaveCount(0); // one pencil, not one per row

  // ---- Send ----
  await page.getByRole("button", { name: "Make a link" }).click();
  const shareUrl = await page.getByLabel("Private link").inputValue({ timeout: 15_000 });
  expect(shareUrl).toMatch(/\/s\/[0-9a-f-]{36}$/);
  await check(page, "recipe-shared");

  const stranger = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const sp = await stranger.newPage();
  await sp.goto(new URL(new URL(shareUrl).pathname, page.url()).toString());
  await expect(sp.getByRole("heading", { name: "Ingredients" })).toBeVisible();
  await expect(sp.getByRole("button", { name: /Sign in to save/ })).toBeVisible();
  await expect(sp.getByRole("button", { name: "Edit ingredients" })).toHaveCount(0); // shared links are read-only
  await check(sp, "shared-signed-out", { keyboard: true });

  await page.getByRole("button", { name: "Turn off link" }).click();
  await expect(page.getByRole("button", { name: "Make a link" })).toBeVisible();
  await sp.reload();
  await expect(sp.getByRole("heading", { name: /isn.t shared anymore/ })).toBeVisible();
  await stranger.close();

  // ---- Move a finished recipe back to Development and back again ----
  await page.goto(recipeUrl);
  await page.getByRole("button", { name: "Development" }).click();
  await expect(page.getByRole("button", { name: "Recipes" })).toBeVisible(); // now offers "Recipes"
  await expect(page.getByRole("button", { name: "Development" })).toHaveCount(0);
  await page.reload();
  await expect(page.locator("main").getByRole("link", { name: "Development" })).toBeVisible(); // breadcrumb follows the move
  await page.getByRole("button", { name: "Recipes" }).click();
  await expect(page.getByRole("button", { name: "Development" })).toBeVisible();

  // ---- Edit their words after the recipe exists (no AI call) ----
  await page.goto(recipeUrl);
  await view.getByRole("button", { name: "Edit their words" }).click();
  await view.getByLabel("The cook's words").fill(`${YOGURT} oh and let the milk cool down first`);
  await check(page, "recipe-words-edit-in-place", { keyboard: true });
  await view.getByRole("button", { name: "Save changes" }).click();
  expect(new URL(page.url()).pathname).toBe(new URL(recipeUrl).pathname);
  await expect(view.getByText(/after this recipe was made/)).toBeVisible();
  await expect(view.getByText(/Their words · edited/)).toBeVisible();
  await view.getByText(/Their words · edited/).click(); // open the transcript
  await expect(view.getByText("See the original words")).toBeVisible();
  await check(page, "recipe-after-edit");

  await page.goto("/?tab=finished");
  await check(page, "home-finished-tab");

  // ---- Not found / someone else's ----
  await page.goto("/r/00000000-0000-0000-0000-000000000000");
  await check(page, "not-found");

  // ---- Clean up: delete this run's recipe (exercises the confirm dialog) ----
  await page.goto(recipeUrl);
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Delete this recipe" }).click();
  await page.waitForURL((u) => u.pathname === "/");
  await page.goto(recipeUrl);
  await expect(page.getByRole("heading", { name: "Not in your lab book" })).toBeVisible();
});
