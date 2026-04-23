import type { Page, TestInfo } from "@playwright/test";
import { expect, test } from "@playwright/test";
import {
  ensurePendingRequest,
  ensureSampleRequest,
  setRequestStatus,
} from "./utils/testData";

const KNOWN_STATUSES = ["PENDING", "UNDER_REVIEW", "IN_PROGRESS", "COMPLETED", "CANCELLED", "UNSET"];
const requestsEndpointRegex = /\/api\/estates\/.*?\/requests/;
const RESIDENT_EMAIL = "testresident@gmail.com";

function getBaseURL(testInfo: TestInfo) {
  return testInfo.project.use.baseURL || "http://localhost:5000";
}

async function openRequestsPage(page: Page) {
  await page.context().setExtraHTTPHeaders({ "x-user-email": RESIDENT_EMAIL });
  await page.addInitScript((email: string) => {
    window.localStorage.setItem("dev_user_email", email);
  }, RESIDENT_EMAIL);

  const estatesResponsePromise = page.waitForResponse(
    (response) => response.url().includes("/api/my-estates") && response.request().method() === "GET"
  );
  const requestsResponsePromise = page.waitForResponse(
    (response) => requestsEndpointRegex.test(response.url()) && response.request().method() === "GET"
  );

  await page.goto("/requests");

  const estatesResponse = await estatesResponsePromise;
  expect(estatesResponse.ok()).toBeTruthy();

  const requestsResponse = await requestsResponsePromise;
  expect(requestsResponse.ok()).toBeTruthy();
}

test.describe("Requests page", () => {
  test("Requests page shows real data for my estate", async ({ page }, testInfo) => {
    const baseURL = getBaseURL(testInfo);
    await ensureSampleRequest(baseURL);

    await openRequestsPage(page);

    await expect(page.getByRole("heading", { name: /Service Requests/i })).toBeVisible();

    const rows = page.locator("table tbody tr");
    await expect(rows.first()).toBeVisible();
    expect(await rows.count()).toBeGreaterThan(0);

    const statusCells = await page.locator("table tbody tr td:nth-child(3)").allTextContents();
    const hasKnownStatus = statusCells.some((status) =>
      KNOWN_STATUSES.some((known) => status.trim().toUpperCase().includes(known))
    );
    expect(hasKnownStatus).toBeTruthy();
  });

  test("Can move a request from PENDING to UNDER_REVIEW and then to IN_PROGRESS", async ({ page }, testInfo) => {
    const baseURL = getBaseURL(testInfo);
    const pendingRequest = await ensurePendingRequest(baseURL);
    const targetDescription = pendingRequest.description ?? pendingRequest.title ?? "Untitled request";

    await openRequestsPage(page);

    const pendingRow = page
      .locator("table tbody tr")
      .filter({
        has: page.getByText(targetDescription),
        hasText: "PENDING",
      })
      .first();
    await expect(pendingRow).toBeVisible();

    const toUnderReview = page.waitForResponse(
      (response) =>
        response.request().method() === "PATCH" &&
        response.url().includes(`/api/requests/${pendingRequest.id}/status`)
    );
    await pendingRow.getByRole("button", { name: /Under review/i }).click();
    const underReviewResponse = await toUnderReview;
    expect(underReviewResponse.ok()).toBeTruthy();
    const underReviewBody = await underReviewResponse.json();
    expect((underReviewBody as any).status).toBe("UNDER_REVIEW");
    const targetRow = page
      .locator("table tbody tr")
      .filter({ has: page.getByText(targetDescription) })
      .first();
    await expect(targetRow.getByText("UNDER_REVIEW")).toBeVisible();

    const toInProgress = page.waitForResponse(
      (response) =>
        response.request().method() === "PATCH" &&
        response.url().includes(`/api/requests/${pendingRequest.id}/status`)
    );
    await targetRow.getByRole("button", { name: /In Progress/i }).click();
    const inProgressResponse = await toInProgress;
    expect(inProgressResponse.ok()).toBeTruthy();
    const inProgressBody = await inProgressResponse.json();
    expect((inProgressBody as any).status).toBe("IN_PROGRESS");
    await expect(targetRow.getByText("IN_PROGRESS")).toBeVisible();

    const titleCell = targetRow.locator("td").first();
    const titleText = (await titleCell.innerText()).trim();

    await openRequestsPage(page);

    const reloadedRow = page
      .locator("table tbody tr")
      .filter({
        has: page.getByText(targetDescription || titleText),
        hasText: "IN_PROGRESS",
      })
      .first();
    await expect(reloadedRow).toBeVisible();
  });

  test("Completed requests show no action buttons", async ({ page }, testInfo) => {
    const baseURL = getBaseURL(testInfo);
    const sample = await ensurePendingRequest(baseURL);
    const completed = await setRequestStatus(sample.id, "COMPLETED", baseURL);
    const targetDescription = completed.description ?? completed.title ?? "Untitled request";

    await openRequestsPage(page);

    const completedRow = page
      .locator("table tbody tr")
      .filter({
        has: page.getByText(targetDescription),
        hasText: "COMPLETED",
      })
      .first();

    await expect(completedRow).toBeVisible();
    await expect(completedRow.getByText("COMPLETED")).toBeVisible();

    const actionCell = completedRow.locator("td").nth(4);
    await expect(actionCell.getByRole("button")).toHaveCount(0);
    await expect(actionCell.getByText(/Done/i)).toBeVisible();
  });
});
