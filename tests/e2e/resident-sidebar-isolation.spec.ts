import { expect, test } from "@playwright/test";

async function loginAsAdmin(page: import("@playwright/test").Page) {
  const response = await page.context().request.post("/api/login", {
    data: { username: "pgadmin@cityconnect.com", password: "PgAdmin123!" },
  });

  expect(response.ok()).toBeTruthy();
}

test.describe("Resident /requests/new layout isolation", () => {
  test("secondary Sub nav does not shrink when primary sidebar toggles", async ({ page }) => {
    await loginAsAdmin(page);

    await page.goto("/resident/requests/new");

    const subNav = page.locator('[data-name="Sub nav"]');
    await expect(subNav).toBeVisible();

    const before = await subNav.boundingBox();
    expect(before).not.toBeNull();

    await page.getByRole("button", { name: /Collapse sidebar/i }).click();

    const afterCollapse = await subNav.boundingBox();
    expect(afterCollapse).not.toBeNull();

    expect(Math.abs((before!.width ?? 0) - (afterCollapse!.width ?? 0))).toBeLessThan(2);

    await page.getByRole("button", { name: /Expand sidebar/i }).click();

    const afterExpand = await subNav.boundingBox();
    expect(afterExpand).not.toBeNull();

    expect(Math.abs((before!.width ?? 0) - (afterExpand!.width ?? 0))).toBeLessThan(2);
  });
});
