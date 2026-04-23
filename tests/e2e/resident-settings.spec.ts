import { expect, test } from "@playwright/test";

const RESIDENT_EMAIL = "testresident@gmail.com";

type SettingsEvent = {
  eventKey: string;
  inApp: boolean;
  email: boolean;
  sms: boolean;
};

function authHeaders() {
  return { "x-user-email": RESIDENT_EMAIL };
}

function sanitizeEvents(events: SettingsEvent[]) {
  return events.map((event) => {
    if (event.inApp || event.email || event.sms) return event;
    return { ...event, inApp: true };
  });
}

test.describe("Resident settings", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 1000 });
    await page.context().setExtraHTTPHeaders(authHeaders());
    await page.addInitScript((email: string) => {
      window.localStorage.setItem("dev_user_email", email);
      window.localStorage.setItem("resident_email_dev", email);
    }, RESIDENT_EMAIL);
  });

  test("settings API profile/notifications/privacy/security round-trip", async ({ page }) => {
    const request = page.context().request;

    const initialRes = await request.get("/api/app/settings", { headers: authHeaders() });
    expect(initialRes.ok()).toBeTruthy();
    const initial = (await initialRes.json()) as any;

    const initialProfile = initial.profile;
    const initialNotifications = initial.notifications;
    const initialPrivacy = initial.privacy;
    const initialSecurity = initial.security;

    const nextBio = `Resident settings smoke ${Date.now()}`;
    const providerAssignedInitial =
      (initialNotifications.events as SettingsEvent[]).find((event) => event.eventKey === "provider_assigned") ||
      null;

    try {
      const patchProfileRes = await request.patch("/api/app/settings/profile", {
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        data: { bio: nextBio },
      });
      expect(patchProfileRes.ok()).toBeTruthy();
      const patchProfilePayload = await patchProfileRes.json();
      expect(patchProfilePayload?.profile?.bio).toBe(nextBio);

      const patchNotificationsRes = await request.patch("/api/app/settings/notifications", {
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        data: {
          quietHoursEnabled: true,
          quietHoursStart: "22:00",
          quietHoursEnd: "06:00",
          digestFrequency: "daily",
          events: [{ eventKey: "provider_assigned", inApp: true, email: true, sms: false }],
        },
      });
      expect(patchNotificationsRes.ok()).toBeTruthy();
      const patchNotificationsPayload = await patchNotificationsRes.json();
      expect(patchNotificationsPayload?.notifications?.quietHoursEnabled).toBe(true);
      expect(patchNotificationsPayload?.notifications?.digestFrequency).toBe("daily");
      const providerAssignedPatched = (patchNotificationsPayload?.notifications?.events as SettingsEvent[]).find(
        (event) => event.eventKey === "provider_assigned",
      );
      expect(providerAssignedPatched?.email).toBe(true);

      const patchPrivacyRes = await request.patch("/api/app/settings/privacy", {
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        data: {
          ...initialPrivacy,
          allowMarketing: !Boolean(initialPrivacy.allowMarketing),
        },
      });
      expect(patchPrivacyRes.ok()).toBeTruthy();
      const patchPrivacyPayload = await patchPrivacyRes.json();
      expect(patchPrivacyPayload?.privacy?.allowMarketing).toBe(!Boolean(initialPrivacy.allowMarketing));

      const patchSecurityRes = await request.patch("/api/app/settings/security", {
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        data: {
          loginAlertsEnabled: !Boolean(initialSecurity.loginAlertsEnabled),
        },
      });
      expect(patchSecurityRes.ok()).toBeTruthy();
      const patchSecurityPayload = await patchSecurityRes.json();
      expect(patchSecurityPayload?.security?.loginAlertsEnabled).toBe(!Boolean(initialSecurity.loginAlertsEnabled));

      const wrongPasswordRes = await request.post("/api/app/settings/security/change-password", {
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        data: {
          currentPassword: "WrongCurrentPassword123!",
          newPassword: "NewPassword123!",
        },
      });
      expect(wrongPasswordRes.status()).toBe(422);

      const sessionsRes = await request.get("/api/app/settings/security/sessions", {
        headers: authHeaders(),
      });
      expect(sessionsRes.ok()).toBeTruthy();
      const sessionsPayload = await sessionsRes.json();
      expect(Array.isArray(sessionsPayload?.sessions)).toBeTruthy();
      expect(sessionsPayload.sessions.length).toBeGreaterThan(0);
      expect(sessionsPayload.sessions.some((session: any) => Boolean(session.isCurrent))).toBeTruthy();

      const revokeOthersRes = await request.post("/api/app/settings/security/sessions/revoke-others", {
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        data: {},
      });
      expect(revokeOthersRes.ok()).toBeTruthy();
      const revokeOthersPayload = await revokeOthersRes.json();
      expect(typeof revokeOthersPayload?.revokedCount).toBe("number");

      const finalGetRes = await request.get("/api/app/settings", { headers: authHeaders() });
      expect(finalGetRes.ok()).toBeTruthy();
      const finalPayload = await finalGetRes.json();
      expect(finalPayload?.profile?.bio).toBe(nextBio);
      expect(finalPayload?.notifications?.quietHoursEnabled).toBe(true);
      expect(finalPayload?.privacy?.allowMarketing).toBe(!Boolean(initialPrivacy.allowMarketing));
      expect(finalPayload?.security?.loginAlertsEnabled).toBe(!Boolean(initialSecurity.loginAlertsEnabled));

      const compatGetProfileRes = await request.get("/api/app/profile", { headers: authHeaders() });
      expect(compatGetProfileRes.ok()).toBeTruthy();
      const compatProfilePayload = await compatGetProfileRes.json();
      expect(String(compatProfilePayload?.email || "").toLowerCase()).toBe(RESIDENT_EMAIL);

      const compatPatchProfileRes = await request.patch("/api/app/profile", {
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        data: { bio: nextBio },
      });
      expect(compatPatchProfileRes.ok()).toBeTruthy();
      const compatPatchedProfile = await compatPatchProfileRes.json();
      expect(compatPatchedProfile?.bio).toBe(nextBio);
    } finally {
      await request.patch("/api/app/settings/profile", {
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        data: { bio: initialProfile?.bio || "" },
      });

      await request.patch("/api/app/settings/notifications", {
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        data: {
          quietHoursEnabled: Boolean(initialNotifications?.quietHoursEnabled),
          quietHoursStart: initialNotifications?.quietHoursStart || null,
          quietHoursEnd: initialNotifications?.quietHoursEnd || null,
          digestFrequency: initialNotifications?.digestFrequency || "off",
          events: sanitizeEvents((initialNotifications?.events || []) as SettingsEvent[]),
        },
      });

      await request.patch("/api/app/settings/privacy", {
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        data: initialPrivacy,
      });

      await request.patch("/api/app/settings/security", {
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        data: { loginAlertsEnabled: Boolean(initialSecurity?.loginAlertsEnabled) },
      });

      if (providerAssignedInitial) {
        await request.patch("/api/app/settings/notifications", {
          headers: { ...authHeaders(), "Content-Type": "application/json" },
          data: {
            events: [providerAssignedInitial],
          },
        });
      }
    }
  });

  test("settings UI renders tabs and supports cancel reset", async ({ page }) => {
    await page.goto("/resident/settings", { waitUntil: "domcontentloaded", timeout: 30000 });

    await expect(page.getByRole("heading", { name: /Resident settings/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Profile$/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Notifications$/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Privacy$/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Security$/ })).toBeVisible();

    await page.getByRole("button", { name: /^Notifications$/ }).click();
    await expect(page.getByText("Provider assigned")).toBeVisible();

    const quietHoursToggle = page
      .locator("label")
      .filter({ hasText: /Enable quiet hours/i })
      .locator('input[type="checkbox"]');
    const initialQuietHoursState = await quietHoursToggle.isChecked();

    await quietHoursToggle.click();
    await page.getByRole("button", { name: "Cancel" }).click();

    if (initialQuietHoursState) {
      await expect(quietHoursToggle).toBeChecked();
    } else {
      await expect(quietHoursToggle).not.toBeChecked();
    }
  });
});
