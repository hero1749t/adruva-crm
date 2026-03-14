import { expect, test } from "@playwright/test";

const ownerEmail = "owner@adruva.com";
const ownerPassword = "Adruva@2026#Owner";

test("authenticate owner session", async ({ page }) => {
  await page.goto("/login");

  await expect(page.getByRole("heading", { name: /adruva solution/i })).toBeVisible();
  await page.getByPlaceholder("you@adruvasolution.com").fill(ownerEmail);
  await page.locator('input[type="password"]').fill(ownerPassword);
  await page.getByRole("button", { name: /sign in/i }).click();

  await page.waitForURL("**/dashboard");
  await expect(page.getByRole("heading", { name: /dashboard/i })).toBeVisible();

  await page.context().storageState({ path: "playwright/.auth/owner.json" });
});
