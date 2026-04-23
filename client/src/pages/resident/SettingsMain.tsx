
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { ProfilePics } from "@/components/ui/ProfilePics";
import { useProfile } from "@/contexts/ProfileContext";

type SettingsProfile = {
  firstName: string;
  lastName: string;
  username: string | null;
  email: string;
  phone: string;
  profileImage: string | null;
  bio: string | null;
  website: string | null;
  countryCode: string | null;
  timezone: string | null;
  lastUpdatedAt: string | null;
};

type SettingsNotificationEvent = {
  eventKey:
    | "provider_assigned"
    | "inspection_scheduled"
    | "report_ready"
    | "payment_requested"
    | "status_changed"
    | "job_completed"
    | "refund_update"
    | "new_message"
    | "system_announcements";
  inApp: boolean;
  email: boolean;
  sms: boolean;
};

type SettingsNotifications = {
  quietHoursEnabled: boolean;
  quietHoursStart: string | null;
  quietHoursEnd: string | null;
  digestFrequency: "off" | "daily" | "weekly";
  events: SettingsNotificationEvent[];
};

type SettingsPrivacy = {
  profileVisibility: "private" | "contacts" | "public";
  showPhoneToProvider: boolean;
  showEmailToProvider: boolean;
  allowMarketing: boolean;
  allowAnalytics: boolean;
  allowPersonalization: boolean;
};

type SettingsSecuritySession = {
  id: string;
  isCurrent: boolean;
  userAgent: string;
  ipAddress: string;
  lastSeenAt: string | null;
  createdAt: string | null;
};

type SettingsSecurity = {
  loginAlertsEnabled: boolean;
  sessions: SettingsSecuritySession[];
};

type SettingsPayload = {
  profile: SettingsProfile;
  notifications: SettingsNotifications;
  privacy: SettingsPrivacy;
  security: SettingsSecurity;
};

type ErrorMap = Record<string, string>;

type TabKey = "profile" | "notifications" | "privacy" | "security";

const TAB_ITEMS: Array<{ key: TabKey; label: string }> = [
  { key: "profile", label: "Profile" },
  { key: "notifications", label: "Notifications" },
  { key: "privacy", label: "Privacy" },
  { key: "security", label: "Security" },
];

const EVENT_KEYS: SettingsNotificationEvent["eventKey"][] = [
  "provider_assigned",
  "inspection_scheduled",
  "report_ready",
  "payment_requested",
  "status_changed",
  "job_completed",
  "refund_update",
  "new_message",
  "system_announcements",
];

const EVENT_LABELS: Record<SettingsNotificationEvent["eventKey"], string> = {
  provider_assigned: "Provider assigned",
  inspection_scheduled: "Inspection scheduled",
  report_ready: "Report ready",
  payment_requested: "Payment requested",
  status_changed: "Status changed",
  job_completed: "Job completed",
  refund_update: "Refund update",
  new_message: "New message",
  system_announcements: "System announcements",
};

const COMMON_TIMEZONES = [
  "Africa/Lagos",
  "Africa/Accra",
  "Europe/London",
  "Europe/Paris",
  "America/New_York",
  "America/Chicago",
  "America/Los_Angeles",
  "Asia/Dubai",
  "Asia/Singapore",
  "Asia/Tokyo",
];

const defaultSettings: SettingsPayload = {
  profile: {
    firstName: "",
    lastName: "",
    username: null,
    email: "",
    phone: "",
    profileImage: null,
    bio: null,
    website: null,
    countryCode: "NG",
    timezone: "Africa/Lagos",
    lastUpdatedAt: null,
  },
  notifications: {
    quietHoursEnabled: false,
    quietHoursStart: null,
    quietHoursEnd: null,
    digestFrequency: "off",
    events: EVENT_KEYS.map((eventKey) => ({
      eventKey,
      inApp: true,
      email: false,
      sms: false,
    })),
  },
  privacy: {
    profileVisibility: "private",
    showPhoneToProvider: false,
    showEmailToProvider: false,
    allowMarketing: false,
    allowAnalytics: true,
    allowPersonalization: true,
  },
  security: {
    loginAlertsEnabled: true,
    sessions: [],
  },
};

function isEqual(a: unknown, b: unknown) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function parseFieldErrors(rawError: any): ErrorMap {
  const out: ErrorMap = {};
  const text = String(rawError?.message || "");
  const bodyStart = text.indexOf("\n");
  if (bodyStart < 0) return out;
  try {
    const payload = JSON.parse(text.slice(bodyStart + 1));
    const fields = payload?.error?.fieldErrors || payload?.fieldErrors || {};
    for (const [key, value] of Object.entries(fields)) {
      if (Array.isArray(value) && value.length > 0) {
        out[key] = String(value[0]);
      }
    }
    if (!Object.keys(out).length && payload?.error?.message) {
      out.general = String(payload.error.message);
    }
  } catch {
    // no-op
  }
  return out;
}

function formatDate(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString();
}

function ActionButton({
  label,
  onClick,
  disabled,
  variant = "primary",
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  variant?: "primary" | "secondary" | "danger";
}) {
  const base = "rounded-lg px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60";
  const classes =
    variant === "primary"
      ? "bg-[#039855] text-white hover:bg-[#027a48]"
      : variant === "danger"
        ? "bg-[#d92d20] text-white hover:bg-[#b42318]"
        : "border border-[#D0D5DD] bg-white text-[#344054] hover:bg-[#F9FAFB]";
  return (
    <button type="button" className={`${base} ${classes}`} onClick={onClick} disabled={disabled}>
      {label}
    </button>
  );
}
export default function SettingsMain() {
  const { toast } = useToast();
  const { setFirstName, setLastName, setEmail, setPhone, setProfileImage, refreshProfile } = useProfile();
  const [activeTab, setActiveTab] = useState<TabKey>("profile");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<TabKey | null>(null);
  const [errors, setErrors] = useState<ErrorMap>({});

  const [settings, setSettings] = useState<SettingsPayload>(defaultSettings);
  const [profileDraft, setProfileDraft] = useState<SettingsProfile>(defaultSettings.profile);
  const [notificationsDraft, setNotificationsDraft] = useState<SettingsNotifications>(defaultSettings.notifications);
  const [privacyDraft, setPrivacyDraft] = useState<SettingsPrivacy>(defaultSettings.privacy);
  const [securityDraft, setSecurityDraft] = useState<SettingsSecurity>(defaultSettings.security);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const loadSettings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiRequest("GET", "/api/app/settings");
      const data = (await res.json()) as SettingsPayload;
      const normalized: SettingsPayload = {
        profile: { ...defaultSettings.profile, ...(data?.profile || {}) },
        notifications: {
          ...defaultSettings.notifications,
          ...(data?.notifications || {}),
          events:
            Array.isArray(data?.notifications?.events) && data.notifications.events.length > 0
              ? data.notifications.events
              : defaultSettings.notifications.events,
        },
        privacy: { ...defaultSettings.privacy, ...(data?.privacy || {}) },
        security: {
          ...defaultSettings.security,
          ...(data?.security || {}),
          sessions: Array.isArray(data?.security?.sessions) ? data.security.sessions : [],
        },
      };
      setSettings(normalized);
      setProfileDraft(normalized.profile);
      setNotificationsDraft(normalized.notifications);
      setPrivacyDraft(normalized.privacy);
      setSecurityDraft(normalized.security);
    } catch (error: any) {
      toast({
        title: "Could not load settings",
        description: error?.message || "Please refresh and try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  const profileDirty = useMemo(() => !isEqual(profileDraft, settings.profile), [profileDraft, settings.profile]);
  const notificationsDirty = useMemo(
    () => !isEqual(notificationsDraft, settings.notifications),
    [notificationsDraft, settings.notifications],
  );
  const privacyDirty = useMemo(() => !isEqual(privacyDraft, settings.privacy), [privacyDraft, settings.privacy]);
  const securityDirty = useMemo(
    () => securityDraft.loginAlertsEnabled !== settings.security.loginAlertsEnabled,
    [securityDraft.loginAlertsEnabled, settings.security.loginAlertsEnabled],
  );

  const syncProfileContext = useCallback(
    async (nextProfile: SettingsProfile) => {
      setFirstName(nextProfile.firstName || "");
      setLastName(nextProfile.lastName || "");
      setEmail(nextProfile.email || "");
      setPhone(nextProfile.phone || "");
      setProfileImage(nextProfile.profileImage || null);
      await refreshProfile();
    },
    [refreshProfile, setEmail, setFirstName, setLastName, setPhone, setProfileImage],
  );

  const handleProfileSave = async () => {
    setSaving("profile");
    setErrors({});
    try {
      const res = await apiRequest("PATCH", "/api/app/settings/profile", {
        firstName: profileDraft.firstName,
        lastName: profileDraft.lastName,
        username: profileDraft.username || "",
        email: profileDraft.email,
        phone: profileDraft.phone,
        profileImage: profileDraft.profileImage || "",
        bio: profileDraft.bio || "",
        website: profileDraft.website || "",
        countryCode: profileDraft.countryCode || "",
        timezone: profileDraft.timezone || "",
      });
      const payload = await res.json();
      const nextProfile: SettingsProfile = { ...profileDraft, ...(payload?.profile || {}) };
      setSettings((prev) => ({ ...prev, profile: nextProfile }));
      setProfileDraft(nextProfile);
      await syncProfileContext(nextProfile);
      toast({ title: "Profile updated" });
    } catch (error: any) {
      const parsedErrors = parseFieldErrors(error);
      setErrors(parsedErrors);
      toast({
        title: "Profile update failed",
        description: parsedErrors.email || parsedErrors.username || error?.message || "Please review the form.",
        variant: "destructive",
      });
    } finally {
      setSaving(null);
    }
  };

  const handleNotificationsSave = async () => {
    setSaving("notifications");
    setErrors({});
    try {
      const res = await apiRequest("PATCH", "/api/app/settings/notifications", notificationsDraft);
      const payload = await res.json();
      const nextValue: SettingsNotifications = payload?.notifications || notificationsDraft;
      setSettings((prev) => ({ ...prev, notifications: nextValue }));
      setNotificationsDraft(nextValue);
      toast({ title: "Notification settings updated" });
    } catch (error: any) {
      const parsedErrors = parseFieldErrors(error);
      setErrors(parsedErrors);
      toast({
        title: "Could not update notifications",
        description: parsedErrors.quietHoursStart || parsedErrors.general || error?.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(null);
    }
  };

  const handlePrivacySave = async () => {
    setSaving("privacy");
    try {
      const res = await apiRequest("PATCH", "/api/app/settings/privacy", privacyDraft);
      const payload = await res.json();
      const nextValue: SettingsPrivacy = payload?.privacy || privacyDraft;
      setSettings((prev) => ({ ...prev, privacy: nextValue }));
      setPrivacyDraft(nextValue);
      toast({ title: "Privacy settings updated" });
    } catch (error: any) {
      toast({
        title: "Could not update privacy settings",
        description: error?.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(null);
    }
  };

  const handleSecuritySave = async () => {
    setSaving("security");
    try {
      const res = await apiRequest("PATCH", "/api/app/settings/security", {
        loginAlertsEnabled: securityDraft.loginAlertsEnabled,
      });
      const payload = await res.json();
      const nextValue: SettingsSecurity = {
        ...settings.security,
        ...(payload?.security || {}),
      };
      setSettings((prev) => ({ ...prev, security: nextValue }));
      setSecurityDraft(nextValue);
      toast({ title: "Security preferences updated" });
    } catch (error: any) {
      toast({
        title: "Could not update security settings",
        description: error?.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(null);
    }
  };

  const refreshSessions = async () => {
    const res = await apiRequest("GET", "/api/app/settings/security/sessions");
    const payload = await res.json();
    const sessions = Array.isArray(payload?.sessions) ? payload.sessions : [];
    const loginAlertsEnabled = Boolean(payload?.loginAlertsEnabled ?? securityDraft.loginAlertsEnabled);
    const nextSecurity: SettingsSecurity = {
      ...securityDraft,
      sessions,
      loginAlertsEnabled,
    };
    setSecurityDraft(nextSecurity);
    setSettings((prev) => ({
      ...prev,
      security: {
        ...prev.security,
        sessions,
        loginAlertsEnabled,
      },
    }));
  };
  const handleChangePassword = async () => {
    setErrors({});
    if (!currentPassword || !newPassword) {
      setErrors({
        currentPassword: !currentPassword ? "Current password is required" : "",
        newPassword: !newPassword ? "New password is required" : "",
      });
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrors({ newPassword: "Passwords do not match" });
      return;
    }

    setSaving("security");
    try {
      await apiRequest("POST", "/api/app/settings/security/change-password", {
        currentPassword,
        newPassword,
      });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast({ title: "Password changed successfully" });
    } catch (error: any) {
      const parsedErrors = parseFieldErrors(error);
      setErrors(parsedErrors);
      toast({
        title: "Password change failed",
        description: parsedErrors.currentPassword || parsedErrors.newPassword || error?.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(null);
    }
  };

  const handleRevokeSession = async (sessionId: string) => {
    try {
      await apiRequest("DELETE", `/api/app/settings/security/sessions/${sessionId}`);
      await refreshSessions();
      toast({ title: "Session revoked" });
    } catch (error: any) {
      toast({
        title: "Could not revoke session",
        description: error?.message || "Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleRevokeOthers = async () => {
    try {
      const res = await apiRequest("POST", "/api/app/settings/security/sessions/revoke-others", {});
      const payload = await res.json();
      await refreshSessions();
      toast({ title: `Revoked ${Number(payload?.revokedCount || 0)} session(s)` });
    } catch (error: any) {
      toast({
        title: "Could not revoke other sessions",
        description: error?.message || "Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleDataExportRequest = async () => {
    try {
      await apiRequest("POST", "/api/app/settings/privacy/request-data-export", {});
      toast({ title: "Data export request submitted" });
    } catch (error: any) {
      toast({
        title: "Could not submit request",
        description: error?.message || "Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleDeletionRequest = async () => {
    try {
      await apiRequest("POST", "/api/app/settings/privacy/request-account-deletion", {
        reason: "Resident requested account deletion from settings.",
      });
      toast({ title: "Account deletion request submitted for review" });
    } catch (error: any) {
      toast({
        title: "Could not submit request",
        description: error?.message || "Please try again.",
        variant: "destructive",
      });
    }
  };

  const onSelectProfileImage = (file: File | null) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      if (!result) return;
      setProfileDraft((prev) => ({ ...prev, profileImage: result }));
    };
    reader.readAsDataURL(file);
  };

  if (loading) {
    return (
      <div className="h-full w-full rounded-bl-[40px] rounded-tl-[40px] bg-white px-8 py-12">
        <p className="text-sm text-[#667085]">Loading settings...</p>
      </div>
    );
  }

  return (
    <div className="h-full w-full overflow-y-auto rounded-bl-[40px] rounded-tl-[40px] bg-white px-4 py-6 sm:px-8">
      <div className="mx-auto w-full max-w-[1120px]">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-[30px] font-semibold text-[#101828]">Resident settings</h1>
            <p className="mt-1 text-sm text-[#667085]">Control your profile, privacy, notifications, and account security.</p>
          </div>
          {settings.profile.lastUpdatedAt ? (
            <p className="rounded-full border border-[#E4E7EC] bg-[#F9FAFB] px-3 py-1 text-xs font-medium text-[#475467]">
              Last updated: {formatDate(settings.profile.lastUpdatedAt)}
            </p>
          ) : null}
        </div>

        <div className="mb-6 flex flex-wrap gap-2 rounded-xl border border-[#EAECF0] bg-[#F9FAFB] p-2">
          {TAB_ITEMS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
                activeTab === tab.key ? "bg-white text-[#101828] shadow-sm" : "text-[#667085] hover:text-[#344054]"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === "profile" ? (
          <section className="rounded-2xl border border-[#EAECF0] bg-white p-5 sm:p-6">
            <div className="mb-6 flex flex-wrap items-center gap-4">
              <ProfilePics size={72} customImage={profileDraft.profileImage} />
              <div className="flex items-center gap-2">
                <ActionButton label="Upload photo" variant="secondary" onClick={() => fileInputRef.current?.click()} />
                <ActionButton
                  label="Remove"
                  variant="secondary"
                  onClick={() => setProfileDraft((prev) => ({ ...prev, profileImage: null }))}
                  disabled={!profileDraft.profileImage}
                />
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(event) => onSelectProfileImage(event.target.files?.[0] || null)}
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="space-y-1">
                <span className="text-sm font-medium text-[#344054]">First name</span>
                <input
                  value={profileDraft.firstName}
                  onChange={(event) => setProfileDraft((prev) => ({ ...prev, firstName: event.target.value }))}
                  className="w-full rounded-lg border border-[#D0D5DD] px-3 py-2 text-sm outline-none focus:border-[#039855]"
                />
                {errors.firstName ? <p className="text-xs text-[#d92d20]">{errors.firstName}</p> : null}
              </label>

              <label className="space-y-1">
                <span className="text-sm font-medium text-[#344054]">Last name</span>
                <input
                  value={profileDraft.lastName}
                  onChange={(event) => setProfileDraft((prev) => ({ ...prev, lastName: event.target.value }))}
                  className="w-full rounded-lg border border-[#D0D5DD] px-3 py-2 text-sm outline-none focus:border-[#039855]"
                />
                {errors.lastName ? <p className="text-xs text-[#d92d20]">{errors.lastName}</p> : null}
              </label>

              <label className="space-y-1">
                <span className="text-sm font-medium text-[#344054]">Username</span>
                <input
                  value={profileDraft.username || ""}
                  onChange={(event) => setProfileDraft((prev) => ({ ...prev, username: event.target.value || null }))}
                  className="w-full rounded-lg border border-[#D0D5DD] px-3 py-2 text-sm outline-none focus:border-[#039855]"
                />
                {errors.username ? <p className="text-xs text-[#d92d20]">{errors.username}</p> : null}
              </label>

              <label className="space-y-1">
                <span className="text-sm font-medium text-[#344054]">Email</span>
                <input
                  value={profileDraft.email}
                  onChange={(event) => setProfileDraft((prev) => ({ ...prev, email: event.target.value }))}
                  className="w-full rounded-lg border border-[#D0D5DD] px-3 py-2 text-sm outline-none focus:border-[#039855]"
                />
                {errors.email ? <p className="text-xs text-[#d92d20]">{errors.email}</p> : null}
              </label>

              <label className="space-y-1">
                <span className="text-sm font-medium text-[#344054]">Phone</span>
                <input
                  value={profileDraft.phone}
                  onChange={(event) => setProfileDraft((prev) => ({ ...prev, phone: event.target.value }))}
                  placeholder="+2348012345678"
                  className="w-full rounded-lg border border-[#D0D5DD] px-3 py-2 text-sm outline-none focus:border-[#039855]"
                />
                {errors.phone ? <p className="text-xs text-[#d92d20]">{errors.phone}</p> : null}
              </label>

              <label className="space-y-1">
                <span className="text-sm font-medium text-[#344054]">Country code</span>
                <input
                  value={profileDraft.countryCode || ""}
                  onChange={(event) =>
                    setProfileDraft((prev) => ({ ...prev, countryCode: event.target.value.toUpperCase() || null }))
                  }
                  maxLength={2}
                  className="w-full rounded-lg border border-[#D0D5DD] px-3 py-2 text-sm uppercase outline-none focus:border-[#039855]"
                />
                {errors.countryCode ? <p className="text-xs text-[#d92d20]">{errors.countryCode}</p> : null}
              </label>

              <label className="space-y-1">
                <span className="text-sm font-medium text-[#344054]">Timezone</span>
                <input
                  list="settings-timezones"
                  value={profileDraft.timezone || ""}
                  onChange={(event) => setProfileDraft((prev) => ({ ...prev, timezone: event.target.value || null }))}
                  className="w-full rounded-lg border border-[#D0D5DD] px-3 py-2 text-sm outline-none focus:border-[#039855]"
                />
                <datalist id="settings-timezones">
                  {COMMON_TIMEZONES.map((tz) => (
                    <option key={tz} value={tz} />
                  ))}
                </datalist>
                {errors.timezone ? <p className="text-xs text-[#d92d20]">{errors.timezone}</p> : null}
              </label>

              <label className="space-y-1 sm:col-span-2">
                <span className="text-sm font-medium text-[#344054]">Website</span>
                <input
                  value={profileDraft.website || ""}
                  onChange={(event) => setProfileDraft((prev) => ({ ...prev, website: event.target.value || null }))}
                  placeholder="https://example.com"
                  className="w-full rounded-lg border border-[#D0D5DD] px-3 py-2 text-sm outline-none focus:border-[#039855]"
                />
                {errors.website ? <p className="text-xs text-[#d92d20]">{errors.website}</p> : null}
              </label>

              <label className="space-y-1 sm:col-span-2">
                <span className="text-sm font-medium text-[#344054]">Bio</span>
                <textarea
                  value={profileDraft.bio || ""}
                  onChange={(event) => setProfileDraft((prev) => ({ ...prev, bio: event.target.value || null }))}
                  rows={4}
                  className="w-full rounded-lg border border-[#D0D5DD] px-3 py-2 text-sm outline-none focus:border-[#039855]"
                />
                {errors.bio ? <p className="text-xs text-[#d92d20]">{errors.bio}</p> : null}
              </label>
            </div>

            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <ActionButton
                label="Cancel"
                variant="secondary"
                onClick={() => {
                  setErrors({});
                  setProfileDraft(settings.profile);
                }}
                disabled={!profileDirty || saving === "profile"}
              />
              <ActionButton
                label={saving === "profile" ? "Saving..." : "Save profile"}
                onClick={handleProfileSave}
                disabled={!profileDirty || saving === "profile"}
              />
            </div>
          </section>
        ) : null}

        {activeTab === "notifications" ? (
          <section className="space-y-5 rounded-2xl border border-[#EAECF0] bg-white p-5 sm:p-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <label className="space-y-1">
                <span className="text-sm font-medium text-[#344054]">Digest frequency</span>
                <select
                  value={notificationsDraft.digestFrequency}
                  onChange={(event) =>
                    setNotificationsDraft((prev) => ({
                      ...prev,
                      digestFrequency: event.target.value as SettingsNotifications["digestFrequency"],
                    }))
                  }
                  className="w-full rounded-lg border border-[#D0D5DD] px-3 py-2 text-sm outline-none focus:border-[#039855]"
                >
                  <option value="off">Off</option>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                </select>
              </label>

              <label className="flex items-center gap-2 rounded-lg border border-[#EAECF0] px-3 py-2 text-sm font-medium text-[#344054] sm:col-span-2">
                <input
                  type="checkbox"
                  checked={notificationsDraft.quietHoursEnabled}
                  onChange={(event) =>
                    setNotificationsDraft((prev) => ({ ...prev, quietHoursEnabled: event.target.checked }))
                  }
                />
                Enable quiet hours
              </label>

              <label className="space-y-1">
                <span className="text-sm font-medium text-[#344054]">Quiet hours start</span>
                <input
                  type="time"
                  value={notificationsDraft.quietHoursStart || ""}
                  onChange={(event) =>
                    setNotificationsDraft((prev) => ({ ...prev, quietHoursStart: event.target.value || null }))
                  }
                  className="w-full rounded-lg border border-[#D0D5DD] px-3 py-2 text-sm outline-none focus:border-[#039855]"
                />
              </label>

              <label className="space-y-1">
                <span className="text-sm font-medium text-[#344054]">Quiet hours end</span>
                <input
                  type="time"
                  value={notificationsDraft.quietHoursEnd || ""}
                  onChange={(event) =>
                    setNotificationsDraft((prev) => ({ ...prev, quietHoursEnd: event.target.value || null }))
                  }
                  className="w-full rounded-lg border border-[#D0D5DD] px-3 py-2 text-sm outline-none focus:border-[#039855]"
                />
              </label>
            </div>

            {errors.quietHoursStart ? <p className="text-xs text-[#d92d20]">{errors.quietHoursStart}</p> : null}

            <div className="overflow-x-auto rounded-xl border border-[#EAECF0]">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-[#F9FAFB] text-[#475467]">
                  <tr>
                    <th className="px-3 py-2 font-semibold">Event</th>
                    <th className="px-3 py-2 font-semibold">In-app</th>
                    <th className="px-3 py-2 font-semibold">Email</th>
                    <th className="px-3 py-2 font-semibold">SMS</th>
                  </tr>
                </thead>
                <tbody>
                  {notificationsDraft.events.map((event) => (
                    <tr key={event.eventKey} className="border-t border-[#F2F4F7]">
                      <td className="px-3 py-2 font-medium text-[#101828]">{EVENT_LABELS[event.eventKey]}</td>
                      {(["inApp", "email", "sms"] as const).map((channel) => (
                        <td key={channel} className="px-3 py-2">
                          <input
                            type="checkbox"
                            checked={Boolean(event[channel])}
                            onChange={(checkboxEvent) =>
                              setNotificationsDraft((prev) => ({
                                ...prev,
                                events: prev.events.map((row) =>
                                  row.eventKey === event.eventKey
                                    ? { ...row, [channel]: checkboxEvent.target.checked }
                                    : row,
                                ),
                              }))
                            }
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {errors.events ? <p className="text-xs text-[#d92d20]">{errors.events}</p> : null}

            <div className="flex flex-wrap justify-end gap-2">
              <ActionButton
                label="Cancel"
                variant="secondary"
                onClick={() => {
                  setErrors({});
                  setNotificationsDraft(settings.notifications);
                }}
                disabled={!notificationsDirty || saving === "notifications"}
              />
              <ActionButton
                label={saving === "notifications" ? "Saving..." : "Save notifications"}
                onClick={handleNotificationsSave}
                disabled={!notificationsDirty || saving === "notifications"}
              />
            </div>
          </section>
        ) : null}

        {activeTab === "privacy" ? (
          <section className="space-y-5 rounded-2xl border border-[#EAECF0] bg-white p-5 sm:p-6">
            <label className="space-y-1">
              <span className="text-sm font-medium text-[#344054]">Profile visibility</span>
              <select
                value={privacyDraft.profileVisibility}
                onChange={(event) =>
                  setPrivacyDraft((prev) => ({
                    ...prev,
                    profileVisibility: event.target.value as SettingsPrivacy["profileVisibility"],
                  }))
                }
                className="w-full rounded-lg border border-[#D0D5DD] px-3 py-2 text-sm outline-none focus:border-[#039855]"
              >
                <option value="private">Private</option>
                <option value="contacts">Contacts only</option>
                <option value="public">Public</option>
              </select>
            </label>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {[
                { key: "showPhoneToProvider", label: "Show phone to providers" },
                { key: "showEmailToProvider", label: "Show email to providers" },
                { key: "allowMarketing", label: "Allow marketing updates" },
                { key: "allowAnalytics", label: "Allow analytics" },
                { key: "allowPersonalization", label: "Allow personalization" },
              ].map((item) => (
                <label key={item.key} className="flex items-center gap-2 rounded-lg border border-[#EAECF0] px-3 py-2 text-sm font-medium text-[#344054]">
                  <input
                    type="checkbox"
                    checked={Boolean(privacyDraft[item.key as keyof SettingsPrivacy])}
                    onChange={(event) =>
                      setPrivacyDraft((prev) => ({
                        ...prev,
                        [item.key]: event.target.checked,
                      }))
                    }
                  />
                  {item.label}
                </label>
              ))}
            </div>

            <div className="rounded-xl border border-[#EAECF0] bg-[#F9FAFB] p-4">
              <p className="text-sm font-semibold text-[#344054]">Data controls</p>
              <p className="mt-1 text-sm text-[#667085]">
                Request a full export of your account data or submit an account deletion request for admin review.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <ActionButton label="Request data export" variant="secondary" onClick={handleDataExportRequest} />
                <ActionButton label="Request account deletion" variant="danger" onClick={handleDeletionRequest} />
              </div>
            </div>

            <div className="flex flex-wrap justify-end gap-2">
              <ActionButton
                label="Cancel"
                variant="secondary"
                onClick={() => setPrivacyDraft(settings.privacy)}
                disabled={!privacyDirty || saving === "privacy"}
              />
              <ActionButton
                label={saving === "privacy" ? "Saving..." : "Save privacy"}
                onClick={handlePrivacySave}
                disabled={!privacyDirty || saving === "privacy"}
              />
            </div>
          </section>
        ) : null}

        {activeTab === "security" ? (
          <section className="space-y-5 rounded-2xl border border-[#EAECF0] bg-white p-5 sm:p-6">
            <label className="flex items-center gap-2 rounded-lg border border-[#EAECF0] px-3 py-2 text-sm font-medium text-[#344054]">
              <input
                type="checkbox"
                checked={securityDraft.loginAlertsEnabled}
                onChange={(event) =>
                  setSecurityDraft((prev) => ({
                    ...prev,
                    loginAlertsEnabled: event.target.checked,
                  }))
                }
              />
              Notify me when new devices log in to my account
            </label>

            <div className="rounded-xl border border-[#EAECF0] p-4">
              <h3 className="text-sm font-semibold text-[#344054]">Change password</h3>
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <label className="space-y-1">
                  <span className="text-xs font-medium text-[#475467]">Current password</span>
                  <input
                    type="password"
                    value={currentPassword}
                    onChange={(event) => setCurrentPassword(event.target.value)}
                    className="w-full rounded-lg border border-[#D0D5DD] px-3 py-2 text-sm outline-none focus:border-[#039855]"
                  />
                  {errors.currentPassword ? <p className="text-xs text-[#d92d20]">{errors.currentPassword}</p> : null}
                </label>
                <label className="space-y-1">
                  <span className="text-xs font-medium text-[#475467]">New password</span>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                    className="w-full rounded-lg border border-[#D0D5DD] px-3 py-2 text-sm outline-none focus:border-[#039855]"
                  />
                  {errors.newPassword ? <p className="text-xs text-[#d92d20]">{errors.newPassword}</p> : null}
                </label>
                <label className="space-y-1">
                  <span className="text-xs font-medium text-[#475467]">Confirm new password</span>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    className="w-full rounded-lg border border-[#D0D5DD] px-3 py-2 text-sm outline-none focus:border-[#039855]"
                  />
                </label>
              </div>
              <div className="mt-3 flex justify-end">
                <ActionButton
                  label={saving === "security" ? "Processing..." : "Change password"}
                  onClick={handleChangePassword}
                  disabled={saving === "security"}
                />
              </div>
            </div>

            <div className="rounded-xl border border-[#EAECF0] p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-[#344054]">Active sessions</h3>
                <ActionButton label="Revoke all other sessions" variant="secondary" onClick={handleRevokeOthers} />
              </div>
              <div className="space-y-2">
                {securityDraft.sessions.length === 0 ? (
                  <p className="text-sm text-[#667085]">No active sessions found.</p>
                ) : (
                  securityDraft.sessions.map((session) => (
                    <div key={session.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#EAECF0] p-3">
                      <div>
                        <p className="text-sm font-medium text-[#101828]">
                          {session.userAgent || "Unknown device"}
                          {session.isCurrent ? (
                            <span className="ml-2 rounded-full bg-[#ECFDF3] px-2 py-0.5 text-xs font-semibold text-[#027A48]">
                              Current
                            </span>
                          ) : null}
                        </p>
                        <p className="text-xs text-[#667085]">IP: {session.ipAddress || "n/a"}</p>
                        <p className="text-xs text-[#667085]">Last seen: {formatDate(session.lastSeenAt)}</p>
                      </div>
                      {!session.isCurrent ? (
                        <ActionButton label="Revoke" variant="secondary" onClick={() => void handleRevokeSession(session.id)} />
                      ) : null}
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="flex flex-wrap justify-end gap-2">
              <ActionButton
                label="Cancel"
                variant="secondary"
                onClick={() => setSecurityDraft(settings.security)}
                disabled={!securityDirty || saving === "security"}
              />
              <ActionButton
                label={saving === "security" ? "Saving..." : "Save security"}
                onClick={handleSecuritySave}
                disabled={!securityDirty || saving === "security"}
              />
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}
