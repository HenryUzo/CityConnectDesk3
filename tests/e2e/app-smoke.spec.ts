import { expect, test } from "@playwright/test";

test("root page loads and shows app shell", async ({ page }) => {
  const pageErrors: Error[] = [];
  page.on("pageerror", (error) => pageErrors.push(error));

  await page.goto("/");
  await page.waitForLoadState("networkidle");

  const appShell = page.getByText(/CityConnect/i).first();
  await expect(appShell).toBeVisible();

  expect(pageErrors.map((err) => err.message)).toEqual([]);
});
