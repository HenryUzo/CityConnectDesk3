const rawApiUrl = String(process.env.EXPO_PUBLIC_API_URL || "http://localhost:5000").trim();

function normalizeApiUrl(value: string) {
  return value.replace(/\/$/, "");
}

export const env = {
  apiUrl: normalizeApiUrl(rawApiUrl || "http://localhost:5000"),
  appEnv: String(process.env.EXPO_PUBLIC_APP_ENV || "development").trim().toLowerCase(),
  isDevelopment: String(process.env.EXPO_PUBLIC_APP_ENV || "development").trim().toLowerCase() !== "production",
} as const;

export function describeEnv() {
  return {
    apiUrl: env.apiUrl,
    appEnv: env.appEnv,
  };
}
