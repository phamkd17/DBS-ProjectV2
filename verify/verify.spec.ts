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

/** Recipe page: idea and development notes are folded away until opened (student, Nov 28). */
async function openNotes(page: Page) {
  const details = page.locator("main").filter({ visible: true }).locator('details:has(> summary:has-text("Notes from Ideas and Development"))');
  if (!(await details.evaluate((d: HTMLDetailsElement) => d.open))) await details.locator("> summary").click();
}

/** The image really loaded (not a broken or still-loading signed URL). */
async function expectLoaded(img: import("@playwright/test").Locator) {
  await expect(img).toBeVisible();
  await expect.poll(() => img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0)).toBe(true);
}

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
  // Font tokens too (Nov 28: the Figtree switch was served stale and fell back to the system font).
  const squash = (t: string) => t.replace(/\s+/g, " ").replace(/"/g, "").trim();
  const fonts = [...src.matchAll(/(--font-ls-[a-z]+):\s*([^;]+);/g)].map((m) => [m[1], squash(m[2])]);
  const servedFlat = squash(served);
  stale.push(...fonts.filter(([name, value]) => !servedFlat.includes(`${name}: ${value}`)));
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
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible(); // the open tab's name
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
  await expect(page.getByText(/Type the idea or add a photo first/)).toBeVisible();
  await quick.fill(`${IDEA} (quick)`);
  // Inspiration in the same step (no second page, no pencil).
  const quickInspiration = page.getByRole("textbox", { name: "Inspiration (optional)" });
  await quickInspiration.fill("Had it at the night market. Silky, not too sweet.");
  await quick.press("Enter");
  await expect(page.getByText(`Added “${IDEA} (quick)”`, { exact: false })).toBeVisible();
  await expect(page.locator("main").getByText(`${IDEA} (quick)`, { exact: true })).toBeVisible(); // in the list
  await expect(quick).toHaveValue(""); // ready for the next one
  await expect(quickInspiration).toHaveValue("");
  await expect(page.locator("main").getByText("Had it at the night market. Silky, not too sweet.").first()).toBeVisible(); // saved with it
  await expect(quick).toBeFocused();
  await check(page, "ideas-quick-add", { keyboard: true });

  // ---- Ideas: text, a photo, or both (issue #7) ----
  const quickForm = page.locator("main").filter({ visible: true }).locator("form").filter({ has: quick });
  const quickFile = quickForm.locator('input[type="file"]');
  await quickFile.setInputFiles("verify/fixtures/not-a-photo.jpg");
  await expect(quickForm.getByText("Couldn't open that photo.", { exact: false })).toBeVisible(); // not an image
  await quickFile.setInputFiles("verify/fixtures/onions.jpg");
  await expect(quickForm.getByRole("img", { name: "The photo you chose" })).toBeVisible(); // preview
  await expect(quickForm.getByRole("button", { name: "Change photo" })).toBeVisible();
  await check(page, "ideas-quick-add-photo", { keyboard: true });
  await quickForm.getByRole("button", { name: "Add", exact: true }).click(); // photo only, no text
  await expect(quickForm.getByText("Added “Photo idea”", { exact: false })).toBeVisible();
  await expect(quickForm.getByRole("img", { name: "The photo you chose" })).toHaveCount(0); // ready for the next one
  const ideasList = page.locator("main").filter({ visible: true }).locator("ul").first();
  const photoCard = ideasList.getByRole("link", { name: /Photo idea/ }).first(); // newest first
  const photoThumb = ideasList.getByRole("button", { name: "Zoom in on the photo of Photo idea" }).first();
  await expectLoaded(photoThumb.locator("img")); // thumbnail
  // Tapping the thumbnail zooms in (it doesn't open the item).
  const listUrl = page.url();
  await photoThumb.click();
  await expect(page.getByRole("dialog", { name: "Photo 1 of 1" })).toBeVisible();
  await expectLoaded(page.getByRole("dialog").getByRole("img", { name: "Photo 1, full size" }));
  expect(page.url()).toBe(listUrl);
  await page.keyboard.press("Escape");
  await expect(photoThumb).toBeFocused();
  await quick.fill(`${IDEA} (photo)`);
  await quickFile.setInputFiles("verify/fixtures/onions.jpg");
  await expect(quickForm.getByRole("img", { name: "The photo you chose" })).toBeVisible();
  await quick.press("Enter"); // text + photo
  await expect(quickForm.getByText(`Added “${IDEA} (photo)”`, { exact: false })).toBeVisible();
  await expectLoaded(ideasList.getByRole("button", { name: /Zoom in on the photo of .*\(photo\)/ }).first().locator("img"));
  await check(page, "ideas-with-photos");
  // The photo-only idea: open it, see the photo, add one more, delete one, then delete the idea (and its files).
  await photoCard.click();
  await page.waitForURL(/\/d\//);
  const pv = page.locator("main").filter({ visible: true });
  const photosBox = pv.getByRole("region", { name: "Photos" });
  await expectLoaded(photosBox.getByRole("img", { name: "Photo 1" }));
  await expect(pv.getByRole("heading", { level: 1 })).toContainText("Photo idea"); // same name as in the list
  await photosBox.locator('input[type="file"]').setInputFiles("verify/fixtures/tall.jpg"); // portrait: shown whole, not cropped
  await expectLoaded(photosBox.getByRole("img", { name: "Photo 2" }));
  await check(page, "idea-photos", { keyboard: true });
  // Tap a photo: it opens large in place (no new tab); arrows move between photos; Escape closes.
  const pages = page.context().pages().length;
  await photosBox.getByRole("button", { name: "Open photo 2" }).click();
  const viewer = page.getByRole("dialog", { name: "Photo 2 of 2" });
  await expect(viewer).toBeVisible();
  await expectLoaded(viewer.getByRole("img", { name: "Photo 2, full size" }));
  expect(page.context().pages().length).toBe(pages);
  await check(page, "photo-viewer");
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("dialog", { name: "Photo 1 of 2" })).toBeVisible();
  await page.getByRole("dialog").getByRole("button", { name: "Next →" }).click();
  await expect(page.getByRole("dialog", { name: "Photo 2 of 2" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(photosBox.getByRole("button", { name: "Open photo 2" })).toBeFocused(); // focus comes back
  // Tapping anywhere, even on the photo, closes it.
  await photosBox.getByRole("button", { name: "Open photo 1" }).click();
  await page.getByRole("dialog").getByRole("img", { name: "Photo 1, full size" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  page.once("dialog", (d) => d.accept());
  await photosBox.getByRole("button", { name: "Delete photo 2" }).click();
  await expect(photosBox.getByRole("img", { name: "Photo 2" })).toHaveCount(0);
  await expect(photosBox.getByRole("img", { name: "Photo 1" })).toBeVisible();
  page.once("dialog", (d) => d.accept());
  await pv.getByRole("button", { name: "Delete idea", exact: true }).click();
  await page.waitForURL((u) => u.pathname === "/");
  // The text + photo idea: delete it too (leaves nothing behind in Storage).
  await page.goto("/?tab=ideas");
  await page.locator("main").filter({ visible: true }).getByRole("link", { name: new RegExp(`\\(photo\\)`) }).first().click();
  await page.waitForURL(/\/d\//);
  await expect(page.locator("main").filter({ visible: true }).getByRole("region", { name: "Photos" }).getByRole("img", { name: "Photo 1" })).toBeVisible();
  page.once("dialog", (d) => d.accept());
  await page.locator("main").filter({ visible: true }).getByRole("button", { name: "Delete idea", exact: true }).click();
  await page.waitForURL((u) => u.pathname === "/");
  await page.goto("/?tab=ideas");
  await expect(page.locator("main").getByRole("link", { name: "+ New idea" })).toHaveCount(0); // the box replaces it
  // Development tab: "+ Kitchen notes".
  await page.goto("/?tab=development");
  await expect(page.locator("main").getByRole("link", { name: "+ Kitchen notes" })).toBeVisible();

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
  // Shortcut: Enter adds the next ingredient and moves the cursor into it (no submit).
  await rf.getByLabel("Ingredient 2", { exact: true }).press("Enter");
  await expect(rf.getByLabel("Ingredient 3", { exact: true })).toBeVisible();
  await expect(page.locator(":focus")).toHaveAttribute("id", /^(amt|item)-/);
  await expect(rf.getByText("Give the recipe a name.")).toHaveCount(0); // still on the form
  await rf.getByLabel("Ingredient 3", { exact: true }).fill("vanilla bean");
  await rf.getByLabel("Step 1", { exact: true }).fill("Heat the milk until it steams. Don't let it boil.");
  await rf.getByRole("button", { name: "+ Why it works" }).first().click();
  await rf.getByLabel(/Why it works/).fill("Boiling can scorch the milk.");
  // Food science and adjustments like the recipe editor; × closes a note (student, Nov 28).
  await rf.getByRole("button", { name: "+ Why it works" }).first().click();
  await expect(rf.getByRole("textbox", { name: /Why it works \(step 1, note 2\)/ })).toBeFocused();
  await rf.getByRole("button", { name: "Remove why it works 2 from step 1" }).click();
  await expect(rf.getByRole("textbox", { name: /Why it works \(step 1, note 2\)/ })).toHaveCount(0);
  await rf.getByRole("button", { name: "+ Adjust to taste" }).first().click();
  await rf.getByRole("textbox", { name: "If you" }).fill("steam longer");
  await rf.getByRole("textbox", { name: "It comes out" }).fill("a thicker yogurt");
  // Enter in a step adds the next step; Shift+Enter is a new line in the same step.
  await rf.getByLabel("Step 1", { exact: true }).press("Enter");
  await expect(rf.getByLabel("Step 2", { exact: true })).toBeFocused();
  await page.keyboard.type("Stir in the sugar.");
  await page.keyboard.press("Shift+Enter");
  await page.keyboard.type("Then the vanilla.");
  await expect(rf.getByLabel("Step 3", { exact: true })).toHaveCount(0);
  await expect(rf.getByLabel("Step 2", { exact: true })).toHaveValue("Stir in the sugar.\nThen the vanilla.");
  await rf.getByRole("button", { name: "+ Add step" }).click();
  await rf.getByLabel("Remove step 3").click();
  await check(page, "manual-recipe-form", { keyboard: true });
  await rf.getByRole("button", { name: "Save recipe" }).click();
  await page.waitForURL(/\/r\//);
  const manualUrl = page.url();
  const mr = page.locator("main").filter({ visible: true });
  await expect(mr.getByRole("heading", { name: MANUAL })).toBeVisible();
  await expect(mr.getByText("whole milk")).toBeVisible();
  await expect(mr.getByText("vanilla bean")).toBeVisible();
  await expect(mr.getByRole("button", { name: "Why step 1 works" })).toBeVisible(); // same format as AI recipes
  await expect(mr.getByRole("button", { name: "Adjust step 1 to taste" })).toBeVisible();
  await expect(mr.getByText(/Kitchen notes/)).toHaveCount(0); // no kitchen-notes section on hand-typed recipes
  await check(page, "manual-recipe", { keyboard: true });

  // ---- Dish photo beside the title and ingredients, with cropping (student, Nov 28) ----
  await expect(mr.getByRole("button", { name: "Add dish photo" })).toBeVisible();
  const dishInput = mr.locator('input[type="file"][aria-label="Dish photo"]');
  const cropper = page.getByRole("dialog", { name: "Crop the photo" });
  const ratio = (img: import("@playwright/test").Locator) => img.evaluate((el: HTMLImageElement) => el.naturalWidth / el.naturalHeight);
  await dishInput.setInputFiles("verify/fixtures/tall.jpg");
  await expect(cropper).toBeVisible(); // a new photo opens the cropper first
  await cropper.getByRole("radio", { name: "Square" }).click();
  await expect(cropper.getByRole("radio", { name: "Square" })).toHaveAttribute("aria-checked", "true");
  await check(page, "dish-photo-crop");
  await cropper.getByRole("button", { name: "Save photo" }).click();
  await expect(cropper).toBeHidden();
  const dishImg = mr.getByRole("img", { name: "The dish" });
  await expectLoaded(dishImg);
  expect(Math.abs((await ratio(dishImg)) - 1)).toBeLessThan(0.02); // saved square
  await check(page, "recipe-dish-photo", { keyboard: true });
  // Change/Remove/Crop only show once the photo is tapped (in the large view).
  await expect(mr.getByRole("button", { name: "Remove", exact: true })).toHaveCount(0);
  await mr.getByRole("button", { name: /^Dish photo: zoom in/ }).click();
  const dishView = page.getByRole("dialog", { name: "Photo 1 of 1" });
  await expect(dishView.getByRole("button", { name: "Change" })).toBeVisible();
  await check(page, "dish-photo-open");
  // Re-crop the saved photo (reads it back from private Storage) to Wide.
  let oldSrc = await dishImg.getAttribute("src");
  await dishView.getByRole("button", { name: "Crop" }).click();
  await expect(cropper).toBeVisible();
  await cropper.getByRole("radio", { name: "Wide" }).click();
  await cropper.getByRole("button", { name: "Save photo" }).click();
  await expect(cropper).toBeHidden();
  await expect(dishImg).not.toHaveAttribute("src", oldSrc ?? "");
  await expectLoaded(dishImg);
  expect(Math.abs((await ratio(dishImg)) - 4 / 3)).toBeLessThan(0.03); // saved wide
  // Change: pick another photo; it replaces the old one.
  oldSrc = await dishImg.getAttribute("src");
  await dishInput.setInputFiles("verify/fixtures/onions.jpg");
  await cropper.getByRole("button", { name: "Save photo" }).click();
  await expect(dishImg).not.toHaveAttribute("src", oldSrc ?? "");
  await expect(mr.getByRole("img", { name: "The dish" })).toHaveCount(1);
  await expectLoaded(dishImg);
  await mr.getByRole("button", { name: /^Dish photo: zoom in/ }).click();
  page.once("dialog", (d) => d.accept());
  await dishView.getByRole("button", { name: "Remove" }).click();
  await expect(mr.getByRole("button", { name: "Add dish photo" })).toBeVisible();

  // ---- Edit the instructions: text, Why it works, Adjust to taste (student, Nov 28) ----
  await expect(mr.getByRole("heading", { name: "Instructions" })).toBeVisible();
  await mr.getByRole("button", { name: "Edit instructions" }).click();
  const ed = mr.locator("form").filter({ has: page.getByRole("button", { name: "Save instructions" }) });
  await ed.getByRole("textbox", { name: "Step 1", exact: true }).fill("Heat the milk until it steams, about 180°F. Don't let it boil.");
  await ed.getByRole("button", { name: "+ Why it works" }).nth(1).click(); // step 2
  await ed.getByRole("textbox", { name: /Why it works \(step 2, note 1\)/ }).fill("Sugar dissolves faster in warm milk.");
  await ed.getByRole("button", { name: "+ Adjust to taste" }).nth(1).click();
  await ed.getByRole("textbox", { name: "If you" }).last().fill("more sugar");
  await ed.getByRole("textbox", { name: "It comes out" }).last().fill("sweeter");
  await check(page, "instructions-editing", { keyboard: true });
  await ed.getByRole("button", { name: "Save instructions" }).click();
  await expect(mr.getByText("about 180°F", { exact: false })).toBeVisible();
  await expect(mr.getByRole("button", { name: "Edit instructions" })).toBeFocused();
  await mr.getByRole("button", { name: "Why step 2 works" }).click();
  await expect(mr.getByText("Sugar dissolves faster in warm milk.")).toBeVisible();
  await mr.getByRole("button", { name: "Adjust step 2 to taste" }).click();
  await expect(mr.getByText("sweeter", { exact: true })).toBeVisible();
  // Remove step 1's food-science note.
  await mr.getByRole("button", { name: "Edit instructions" }).click();
  await ed.getByRole("button", { name: "Remove why it works 1 from step 1" }).click();
  await ed.getByRole("button", { name: "Save instructions" }).click();
  await expect(mr.getByRole("button", { name: "Edit instructions" })).toBeVisible();
  await expect(mr.getByRole("button", { name: "Why step 1 works" })).toHaveCount(0);

  // ---- Tags (Recipes tab): type to add, several per recipe, filter, delete (the recipe stays) ----
  const TAG = `Desserts ${RUN}`;
  const TAG2 = `Breakfast ${RUN}`;
  const tagsBox = mr.getByRole("region", { name: "Tags" });
  const tagInput = tagsBox.getByRole("textbox", { name: "Add a tag" });
  const onRecipe = tagsBox.getByRole("list", { name: "Tags on this recipe" });
  // Mobile-app style: a "+ Tag" chip opens a small box in the row (student, Nov 28).
  await expect(tagInput).toHaveCount(0);
  await tagsBox.getByRole("button", { name: "+ Tag" }).click();
  await expect(tagInput).toBeFocused();
  await tagInput.fill(TAG);
  await expect(tagsBox.getByText(`Press Enter to make the new tag “${TAG}”.`)).toBeVisible();
  await tagInput.press("Enter");
  await expect(onRecipe.getByText(TAG)).toBeVisible(); // made + added
  await expect(tagInput).toHaveValue(""); // ready for the next one
  await expect(tagInput).toBeFocused();
  await tagInput.fill(TAG2);
  await tagInput.press("Enter");
  await expect(onRecipe.getByText(TAG2)).toBeVisible(); // several per recipe
  await tagInput.fill(TAG.toUpperCase());
  await tagInput.press("Enter"); // same tag, any case: no duplicate
  await expect(onRecipe.getByText(TAG, { exact: true })).toHaveCount(1);
  await expect(onRecipe.getByText(TAG.toUpperCase(), { exact: true })).toHaveCount(0);
  await onRecipe.getByRole("button", { name: `Remove ${TAG2}` }).click(); // × = off this recipe
  await expect(onRecipe.getByText(TAG2)).toHaveCount(0);
  // Your other tags narrow as you type; tap one to add it back.
  await tagInput.fill(`Breakfast ${RUN}`.slice(0, 12));
  const pick = tagsBox.getByRole("list", { name: "Tap a tag to add it" }).getByRole("button", { name: `Add ${TAG2}` });
  await expect(pick).toBeVisible();
  await expect(tagsBox.getByRole("button", { name: `Add ${TAG}` })).toHaveCount(0); // already on it
  await check(page, "recipe-tags", { keyboard: true });
  await pick.click();
  await expect(onRecipe.getByText(TAG2)).toBeVisible();
  await onRecipe.getByRole("button", { name: `Remove ${TAG2}` }).click();
  await expect(onRecipe.getByText(TAG2)).toHaveCount(0);
  await expect(tagsBox).toHaveAttribute("aria-busy", "false"); // every change has reached the server
  await page.reload(); // saved, not just on screen
  await expect(mr.getByRole("list", { name: "Tags on this recipe" }).getByText(TAG2)).toHaveCount(0);
  await expect(mr.getByRole("list", { name: "Tags on this recipe" }).getByText(TAG)).toBeVisible();

  await page.goto("/?tab=finished");
  const rt = page.locator("main").filter({ visible: true });
  const filter = rt.getByRole("navigation", { name: "Filter by tag" });
  await expect(filter.getByRole("link", { name: "All", exact: true })).toHaveAttribute("aria-current", "page");
  await filter.getByRole("link", { name: TAG }).click();
  await expect(filter.getByRole("link", { name: TAG })).toHaveAttribute("aria-current", "page");
  await expect(rt.getByText(MANUAL, { exact: true })).toBeVisible();
  await check(page, "recipes-by-tag", { keyboard: true });
  await filter.getByRole("link", { name: TAG2 }).click();
  await expect(filter.getByRole("link", { name: TAG2 })).toHaveAttribute("aria-current", "page");
  await expect(rt.getByText(MANUAL, { exact: true })).toHaveCount(0);
  await expect(rt.getByText(`No recipes tagged ${TAG2} yet.`, { exact: false })).toBeVisible();

  await filter.getByRole("link", { name: "All tags" }).click();
  await page.waitForURL(/\/tags/);
  const tagPage = page.locator("main").filter({ visible: true });
  // Every tag with its recipes under it.
  const tagBlock = tagPage.getByRole("region", { name: TAG, exact: true });
  await expect(tagBlock.getByText("1 recipe", { exact: true })).toBeVisible();
  await expect(tagBlock.getByRole("list", { name: `Recipes tagged ${TAG}` }).getByRole("link", { name: MANUAL })).toBeVisible();
  await expect(tagPage.getByRole("region", { name: TAG2, exact: true }).getByText("No recipes yet.", { exact: false })).toBeVisible();
  await check(page, "tags-page", { keyboard: true });
  for (const name of [TAG, TAG2]) {
    page.once("dialog", (d) => d.accept());
    await tagPage.getByRole("button", { name: `Delete ${name}`, exact: true }).click();
    await expect(tagPage.getByRole("button", { name: `Delete ${name}`, exact: true })).toHaveCount(0);
  }
  await page.goto(manualUrl);
  await expect(mr.getByRole("heading", { name: MANUAL })).toBeVisible(); // deleting a tag keeps the recipe
  page.once("dialog", (d) => d.accept());
  await mr.getByRole("button", { name: "Delete recipe" }).click();
  await page.waitForURL((u) => u.pathname === "/");
  await page.goto(manualUrl);
  await expect(page.getByRole("heading", { name: "Not in your lab book" })).toBeVisible();

  // ---- Recipe components, like a flan's caramel and custard (student, Nov 28) ----
  const FLAN = `Flan (verify ${RUN})`;
  await page.goto("/recipes/new");
  const ff = page.locator("main").filter({ visible: true });
  await ff.getByLabel("Recipe name").fill(FLAN);
  await ff.getByRole("button", { name: "+ Component" }).click();
  await ff.getByRole("textbox", { name: "New component" }).fill("Caramel sauce");
  await ff.getByRole("textbox", { name: "New component" }).press("Enter");
  await ff.getByRole("textbox", { name: "New component" }).fill("Custard");
  await ff.getByRole("textbox", { name: "New component" }).press("Enter");
  await ff.getByRole("textbox", { name: "Ingredient 1", exact: true }).click(); // closes the part box
  await ff.getByRole("radiogroup", { name: "Component of ingredient 1" }).getByRole("radio", { name: "Caramel sauce" }).click();
  await ff.getByRole("textbox", { name: "Ingredient 1", exact: true }).fill("sugar");
  await ff.getByRole("textbox", { name: "Amount 1", exact: true }).fill("100 g");
  await ff.getByRole("textbox", { name: "Ingredient 1", exact: true }).press("Enter"); // the new row stays in Caramel sauce
  await expect(ff.getByRole("radiogroup", { name: "Component of ingredient 2" }).getByRole("radio", { name: "Caramel sauce" })).toHaveAttribute("aria-checked", "true");
  await ff.getByRole("textbox", { name: "Ingredient 2", exact: true }).fill("water");
  await ff.getByRole("textbox", { name: "Ingredient 3", exact: true }).fill("whole milk");
  await ff.getByRole("radiogroup", { name: "Component of ingredient 3" }).getByRole("radio", { name: "Custard" }).click();
  // Bulk move: tick two rows, then one tap moves both (student, Nov 28).
  await ff.getByRole("checkbox", { name: "Select ingredient 1" }).check();
  await ff.getByRole("checkbox", { name: "Select ingredient 2" }).check();
  const bulk = ff.getByRole("group", { name: "Move 2 selected ingredients" });
  await check(page, "recipe-components-bulk");
  await bulk.getByRole("button", { name: "Custard" }).click();
  for (const n of [1, 2])
    await expect(ff.getByRole("radiogroup", { name: `Component of ingredient ${n}` }).getByRole("radio", { name: "Custard" })).toHaveAttribute("aria-checked", "true");
  await expect(ff.getByRole("group", { name: /Move \d+ selected ingredients/ })).toHaveCount(0); // cleared after the move
  await ff.getByRole("checkbox", { name: "Select ingredient 1" }).check();
  await ff.getByRole("checkbox", { name: "Select ingredient 2" }).check();
  await bulk.getByRole("button", { name: "Caramel sauce" }).click();
  await expect(ff.getByRole("radiogroup", { name: "Component of ingredient 2" }).getByRole("radio", { name: "Caramel sauce" })).toHaveAttribute("aria-checked", "true");
  await ff.getByRole("textbox", { name: "Step 1", exact: true }).fill("Preheat the oven to 320°F.");
  await ff.getByRole("textbox", { name: "Step 1", exact: true }).press("Enter");
  await page.keyboard.type("Dissolve the sugar in the water over medium-low heat.");
  await ff.getByRole("radiogroup", { name: "Component of step 2" }).getByRole("radio", { name: "Caramel sauce" }).click();
  await ff.getByRole("button", { name: "+ Add step" }).click();
  await ff.getByRole("textbox", { name: "Step 3", exact: true }).fill("Bring the milk to 200°F.");
  await ff.getByRole("radiogroup", { name: "Component of step 3" }).getByRole("radio", { name: "Custard" }).click();
  await check(page, "recipe-parts-form", { keyboard: true });
  await ff.getByRole("button", { name: "Save recipe" }).click();
  await page.waitForURL(/\/r\//);
  const fr = page.locator("main").filter({ visible: true });
  // Ingredients grouped under part headings; instructions keep their order with headings where the part changes.
  await expect(fr.getByRole("heading", { level: 3, name: "Caramel sauce" })).toHaveCount(2);
  await expect(fr.getByRole("heading", { level: 3, name: "Custard" })).toHaveCount(2);
  await expect(fr.locator("ol").first().getByText("Preheat the oven", { exact: false })).toBeVisible(); // no part: first
  await check(page, "recipe-parts", { keyboard: true });
  // Move "water" to Custard in the ingredient editor.
  await fr.getByRole("button", { name: "Edit ingredients" }).click();
  // The editor box never overlaps the dish photo tile (it starts below it).
  const tile = await fr.getByRole("button", { name: "Add dish photo" }).boundingBox();
  const box = await fr.locator("form").filter({ has: page.getByRole("button", { name: "Save ingredients" }) }).boundingBox();
  expect(box!.y).toBeGreaterThanOrEqual(tile!.y + tile!.height - 1);
  await fr.getByRole("radiogroup", { name: "Component of water" }).getByRole("radio", { name: "Custard" }).click();
  await fr.getByRole("button", { name: "Save ingredients" }).click();
  await expect(fr.getByRole("button", { name: "Edit ingredients" })).toBeVisible();
  const custardList = fr.getByRole("heading", { level: 3, name: "Custard" }).first().locator("xpath=following-sibling::ul[1]");
  await expect(custardList.getByText(/^water/)).toBeVisible();
  page.once("dialog", (d) => d.accept());
  await fr.getByRole("button", { name: "Delete recipe" }).click();
  await page.waitForURL((u) => u.pathname === "/");

  // ---- The full idea form (note + link) ----
  await page.goto("/ideas/new");
  await page.getByRole("button", { name: "Save idea" }).click();
  await expect(page.getByText(/Give the idea a short name/)).toBeVisible();
  await page.getByLabel("Idea", { exact: true }).fill(IDEA);
  await page.getByLabel(/Inspiration/).fill("Had it on pho. Crunchy and sweet. Try drying in a low oven?");
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
  await expect(ideaView.getByText(/Nothing yet\. Dictate or paste rough instructions/)).toHaveCount(0);
  await expect(ideaView.getByRole("button", { name: "Add kitchen notes" })).toHaveCount(0);

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

  // Pencil on Inspiration.
  await view.getByRole("button", { name: "Edit inspiration" }).click();
  await view.getByRole("textbox", { name: "Inspiration" }).fill("Had it on pho. Crunchy and sweet. Dry at 200°F for 2 hours?");
  await check(page, "idea-notes-editing", { keyboard: true });
  await view.getByRole("button", { name: "Save", exact: true }).click();
  await expect(view.getByText(/Dry at 200°F/)).toBeVisible();
  await expect(view.getByRole("button", { name: "Edit inspiration" })).toBeFocused();
  expect(page.url()).toBe(ideaUrl);

  await page.goto("/?tab=ideas");
  const ideaRow = page.getByRole("listitem").filter({ has: page.getByText(`${IDEA} (renamed)`, { exact: true }), visible: true });
  await expect(ideaRow).toBeVisible();
  await check(page, "home-ideas-with-idea");
  await expect(ideaRow.getByRole("button", { name: "Development" })).toHaveCount(0); // no "Move to" on every row
  await ideaRow.getByRole("link").click(); // moving happens on the item's page
  await page.waitForURL(/\/d\//);
  await page.locator("main").filter({ visible: true }).getByRole("button", { name: "Move to Development" }).click();
  await expect(page.locator("main").filter({ visible: true }).getByRole("link", { name: "Development" }).first()).toBeVisible();
  await page.goto("/?tab=development");
  await expect(page.getByRole("listitem").filter({ has: page.getByText(`${IDEA} (renamed)`, { exact: true }), visible: true })).toBeVisible();
  await check(page, "home-development-moved-idea");

  // In Development, the idea keeps its notes and offers "Add kitchen notes".
  await page.goto(ideaUrl);
  await expect(view.getByText(/Dry at 200°F/)).toBeVisible(); // notes kept after the move
  await expect(view.getByText(/Nothing yet\. Dictate or paste rough instructions/)).toBeVisible();
  await expect(view.getByRole("button", { name: "Create recipe with AI" })).toHaveCount(0);
  await check(page, "idea-in-development-no-words", { keyboard: true });
  await view.getByRole("button", { name: "Add kitchen notes" }).click();
  await view.getByRole("textbox", { name: "Kitchen notes", exact: true }).fill("You slice the onions thin and cook them low for an hour until deep brown, then dry them in the oven.");
  await view.getByLabel(/Whose recipe/).fill("Auntie");
  await view.getByRole("button", { name: "Save changes" }).click();
  await expect(view.getByText("Kitchen notes", { exact: true })).toBeVisible();
  await expect(view.getByRole("heading", { name: "Ready to make it a recipe?" })).toBeVisible(); // AI step now offered
  // Delete their words: back to "No cook's words yet", notes stay, no AI step.
  page.once("dialog", (d) => d.accept());
  await view.getByRole("button", { name: "Delete kitchen notes" }).click();
  await expect(view.getByText(/Nothing yet\. Dictate or paste rough instructions/)).toBeVisible();
  await expect(view.getByRole("button", { name: "Create recipe with AI" })).toHaveCount(0);
  await expect(view.getByText(/Dry at 200°F/)).toBeVisible(); // idea notes stay
  await check(page, "words-deleted");
  await expect(view.getByText(/Dry at 200°F/)).toBeVisible(); // notes still there
  await check(page, "idea-with-words-added");

  // ---- Write its recipe yourself (no AI), right from Development ----
  await view.getByRole("link", { name: "or write the recipe yourself" }).click();
  await page.waitForURL(/\/recipes\/new\?from=/);
  const wf = page.locator("main").filter({ visible: true });
  await expect(wf.getByLabel("Recipe name")).toHaveValue(`${IDEA} (renamed)`); // prefilled from the item
  await wf.getByLabel("Ingredient 1", { exact: true }).fill("yellow onions");
  await wf.getByLabel("Amount 1", { exact: true }).fill("4");
  await wf.getByLabel("Step 1", { exact: true }).fill("Slice thin and cook low for an hour, then dry in a 200°F oven.");
  await check(page, "write-recipe-from-item");
  await wf.getByRole("button", { name: "Save recipe" }).click();
  await page.waitForURL(/\/r\//);
  const wr = page.locator("main").filter({ visible: true });
  await expect(wr.getByRole("link", { name: "Recipes" }).first()).toBeVisible(); // moved to Recipes
  await expect(wr.getByText("yellow onions")).toBeVisible();
  await expect(wr.getByText(/Dry at 200°F/)).toBeHidden(); // folded away on the recipe page
  await openNotes(page);
  await expect(wr.getByText(/Dry at 200°F/)).toBeVisible(); // its idea notes came along

  // Delete it (this removes the item too).
  page.once("dialog", (d) => d.accept());
  await wr.getByRole("button", { name: "Delete recipe" }).click();
  await page.waitForURL((u) => u.pathname === "/");
  // Scope to <main>: Next keeps hidden copies of past pages, and its screen-reader
  // route announcer still holds the old title.
  await expect(page.locator("main").getByText(`${IDEA} (renamed)`, { exact: true }).filter({ visible: true })).toHaveCount(0);
  // Remove the quick-added idea too.
  await page.goto("/?tab=ideas");
  await page.locator("main").getByText(`${IDEA} (quick)`, { exact: true }).first().click();
  await page.waitForURL(/\/d\//);
  page.once("dialog", (d) => d.accept());
  await page.locator("main").filter({ visible: true }).getByRole("button", { name: "Delete idea", exact: true }).click();
  await page.waitForURL((u) => u.pathname === "/");
  // Also remove the second idea from the "Save and add another" check.
  await page.goto("/?tab=ideas");
  await page.locator("main").getByText(`${IDEA} #2`, { exact: true }).first().click();
  await page.waitForURL(/\/d\//);
  page.once("dialog", (d) => d.accept());
  await page.locator("main").filter({ visible: true }).getByRole("button", { name: "Delete idea", exact: true }).click();
  await page.waitForURL((u) => u.pathname === "/");

  // ---- Capture ----
  await page.goto("/?tab=development");
  await page.locator("main").getByRole("link", { name: "+ Kitchen notes" }).click();
  await page.waitForURL(/\/new$/);
  await page.getByRole("button", { name: /Save kitchen notes/ }).click();
  await expect(page.getByText(/Dictate or paste the kitchen notes here first/)).toBeVisible();
  await check(page, "new-empty-error", { keyboard: true });

  await page.getByRole("textbox", { name: "Kitchen notes", exact: true }).fill(YOGURT);
  await page.getByLabel(/Dish name/).fill(DISH);
  await page.getByLabel(/Whose recipe/).fill("Grandma");
  await page.getByRole("button", { name: /Save kitchen notes/ }).click();
  await page.waitForURL(/\/d\//);
  // A new dictation starts in Development (adding the cook's words is Development work).
  // Wait for the real page, not the loading skeleton.
  await expect(view.getByRole("heading", { name: "Ready to make it a recipe?" })).toBeVisible();
  await expect(view.getByRole("link", { name: "Development" }).first()).toBeVisible(); // breadcrumb
  // Inspiration and the kitchen notes are separate sections.
  await expect(view.getByRole("heading", { name: "Inspiration" })).toBeVisible();
  await expect(view.getByText("Kitchen notes", { exact: true })).toBeVisible();
  // Long kitchen notes show a few lines and "Show all" (compact).
  await view.getByRole("button", { name: "Show all" }).click();
  await expect(view.getByRole("button", { name: "Show less" })).toHaveAttribute("aria-expanded", "true");
  await view.getByRole("button", { name: "Show less" }).click();
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
  await page.getByLabel(/kitchen notes are complete/).check();
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
  await page.getByLabel(/kitchen notes are complete/).check();
  await page.locator("main").filter({ visible: true }).getByRole("button", { name: "Create recipe with AI" }).click();
  await waitForAi(page, () => page.waitForURL(/\/r\//, { timeout: 4 * 60_000 }));
  recipeUrl = page.url();
  await expect(page.getByRole("heading", { name: /questions/i })).toBeVisible();
  const qp = page.locator("main").filter({ visible: true });
  await qp.getByRole("button", { name: "Edit kitchen notes" }).click();
  await qp.getByRole("textbox", { name: "Kitchen notes", exact: true }).fill("");
  await qp.getByRole("button", { name: "Save changes" }).click();
  await expect(qp.getByText(/AI questions still need these notes/)).toBeVisible();
  await qp.getByRole("button", { name: "Cancel" }).click();

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
  // No source labels and no "Show sources" switch (student, Nov 27).
  const main = page.locator("main").filter({ visible: true });
  await expect(main.getByText("Where each part came from:")).toBeHidden();
  await expect(main.getByRole("switch", { name: "Show sources" })).toHaveCount(0);
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
    await expect(main.getByText("Adjust to taste", { exact: true }).filter({ visible: true }).first()).toBeVisible();
  }
  await check(page, "recipe-science-and-dials-open");
  // "Show all notes" opens every note at once, and closes them again (student, Nov 28).
  const allNotes = main.getByRole("switch", { name: "All notes" });
  await allNotes.click();
  await expect(allNotes).toHaveAttribute("aria-checked", "true");
  for (const b of await main.getByRole("button", { name: /^(Why step \d+ works|Adjust step \d+ to taste|Note about .*|Adjust .* to taste)$/ }).all())
    await expect(b).toHaveAttribute("aria-expanded", "true");
  await check(page, "recipe-all-notes-open");
  await allNotes.click();
  for (const b of await main.getByRole("button", { name: /^(Why step \d+ works|Adjust step \d+ to taste|Note about .*|Adjust .* to taste)$/ }).all())
    await expect(b).toHaveAttribute("aria-expanded", "false");
  // Ingredient notes hide behind an icon: sliders for taste notes, a note icon otherwise (student, Nov 28).
  await expect(main.getByRole("button", { name: /^Why .* works$/ }).first()).toBeVisible(); // the flask is for steps' food science
  const noteBtn = main.getByRole("button", { name: /^(Note about|Adjust) / }).first();
  if (await noteBtn.count()) {
    await expect(noteBtn).toHaveAttribute("aria-expanded", "false");
    await noteBtn.click();
    await expect(noteBtn).toHaveAttribute("aria-expanded", "true");
  }

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
  // The edits are saved; labels and history are kept in the data but not shown.
  const changed = list.getByRole("listitem").filter({ hasText: "2 cups (verify)" });
  await expect(changed).toBeVisible();
  await expect(changed.getByText("Family answer")).toBeHidden();
  await expect(list.getByRole("listitem").filter({ hasText: "salt (verify)" })).toBeVisible();
  await expect(list.getByRole("listitem").filter({ hasText: removedName })).toHaveCount(0);
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

  await page.getByRole("button", { name: "Turn off", exact: true }).click();
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
  await openNotes(page);
  await view.getByRole("button", { name: "Edit kitchen notes" }).click();
  await view.getByRole("textbox", { name: "Kitchen notes", exact: true }).fill(`${YOGURT} oh and let the milk cool down first`);
  await check(page, "recipe-words-edit-in-place", { keyboard: true });
  await view.getByRole("button", { name: "Save changes" }).click();
  expect(new URL(page.url()).pathname).toBe(new URL(recipeUrl).pathname);
  await expect(view.getByText(/after this recipe was made/)).toBeVisible();
  await expect(view.getByText(/Kitchen notes · edited/)).toBeVisible();
  await expect(view.getByText("See the original words")).toHaveCount(0); // no original versions are kept
  await check(page, "recipe-after-edit");
  await openNotes(page);
  await view.getByRole("button", { name: "Edit kitchen notes" }).click();
  await view.getByRole("textbox", { name: "Kitchen notes", exact: true }).fill("");
  await view.getByRole("button", { name: "Save changes" }).click();
  await expect(view.getByText(/Nothing yet\. Dictate or paste rough instructions/)).toBeVisible(); // empty save = deleted
  await expect(view.getByRole("heading", { name: "Ingredients" })).toBeVisible(); // the recipe stays

  await page.goto("/?tab=finished");
  await check(page, "home-finished-tab");

  // ---- Not found / someone else's ----
  await page.goto("/r/00000000-0000-0000-0000-000000000000");
  await check(page, "not-found");

  // ---- Clean up: delete this run's recipe (exercises the confirm dialog) ----
  await page.goto(recipeUrl);
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Delete recipe" }).click();
  await page.waitForURL((u) => u.pathname === "/");
  await page.goto(recipeUrl);
  await expect(page.getByRole("heading", { name: "Not in your lab book" })).toBeVisible();
});
