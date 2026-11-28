/**
 * Issue #5: the per-user AI limit. Run with `npm run verify:limits` (dev server on :3000).
 * Uses its own test user, so the main verify user is never affected.
 *   1. Fill this user's hourly allowance, as the user (anon key + their Clerk token, so RLS applies).
 *   2. Try to create a recipe: the limit message shows, and no recipe is made (no Gemini call).
 * The ai_calls rows can't be deleted by the user (by design); they age out after a day.
 */
import { clerk, clerkSetup } from "@clerk/testing/playwright";
import { createClerkClient } from "@clerk/backend";
import { expect, test } from "@playwright/test";

const EMAIL = "labbook-limits+clerk_test@example.com";
const RUN = new Date().toISOString().slice(5, 19).replace("T", " ");

test.beforeAll(async () => {
  await clerkSetup();
  const api = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
  const { data } = await api.users.getUserList({ emailAddress: [EMAIL] });
  if (data.length === 0) await api.users.createUser({ emailAddress: [EMAIL], skipPasswordRequirement: true });
});

test("over the AI limit: a clear message and no model call", async ({ page }) => {
  await page.goto("/");
  await clerk.signIn({ page, emailAddress: EMAIL });
  await page.goto("/?tab=development");
  await page.waitForFunction(() => !!(window as unknown as { Clerk?: { session?: unknown } }).Clerk?.session);

  // 1. Use up the hour (20 calls), as this user.
  const status = await page.evaluate(
    async ({ url, key }) => {
      const token = await (window as unknown as { Clerk: { session: { getToken(): Promise<string> } } }).Clerk.session.getToken();
      const res = await fetch(`${url}/rest/v1/ai_calls`, {
        method: "POST",
        headers: { apikey: key, Authorization: `Bearer ${token}`, "Content-Type": "application/json", Prefer: "return=minimal" },
        body: JSON.stringify(Array.from({ length: 20 }, () => ({ kind: "draft" }))),
      });
      return res.status;
    },
    { url: process.env.NEXT_PUBLIC_SUPABASE_URL!, key: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY! },
  );
  expect(status).toBe(201);

  // 2. New kitchen notes (unique, so the dev cache can't answer for the model), then try the AI step.
  await page.goto("/new");
  await page.getByRole("textbox", { name: "Kitchen notes", exact: true }).fill(`Limit test ${RUN}: heat 2 cups of milk to 180°F, cool to 110°F, stir in 2 tbsp yogurt, keep warm 8 hours.`);
  await page.getByLabel(/Dish name/).fill(`Limit test (${RUN})`);
  await page.getByRole("button", { name: /Save kitchen notes/ }).click();
  await page.waitForURL(/\/d\//);
  const itemUrl = page.url();
  const main = page.locator("main").filter({ visible: true });
  await main.getByLabel(/kitchen notes are complete/).check();
  await main.getByRole("button", { name: "Create recipe with AI" }).click();
  await expect(main.getByText(/AI requests in the last hour|today's \d+ AI requests/)).toBeVisible({ timeout: 30_000 });
  await expect(main.getByText(/You can make more in about/)).toBeVisible();
  expect(page.url()).toBe(itemUrl); // no recipe was made

  // Clean up the item (the ai_calls rows stay; they age out).
  page.once("dialog", (d) => d.accept());
  await main.getByRole("button", { name: "Delete", exact: true }).click();
  await page.waitForURL((u) => u.pathname === "/");
});
