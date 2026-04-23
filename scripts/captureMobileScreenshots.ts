import { mkdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { chromium, devices, type BrowserContext, type Page } from "playwright";

const WEB_URL = "http://127.0.0.1:19006";
const API_URL = "http://127.0.0.1:5000";
const STORAGE_KEYS = {
  accessToken: "cityconnect.mobile.accessToken",
  refreshToken: "cityconnect.mobile.refreshToken",
  user: "cityconnect.mobile.user",
};

type SeedManifest = {
  resident: {
    email: string;
    password: string;
    accessCode?: string | null;
  };
  provider: {
    email: string;
    password: string;
  };
  requestIds: {
    residentDetail: string;
    providerDetail: string;
  };
};

async function waitForApp(page: Page) {
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(800);
}

async function capture(page: Page, dir: string, name: string) {
  await waitForApp(page);
  await page.screenshot({
    path: join(dir, `${name}.png`),
    fullPage: true,
  });
}

async function authenticate(page: Page, email: string, password: string) {
  const response = await fetch(`${API_URL}/api/mobile/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ identifier: email, password }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed mobile login for ${email}: ${response.status} ${text}`);
  }

  const payload = await response.json();

  await page.addInitScript(
    ([keys, authPayload]) => {
      localStorage.setItem(keys.accessToken, authPayload.accessToken);
      localStorage.setItem(keys.refreshToken, authPayload.refreshToken);
      localStorage.setItem(keys.user, JSON.stringify(authPayload.user));
    },
    [STORAGE_KEYS, payload] as const,
  );
}

async function createContext(browser: any) {
  return browser.newContext({
    ...devices["Pixel 7"],
    viewport: { width: 412, height: 915 },
    colorScheme: "light",
  });
}

async function main() {
  const outputDir = join(process.cwd(), "output", "playwright", "mobile-screenshots");
  await mkdir(outputDir, { recursive: true });

  const manifest = JSON.parse(
    await readFile(join(process.cwd(), "output", "playwright", "mobile-screenshot-seed.json"), "utf8"),
  ) as SeedManifest;

  const browser = await chromium.launch({ headless: true });

  try {
    const authContext = await createContext(browser);
    const authPage = await authContext.newPage();

    await authPage.goto(`${WEB_URL}/login`);
    await capture(authPage, outputDir, "auth-login");

    await authPage.goto(`${WEB_URL}/register`);
    await capture(authPage, outputDir, "auth-register-welcome");
    await authPage.getByText("Get started").click();
    await capture(authPage, outputDir, "auth-register-role");
    await authPage.getByText("Continue").click();
    await capture(authPage, outputDir, "auth-register-info");
    await authPage.getByPlaceholder("e.g. Julian Rivers").fill("Julian Rivers");
    await authPage.getByPlaceholder("hello@cityconnect.com").fill("demo@cityconnect.local");
    const phoneField = authPage.getByPlaceholder("+234...");
    await phoneField.fill("08000000000");
    await authPage.getByPlaceholder("Create a password").fill("password123");
    await authPage.getByText("Continue").click();
    await capture(authPage, outputDir, "auth-register-details");
    await authPage.goto(`${WEB_URL}/provider-pending?email=provider.mobile@cityconnect.local`);
    await capture(authPage, outputDir, "auth-provider-pending");
    await authContext.close();

    const residentContext = await createContext(browser);
    const residentPage = await residentContext.newPage();
    await authenticate(residentPage, manifest.resident.email, manifest.resident.password);

    await residentPage.goto(`${WEB_URL}/`);
    await capture(residentPage, outputDir, "resident-home");
    await residentPage.goto(`${WEB_URL}/requests`);
    await capture(residentPage, outputDir, "resident-requests");
    await residentPage.goto(`${WEB_URL}/request-flow`);
    await capture(residentPage, outputDir, "resident-request-flow");
    await residentPage.goto(`${WEB_URL}/request-detail?requestId=${manifest.requestIds.residentDetail}`);
    await capture(residentPage, outputDir, "resident-request-detail");
    await residentPage.goto(`${WEB_URL}/maintenance`);
    await capture(residentPage, outputDir, "resident-maintenance");
    await residentPage.goto(`${WEB_URL}/notifications`);
    await capture(residentPage, outputDir, "resident-notifications");
    await residentPage.goto(`${WEB_URL}/profile`);
    await capture(residentPage, outputDir, "resident-profile");
    await residentContext.close();

    const providerContext = await createContext(browser);
    const providerPage = await providerContext.newPage();
    await authenticate(providerPage, manifest.provider.email, manifest.provider.password);

    await providerPage.goto(`${WEB_URL}/`);
    await capture(providerPage, outputDir, "provider-home");
    await providerPage.goto(`${WEB_URL}/jobs`);
    await capture(providerPage, outputDir, "provider-jobs");
    await providerPage.goto(`${WEB_URL}/job-detail?requestId=${manifest.requestIds.providerDetail}`);
    await capture(providerPage, outputDir, "provider-job-detail");
    await providerPage.goto(`${WEB_URL}/tasks`);
    await capture(providerPage, outputDir, "provider-tasks");
    await providerPage.goto(`${WEB_URL}/maintenance`);
    await capture(providerPage, outputDir, "provider-maintenance");
    await providerPage.goto(`${WEB_URL}/notifications`);
    await capture(providerPage, outputDir, "provider-notifications");
    await providerPage.goto(`${WEB_URL}/profile`);
    await capture(providerPage, outputDir, "provider-profile");
    await providerContext.close();
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
