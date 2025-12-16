import { test, expect } from '@playwright/test';

const aiMock = {
  summary: 'Power issue detected. Likely loose wiring at the socket.',
  probableCauses: [
    { cause: 'Loose wire at outlet', likelihood: 'high' },
    { cause: 'Faulty breaker', likelihood: 'medium' },
  ],
  severity: 'medium',
  shouldAvoidDIY: false,
  safetyNotes: ['Turn off the main power before touching outlets.'],
  suggestedChecks: ['Try a different outlet', 'Inspect for burn marks'],
  whenToCallPro: 'If smell persists or breaker keeps tripping, call a pro.',
  suggestedCategory: 'electrician',
} as const;

async function fillMinimalValidForm(page: import('@playwright/test').Page) {
  await page.getByPlaceholder('Enter request title').fill('Flickering lights in living room');
  // Category is auto-initialized to first fallback via effect, so skip selecting.
  await page.getByPlaceholder('Describe the issue and what needs fixing').fill('Lights flicker intermittently when AC turns on.');
  // Urgency defaults to medium; date/time optional; special instructions optional.
}

test.describe('Book Artisan - CityBuddy & AI diagnosis', () => {
  test('AI diagnosis shows summary card', async ({ page }) => {
    // Mock AI endpoint
    await page.route('**/api/ai/diagnose', async (route) => {
      const body = await route.request().postDataJSON().catch(() => ({}));
      expect(body).toHaveProperty('category');
      expect(body).toHaveProperty('description');
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(aiMock) });
    });

    // Mock categories to force fallback path or let it 404 naturally — not required.
    await page.goto('/book-artisan');

    await fillMinimalValidForm(page);

    // Trigger AI diagnosis
    await page.getByRole('button', { name: /Ask AI Diagnosis \(Free\)/i }).click();

    // Assert summary card appears
    await expect(page.getByText('AI Diagnosis Summary')).toBeVisible();
    await expect(page.getByText(aiMock.summary)).toBeVisible();
    await expect(page.getByText(/Most likely causes:/i)).toBeVisible();
  });

  test('CityBuddy Diagnosis submits with diagnosisType "regular"', async ({ page }) => {
    let sawRequest = false;

    await page.route('**/api/app/service-requests', async (route) => {
      const req = route.request();
      const payload = await req.postDataJSON().catch(() => ({}));
      // Validate minimal payload
      expect(payload).toMatchObject({
        title: expect.any(String),
        category: expect.any(String),
        description: expect.any(String),
        urgency: expect.any(String),
        diagnosisType: 'regular',
      });
      sawRequest = true;
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
    });

    await page.goto('/book-artisan');
    await fillMinimalValidForm(page);

    // Click CityBuddy submit button
    const cityBuddyBtn = page.getByRole('button', { name: /CityBuddy Diagnosis \(Free\)/i });
    await expect(cityBuddyBtn).toBeVisible();
    await cityBuddyBtn.click();

    // Expect navigation to resident dashboard on success
    await page.waitForURL('**/resident');
    expect(sawRequest).toBeTruthy();
  });
});
