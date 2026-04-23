import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test, type Page } from "@playwright/test";

const RESIDENT_EMAIL = "testresident@gmail.com";
const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const EVIDENCE_IMAGE = path.resolve(TEST_DIR, "fixtures/request-evidence.svg");

async function openFreshOrdinaryFlow(page: Page) {
  const clearDraftState = (email: string) => {
    window.localStorage.setItem("dev_user_email", email);
    Object.keys(window.localStorage)
      .filter((key) => key.startsWith("ordinary_flow_draft_v1:"))
      .forEach((key) => window.localStorage.removeItem(key));
    window.sessionStorage.removeItem("ordinary_flow_e2e_started");
    window.sessionStorage.removeItem("citybuddy_consultancy_draft");
  };
  await page.addInitScript(clearDraftState, RESIDENT_EMAIL);
  await page.setExtraHTTPHeaders({ "x-user-email": RESIDENT_EMAIL });
  await page.goto("/resident/requests/ordinary");
  await page.waitForLoadState("domcontentloaded");
  await page.evaluate(clearDraftState, RESIDENT_EMAIL);
  await page.reload({ waitUntil: "domcontentloaded" });

  const createNewRequestCta = page.getByRole("button", { name: /Create new request/i }).first();
  if (await createNewRequestCta.isVisible({ timeout: 5000 }).catch(() => false)) {
    await createNewRequestCta.click();
  }
  const changeCategoryButton = page.getByRole("button", { name: /^Change category$/i }).first();
  if (await changeCategoryButton.isVisible({ timeout: 1000 }).catch(() => false)) {
    await changeCategoryButton.click();
  }
  await expect(page.getByText("Select Categories")).toBeVisible();
}

async function selectCategory(page: Page) {
  const search = page.getByPlaceholder(/Search Categories/i).first();
  if (await search.isVisible({ timeout: 5000 }).catch(() => false)) {
    await search.fill("Plumber");
  }

  const plumberLabel = page.getByText(/^Plumber$/i).first();
  await expect(plumberLabel).toBeVisible();
  const plumberAction = plumberLabel.locator("xpath=ancestor::button[1]");
  if (await plumberAction.isVisible({ timeout: 1000 }).catch(() => false)) {
    await plumberAction.click();
  } else {
    await plumberLabel.click();
  }
  await expect(page.getByText(/You selected Plumber/i)).toBeVisible();
}

async function answerLocation(page: Page) {
  await expect(page.getByText("Do you live in an estate registered with CityConnect?")).toBeVisible();
  const noButton = page.getByRole("button", { name: /^No$/i }).first();
  if (await noButton.isVisible({ timeout: 1000 }).catch(() => false)) {
    await noButton.click();
  }

  await expect(page.getByText("Select state/LGA")).toBeVisible();
  const stateField = page
    .locator("p")
    .filter({ hasText: /^State$/i })
    .first()
    .locator("xpath=..");
  if (!(await page.locator("[role='listbox']").isVisible({ timeout: 500 }).catch(() => false))) {
    await stateField.getByRole("combobox").click();
  }
  await page.locator("[role='listbox']").last().getByRole("option", { name: "Lagos" }).click();

  const lgaField = page
    .locator("p")
    .filter({ hasText: /^LGA$/i })
    .first()
    .locator("xpath=..");
  await lgaField.getByRole("combobox").click();
  await page.locator("[role='listbox']").last().getByRole("option", { name: "Alimosho" }).click();

  await expect(page.getByText("Enter your address.")).toBeVisible();
  await page.getByPlaceholder("Enter your address").fill("11 E2E Evidence Close");

  const addLocationButton = page.getByRole("button", { name: /^Add location$/i });
  await expect(addLocationButton).toBeEnabled();
  await addLocationButton.click();
  await expect(page.getByText(/How urgent is this\?|Pick the closest/i).first()).toBeVisible();
  await page.waitForTimeout(500);
}

async function completeWizardToSummary(
  page: Page,
  options: {
    issueType?: string;
    followUpAnswer?: string;
    quantity?: string;
    timeWindow?: string;
  } = {},
) {
  const {
    issueType = "Blocked drain",
    followUpAnswer = "Kitchen",
    quantity = "1",
    timeWindow = "Today",
  } = options;

  await page.getByRole("button", { name: /^Low\b/i }).last().click();
  await expect(page.getByText(/Pick the closest.*issue type\./i)).toBeVisible();

  await page.getByRole("button", { name: new RegExp(`^${escapeRegExp(issueType)}$`, "i") }).last().click();
  await expect(page.getByText(/Where is .*located\?|Where is low pressure observed\?/i)).toBeVisible();

  await page.getByRole("button", { name: new RegExp(`^${escapeRegExp(followUpAnswer)}$`, "i") }).last().click();
  await expect(page.getByText(/How many .*affected\?/i)).toBeVisible();

  await page.getByRole("button", { name: new RegExp(`^${escapeRegExp(quantity)}$`, "i") }).last().click();
  await expect(page.getByText("When should we come?")).toBeVisible();

  await page.getByRole("button", { name: new RegExp(`^${escapeRegExp(timeWindow)}$`, "i") }).last().click();
  await expect(page.getByRole("button", { name: /^Add photo$/i })).toBeVisible();
  const chooserPromise = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: /^Add photo$/i }).click();
  const chooser = await chooserPromise;
  await chooser.setFiles(EVIDENCE_IMAGE);
  await expect(page.getByText("request-evidence.svg")).toBeVisible();
  await page.getByRole("button", { name: /^Continue$/i }).click();

  const notesField = page.locator("textarea:visible").last();
  await expect(notesField).toBeVisible();
  await notesField.fill("Please call before arrival. The access gate requires resident confirmation.");
  await page.getByRole("button", { name: /Continue to summary|Next/i }).last().click();

  await expect(page.getByText("Job summary")).toBeVisible();
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function clickSummaryEdit(page: Page, label: string) {
  const summaryDrawer = page.locator(".fixed.inset-0.z-50").filter({ hasText: "Job summary" });
  const editIndexByLabel: Record<string, number> = {
    Category: 0,
    Location: 1,
    Urgency: 2,
    "Problem type": 3,
    Quantity: 4,
    "Time window": 5,
    Attachments: 6,
    "Additional information": 7,
  };

  await expect(summaryDrawer.getByText(label, { exact: true })).toBeVisible();
  await summaryDrawer.getByRole("button", { name: /^Edit$/i }).nth(editIndexByLabel[label]).click();
  await expect(summaryDrawer).toBeHidden();
}

test.describe("Ordinary request full intake", () => {
  test("answers all required questions, uploads image evidence, and prepares checkout draft", async ({ page }) => {
    await openFreshOrdinaryFlow(page);
    await selectCategory(page);
    await answerLocation(page);
    await completeWizardToSummary(page);

    await expect(page.getByText("Job summary")).toBeVisible();
    await expect(page.getByText("11 E2E Evidence Close").first()).toBeVisible();
    await expect(page.getByText(/1 photo\(s\)|1 attached/i).first()).toBeVisible();

    await page.getByRole("button", { name: /^Book for consultancy$/i }).click();
    await expect(page).toHaveURL(/\/checkout-diagnosis/);

    const draft = await page.evaluate(() => {
      const raw = window.sessionStorage.getItem("citybuddy_consultancy_draft");
      return raw ? JSON.parse(raw) : null;
    });

    expect(draft).toBeTruthy();
    expect(String(draft.categoryKey || "")).toBeTruthy();
    expect(String(draft.location || "")).toContain("11 E2E Evidence Close");
    expect(String(draft.urgency || "")).toBeTruthy();
    expect(String(draft.issueType || "")).toBeTruthy();
    expect(String(draft.quantityLabel || "")).toBeTruthy();
    expect(String(draft.timeWindowLabel || "")).toBeTruthy();
    expect(String(draft.notes || "")).toContain("Please call before arrival");
    expect(draft.attachmentsCount).toBe(1);
    expect(String(draft.description || "")).toContain("Photos attached: 1");
  });

  test("keeps plumber low-pressure flow on image upload before showing summary", async ({ page }) => {
    await openFreshOrdinaryFlow(page);
    await selectCategory(page);
    await answerLocation(page);
    await completeWizardToSummary(page, {
      issueType: "Low pressure",
      followUpAnswer: "Entire home",
      quantity: "4-6",
      timeWindow: "Within 3 days",
    });

    await expect(page.getByText("Job summary")).toBeVisible();
    await expect(page.getByText("Low pressure").first()).toBeVisible();
    await expect(page.getByText(/1 photo\(s\)|1 attached/i).first()).toBeVisible();
  });

  test("does not reopen job summary after Back to wizard is clicked", async ({ page }) => {
    await openFreshOrdinaryFlow(page);
    await selectCategory(page);
    await answerLocation(page);
    await completeWizardToSummary(page);

    const summaryDrawer = page.locator(".fixed.inset-0.z-50").filter({ hasText: "Job summary" });
    await expect(summaryDrawer).toBeVisible();
    await summaryDrawer.getByRole("button", { name: /^Back to wizard$/i }).click();
    await expect(summaryDrawer).toBeHidden();
    await page.waitForTimeout(1500);
    await expect(summaryDrawer).toBeHidden();
    await expect(page.getByText(/Anything else we should know\?|Upload photo evidence/i).first()).toBeVisible();
  });
});
