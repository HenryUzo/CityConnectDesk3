import {
  useState,
  useEffect,
  createContext,
  useContext,
  ReactNode,
} from "react";
import { useLocation } from "wouter";
import {
  adminApiRequest,
  setAdminToken,
  setCurrentEstate,
} from "@/lib/adminApi";
import { User as SelectUser } from "@shared/schema";

// Define the shape of the user object for admins
export interface AdminUser extends SelectUser {
  memberships: { estateId: string; role: string }[];
  globalRole?: "super_admin" | null;
}

// Define the shape of the authentication context
interface AdminAuthContextType {
  user: AdminUser | null;
  token: string | null;
  selectedEstateId: string | null;
  isLoading: boolean;
  sessionChecked: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  setSelectedEstateId: (estateId: string | null) => void;
}

// Create the context
const AdminAuthContext = createContext<AdminAuthContextType | null>(null);

// --- Helper functions for localStorage ---
function loadUserFromStorage(): AdminUser | null {
  try {
    const stored = localStorage.getItem("admin_user");
    if (!stored) return null;
    const parsed = JSON.parse(stored);
    return {
      ...parsed,
      memberships: Array.isArray(parsed.memberships) ? parsed.memberships : [],
    };
  } catch {
    return null;
  }
}

function saveUserToStorage(user: AdminUser | null) {
  try {
    if (user) {
      localStorage.setItem("admin_user", JSON.stringify(user));
    } else {
      localStorage.removeItem("admin_user");
    }
  } catch {
    // Ignore storage errors
  }
}

// --- AuthProvider Component ---
export const AdminAuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<AdminUser | null>(loadUserFromStorage);
  const [token, setToken] = useState<string | null>(null);
  const [selectedEstateId, setSelectedEstateId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [sessionChecked, setSessionChecked] = useState(false);
  const [location, setLocation] = useLocation();

  const isAdminRoute = location.startsWith("/admin-dashboard");

  // Sync token and estate ID to global helpers
  useEffect(() => {
    setAdminToken(token);
  }, [token]);

  useEffect(() => {
    if (selectedEstateId) {
      setCurrentEstate(selectedEstateId);
    }
  }, [selectedEstateId]);

  // Persist user to localStorage
  useEffect(() => {
    saveUserToStorage(user);
  }, [user]);

  // --- Core Authentication Logic ---
  const login = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const response: any = await adminApiRequest("POST", "/api/login", {
        username: email,
        password,
      });
      const userObj = response?.user ?? response;
      setUser(userObj);
      // After login, if there's no selected estate, select the first one
      if (userObj?.memberships?.length > 0 && !selectedEstateId) {
        setSelectedEstateId(userObj.memberships[0].estateId);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    adminApiRequest("POST", "/api/logout");
    setUser(null);
    setToken(null);
    sessionStorage.removeItem("admin_refresh_token");
    localStorage.removeItem("admin_user");
    setLocation("/auth");
  };

  // --- Session Bootstraping ---
  useEffect(() => {
    if (!isAdminRoute) {
      if (!sessionChecked) setSessionChecked(true);
      return;
    }

    const bootstrapSession = async () => {
      if (user) {
        setSessionChecked(true);
        return; // Already logged in from localStorage
      }
      try {
        // If no user in state, check the server-side session
        const sessionUser = await adminApiRequest("GET", "/api/user");
        if (sessionUser) {
          setUser(sessionUser as AdminUser);
        }
      } catch (error) {
        // Not logged in
      } finally {
        setSessionChecked(true);
      }
    };

    bootstrapSession();
  }, [isAdminRoute, user]); // Rerun if we navigate to/from admin or user logs out

  const value = {
    user,
    token,
    selectedEstateId,
    isLoading,
    sessionChecked,
    login,
    logout,
    setSelectedEstateId,
  };

  return (
    <AdminAuthContext.Provider value={value}>
      {children}
    </AdminAuthContext.Provider>
  );
};

// --- Custom Hook ---
export const useAdminAuth = () => {
  const context = useContext(AdminAuthContext);
  if (!context) {
    throw new Error("useAdminAuth must be used within an AdminAuthProvider");
  }
  return context;
};

