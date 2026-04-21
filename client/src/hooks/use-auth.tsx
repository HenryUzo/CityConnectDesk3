import { createContext, ReactNode, useContext, useEffect } from "react";
import {
  useQuery,
  useMutation,
  UseMutationResult,
} from "@tanstack/react-query";
import { insertUserSchema, User as SelectUser, InsertUser } from "@shared/schema";
import { getQueryFn, apiRequest, queryClient } from "../lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type AuthContextType = {
  user: SelectUser | null;
  isLoading: boolean;
  error: Error | null;
  loginMutation: UseMutationResult<SelectUser, Error, LoginData>;
  logoutMutation: UseMutationResult<void, Error, void>;
  registerMutation: UseMutationResult<SelectUser, Error, InsertUser>;
  refreshUser: () => Promise<SelectUser | null>;
};

type LoginData = {
  username?: string;
  password?: string;
  accessCode?: string;
};

const LEGACY_AUTH_STORAGE_KEYS = [
  "jwt",
  "refreshToken",
  "token",
  "admin_access_token",
  "admin_refresh_token",
  "admin_jwt",
];

function clearLegacyAuthStorage() {
  if (typeof window === "undefined") return;

  for (const key of LEGACY_AUTH_STORAGE_KEYS) {
    window.localStorage.removeItem(key);
    window.sessionStorage.removeItem(key);
  }
}

export const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();

  useEffect(() => {
    clearLegacyAuthStorage();
  }, []);

  // Avoid querying /api/user on admin routes (prevents noisy 401s there)
  const isAdminRoute =
    typeof window !== "undefined" &&
    (window.location.pathname.startsWith("/admin") ||
      window.location.pathname.startsWith("/admin-dashboard"));

  // In resident areas, we ask the API who the user is.
  // On admin routes, we disable this query entirely.
  const isPublicRegistrationRoute =
    typeof window !== "undefined" &&
    (window.location.pathname.startsWith("/auth") ||
      window.location.pathname.startsWith("/register"));

  const {
    data: user,
    error,
    isLoading,
  } = useQuery<SelectUser | null, Error>({
    queryKey: ["/api/user"],
    queryFn: getQueryFn<SelectUser | null>({ on401: "returnNull" }),
    enabled: !isAdminRoute && !isPublicRegistrationRoute, // <- critical line
  });

  const loginMutation = useMutation({
    mutationFn: async (credentials: LoginData) => {
      // Transform accessCode to username for backend compatibility
      const loginData = credentials.accessCode
        ? { username: credentials.accessCode, password: "access_code_login" }
        : { username: credentials.username, password: credentials.password };

      const res = await apiRequest("POST", "/api/login", loginData);
      const data = await res.json();
      clearLegacyAuthStorage();
      return data.user || data;
    },
    onSuccess: (user: SelectUser) => {
      queryClient.setQueryData(["/api/user"], user);
    },
    onError: (error: Error) => {
      toast({
        title: "Login failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const registerMutation = useMutation({
    mutationFn: async (credentials: InsertUser) => {
      // Optional: validate on client (keeps your original import in use)
      insertUserSchema.passthrough().parse(credentials);
      const res = await apiRequest("POST", "/api/register", credentials);
      const data = await res.json();
      clearLegacyAuthStorage();
      return data.user || data;
    },
    onSuccess: (user: SelectUser) => {
      queryClient.setQueryData(["/api/user"], user);
    },
    onError: (error: Error) => {
      toast({
        title: "Registration failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/logout");
    },
    onSuccess: () => {
      clearLegacyAuthStorage();
      queryClient.setQueryData(["/api/user"], null);
    },
    onError: (error: Error) => {
      toast({
        title: "Logout failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const refreshUser = async () => {
    const res = await apiRequest("GET", "/api/user");
    const nextUser = (await res.json()) as SelectUser;
    queryClient.setQueryData(["/api/user"], nextUser);
    return nextUser ?? null;
  };

  return (
    <AuthContext.Provider
      value={{
        user: user ?? null,
        isLoading,
        error,
        loginMutation,
        logoutMutation,
        registerMutation,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
