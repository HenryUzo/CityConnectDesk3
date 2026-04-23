import { createContext, PropsWithChildren, useContext, useEffect, useState } from "react";
import * as SecureStore from "expo-secure-store";
import { createApiClient, postPublicJson } from "../../api/client";
import {
  AppUser,
  AuthTokens,
  MobileAuthResponse,
  OtpChallengeResponse,
  OtpVerifyResponse,
} from "../../api/contracts";
import { createServices } from "../../api/services";

const ACCESS_TOKEN_KEY = "cityconnect.mobile.accessToken";
const REFRESH_TOKEN_KEY = "cityconnect.mobile.refreshToken";
const USER_KEY = "cityconnect.mobile.user";

const volatileStorage = new Map<string, string>();

type SessionStatus = "loading" | "authenticated" | "unauthenticated";

type SessionContextValue = {
  status: SessionStatus;
  user: AppUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  services: ReturnType<typeof createServices>;
  startLogin: (payload: Record<string, unknown>) => Promise<OtpChallengeResponse>;
  verifyLogin: (challengeId: string, code: string) => Promise<MobileAuthResponse>;
  startRegister: (payload: Record<string, unknown>) => Promise<OtpChallengeResponse>;
  verifyOtp: (challengeId: string, code: string) => Promise<OtpVerifyResponse>;
  resendOtp: (challengeId: string) => Promise<OtpChallengeResponse>;
  completeRegister: (
    pendingRegistrationId: string,
    verificationToken: string,
  ) => Promise<MobileAuthResponse>;
  legacyLogin: (payload: Record<string, unknown>) => Promise<MobileAuthResponse>;
  legacyRegister: (payload: Record<string, unknown>) => Promise<MobileAuthResponse>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<AuthTokens | null>;
};

const SessionContext = createContext<SessionContextValue | null>(null);

function getBrowserStorage() {
  try {
    if (typeof globalThis !== "undefined" && "localStorage" in globalThis && globalThis.localStorage) {
      return globalThis.localStorage;
    }
  } catch {
    // ignore localStorage access errors
  }

  return null;
}

async function setStoredValue(key: string, value: string) {
  const browserStorage = getBrowserStorage();
  browserStorage?.setItem(key, value);
  volatileStorage.set(key, value);

  try {
    await SecureStore.setItemAsync(key, value);
  } catch {
    // Fall back silently when the native SecureStore module is unavailable
    // or mismatched with the current runtime.
  }
}

async function deleteStoredValue(key: string) {
  const browserStorage = getBrowserStorage();
  browserStorage?.removeItem(key);
  volatileStorage.delete(key);

  try {
    await SecureStore.deleteItemAsync(key);
  } catch {
    // Ignore native delete failures and rely on the fallback stores.
  }
}

async function getStoredValue(key: string) {
  try {
    const secureValue = await SecureStore.getItemAsync(key);
    if (secureValue !== null && secureValue !== undefined) {
      const browserStorage = getBrowserStorage();
      browserStorage?.setItem(key, secureValue);
      volatileStorage.set(key, secureValue);
      return secureValue;
    }
  } catch {
    // Ignore native read failures and fall back below.
  }

  const browserStorage = getBrowserStorage();
  const browserValue = browserStorage?.getItem(key);
  if (browserValue !== null && browserValue !== undefined) {
    volatileStorage.set(key, browserValue);
    return browserValue;
  }

  return volatileStorage.get(key) ?? null;
}

async function persistTokens(tokens: AuthTokens | null) {
  if (!tokens) {
    await deleteStoredValue(ACCESS_TOKEN_KEY);
    await deleteStoredValue(REFRESH_TOKEN_KEY);
    return;
  }
  await setStoredValue(ACCESS_TOKEN_KEY, tokens.accessToken);
  await setStoredValue(REFRESH_TOKEN_KEY, tokens.refreshToken);
}

async function persistUser(user: AppUser | null) {
  if (!user) {
    await deleteStoredValue(USER_KEY);
    return;
  }
  await setStoredValue(USER_KEY, JSON.stringify(user));
}

async function readStoredUser() {
  const raw = await getStoredValue(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AppUser;
  } catch {
    return null;
  }
}

export function SessionProvider({ children }: PropsWithChildren) {
  const [status, setStatus] = useState<SessionStatus>("loading");
  const [user, setUser] = useState<AppUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);

  async function applyAuthenticatedSession(payload: MobileAuthResponse) {
    setUser(payload.user);
    setAccessToken(payload.accessToken);
    setRefreshToken(payload.refreshToken);
    setStatus("authenticated");
    await persistTokens(payload);
    await persistUser(payload.user);
  }

  async function clearSession() {
    setUser(null);
    setAccessToken(null);
    setRefreshToken(null);
    setStatus("unauthenticated");
    await persistTokens(null);
    await persistUser(null);
  }

  async function refreshSessionInternal(tokenToRefresh?: string) {
    const activeRefreshToken = tokenToRefresh || refreshToken;
    if (!activeRefreshToken) return null;

    const refreshed = await postPublicJson<MobileAuthResponse>("/api/mobile/auth/refresh", {
      refreshToken: activeRefreshToken,
    });

    await applyAuthenticatedSession(refreshed);
    return {
      accessToken: refreshed.accessToken,
      refreshToken: refreshed.refreshToken,
      expiresIn: refreshed.expiresIn,
    };
  }

  const apiClient = createApiClient({
    getAccessToken: () => accessToken,
    getRefreshToken: () => refreshToken,
    refreshTokens: (storedRefreshToken) => refreshSessionInternal(storedRefreshToken),
    onAuthFailure: () => clearSession(),
  });

  const services = createServices(apiClient);

  useEffect(() => {
    let cancelled = false;

    const bootstrap = async () => {
      try {
        const [storedAccessToken, storedRefreshToken, storedUser] = await Promise.all([
          getStoredValue(ACCESS_TOKEN_KEY),
          getStoredValue(REFRESH_TOKEN_KEY),
          readStoredUser(),
        ]);

        if (cancelled) return;

        if (!storedAccessToken && !storedRefreshToken) {
          setStatus("unauthenticated");
          return;
        }

        setAccessToken(storedAccessToken);
        setRefreshToken(storedRefreshToken);
        setUser(storedUser);

        if (storedAccessToken) {
          try {
            const me = await createServices(
              createApiClient({
                getAccessToken: () => storedAccessToken,
                getRefreshToken: () => storedRefreshToken,
                refreshTokens: (token) => refreshSessionInternal(token),
                onAuthFailure: () => clearSession(),
              }),
            ).auth.me();
            if (cancelled) return;
            setUser(me.user);
            setStatus("authenticated");
            await persistUser(me.user);
            return;
          } catch {
            // fall through to refresh
          }
        }

        if (storedRefreshToken) {
          await refreshSessionInternal(storedRefreshToken);
          if (cancelled) return;
          return;
        }

        await clearSession();
      } catch {
        if (!cancelled) {
          await clearSession();
        }
      }
    };

    void bootstrap();

    return () => {
      cancelled = true;
    };
  }, []);

  async function startLogin(payload: Record<string, unknown>) {
    return postPublicJson<OtpChallengeResponse>("/api/mobile/auth/login/start", payload);
  }

  async function verifyLogin(challengeId: string, code: string) {
    const result = await postPublicJson<MobileAuthResponse>("/api/mobile/auth/login/verify", {
      challengeId,
      code,
    });
    await applyAuthenticatedSession(result);
    return result;
  }

  async function startRegister(payload: Record<string, unknown>) {
    return postPublicJson<OtpChallengeResponse>("/api/mobile/auth/register", payload);
  }

  async function verifyOtp(challengeId: string, code: string) {
    return postPublicJson<OtpVerifyResponse>("/api/mobile/auth/otp/verify", {
      challengeId,
      code,
    });
  }

  async function resendOtp(challengeId: string) {
    return postPublicJson<OtpChallengeResponse>("/api/mobile/auth/otp/resend", { challengeId });
  }

  async function completeRegister(pendingRegistrationId: string, verificationToken: string) {
    const result = await postPublicJson<MobileAuthResponse>(
      "/api/mobile/auth/register/complete",
      {
        pendingRegistrationId,
        verificationToken,
      },
    );
    await applyAuthenticatedSession(result);
    return result;
  }

  async function legacyLogin(payload: Record<string, unknown>) {
    const result = await postPublicJson<MobileAuthResponse>("/api/mobile/auth/login", payload);
    await applyAuthenticatedSession(result);
    return result;
  }

  async function legacyRegister(payload: Record<string, unknown>) {
    const result = await postPublicJson<MobileAuthResponse>("/api/mobile/auth/register", payload);
    await applyAuthenticatedSession(result);
    return result;
  }

  async function logout() {
    try {
      if (accessToken) {
        await services.auth.logout();
      }
    } finally {
      await clearSession();
    }
  }

  return (
    <SessionContext.Provider
      value={{
        status,
        user,
        accessToken,
        refreshToken,
        services,
        startLogin,
        verifyLogin,
        startRegister,
        verifyOtp,
        resendOtp,
        completeRegister,
        legacyLogin,
        legacyRegister,
        logout,
        refreshSession: () => refreshSessionInternal(),
      }}
    >
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error("useSession must be used within a SessionProvider");
  }
  return context;
}
