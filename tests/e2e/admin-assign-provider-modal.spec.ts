import { expect, test } from "@playwright/test";

const ADMIN_EMAIL = "admin@cityconnect.com";

async function applyDevAdminHeader(page: import("@playwright/test").Page) {
  await page.context().setExtraHTTPHeaders({ "x-user-email": ADMIN_EMAIL });
}

async function fetchRequests(page: import("@playwright/test").Page) {
  const response = await page.context().request.get("/api/admin/bridge/service-requests", { headers: { "x-user-email": ADMIN_EMAIL } });
  expect(response.ok()).toBeTruthy();
  const payload = await response.json();
  return Array.isArray(payload) ? payload : [];
}

async function fetchRequestDetail(page: import("@playwright/test").Page, id: string) {
  const response = await page.context().request.get(`/api/service-requests/${id}`, { headers: { "x-user-email": ADMIN_EMAIL } });
  if (!response.ok()) return null;
  return response.json();
}

async function findRequestWithAction(page: import("@playwright/test").Page) {
  const requests = await fetchRequests(page);
  for (const request of requests) {
    const id = request?.id;
    if (!id) continue;
    const detail = await fetchRequestDetail(page, id);
    if (detail?.nextActions?.canAssignProvider) {
      return { id, hasAssignForJob: Boolean(detail?.nextActions?.canAssignForJob) };
    }
  }
  throw new Error("No service request found with Assign provider available.");
}

test("Assign provider modal stays on detail page", async ({ page }) => {
  await applyDevAdminHeader(page);

  const target = await findRequestWithAction(page);

  await page.goto(`/admin-dashboard/requests/${target.id}`);
  await expect(page.getByRole("button", { name: /Assign provider/i })).toBeVisible();

  await page.getByRole("button", { name: /Assign provider/i }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("heading", { name: /Assign (Job Provider|Inspector)/i })).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`/admin-dashboard/requests/${target.id}`));

  const cancelButton = page.getByRole("button", { name: /^Cancel$/ }).first();
  await cancelButton.click();

  const assignForJobButton = page.getByRole("button", { name: /Assign for job/i });
  if (await assignForJobButton.isVisible().catch(() => false)) {
    await assignForJobButton.click();
    const jobDialog = page.getByRole("dialog");
    await expect(jobDialog).toBeVisible();
    await expect(jobDialog.getByText(/Assign (Job Provider|Inspector)/i)).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`/admin-dashboard/requests/${target.id}`));
  }
});
