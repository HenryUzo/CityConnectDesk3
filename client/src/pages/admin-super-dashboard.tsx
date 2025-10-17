import {
  useState,
  useEffect,
  createContext,
  useContext,
  ReactNode,
} from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import {
  adminApiRequest,
  setAdminToken,
  setCurrentEstate,
  getCurrentEstate,
} from "@/lib/adminApi";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  createMarketplaceItemSchema,
  updateMarketplaceItemSchema,
  createProviderSchema,
  type CreateMarketplaceItemInput,
  type UpdateMarketplaceItemInput,
  type CreateProviderInput,
  type IMarketplaceItem,
} from "@shared/admin-schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ArtisanRequestsPanel from "@/components/admin/ArtisanRequestsPanel";



import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  LayoutDashboard,
  Users,
  Building2,
  Store,
  Settings,
  ShoppingCart,
  FileBarChart,
  UserCheck,
  ClipboardList,
  MessageSquare,
  Shield,
  LogOut,
  Menu,
  X,
  Plus,
  Search,
  Filter,
  TrendingUp,
  DollarSign,
  Package,
  AlertTriangle,
  UserPlus,
  Edit,
  CheckCircle,
  XCircle,
  Star,
  Eye,
  EyeOff,
  Tags,
  Wrench,
  ShoppingBag,
  ChevronLeft,
  ChevronRight,
  Download,
  Calendar,
  Clock,
  Globe,
} from "lucide-react";

// Admin Context for JWT token management
interface AdminUser {
  id: string;
  email: string;
  name: string;
  globalRole?: string;
  memberships?: Array<{
    estateId: string;
    role: string;
    permissions?: string[];
  }>;
}

interface AdminAuthContextType {
  user: AdminUser | null;
  token: string | null;
  selectedEstateId: string | null;
  setSelectedEstateId: (estateId: string | null) => void;
  login: (email: string, password: string) => Promise<any>;
  logout: () => void;
  isLoading: boolean;
  refreshToken: () => Promise<void>;
}

const AdminAuthContext = createContext<AdminAuthContextType | null>(null);

export const useAdminAuth = () => {
  const context = useContext(AdminAuthContext);
  if (!context) {
    throw new Error("useAdminAuth must be used within AdminAuthProvider");
  }
  return context;
};

interface AdminAuthProviderProps {
  children: ReactNode;
}

export const AdminAuthProvider = ({ children }: AdminAuthProviderProps) => {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [selectedEstateId, setSelectedEstateId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [, setLocation] = useLocation();

  // Update global token reference when token changes
  useEffect(() => {
    setAdminToken(token);
  }, [token]);

  // Update global estate context when selectedEstateId changes
  useEffect(() => {
    setCurrentEstate(selectedEstateId);
  }, [selectedEstateId]);

  // Listen for auth failure events from adminApiRequest
  useEffect(() => {
    const handleAuthFailure = () => {
      logout();
    };
    window.addEventListener("admin-auth-failed", handleAuthFailure);
    return () =>
      window.removeEventListener("admin-auth-failed", handleAuthFailure);
  }, []);

  // Auto-refresh token on mount if refresh token exists
  useEffect(() => {
    const refreshTokenFromStorage = sessionStorage.getItem(
      "admin_refresh_token",
    );
    if (refreshTokenFromStorage && !token) {
      refreshToken();
    }
  }, []);

  const refreshToken = async () => {
    const refreshTokenValue = sessionStorage.getItem("admin_refresh_token");
    if (!refreshTokenValue) return;

    try {
      const response: any = await adminApiRequest(
        "POST",
        "/api/admin/auth/refresh",
        {
          refreshToken: refreshTokenValue,
        },
      );

      // Race-proof: Set tokens immediately
      setAdminToken(response.accessToken);
      setToken(response.accessToken);
      setUser(response.user);
      sessionStorage.setItem("admin_refresh_token", response.refreshToken);

      // Restore estate selection if user has memberships
      if (
        response.user.memberships &&
        response.user.memberships.length > 0 &&
        !selectedEstateId
      ) {
        const firstEstate = response.user.memberships[0].estateId;
        setSelectedEstateId(firstEstate);
      }
    } catch (error) {
      // Refresh failed, clear tokens and redirect to login
      logout();
    }
  };

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const response: any = await adminApiRequest(
        "POST",
        "/api/admin/auth/login",
        { email, password },
      );

      // Race-proof: Set tokens immediately before any queries can fire
      setAdminToken(response.accessToken);
      setToken(response.accessToken);
      setUser(response.user);
      sessionStorage.setItem("admin_refresh_token", response.refreshToken);
      sessionStorage.setItem("admin_access_token", response.accessToken);

      // Auto-select first estate for tenant scoping
      if (response.user.memberships && response.user.memberships.length > 0) {
        const firstEstate = response.user.memberships[0].estateId;
        setSelectedEstateId(firstEstate);
      }

      return response;
    } catch (error) {
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    // Clear tokens everywhere
    setAdminToken(null);               // <- ensures adminApi stops sending Authorization
    setToken(null);
    setUser(null);

    sessionStorage.removeItem("admin_refresh_token");
    sessionStorage.removeItem("admin_access_token");
    localStorage.removeItem("admin_jwt");

    // Bounce back to login
    setLocation("/");
  };


  return (
    <AdminAuthContext.Provider
      value={{
        user,
        token,
        selectedEstateId,
        setSelectedEstateId,
        login,
        logout,
        isLoading,
        refreshToken,
      }}
    >
      {children}
    </AdminAuthContext.Provider>
  );
};

// Legacy API request function - now uses centralized adminApiRequest

// Admin Login Component
const AdminLogin = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAdminAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      await login(email, password);
      toast({
        title: "Login Successful",
        description: "Welcome to CityConnect Admin Dashboard",
      });
      setLocation("/admin-dashboard");
    } catch (error: any) {
      toast({
        title: "Login Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold text-primary">
            CityConnect Admin
          </CardTitle>
          <p className="text-muted-foreground">Multi-tenant Admin Dashboard</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Email</label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@cityconnect.com"
                required
                data-testid="input-admin-email"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Password</label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                data-testid="input-admin-password"
              />
            </div>
            <Button
              type="submit"
              className="w-full"
              disabled={isLoading}
              data-testid="button-admin-login"
            >
              {isLoading ? "Signing in..." : "Sign In"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

// Sidebar Navigation
const AdminSidebar = ({
  activeTab,
  setActiveTab,
  isMobileOpen,
  setIsMobileOpen,
}: {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isMobileOpen: boolean;
  setIsMobileOpen: (open: boolean) => void;
}) => {
  const { user, logout } = useAdminAuth();

  const menuItems = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "estates", label: "Estates", icon: Building2 },
    { id: "users", label: "Users", icon: Users },
    { id: "providers", label: "Providers", icon: UserCheck },
    { id: "stores", label: "Stores", icon: Store },
    { id: "categories", label: "Categories", icon: Tags },
    { id: "marketplace", label: "Marketplace", icon: ShoppingBag },
     { id: "artisanRequests", label: "Book an Artisan", icon: Wrench },
    { id: "requests", label: "Service Requests", icon: ClipboardList },
    { id: "orders", label: "Orders", icon: Package },
    { id: "analytics", label: "Analytics", icon: FileBarChart },
    { id: "notifications", label: "Notifications", icon: MessageSquare },
    { id: "settings", label: "Settings", icon: Settings },
    { id: "audit", label: "Audit Logs", icon: Shield },

  ];

  const isSuperAdmin = user?.globalRole === "super_admin";

  return (
    <>
      {/* Mobile backdrop */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div
        className={`
        fixed left-0 top-0 h-full w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 z-50
        transform transition-transform duration-300 ease-in-out
        ${isMobileOpen ? "translate-x-0" : "-translate-x-full"}
        lg:translate-x-0 lg:relative lg:z-0
      `}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
            CityConnect Admin
          </h1>
          <Button
            variant="ghost"
            size="sm"
            className="lg:hidden"
            onClick={() => setIsMobileOpen(false)}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* User Info */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
              <Users className="w-4 h-4 text-primary-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                {user?.name}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                {user?.globalRole?.replace("_", " ").toUpperCase()}
              </p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;

            // Hide estate-specific features for non-super admins without proper access
            if (!isSuperAdmin && ["estates", "audit"].includes(item.id)) {
              return null;
            }

            return (
              <button
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id);
                  setIsMobileOpen(false);
                }}
                className={`
                  w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors
                  ${
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                  }
                `}
                data-testid={`nav-${item.id}`}
              >
                <Icon className="w-4 h-4" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Logout */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700">
          <Button
            variant="outline"
            className="w-full"
            onClick={logout}
            data-testid="button-logout"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Logout
          </Button>
        </div>
      </div>
    </>
  );
};



// Users Management Component
const UsersManagement = () => {
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [viewMode, setViewMode] = useState<"global" | "estate">("global");
  const [selectedEstateId, setSelectedEstateId] = useState<string>("");
  const [editingUser, setEditingUser] = useState<any>(null);
  const [showAddUser, setShowAddUser] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    globalRole: "",
  });
  const [showMemberships, setShowMemberships] = useState(false);
  const [membershipUser, setMembershipUser] = useState<any>(null);
  const [newMembership, setNewMembership] = useState({
    estateId: "",
    role: "",
  });

  const { toast } = useToast();
  const { user } = useAdminAuth();
  const isSuperAdmin = user?.globalRole === "super_admin";

  // Initialize view mode from localStorage estate context
  useEffect(() => {
    const estateId = getCurrentEstate();
    if (estateId) {
      setViewMode("estate");
      setSelectedEstateId(estateId);
    } else {
      setViewMode("global");
    }
  }, []);

  // Users (unified) — array normalized for the table
  const { data: users = [], isLoading } = useQuery<any[]>({
    queryKey: [
      `${import.meta.env.VITE_API_URL}/api/admin/users/all`,
      { search, role: roleFilter === "all" ? undefined : roleFilter, viewMode, selectedEstateId },
    ],
    queryFn: async () => {
      const r = await adminApiRequest("GET", "/api/admin/users/all", {
        search: search || undefined,
        role: roleFilter === "all" ? undefined : roleFilter, // 'admin' | 'resident' | 'provider'
      });
      // Always return an array for the table:
      return Array.isArray(r) ? r : (r?.items ?? []);
    },
  });

  // Optional alias (now just equals users)
  const rows = users;

  // Estates for both membership dialog and view mode selector
  const { data: estates } = useQuery({
    queryKey: ["admin-estates"],
    queryFn: () => adminApiRequest("GET", "/api/admin/estates"),
    enabled: showMemberships || isSuperAdmin, // Load for super admins or when managing memberships
  });

  // Handle view mode changes
  const handleViewModeChange = (mode: "global" | "estate") => {
    setViewMode(mode);
    if (mode === "global") {
      // Clear estate context for global view
      setCurrentEstate(null);
      setSelectedEstateId("");
    } else if (mode === "estate" && selectedEstateId) {
      // Set estate context when switching to estate view
      setCurrentEstate(selectedEstateId);
    }
  };

  // Handle estate selection
  const handleEstateSelect = (estateId: string) => {
    setSelectedEstateId(estateId);
    setCurrentEstate(estateId);
    if (!viewMode || viewMode === "global") {
      setViewMode("estate");
    }
  };

  // Memberships query – use the correct endpoint
  const { data: userMemberships } = useQuery({
    queryKey: ["admin-user-memberships", membershipUser?._id || membershipUser?.id],
    queryFn: () => {
      if (!membershipUser) return [];
      // Handle both MongoDB (_id) and PostgreSQL (id) user objects
      const userId = membershipUser._id || membershipUser.id;
      return adminApiRequest("GET", `/api/admin/users/${userId}/memberships`);
    },
    enabled: !!membershipUser,
  });

  // Toggle active/inactive – use /api/admin/bridge/users/{id} (PostgreSQL)
  const toggleUserStatusMutation = useMutation({
    mutationFn: ({ userId, isActive }: { userId: string; isActive: boolean }) =>
      adminApiRequest("PATCH", `/api/admin/bridge/users/${userId}`, { isActive }),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users/all"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/bridge/users"] });
      toast({
        title: `User ${variables.isActive ? "activated" : "deactivated"} successfully`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error updating user status",
        description:
          error.response?.data?.error || "Failed to update user status",
        variant: "destructive",
      });
    },
  });

  // Create user – POST to /api/admin/users
  const createUserMutation = useMutation({
    mutationFn: (userData: any) =>
      adminApiRequest("POST", "/api/admin/users", userData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users/all"] });
      setShowAddUser(false);
      resetForm();
      toast({ title: "User created successfully" });
    },
    onError: (error: any) => {
      toast({
        title: "Error creating user",
        description: error.response?.data?.error || "Failed to create user",
        variant: "destructive",
      });
    },
  });

  // Update user – PATCH to /api/admin/bridge/users/{id} (PostgreSQL)
  const updateUserMutation = useMutation({
    mutationFn: ({ userId, userData }: { userId: string; userData: any }) =>
      adminApiRequest("PATCH", `/api/admin/bridge/users/${userId}`, userData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users/all"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/bridge/users"] });
      setEditingUser(null);
      resetForm();
      toast({ title: "User updated successfully" });
    },
    onError: (error: any) => {
      toast({
        title: "Error updating user",
        description:
          error.response?.data?.error || "Failed to update user",
        variant: "destructive",
      });
    },
  });


  const handleToggleUserStatus = (userId: string, currentStatus: boolean) => {
    toggleUserStatusMutation.mutate({ userId, isActive: !currentStatus });
  };

  const resetForm = () => {
    setFormData({
      name: "",
      email: "",
      phone: "",
      password: "",
      globalRole: "",
    });
  };

  const handleOpenEditDialog = (user: any) => {
    setEditingUser(user);
    setFormData({
      name: user.name || "",
      email: user.email || "",
      phone: user.phone || "",
      password: "",
      globalRole: user.globalRole || "",
    });
  };

  const createMembershipMutation = useMutation({
    mutationFn: (membershipData: any) =>
      adminApiRequest("POST", "/api/admin/memberships", membershipData),
    onSuccess: () => {
      // Invalidate all relevant queries to ensure UI consistency
      queryClient.invalidateQueries({ queryKey: ["/api/admin/memberships"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users/all"] });

      // Reset form state
      setNewMembership({ estateId: "", role: "" });

      toast({ title: "Estate membership added successfully" });
    },
    onError: (error: any) => {
      toast({
        title: "Error adding membership",
        description: error.response?.data?.error || "Failed to add membership",
        variant: "destructive",
      });
    },
  });

  const deleteMembershipMutation = useMutation({
    mutationFn: ({ userId, estateId }: { userId: string; estateId: string }) =>
      adminApiRequest("DELETE", `/api/admin/memberships/${userId}/${estateId}`),
    onSuccess: () => {
      // Invalidate all relevant queries to ensure UI consistency
      queryClient.invalidateQueries({ queryKey: ["/api/admin/memberships"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users/all"] });

      toast({ title: "Membership removed successfully" });
    },
    onError: (error: any) => {
      toast({
        title: "Error removing membership",
        description:
          error.response?.data?.error || "Failed to remove membership",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = () => {
    const { password, ...baseData } = formData;
    const userData = password ? { ...baseData, password } : baseData; // Only include password if provided

    if (editingUser) {
      // Handle both MongoDB (_id) and PostgreSQL (id) user objects
      const userId = editingUser._id || editingUser.id;
      updateUserMutation.mutate({ userId, userData });
    } else {
      createUserMutation.mutate(userData);
    }
  };

  const handleAddMembership = (estateId: string, role: string) => {
    if (!membershipUser) return;

    // Check for duplicate membership
    const existingMembership = userMemberships?.find(
      (membership: any) => membership.estateId === estateId,
    );

    if (existingMembership) {
      toast({
        title: "Duplicate membership",
        description: "User is already a member of this estate",
        variant: "destructive",
      });
      return;
    }

    // Handle both MongoDB (_id) and PostgreSQL (id) user objects
    const userId = membershipUser._id || membershipUser.id;
    createMembershipMutation.mutate({
      userId,
      estateId,
      role,
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-8 bg-gray-200 rounded w-1/4 animate-pulse"></div>
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="h-16 bg-gray-200 rounded animate-pulse"
            ></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              User Management
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Manage users and their estate assignments
            </p>
          </div>
          <Button
            className="bg-primary hover:bg-primary/90"
            onClick={() => setShowAddUser(true)}
            data-testid="button-add-user"
          >
            <UserPlus className="w-4 h-4 mr-2" />
            Add User
          </Button>
        </div>

        {/* Global/Estate Toggle - Only for Super Admins */}
        {isSuperAdmin && (
          <Card className={viewMode === "global" ? "bg-purple-500/5 dark:bg-purple-500/10" : "bg-teal-500/5 dark:bg-teal-500/10"}>
            <CardContent className="p-4">
              <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
                {/* Toggle Buttons */}
                <div className="flex items-center gap-2 bg-background border border-border rounded-lg p-1 h-10">
                  <Button
                    variant={viewMode === "global" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => handleViewModeChange("global")}
                    className={`transition-all duration-200 ${
                      viewMode === "global"
                        ? "bg-purple-500 hover:bg-purple-600 text-white shadow-[0_0_20px_rgba(168,85,247,0.15)]"
                        : ""
                    }`}
                    data-testid="button-view-global"
                  >
                    <Globe className="w-4 h-4 mr-2" />
                    Global
                  </Button>
                  <Button
                    variant={viewMode === "estate" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => handleViewModeChange("estate")}
                    className={`transition-all duration-200 ${
                      viewMode === "estate"
                        ? "bg-teal-500 hover:bg-teal-600 text-white shadow-[0_0_20px_rgba(20,184,166,0.15)]"
                        : ""
                    }`}
                    data-testid="button-view-estate"
                  >
                    <Building2 className="w-4 h-4 mr-2" />
                    Estate
                  </Button>
                </div>

                {/* Estate Selector - Shows when Estate mode is active */}
                {viewMode === "estate" && (
                  <Select value={selectedEstateId} onValueChange={handleEstateSelect}>
                    <SelectTrigger className="w-full sm:w-[280px]" data-testid="select-estate-filter">
                      <SelectValue placeholder="Select an estate..." />
                    </SelectTrigger>
                    <SelectContent>
                      {estates && estates.length > 0 ? (
                        estates.map((estate: any) => (
                          <SelectItem key={estate._id} value={estate._id}>
                            <div className="flex flex-col">
                              <span className="font-medium">{estate.name}</span>
                              <span className="text-xs text-muted-foreground">{estate.address}</span>
                            </div>
                          </SelectItem>
                        ))
                      ) : (
                        <SelectItem value="none" disabled>
                          No estates available
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                )}

                {/* Context Badge */}
                <div className="flex-1">
                  <Badge
                    variant="outline"
                    className={`text-sm ${
                      viewMode === "global"
                        ? "border-purple-500 text-purple-600 dark:text-purple-400"
                        : "border-teal-500 text-teal-600 dark:text-teal-400"
                    }`}
                  >
                    {viewMode === "global" ? (
                      <>
                        <div className="w-2 h-2 rounded-full bg-purple-500 mr-2"></div>
                        Viewing all users globally
                      </>
                    ) : selectedEstateId ? (
                      <>
                        <div className="w-2 h-2 rounded-full bg-teal-500 mr-2"></div>
                        Estate: {estates?.find((e: any) => e._id === selectedEstateId)?.name || "Selected"}
                      </>
                    ) : (
                      <>Please select an estate</>
                    )}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <Input
                    placeholder="Search users by name or email..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-10"
                    data-testid="input-search-users"
                  />
                </div>
              </div>
              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger
                  className="w-48"
                  data-testid="select-role-filter"
                >
                  <SelectValue placeholder="Filter by role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  <SelectItem value="resident">Resident</SelectItem>
                  <SelectItem value="provider">Provider</SelectItem>
                  <SelectItem value="estate_admin">Estate Admin</SelectItem>
                  <SelectItem value="moderator">Moderator</SelectItem>
                  <SelectItem value="super_admin">Super Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Users Table */}
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Active</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                
                   {rows.map((user: any) => (
  <TableRow key={user.id || user._id || user.email}>
                    <TableCell className="font-medium">{user.name}</TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>{user.phone}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          user.globalRole === "super_admin"
                            ? "default"
                            : "secondary"
                        }
                      >
                        {user.globalRole || "User"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={user.isActive ? "default" : "destructive"}
                      >
                        {user.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {user.lastLoginAt
                        ? new Date(user.lastLoginAt).toLocaleDateString()
                        : "Never"}
                    </TableCell>
                    <TableCell>
                      <div className="flex space-x-2">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleOpenEditDialog(user)}
                              data-testid={`button-edit-user-${user._id}`}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Edit user details</p>
                          </TooltipContent>
                        </Tooltip>

                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setMembershipUser(user);
                                setShowMemberships(true);
                              }}
                              data-testid={`button-estates-user-${user._id}`}
                            >
                              <Building2 className="w-4 h-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Manage estate memberships</p>
                          </TooltipContent>
                        </Tooltip>

                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant={
                                user.isActive ? "destructive" : "default"
                              }
                              size="sm"
                              onClick={() =>
                                handleToggleUserStatus(user._id, user.isActive)
                              }
                              disabled={toggleUserStatusMutation.isPending}
                              data-testid={`button-toggle-user-${user._id}`}
                            >
                              {user.isActive ? (
                                <XCircle className="w-4 h-4" />
                              ) : (
                                <CheckCircle className="w-4 h-4" />
                              )}
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>
                              {user.isActive
                                ? "Deactivate user"
                                : "Activate user"}
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {(!users || users.length === 0) && (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="text-center py-8 text-gray-500"
                    >
                      No users found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Add/Edit User Dialog */}
        <Dialog
          open={showAddUser || editingUser !== null}
          onOpenChange={(open) => {
            if (!open) {
              setShowAddUser(false);
              setEditingUser(null);
            }
          }}
        >
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {editingUser ? "Edit User" : "Add New User"}
              </DialogTitle>
              <DialogDescription>
                {editingUser
                  ? "Update user information and permissions."
                  : "Create a new user account."}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <Input
                placeholder="Full Name"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                data-testid="input-user-name"
              />
              <Input
                placeholder="Email Address"
                type="email"
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
                data-testid="input-user-email"
              />
              <Input
                placeholder="Phone Number"
                value={formData.phone}
                onChange={(e) =>
                  setFormData({ ...formData, phone: e.target.value })
                }
                data-testid="input-user-phone"
              />
              {!editingUser && (
                <Input
                  placeholder="Password"
                  type="password"
                  value={formData.password}
                  onChange={(e) =>
                    setFormData({ ...formData, password: e.target.value })
                  }
                  data-testid="input-user-password"
                />
              )}
              <Select
                value={formData.globalRole}
                onValueChange={(value) =>
                  setFormData({ ...formData, globalRole: value })
                }
              >
                <SelectTrigger data-testid="select-user-role">
                  <SelectValue placeholder="Select Role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No Global Role</SelectItem> // ← ✅
                  <SelectItem value="resident">Resident</SelectItem>
                  <SelectItem value="provider">Provider</SelectItem>
                  <SelectItem value="estate_admin">Estate Admin</SelectItem>
                  <SelectItem value="moderator">Moderator</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setShowAddUser(false);
                  setEditingUser(null);
                  resetForm();
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={
                  createUserMutation.isPending || updateUserMutation.isPending
                }
                data-testid="button-save-user"
              >
                {createUserMutation.isPending || updateUserMutation.isPending
                  ? "Saving..."
                  : editingUser
                    ? "Update User"
                    : "Create User"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Estate Membership Management Dialog */}
        <Dialog open={showMemberships} onOpenChange={setShowMemberships}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                Manage Estate Memberships - {membershipUser?.name}
              </DialogTitle>
              <DialogDescription>
                Assign or remove this user from estates and manage their roles.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              {/* Current Memberships */}
              <div className="mb-6">
                <h4 className="font-medium mb-3">Current Estate Memberships</h4>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {userMemberships?.map((membership: any) => (
                    <div
                      key={`${membership.userId}-${membership.estateId}`}
                      className="flex items-center justify-between p-3 border rounded-lg"
                      data-testid={`membership-${membership.estateId}`}
                    >
                      <div>
                        <span className="font-medium">
                          Estate {membership.estateId}
                        </span>
                        <Badge variant="secondary" className="ml-2">
                          {membership.role}
                        </Badge>
                      </div>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() =>
                          deleteMembershipMutation.mutate({
                            userId: membership.userId,
                            estateId: membership.estateId,
                          })
                        }
                        disabled={deleteMembershipMutation.isPending}
                        data-testid={`button-remove-membership-${membership.estateId}`}
                      >
                        {deleteMembershipMutation.isPending
                          ? "Removing..."
                          : "Remove"}
                      </Button>
                    </div>
                  ))}
                  {(!userMemberships || userMemberships.length === 0) && (
                    <p className="text-muted-foreground text-center py-4">
                      No estate memberships found
                    </p>
                  )}
                </div>
              </div>

              {/* Add New Membership */}
              <div>
                <h4 className="font-medium mb-3">Add Estate Membership</h4>
                <div className="flex space-x-2">
                  <Select
                    value={newMembership.estateId}
                    onValueChange={(value) =>
                      setNewMembership({ ...newMembership, estateId: value })
                    }
                  >
                    <SelectTrigger
                      className="flex-1"
                      data-testid="select-estate"
                    >
                      <SelectValue placeholder="Select Estate" />
                    </SelectTrigger>
                    <SelectContent>
                      {estates?.map((estate: any) => (
                        <SelectItem key={estate._id} value={estate._id}>
                          {estate.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value={newMembership.role}
                    onValueChange={(value) =>
                      setNewMembership({ ...newMembership, role: value })
                    }
                  >
                    <SelectTrigger
                      className="w-40"
                      data-testid="select-estate-role"
                    >
                      <SelectValue placeholder="Select Role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="resident">Resident</SelectItem>
                      <SelectItem value="provider">Provider</SelectItem>
                      <SelectItem value="estate_admin">Estate Admin</SelectItem>
                      <SelectItem value="moderator">Moderator</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    onClick={() => {
                      if (newMembership.estateId && newMembership.role) {
                        handleAddMembership(
                          newMembership.estateId,
                          newMembership.role,
                        );
                        setNewMembership({ estateId: "", role: "" }); // Reset form
                      }
                    }}
                    disabled={
                      createMembershipMutation.isPending ||
                      !newMembership.estateId ||
                      !newMembership.role
                    }
                    data-testid="button-add-membership"
                  >
                    {createMembershipMutation.isPending ? "Adding..." : "Add"}
                  </Button>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setShowMemberships(false);
                  setMembershipUser(null);
                }}
              >
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
};

// Providers Management Component
const ProvidersManagement = () => {
  const [search, setSearch] = useState("");
  const [approvalFilter, setApprovalFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [companyFilter, setCompanyFilter] = useState("all");
  const [showAddProvider, setShowAddProvider] = useState(false);
  const [viewMode, setViewMode] = useState<"global" | "estate">("global");
  const [selectedEstateId, setSelectedEstateId] = useState("");

  const { toast } = useToast();
  const { user } = useAdminAuth();
  const isSuperAdmin = user?.globalRole === "super_admin";

  // Initialize view mode from localStorage estate context
  useEffect(() => {
    const estateId = getCurrentEstate();
    if (estateId) {
      setViewMode("estate");
      setSelectedEstateId(estateId);
    } else {
      setViewMode("global");
    }
  }, []);

  // Fetch estates for the dropdown
  const { data: estates } = useQuery({
    queryKey: [`${import.meta.env.VITE_API_URL}/api/admin/estates`],
    queryFn: () => adminApiRequest("GET", "/api/admin/estates"),
    enabled: isSuperAdmin,
  });

  const handleViewModeChange = (mode: "global" | "estate") => {
    setViewMode(mode);
    if (mode === "global") {
      setCurrentEstate(null);
      setSelectedEstateId("");
    }
  };

  const handleEstateSelect = (estateId: string) => {
    setSelectedEstateId(estateId);
    setCurrentEstate(estateId);
  };

  const providerForm = useForm<CreateProviderInput>({
    resolver: zodResolver(createProviderSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      password: "",
      company: "",
      categories: [],
      experience: 0,
      description: "",
      isApproved: true,
    },
  });

  const { data: providers, isLoading } = useQuery({
    queryKey: [
      "/api/admin/bridge/users",
      {
        role: "provider",
        search,
        approved: approvalFilter,
        viewMode,
        selectedEstateId,
      },
    ],
    queryFn: () =>
      adminApiRequest("GET", "/api/admin/bridge/users", {
        role: "provider",
        search: search || undefined,
      }),
  });

  const approveMutation = useMutation({
    mutationFn: ({
      providerId,
      approved,
    }: {
      providerId: string;
      approved: boolean;
    }) =>
      adminApiRequest("PATCH", `/api/admin/bridge/providers/${providerId}/approval`, {
        approved,
      }),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/bridge/users"] });
      toast({
        title: `Provider ${variables.approved ? "approved" : "rejected"} successfully`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error updating provider status",
        description:
          error.response?.data?.error || "Failed to update provider status",
        variant: "destructive",
      });
    },
  });

  const createProviderMutation = useMutation({
    mutationFn: (providerData: CreateProviderInput) =>
      adminApiRequest("POST", "/api/admin/providers", providerData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/providers"] });
      setShowAddProvider(false);
      providerForm.reset();
      toast({ title: "Provider created successfully" });
    },
    onError: (error: any) => {
      const errorMessage = error.response?.data?.details?.length
        ? error.response.data.details.join(", ")
        : error.response?.data?.error || "Failed to create provider";

      toast({
        title: "Error creating provider",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  const handleApproval = (providerId: string, approved: boolean) => {
    approveMutation.mutate({ providerId, approved });
  };

  const onSubmit = (data: CreateProviderInput) => {
    createProviderMutation.mutate(data);
  };

  // Client-side filtering for approval status
  const filteredProviders = providers?.filter((provider: any) => {
    if (approvalFilter === "all") return true;
    if (approvalFilter === "true") return provider.isApproved === true;
    if (approvalFilter === "false") return provider.isApproved === false;
    return true;
  });

  // Get unique companies for filter (all providers will show as Independent since PostgreSQL doesn't have company field yet)
  const uniqueCompanies = Array.from(
    new Set(filteredProviders?.map((p: any) => p.company).filter(Boolean))
  );

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-8 bg-gray-200 rounded w-1/4 animate-pulse"></div>
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="h-16 bg-gray-200 rounded animate-pulse"
            ></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Provider Management
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Approve and manage service providers
          </p>
        </div>
        <Button
          onClick={() => setShowAddProvider(true)}
          data-testid="button-add-provider"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Provider
        </Button>
      </div>

      {/* Global/Estate Toggle - Only for Super Admins */}
      {isSuperAdmin && (
        <Card className={viewMode === "global" ? "bg-purple-500/5 dark:bg-purple-500/10" : "bg-teal-500/5 dark:bg-teal-500/10"}>
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
              {/* Toggle Buttons */}
              <div className="flex items-center gap-2 bg-background border border-border rounded-lg p-1 h-10">
                <Button
                  variant={viewMode === "global" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => handleViewModeChange("global")}
                  className={`transition-all duration-200 ${
                    viewMode === "global"
                      ? "bg-purple-500 hover:bg-purple-600 text-white shadow-[0_0_20px_rgba(168,85,247,0.15)]"
                      : ""
                  }`}
                  data-testid="button-provider-view-global"
                >
                  <Globe className="w-4 h-4 mr-2" />
                  Global
                </Button>
                <Button
                  variant={viewMode === "estate" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => handleViewModeChange("estate")}
                  className={`transition-all duration-200 ${
                    viewMode === "estate"
                      ? "bg-teal-500 hover:bg-teal-600 text-white shadow-[0_0_20px_rgba(20,184,166,0.15)]"
                      : ""
                  }`}
                  data-testid="button-provider-view-estate"
                >
                  <Building2 className="w-4 h-4 mr-2" />
                  Estate
                </Button>
              </div>

              {/* Estate Selector - Shows when Estate mode is active */}
              {viewMode === "estate" && (
                <Select value={selectedEstateId} onValueChange={handleEstateSelect}>
                  <SelectTrigger className="w-full sm:w-[280px]" data-testid="select-provider-estate-filter">
                    <SelectValue placeholder="Select an estate..." />
                  </SelectTrigger>
                  <SelectContent>
                    {estates && estates.length > 0 ? (
                      estates.map((estate: any) => (
                        <SelectItem key={estate._id} value={estate._id}>
                          <div className="flex flex-col">
                            <span className="font-medium">{estate.name}</span>
                            <span className="text-xs text-muted-foreground">{estate.address}</span>
                          </div>
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="none" disabled>
                        No estates available
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              )}

              {/* Context Badge */}
              <div className="flex-1">
                <Badge
                  variant="outline"
                  className={`text-sm ${
                    viewMode === "global"
                      ? "border-purple-500 text-purple-600 dark:text-purple-400"
                      : "border-teal-500 text-teal-600 dark:text-teal-400"
                  }`}
                >
                  {viewMode === "global" ? (
                    <>
                      <div className="w-2 h-2 rounded-full bg-purple-500 mr-2"></div>
                      Viewing all providers globally
                    </>
                  ) : selectedEstateId ? (
                    <>
                      <div className="w-2 h-2 rounded-full bg-teal-500 mr-2"></div>
                      Estate: {estates?.find((e: any) => e._id === selectedEstateId)?.name || "Selected"}
                    </>
                  ) : (
                    <>Please select an estate</>
                  )}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Search providers by categories..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                  data-testid="input-search-providers"
                />
              </div>
            </div>
            <Select value={approvalFilter} onValueChange={setApprovalFilter}>
              <SelectTrigger
                className="w-48"
                data-testid="select-approval-filter"
              >
                <SelectValue placeholder="Filter by approval" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Providers</SelectItem>
                <SelectItem value="true">Approved</SelectItem>
                <SelectItem value="false">Pending Approval</SelectItem>
              </SelectContent>
            </Select>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger
                className="w-48"
                data-testid="select-category-filter"
              >
                <SelectValue placeholder="Filter by category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                <SelectItem value="electrician">Electrician</SelectItem>
                <SelectItem value="plumber">Plumber</SelectItem>
                <SelectItem value="carpenter">Carpenter</SelectItem>
                <SelectItem value="market_runner">Market Runner</SelectItem>
              </SelectContent>
            </Select>
            <Select value={companyFilter} onValueChange={setCompanyFilter}>
              <SelectTrigger
                className="w-48"
                data-testid="select-company-filter"
              >
                <SelectValue placeholder="Filter by company" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Companies</SelectItem>
                <SelectItem value="independent">Independent</SelectItem>
                {providers && Array.from(new Set(providers.map((p: any) => p.company).filter(Boolean))).map((company: any) => (
                  <SelectItem key={company} value={company}>
                    {company}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Providers Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Provider ID</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Categories</TableHead>
                <TableHead>Experience</TableHead>
                <TableHead>Rating</TableHead>
                <TableHead>Total Jobs</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProviders?.map((provider: any) => (
                <TableRow
                  key={provider.id}
                  data-testid={`row-provider-${provider.id}`}
                >
                  <TableCell className="font-medium">
                    {provider.name}
                  </TableCell>
                  <TableCell>
                    {provider.company ? (
                      <span className="text-sm font-medium">{provider.company}</span>
                    ) : (
                      <span className="text-sm text-muted-foreground">Independent</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {provider.categories
                        ?.slice(0, 2)
                        .map((category: string) => (
                          <Badge
                            key={category}
                            variant="outline"
                            className="text-xs"
                          >
                            {category.replace("_", " ")}
                          </Badge>
                        ))}
                      {provider.categories?.length > 2 && (
                        <Badge variant="outline" className="text-xs">
                          +{provider.categories.length - 2} more
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{provider.experience || 0} years</TableCell>
                  <TableCell>
                    <div className="flex items-center">
                      <Star className="w-4 h-4 fill-yellow-400 text-yellow-400 mr-1" />
                      {provider.rating ? Number(provider.rating).toFixed(1) : "N/A"}
                    </div>
                  </TableCell>
                  <TableCell>{provider.totalJobs || 0}</TableCell>
                  <TableCell>
                    <Badge
                      variant={provider.isApproved ? "default" : "destructive"}
                    >
                      {provider.isApproved ? "Approved" : "Pending"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex space-x-2">
                      {!provider.isApproved ? (
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => handleApproval(provider.id, true)}
                          disabled={approveMutation.isPending}
                          data-testid={`button-approve-provider-${provider.id}`}
                        >
                          <CheckCircle className="w-4 h-4" />
                        </Button>
                      ) : (
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleApproval(provider.id, false)}
                          disabled={approveMutation.isPending}
                          data-testid={`button-reject-provider-${provider.id}`}
                        >
                          <XCircle className="w-4 h-4" />
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        data-testid={`button-edit-provider-${provider.id}`}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {(!filteredProviders || filteredProviders.length === 0) && (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className="text-center py-8 text-gray-500"
                  >
                    No providers found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Add Provider Dialog */}
      <Dialog
        open={showAddProvider}
        onOpenChange={(open) => {
          setShowAddProvider(open);
          if (!open) providerForm.reset();
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add New Service Provider</DialogTitle>
            <DialogDescription>
              Create a new service provider account. They will be automatically
              approved.
            </DialogDescription>
          </DialogHeader>

          <Form {...providerForm}>
            <form
              onSubmit={providerForm.handleSubmit(onSubmit)}
              className="space-y-6"
            >
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={providerForm.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Full Name *</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Enter provider name"
                            {...field}
                            data-testid="input-provider-name"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={providerForm.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email *</FormLabel>
                        <FormControl>
                          <Input
                            type="email"
                            placeholder="Enter email address"
                            {...field}
                            data-testid="input-provider-email"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={providerForm.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Phone Number</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Enter phone number"
                            {...field}
                            data-testid="input-provider-phone"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={providerForm.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Password *</FormLabel>
                        <FormControl>
                          <Input
                            type="password"
                            placeholder="Enter password"
                            {...field}
                            data-testid="input-provider-password"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={providerForm.control}
                  name="company"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Company Name</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Enter company name (optional)"
                          {...field}
                          data-testid="input-provider-company"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={providerForm.control}
                  name="experience"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Years of Experience</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="Enter years of experience"
                          {...field}
                          onChange={(e) =>
                            field.onChange(parseInt(e.target.value) || 0)
                          }
                          data-testid="input-provider-experience"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={providerForm.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Brief description of services offered"
                          {...field}
                          data-testid="textarea-provider-description"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={providerForm.control}
                  name="categories"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Service Categories *</FormLabel>
                      <div className="grid grid-cols-2 gap-2 mt-2">
                        {[
                          "electrician",
                          "plumber",
                          "carpenter",
                          "market_runner",
                        ].map((category) => (
                          <div
                            key={category}
                            className="flex items-center space-x-2"
                          >
                            <input
                              type="checkbox"
                              id={`category-${category}`}
                              checked={field.value?.includes(category) || false}
                              onChange={(e) => {
                                const updatedCategories = e.target.checked
                                  ? [...(field.value || []), category]
                                  : (field.value || []).filter(
                                      (c) => c !== category,
                                    );
                                field.onChange(updatedCategories);
                              }}
                              data-testid={`checkbox-category-${category}`}
                            />
                            <Label
                              htmlFor={`category-${category}`}
                              className="cursor-pointer"
                            >
                              {category
                                .replace("_", " ")
                                .replace(/\b\w/g, (l) => l.toUpperCase())}
                            </Label>
                          </div>
                        ))}
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowAddProvider(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createProviderMutation.isPending}
                  data-testid="button-submit-provider"
                >
                  {createProviderMutation.isPending
                    ? "Creating..."
                    : "Create Provider"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// Categories Management Component
const CategoriesManagement = () => {
  const [search, setSearch] = useState("");
  const [scopeFilter, setScopeFilter] = useState("all");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<any>(null);
  const [formData, setFormData] = useState({
    name: "",
    key: "",
    description: "",
    icon: "",
    scope: "estate",
  });

  const { user } = useAdminAuth();
  const { toast } = useToast();
  const isSuperAdmin = user?.globalRole === "super_admin";

  const { data: categories, isLoading } = useQuery({
    queryKey: ["${import.meta.env.VITE_API_URL}/api/admin/categories", { scope: scopeFilter }],
    queryFn: () => {
      const params = new URLSearchParams();
      if (scopeFilter !== "all") params.set("scope", scopeFilter);
      return adminApiRequest(
        "GET",
        `/api/admin/categories?${params.toString()}`,
      );
    },
  });

  const createCategoryMutation = useMutation({
    mutationFn: (categoryData: any) =>
      adminApiRequest("POST", "/api/admin/categories", categoryData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/categories"] });
      setIsCreateDialogOpen(false);
      resetForm();
      toast({ title: "Category created successfully" });
    },
    onError: (error: any) => {
      toast({
        title: "Error creating category",
        description: error.response?.data?.error || "Failed to create category",
        variant: "destructive",
      });
    },
  });

  const updateCategoryMutation = useMutation({
    mutationFn: ({ id, ...data }: any) =>
      adminApiRequest("PATCH", `/api/admin/categories/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/categories"] });
      setEditingCategory(null);
      resetForm();
      toast({ title: "Category updated successfully" });
    },
    onError: (error: any) => {
      toast({
        title: "Error updating category",
        description: error.response?.data?.error || "Failed to update category",
        variant: "destructive",
      });
    },
  });

  const deleteCategoryMutation = useMutation({
    mutationFn: (categoryId: string) =>
      adminApiRequest("DELETE", `/api/admin/categories/${categoryId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/categories"] });
      toast({ title: "Category deleted successfully" });
    },
    onError: (error: any) => {
      toast({
        title: "Error deleting category",
        description: error.response?.data?.error || "Failed to delete category",
        variant: "destructive",
      });
    },
  });

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const categoryData = {
      ...formData,
      key: formData.key || formData.name.toLowerCase().replace(/\s+/g, "_"),
    };
    createCategoryMutation.mutate(categoryData);
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingCategory) {
      updateCategoryMutation.mutate({ id: editingCategory._id, ...formData });
    }
  };

  const handleDeleteCategory = (categoryId: string) => {
    if (
      confirm(
        "Are you sure you want to delete this category? This action cannot be undone.",
      )
    ) {
      deleteCategoryMutation.mutate(categoryId);
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      key: "",
      description: "",
      icon: "",
      scope: "estate",
    });
  };

  const handleOpenEditDialog = (category: any) => {
    setEditingCategory(category);
    setFormData({
      name: category.name || "",
      key: category.key || "",
      description: category.description || "",
      icon: category.icon || "",
      scope: category.scope || "estate",
    });
  };

  const filteredCategories =
    categories?.filter((category: any) => {
      return (
        category.name?.toLowerCase().includes(search.toLowerCase()) ||
        category.key?.toLowerCase().includes(search.toLowerCase())
      );
    }) || [];

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-8 bg-gray-200 rounded w-1/4 animate-pulse"></div>
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className="h-16 bg-gray-200 rounded animate-pulse"
            ></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Service Categories
          </h1>
          <p className="text-gray-600 dark:text-gray-300">
            Manage global and estate-specific service categories
          </p>
        </div>
        <Button
          onClick={() => setIsCreateDialogOpen(true)}
          className="mt-4 sm:mt-0"
          data-testid="button-create-category"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Category
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <Input
                placeholder="Search categories..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full"
                data-testid="input-search-categories"
              />
            </div>
            <Select value={scopeFilter} onValueChange={setScopeFilter}>
              <SelectTrigger
                className="w-full sm:w-48"
                data-testid="select-scope-filter"
              >
                <SelectValue placeholder="Filter by scope" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Scopes</SelectItem>
                <SelectItem value="global">Global</SelectItem>
                <SelectItem value="estate">Estate</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Categories Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Key</TableHead>
                <TableHead>Scope</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCategories.map((category: any) => (
                <TableRow
                  key={category._id}
                  data-testid={`row-category-${category._id}`}
                >
                  <TableCell>
                    <div className="flex items-center space-x-2">
                      {category.icon && (
                        <span className="text-lg">{category.icon}</span>
                      )}
                      <span
                        className="font-medium"
                        data-testid={`text-category-name-${category._id}`}
                      >
                        {category.name}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <code className="text-xs bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
                      {category.key}
                    </code>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        category.scope === "global" ? "default" : "secondary"
                      }
                    >
                      {category.scope}
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-xs truncate">
                    {category.description || "-"}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={category.isActive ? "default" : "secondary"}
                    >
                      {category.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex space-x-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleOpenEditDialog(category)}
                        data-testid={`button-edit-category-${category._id}`}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteCategory(category._id)}
                        className="text-red-600 hover:text-red-700"
                        data-testid={`button-delete-category-${category._id}`}
                      >
                        <XCircle className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create Category Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create New Category</DialogTitle>
            <DialogDescription>
              Add a new service category for{" "}
              {isSuperAdmin
                ? "global use or estate-specific use"
                : "your estate"}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateSubmit} className="space-y-4">
            <div>
              <label className="text-sm font-medium">Name</label>
              <Input
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder="Category name"
                required
                data-testid="input-category-name"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Key</label>
              <Input
                value={formData.key}
                onChange={(e) =>
                  setFormData({ ...formData, key: e.target.value })
                }
                placeholder="category_key (auto-generated if empty)"
                data-testid="input-category-key"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Description</label>
              <Input
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                placeholder="Optional description"
                data-testid="input-category-description"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Icon</label>
              <Input
                value={formData.icon}
                onChange={(e) =>
                  setFormData({ ...formData, icon: e.target.value })
                }
                placeholder="🔧 (optional emoji icon)"
                data-testid="input-category-icon"
              />
            </div>
            {isSuperAdmin && (
              <div>
                <label className="text-sm font-medium">Scope</label>
                <Select
                  value={formData.scope}
                  onValueChange={(value) =>
                    setFormData({ ...formData, scope: value })
                  }
                >
                  <SelectTrigger data-testid="select-category-scope">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="global">Global (all estates)</SelectItem>
                    <SelectItem value="estate">Estate specific</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsCreateDialogOpen(false);
                  resetForm();
                }}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createCategoryMutation.isPending}
                data-testid="button-submit-create-category"
              >
                {createCategoryMutation.isPending
                  ? "Creating..."
                  : "Create Category"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Category Dialog */}
      <Dialog
        open={!!editingCategory}
        onOpenChange={(open) => {
          if (!open) {
            setEditingCategory(null);
            resetForm();
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Category</DialogTitle>
            <DialogDescription>Update the category details</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEditSubmit} className="space-y-4">
            <div>
              <label className="text-sm font-medium">Name</label>
              <Input
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder="Category name"
                required
                data-testid="input-edit-category-name"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Description</label>
              <Input
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                placeholder="Optional description"
                data-testid="input-edit-category-description"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Icon</label>
              <Input
                value={formData.icon}
                onChange={(e) =>
                  setFormData({ ...formData, icon: e.target.value })
                }
                placeholder="🔧 (optional emoji icon)"
                data-testid="input-edit-category-icon"
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setEditingCategory(null);
                  resetForm();
                }}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={updateCategoryMutation.isPending}
                data-testid="button-submit-edit-category"
              >
                {updateCategoryMutation.isPending
                  ? "Updating..."
                  : "Update Category"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// Marketplace Management Component
const MarketplaceManagement = () => {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [vendorFilter, setVendorFilter] = useState("all");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<IMarketplaceItem | null>(null);

  const { user } = useAdminAuth();
  const { toast } = useToast();

  // Create form with proper Zod validation
  const createForm = useForm<CreateMarketplaceItemInput>({
    resolver: zodResolver(createMarketplaceItemSchema),
    defaultValues: {
      vendorId: "",
      name: "",
      description: "",
      price: 0,
      currency: "NGN",
      category: "",
      subcategory: "",
      stock: 0,
      images: [],
    },
  });

  // Edit form with proper Zod validation
  const editForm = useForm<UpdateMarketplaceItemInput>({
    resolver: zodResolver(updateMarketplaceItemSchema),
    defaultValues: {
      vendorId: "",
      name: "",
      description: "",
      price: 0,
      currency: "NGN",
      category: "",
      subcategory: "",
      stock: 0,
      images: [],
    },
  });

  // Use hierarchical query keys and default fetcher
  const { data: items, isLoading } = useQuery({
    queryKey: [
      "${import.meta.env.VITE_API_URL}/api/admin/marketplace",
      { category: categoryFilter, vendor: vendorFilter, search },
    ],
    enabled: true,
  });

  // Get categories and vendors for filtering
  const { data: categories } = useQuery({
    queryKey: ["${import.meta.env.VITE_API_URL}/api/admin/categories"],
    enabled: true,
  });

  const { data: vendors } = useQuery({
    queryKey: ["${import.meta.env.VITE_API_URL}/api/admin/providers"],
    enabled: true,
  });

  // Type-safe array access with fallback
  const categoriesArray = Array.isArray(categories) ? categories : [];
  const vendorsArray = Array.isArray(vendors) ? vendors : [];

  const createItemMutation = useMutation({
    mutationFn: (itemData: CreateMarketplaceItemInput) =>
      adminApiRequest("POST", "/api/admin/marketplace", itemData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["${import.meta.env.VITE_API_URL}/api/admin/marketplace"] });
      setIsCreateDialogOpen(false);
      createForm.reset();
      toast({ title: "Marketplace item created successfully" });
    },
    onError: (error: Error & { response?: { data?: { error?: string } } }) => {
      toast({
        title: "Error creating marketplace item",
        description: error.response?.data?.error || "Failed to create item",
        variant: "destructive",
      });
    },
  });

  const updateItemMutation = useMutation({
    mutationFn: ({
      id,
      ...data
    }: { id: string } & UpdateMarketplaceItemInput) =>
      adminApiRequest("PATCH", `/api/admin/marketplace/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/marketplace"] });
      setEditingItem(null);
      editForm.reset();
      toast({ title: "Marketplace item updated successfully" });
    },
    onError: (error: Error & { response?: { data?: { error?: string } } }) => {
      toast({
        title: "Error updating marketplace item",
        description: error.response?.data?.error || "Failed to update item",
        variant: "destructive",
      });
    },
  });

  const deleteItemMutation = useMutation({
    mutationFn: (itemId: string) =>
      adminApiRequest("DELETE", `/api/admin/marketplace/${itemId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/marketplace"] });
      toast({ title: "Marketplace item deleted successfully" });
    },
    onError: (error: Error & { response?: { data?: { error?: string } } }) => {
      toast({
        title: "Error deleting marketplace item",
        description: error.response?.data?.error || "Failed to delete item",
        variant: "destructive",
      });
    },
  });

  const handleCreateSubmit = (data: CreateMarketplaceItemInput) => {
    createItemMutation.mutate(data);
  };

  const handleEditSubmit = (data: UpdateMarketplaceItemInput) => {
    if (editingItem) {
      updateItemMutation.mutate({
        id: editingItem._id,
        ...data,
      });
    }
  };

  const handleDeleteItem = (itemId: string) => {
    if (
      confirm(
        "Are you sure you want to delete this marketplace item? This action cannot be undone.",
      )
    ) {
      deleteItemMutation.mutate(itemId);
    }
  };

  const handleOpenEditDialog = (item: IMarketplaceItem) => {
    setEditingItem(item);
    editForm.reset({
      vendorId: item.vendorId || "",
      name: item.name || "",
      description: item.description || "",
      price: item.price || 0,
      currency: item.currency || "NGN",
      category: item.category || "",
      subcategory: item.subcategory || "",
      stock: item.stock || 0,
      images: item.images || [],
    });
  };

  // Type-safe items filtering with fallback
  const itemsArray = Array.isArray(items) ? (items as IMarketplaceItem[]) : [];
  const filteredItems = itemsArray.filter((item: IMarketplaceItem) => {
    return (
      item.name?.toLowerCase().includes(search.toLowerCase()) ||
      item.description?.toLowerCase().includes(search.toLowerCase())
    );
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-8 bg-gray-200 rounded w-1/4 animate-pulse"></div>
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className="h-20 bg-gray-200 rounded animate-pulse"
            ></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Marketplace Management
          </h1>
          <p className="text-gray-600 dark:text-gray-300">
            Manage marketplace items for food runs and groceries
          </p>
        </div>
        <Button
          onClick={() => setIsCreateDialogOpen(true)}
          className="mt-4 sm:mt-0"
          data-testid="button-create-marketplace-item"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Item
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1">
              <Input
                placeholder="Search items..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full"
                data-testid="input-search-items"
              />
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger
                className="w-full lg:w-48"
                data-testid="select-category-filter"
              >
                <SelectValue placeholder="Filter by category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categoriesArray.map((category: any) => (
                  <SelectItem
                    key={category._id || category.id || category}
                    value={category.key || category.name || category}
                  >
                    {category.name || category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={vendorFilter} onValueChange={setVendorFilter}>
              <SelectTrigger
                className="w-full lg:w-48"
                data-testid="select-vendor-filter"
              >
                <SelectValue placeholder="Filter by vendor" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Vendors</SelectItem>
                {vendorsArray.map((vendor: any) => (
                  <SelectItem
                    key={vendor._id || vendor.id || vendor}
                    value={vendor._id || vendor.id || vendor}
                  >
                    {vendor.name || vendor.email || vendor}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Items Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Stock</TableHead>
                <TableHead>Vendor</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredItems.map((item: any) => (
                <TableRow key={item._id} data-testid={`row-item-${item._id}`}>
                  <TableCell>
                    <div className="flex items-center space-x-3">
                      {item.images?.[0] && (
                        <img
                          src={item.images[0]}
                          alt={item.name}
                          className="w-10 h-10 object-cover rounded"
                        />
                      )}
                      <div>
                        <div
                          className="font-medium"
                          data-testid={`text-item-name-${item._id}`}
                        >
                          {item.name}
                        </div>
                        {item.description && (
                          <div className="text-sm text-gray-500 max-w-xs truncate">
                            {item.description}
                          </div>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div>
                      <Badge variant="outline">{item.category}</Badge>
                      {item.subcategory && (
                        <div className="text-xs text-gray-500 mt-1">
                          {item.subcategory}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="font-medium">
                      {item.currency} {item.price?.toLocaleString()}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge variant={item.stock > 0 ? "default" : "secondary"}>
                      {item.stock} units
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <code className="text-xs bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
                      {item.vendorId}
                    </code>
                  </TableCell>
                  <TableCell>
                    <Badge variant={item.isActive ? "default" : "secondary"}>
                      {item.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex space-x-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleOpenEditDialog(item)}
                        data-testid={`button-edit-item-${item._id}`}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteItem(item._id)}
                        className="text-red-600 hover:text-red-700"
                        data-testid={`button-delete-item-${item._id}`}
                      >
                        <XCircle className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create Item Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Create New Marketplace Item</DialogTitle>
            <DialogDescription>
              Add a new item to the marketplace for residents to purchase
            </DialogDescription>
          </DialogHeader>
          <Form {...createForm}>
            <form
              onSubmit={createForm.handleSubmit(handleCreateSubmit)}
              className="space-y-4"
            >
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={createForm.control}
                  name="vendorId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Vendor ID</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="vendor123"
                          data-testid="input-vendor-id"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={createForm.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Category</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="local_food, grocery"
                          data-testid="input-category"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={createForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Item Name</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Fresh Tomatoes (5kg)"
                        data-testid="input-item-name"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={createForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Fresh tomatoes from local farms"
                        data-testid="input-description"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={createForm.control}
                  name="price"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Price</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="2500"
                          data-testid="input-price"
                          {...field}
                          onChange={(e) =>
                            field.onChange(parseFloat(e.target.value) || 0)
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={createForm.control}
                  name="stock"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Stock</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="50"
                          data-testid="input-stock"
                          {...field}
                          onChange={(e) =>
                            field.onChange(parseInt(e.target.value) || 0)
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={createForm.control}
                name="subcategory"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Subcategory (Optional)</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="vegetables, fruits"
                        data-testid="input-subcategory"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsCreateDialogOpen(false);
                    createForm.reset();
                  }}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createItemMutation.isPending}
                  data-testid="button-submit-create-item"
                >
                  {createItemMutation.isPending ? "Creating..." : "Create Item"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Edit Item Dialog */}
      <Dialog
        open={!!editingItem}
        onOpenChange={(open) => {
          if (!open) {
            setEditingItem(null);
            editForm.reset();
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Marketplace Item</DialogTitle>
            <DialogDescription>Update the item details</DialogDescription>
          </DialogHeader>
          <Form {...editForm}>
            <form
              onSubmit={editForm.handleSubmit(handleEditSubmit)}
              className="space-y-4"
            >
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={editForm.control}
                  name="vendorId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Vendor ID</FormLabel>
                      <FormControl>
                        <Input data-testid="input-edit-vendor-id" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editForm.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Category</FormLabel>
                      <FormControl>
                        <Input data-testid="input-edit-category" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={editForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Item Name</FormLabel>
                    <FormControl>
                      <Input data-testid="input-edit-item-name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Input data-testid="input-edit-description" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={editForm.control}
                  name="price"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Price</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          data-testid="input-edit-price"
                          {...field}
                          onChange={(e) =>
                            field.onChange(parseFloat(e.target.value) || 0)
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editForm.control}
                  name="stock"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Stock</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          data-testid="input-edit-stock"
                          {...field}
                          onChange={(e) =>
                            field.onChange(parseInt(e.target.value) || 0)
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={editForm.control}
                name="subcategory"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Subcategory (Optional)</FormLabel>
                    <FormControl>
                      <Input data-testid="input-edit-subcategory" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setEditingItem(null);
                    editForm.reset();
                  }}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={updateItemMutation.isPending}
                  data-testid="button-submit-edit-item"
                >
                  {updateItemMutation.isPending ? "Updating..." : "Update Item"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// Recent Activity Component
const RecentActivity = () => {
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [search, setSearch] = useState("");
  const [limit, setLimit] = useState(10);

  const { data: activities, isLoading } = useQuery({
    queryKey: ["/api/admin/audit-logs", { limit, search, dateFrom, dateTo }],
    queryFn: () => {
      const params = new URLSearchParams();
      if (search) params.append("search", search);
      if (dateFrom) params.append("dateFrom", dateFrom);
      if (dateTo) params.append("dateTo", dateTo);
      params.append("limit", limit.toString());

      const queryString = params.toString();
      return adminApiRequest(
        "GET",
        `/api/admin/audit-logs${queryString ? "?" + queryString : ""}`,
      );
    },
  });

  const exportToCsv = () => {
    if (!activities || activities.length === 0) return;

    const headers = ["Date", "User", "Action", "Target", "Details"];
    const csvContent = [
      headers.join(","),
      ...activities.map((activity: any) =>
        [
          new Date(activity.createdAt).toLocaleString(),
          activity.user?.name || "System",
          activity.action || "",
          activity.target || "",
          activity.details?.replace(/,/g, ";") || "",
        ]
          .map((field) => `"${field}"`)
          .join(","),
      ),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `activity-logs-${new Date().toISOString().split("T")[0]}.csv`,
    );
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getActivityIcon = (action: string) => {
    switch (action?.toLowerCase()) {
      case "create":
      case "register":
        return <Plus className="w-4 h-4 text-green-600" />;
      case "update":
      case "edit":
        return <Edit className="w-4 h-4 text-blue-600" />;
      case "delete":
      case "remove":
        return <XCircle className="w-4 h-4 text-red-600" />;
      case "approve":
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case "reject":
        return <XCircle className="w-4 h-4 text-orange-600" />;
      case "login":
        return <LogOut className="w-4 h-4 text-purple-600" />;
      default:
        return <ClipboardList className="w-4 h-4 text-gray-600" />;
    }
  };

  const getActivityBgColor = (action: string) => {
    switch (action?.toLowerCase()) {
      case "create":
      case "register":
      case "approve":
        return "bg-green-100";
      case "update":
      case "edit":
        return "bg-blue-100";
      case "delete":
      case "remove":
        return "bg-red-100";
      case "reject":
        return "bg-orange-100";
      case "login":
        return "bg-purple-100";
      default:
        return "bg-gray-100";
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Recent Activity
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={exportToCsv}
              disabled={!activities || activities.length === 0}
              data-testid="button-export-activity"
            >
              <Download className="w-4 h-4 mr-2" />
              Export CSV
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
          <div>
            <Label htmlFor="dateFrom" className="text-sm">
              From Date
            </Label>
            <Input
              id="dateFrom"
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="mt-1"
              data-testid="input-date-from"
            />
          </div>
          <div>
            <Label htmlFor="dateTo" className="text-sm">
              To Date
            </Label>
            <Input
              id="dateTo"
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="mt-1"
              data-testid="input-date-to"
            />
          </div>
          <div>
            <Label htmlFor="activitySearch" className="text-sm">
              Search
            </Label>
            <Input
              id="activitySearch"
              placeholder="Search activities..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="mt-1"
              data-testid="input-search-activity"
            />
          </div>
          <div>
            <Label htmlFor="limit" className="text-sm">
              Show Records
            </Label>
            <Select
              value={limit.toString()}
              onValueChange={(value) => setLimit(Number(value))}
            >
              <SelectTrigger
                className="mt-1"
                data-testid="select-activity-limit"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="25">25</SelectItem>
                <SelectItem value="50">50</SelectItem>
                <SelectItem value="100">100</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Activity List */}
        <div className="space-y-3">
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className="flex items-center space-x-4 animate-pulse"
                >
                  <div className="w-8 h-8 bg-gray-200 rounded-full"></div>
                  <div className="flex-1 space-y-1">
                    <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                    <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                  </div>
                </div>
              ))}
            </div>
          ) : activities && activities.length > 0 ? (
            activities.map((activity: any, index: number) => (
              <div
                key={activity._id || index}
                className="flex items-center space-x-4 p-3 hover:bg-gray-50 rounded-lg"
              >
                <div
                  className={`w-8 h-8 ${getActivityBgColor(activity.action)} rounded-full flex items-center justify-center`}
                >
                  {getActivityIcon(activity.action)}
                </div>
                <div className="flex-1">
                  <p
                    className="text-sm font-medium"
                    data-testid={`activity-action-${index}`}
                  >
                    {activity.action || "Unknown action"}{" "}
                    {activity.target && `- ${activity.target}`}
                  </p>
                  <p
                    className="text-xs text-muted-foreground"
                    data-testid={`activity-details-${index}`}
                  >
                    {activity.user?.name || "System"} •{" "}
                    {activity.details || "No details"} •{" "}
                    {activity.createdAt
                      ? new Date(activity.createdAt).toLocaleString()
                      : "Unknown time"}
                  </p>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-8 text-gray-500">
              <ClipboardList className="w-8 h-8 mx-auto mb-2 text-gray-400" />
              <p>No recent activity found</p>
              {(dateFrom || dateTo || search) && (
                <Button
                  variant="link"
                  size="sm"
                  onClick={() => {
                    setDateFrom("");
                    setDateTo("");
                    setSearch("");
                  }}
                  className="mt-2"
                >
                  Clear filters
                </Button>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

// PostgreSQL Bridge Stats Component - Shows data from resident/provider system
const PostgreSQLBridgeStats = () => {
  const { data: bridgeStats, isLoading } = useQuery({
    queryKey: ["${import.meta.env.VITE_API_URL}/api/admin/bridge/stats"],
    queryFn: () => adminApiRequest("GET", "/api/admin/bridge/stats"),
  });

  if (isLoading) {
    return (
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-foreground">
            Resident & Provider System Data
          </h3>
          <Badge variant="secondary">PostgreSQL</Badge>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="animate-pulse">
                  <div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
                  <div className="h-8 bg-gray-200 rounded w-1/3 mb-2"></div>
                  <div className="h-3 bg-gray-200 rounded w-2/3"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const bridgeStatCards = [
    {
      title: "Total Residents",
      value: bridgeStats?.users?.totalResidents || 0,
      icon: Users,
      description: "Active residents in the system",
      color: "text-blue-600",
    },
    {
      title: "Service Providers",
      value: bridgeStats?.users?.totalProviders || 0,
      icon: UserCheck,
      description: "Registered service providers",
      color: "text-green-600",
    },
    {
      title: "Service Requests",
      value: bridgeStats?.serviceRequests?.total || 0,
      icon: ClipboardList,
      description: "Total service requests",
      color: "text-purple-600",
    },
    {
      title: "Pending Approvals",
      value: bridgeStats?.users?.pendingProviders || 0,
      icon: AlertTriangle,
      description: "Providers awaiting approval",
      color: "text-orange-600",
    },
  ];

  const requestStatusData = bridgeStats?.serviceRequests
    ? [
        {
          label: "Pending",
          value: bridgeStats.serviceRequests.pending,
          color: "bg-yellow-500",
        },
        {
          label: "In Progress",
          value: bridgeStats.serviceRequests.inProgress,
          color: "bg-blue-500",
        },
        {
          label: "Completed",
          value: bridgeStats.serviceRequests.completed,
          color: "bg-green-500",
        },
        {
          label: "Cancelled",
          value: bridgeStats.serviceRequests.cancelled,
          color: "bg-red-500",
        },
      ]
    : [];

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-foreground">
          Resident & Provider System Data
        </h3>
        <div className="flex items-center gap-2">
          <Badge variant="secondary">PostgreSQL</Badge>
          <Badge variant="outline">Live Data</Badge>
        </div>
      </div>

      {/* Bridge Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        {bridgeStatCards.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <Card key={index} className="border-l-4 border-l-blue-500">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      {stat.title}
                    </p>
                    <p
                      className={`text-2xl font-bold ${stat.color}`}
                      data-testid={`bridge-stat-${stat.title.toLowerCase().replace(" ", "-")}`}
                    >
                      {stat.value}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {stat.description}
                    </p>
                  </div>
                  <div className="bg-blue-50 p-3 rounded-lg">
                    <Icon className="w-6 h-6 text-blue-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Service Request Status Breakdown */}
      {requestStatusData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Service Request Status Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {requestStatusData.map((status, index) => (
                <div key={index} className="text-center">
                  <div
                    className={`w-full h-2 ${status.color} rounded-full mb-2`}
                  ></div>
                  <p className="text-sm font-medium">{status.label}</p>
                  <p className="text-lg font-bold">{status.value}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

// Dashboard Stats Component
const DashboardStats = () => {
  const { data: stats, isLoading } = useQuery({
    queryKey: ["${import.meta.env.VITE_API_URL}/api/admin/dashboard/stats"],
    queryFn: () => adminApiRequest("GET", "/api/admin/dashboard/stats"),
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <div className="animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
                <div className="h-8 bg-gray-200 rounded w-1/3 mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-2/3"></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const statCards = [
    {
      title: "Total Users",
      value: stats?.totalUsers || 0,
      icon: Users,
      change: "+12.5%",
      trend: "up",
    },
    {
      title: "Active Estates",
      value: stats?.totalEstates || 0,
      icon: Building2,
      change: "+3.2%",
      trend: "up",
    },
    {
      title: "Service Providers",
      value: stats?.totalProviders || 0,
      icon: UserCheck,
      change: "+8.1%",
      trend: "up",
    },
    {
      title: "Total Revenue",
      value: `₦${(stats?.totalRevenue || 0).toLocaleString()}`,
      icon: DollarSign,
      change: "+15.3%",
      trend: "up",
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      {statCards.map((stat, index) => {
        const Icon = stat.icon;
        return (
          <Card key={index}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    {stat.title}
                  </p>
                  <p
                    className="text-2xl font-bold text-foreground"
                    data-testid={`stat-${stat.title.toLowerCase().replace(" ", "-")}`}
                  >
                    {stat.value}
                  </p>
                </div>
                <div className="bg-primary/10 p-3 rounded-lg">
                  <Icon className="w-6 h-6 text-primary" />
                </div>
              </div>
              <div className="flex items-center mt-2">
                <TrendingUp className="w-4 h-4 text-green-500 mr-1" />
                <span className="text-sm text-green-500">{stat.change}</span>
                <span className="text-sm text-muted-foreground ml-1">
                  vs last month
                </span>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};

// Main Admin Dashboard Component
export default function AdminSuperDashboard() {
  const { user, token } = useAdminAuth();
  const [activeTab, setActiveTab] = useState("dashboard");
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  // Redirect to login if not authenticated
  if (!token || !user) {
    return <AdminLogin />;
  }

  return (
    
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="flex">
        {/* Sidebar */}
        <AdminSidebar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          isMobileOpen={isMobileOpen}
          setIsMobileOpen={setIsMobileOpen}
        />

        {/* Main Content */}
        <div className="flex-1 lg:ml-0">
          {/* Mobile Header */}
          <div className="lg:hidden bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-4">
            <div className="flex items-center justify-between">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsMobileOpen(true)}
              >
                <Menu className="w-4 h-4" />
              </Button>
              <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
                {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}
              </h1>
              <div></div>
            </div>
          </div>

          {/* Page Content */}
          <div className="p-6">
            {activeTab === "dashboard" && (
              <div>
                <div className="mb-6">
                  <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                    Dashboard Overview
                  </h1>
                  <p className="text-gray-600 dark:text-gray-400">
                    Welcome back, {user.name}! Here's what's happening across
                    your platform.
                  </p>
                </div>

                <DashboardStats />

                <PostgreSQLBridgeStats />

                {/* Recent Activity */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <RecentActivity />

                  <Card>
                    <CardHeader>
                      <CardTitle>Estate Performance</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium">
                            Lekki Estate
                          </span>
                          <div className="flex items-center space-x-2">
                            <div className="w-20 h-2 bg-gray-200 rounded-full">
                              <div className="w-16 h-2 bg-green-500 rounded-full"></div>
                            </div>
                            <span className="text-xs text-muted-foreground">
                              85%
                            </span>
                          </div>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium">
                            Victoria Island
                          </span>
                          <div className="flex items-center space-x-2">
                            <div className="w-20 h-2 bg-gray-200 rounded-full">
                              <div className="w-14 h-2 bg-blue-500 rounded-full"></div>
                            </div>
                            <span className="text-xs text-muted-foreground">
                              72%
                            </span>
                          </div>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium">
                            Ikoyi Estate
                          </span>
                          <div className="flex items-center space-x-2">
                            <div className="w-20 h-2 bg-gray-200 rounded-full">
                              <div className="w-12 h-2 bg-yellow-500 rounded-full"></div>
                            </div>
                            <span className="text-xs text-muted-foreground">
                              68%
                            </span>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            )}

            {activeTab === "users" && <UsersManagement />}
            {activeTab === "estates" && <EstatesManagement />}
            {activeTab === "providers" && <ProvidersManagement />}
            {activeTab === "stores" && <StoresManagement />}
            {activeTab === "categories" && <CategoriesManagement />}
            {activeTab === "orders" && <OrdersManagement />}
            {activeTab === "requests" && <ArtisanRequestsPanel />}
            {activeTab === "artisanRequests" && <ArtisanRequestsPanel />}

            {activeTab !== "dashboard" &&
              activeTab !== "users" &&
              activeTab !== "estates" &&
              activeTab !== "providers" &&
              activeTab !== "stores" &&
              activeTab !== "categories" &&
              activeTab !== "marketplace" &&
              activeTab !== "orders" && (
                <div className="text-center py-12">
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                    {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}{" "}
                    Management
                  </h2>
                  <p className="text-gray-600 dark:text-gray-400 mb-8">
                    This module is under development. Coming soon!
                  </p>
                  <Card className="max-w-md mx-auto">
                    <CardContent className="p-6">
                      <div className="text-muted-foreground">
                        <Package className="w-12 h-12 mx-auto mb-4" />
                        <p className="text-sm">
                          The {activeTab} management module will provide
                          comprehensive tools for managing this aspect of your
                          platform.
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}
          </div>
        </div>
      </div>
    </div>
    
  );
}

// Estates Management Component
const EstatesManagement = () => {
  const [search, setSearch] = useState("");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingEstate, setEditingEstate] = useState<any>(null);
  const [formData, setFormData] = useState({
    name: "",
    slug: "",
    description: "",
    address: "",
    settings: {
      servicesEnabled: [],
      marketplaceEnabled: true,
      paymentMethods: [],
      deliveryRules: {},
    },
  });

  const { user } = useAdminAuth();
  const { toast } = useToast();
  const isSuperAdmin = user?.globalRole === "super_admin";

  const { data: estates, isLoading } = useQuery({
    queryKey: ["${import.meta.env.VITE_API_URL}/api/admin/estates", { search }],
    queryFn: () => {
      const params = new URLSearchParams();
      if (search) params.append("search", search);
      const queryString = params.toString();
      return adminApiRequest(
        "GET",
        `/api/admin/estates${queryString ? "?" + queryString : ""}`,
      );
    },
  });

  const createEstateMutation = useMutation({
    mutationFn: (estateData: any) =>
      adminApiRequest("POST", "/api/admin/estates", estateData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["${import.meta.env.VITE_API_URL}/api/admin/estates"] });
      setIsCreateDialogOpen(false);
      resetForm();
      toast({ title: "Estate created successfully" });
    },
    onError: (error: any) => {
      toast({
        title: "Error creating estate",
        description: error.response?.data?.error || "Failed to create estate",
        variant: "destructive",
      });
    },
  });

  const updateEstateMutation = useMutation({
    mutationFn: ({ id, ...data }: any) =>
      adminApiRequest("PATCH", `/api/admin/estates/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["${import.meta.env.VITE_API_URL}/api/admin/estates"] });
      setEditingEstate(null);
      resetForm();
      toast({ title: "Estate updated successfully" });
    },
    onError: (error: any) => {
      toast({
        title: "Error updating estate",
        description: error.response?.data?.error || "Failed to update estate",
        variant: "destructive",
      });
    },
  });

  const deleteEstateMutation = useMutation({
    mutationFn: (estateId: string) =>
      adminApiRequest("DELETE", `/api/admin/estates/${estateId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["${import.meta.env.VITE_API_URL}/api/admin/estates"] });
      toast({ title: "Estate deleted successfully" });
    },
    onError: (error: any) => {
      toast({
        title: "Error deleting estate",
        description: error.response?.data?.error || "Failed to delete estate",
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setFormData({
      name: "",
      slug: "",
      description: "",
      address: "",
      settings: {
        servicesEnabled: [],
        marketplaceEnabled: true,
        paymentMethods: [],
        deliveryRules: {},
      },
    });
  };

  const handleEdit = (estate: any) => {
    setEditingEstate(estate);
    setFormData({
      name: estate.name || "",
      slug: estate.slug || "",
      description: estate.description || "",
      address: estate.address || "",
      settings: estate.settings || {
        servicesEnabled: [],
        marketplaceEnabled: true,
        paymentMethods: [],
        deliveryRules: {},
      },
    });
  };

  const handleSubmit = () => {
    if (editingEstate) {
      updateEstateMutation.mutate({ id: editingEstate._id, ...formData });
    } else {
      createEstateMutation.mutate({
        ...formData,
        coverage: {
          type: "Polygon",
          coordinates: [
            [
              [0, 0],
              [0, 1],
              [1, 1],
              [1, 0],
              [0, 0],
            ],
          ], // Default polygon
        },
      });
    }
  };

  const handleDelete = (estateId: string) => {
    if (confirm("Are you sure you want to delete this estate?")) {
      deleteEstateMutation.mutate(estateId);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Estate Management
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Manage estates and their configurations
          </p>
        </div>
        {isSuperAdmin && (
          <Button
            onClick={() => setIsCreateDialogOpen(true)}
            data-testid="button-add-estate"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Estate
          </Button>
        )}
      </div>

      {/* Search Bar */}
      <Card>
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Search estates..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
              data-testid="input-search-estates"
            />
          </div>
        </CardContent>
      </Card>

      {/* Estates Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Address</TableHead>
                <TableHead>Marketplace</TableHead>
                <TableHead>Services</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell>
                      <div className="h-4 bg-gray-200 rounded animate-pulse"></div>
                    </TableCell>
                    <TableCell>
                      <div className="h-4 bg-gray-200 rounded animate-pulse"></div>
                    </TableCell>
                    <TableCell>
                      <div className="h-4 bg-gray-200 rounded animate-pulse"></div>
                    </TableCell>
                    <TableCell>
                      <div className="h-4 bg-gray-200 rounded animate-pulse"></div>
                    </TableCell>
                    <TableCell>
                      <div className="h-4 bg-gray-200 rounded animate-pulse"></div>
                    </TableCell>
                    <TableCell>
                      <div className="h-4 bg-gray-200 rounded animate-pulse"></div>
                    </TableCell>
                  </TableRow>
                ))
              ) : estates && estates.length > 0 ? (
                estates.map((estate: any) => (
                  <TableRow key={estate._id}>
                    <TableCell
                      className="font-medium"
                      data-testid={`estate-name-${estate._id}`}
                    >
                      {estate.name}
                    </TableCell>
                    <TableCell data-testid={`estate-address-${estate._id}`}>
                      {estate.address}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          estate.settings?.marketplaceEnabled
                            ? "default"
                            : "secondary"
                        }
                      >
                        {estate.settings?.marketplaceEnabled
                          ? "Enabled"
                          : "Disabled"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">
                        {estate.settings?.servicesEnabled?.length || 0} services
                      </span>
                    </TableCell>
                    <TableCell data-testid={`estate-created-${estate._id}`}>
                      {new Date(estate.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <div className="flex space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEdit(estate)}
                          data-testid={`button-edit-estate-${estate._id}`}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        {isSuperAdmin && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDelete(estate._id)}
                            data-testid={`button-delete-estate-${estate._id}`}
                          >
                            <XCircle className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="text-center py-8 text-gray-500"
                  >
                    No estates found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog
        open={isCreateDialogOpen || !!editingEstate}
        onOpenChange={() => {
          setIsCreateDialogOpen(false);
          setEditingEstate(null);
          resetForm();
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingEstate ? "Edit Estate" : "Create New Estate"}
            </DialogTitle>
            <DialogDescription>
              {editingEstate
                ? "Update estate information"
                : "Add a new estate to the platform"}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="estateName">Estate Name</Label>
                <Input
                  id="estateName"
                  placeholder="Enter estate name"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  data-testid="input-estate-name"
                />
              </div>
              <div>
                <Label htmlFor="estateSlug">Slug</Label>
                <Input
                  id="estateSlug"
                  placeholder="estate-slug"
                  value={formData.slug}
                  onChange={(e) =>
                    setFormData({ ...formData, slug: e.target.value })
                  }
                  data-testid="input-estate-slug"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="estateAddress">Address</Label>
              <Input
                id="estateAddress"
                placeholder="Enter estate address"
                value={formData.address}
                onChange={(e) =>
                  setFormData({ ...formData, address: e.target.value })
                }
                data-testid="input-estate-address"
              />
            </div>

            <div>
              <Label htmlFor="estateDescription">Description</Label>
              <Textarea
                id="estateDescription"
                placeholder="Enter estate description"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                data-testid="textarea-estate-description"
              />
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="marketplaceEnabled"
                checked={formData.settings.marketplaceEnabled}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    settings: {
                      ...formData.settings,
                      marketplaceEnabled: e.target.checked,
                    },
                  })
                }
                data-testid="checkbox-marketplace-enabled"
              />
              <Label htmlFor="marketplaceEnabled">Enable Marketplace</Label>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setIsCreateDialogOpen(false);
                setEditingEstate(null);
                resetForm();
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={
                createEstateMutation.isPending || updateEstateMutation.isPending
              }
              data-testid="button-submit-estate"
            >
              {createEstateMutation.isPending || updateEstateMutation.isPending
                ? "Saving..."
                : editingEstate
                  ? "Update Estate"
                  : "Create Estate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// Orders Management Component
const OrdersManagement = () => {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [disputeFilter, setDisputeFilter] = useState("all");
  const [dateRange, setDateRange] = useState({ start: "", end: "" });
  const [priceRange, setPriceRange] = useState({ min: "", max: "" });
  const [sortBy, setSortBy] = useState("createdAt");
  const [sortOrder, setSortOrder] = useState("desc");
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [showOrderDetails, setShowOrderDetails] = useState(false);
  const [showDisputeModal, setShowDisputeModal] = useState(false);
  const [disputeAction, setDisputeAction] = useState<"create" | "resolve">(
    "create",
  );
  const [disputeForm, setDisputeForm] = useState({
    reason: "",
    description: "",
    status: "resolved",
    resolution: "",
    refundAmount: 0,
  });

  // Query parameters
  const queryParams = {
    search: search || undefined,
    status: statusFilter === "all" ? undefined : statusFilter,
    hasDispute:
      disputeFilter === "disputes"
        ? "true"
        : disputeFilter === "no-disputes"
          ? "false"
          : undefined,
    startDate: dateRange.start || undefined,
    endDate: dateRange.end || undefined,
    minTotal: priceRange.min ? Number(priceRange.min) : undefined,
    maxTotal: priceRange.max ? Number(priceRange.max) : undefined,
    page,
    limit,
    sortBy,
    sortOrder,
  };

  const { data: ordersData, isLoading: ordersLoading } = useQuery({
    queryKey: ["${import.meta.env.VITE_API_URL}/api/admin/orders", queryParams],
    queryFn: () => adminApiRequest("GET", "/api/admin/orders", queryParams),
  });

  const { data: orderStats } = useQuery({
    queryKey: ["${import.meta.env.VITE_API_URL}/api/admin/orders/analytics/stats"],
    queryFn: () => adminApiRequest("GET", "/api/admin/orders/analytics/stats"),
  });

  const updateOrderStatusMutation = useMutation({
    mutationFn: ({ orderId, status }: { orderId: string; status: string }) =>
      adminApiRequest("PATCH", `/api/admin/orders/${orderId}/status`, {
        status,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["${import.meta.env.VITE_API_URL}/api/admin/orders"] });
      queryClient.invalidateQueries({
        queryKey: ["${import.meta.env.VITE_API_URL}/api/admin/orders/analytics/stats"],
      });
      setShowOrderDetails(false);
    },
  });

  const createDisputeMutation = useMutation({
    mutationFn: ({
      orderId,
      reason,
      description,
    }: {
      orderId: string;
      reason: string;
      description?: string;
    }) =>
      adminApiRequest("POST", `/api/admin/orders/${orderId}/dispute`, {
        reason,
        description,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["${import.meta.env.VITE_API_URL}/api/admin/orders"] });
      setShowDisputeModal(false);
      setDisputeForm({
        reason: "",
        description: "",
        status: "resolved",
        resolution: "",
        refundAmount: 0,
      });
    },
  });

  const resolveDisputeMutation = useMutation({
    mutationFn: ({
      orderId,
      status,
      resolution,
      refundAmount,
    }: {
      orderId: string;
      status: string;
      resolution: string;
      refundAmount?: number;
    }) =>
      adminApiRequest("PATCH", `/api/admin/orders/${orderId}/dispute`, {
        status,
        resolution,
        refundAmount,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["${import.meta.env.VITE_API_URL}/api/admin/orders"] });
      queryClient.invalidateQueries({
        queryKey: ["${import.meta.env.VITE_API_URL}/api/admin/orders/analytics/stats"],
      });
      setShowDisputeModal(false);
      setDisputeForm({
        reason: "",
        description: "",
        status: "resolved",
        resolution: "",
        refundAmount: 0,
      });
    },
  });

  const handleStatusChange = (orderId: string, status: string) => {
    updateOrderStatusMutation.mutate({ orderId, status });
  };

  const handleCreateDispute = () => {
    if (selectedOrder && disputeForm.reason) {
      createDisputeMutation.mutate({
        orderId: selectedOrder._id,
        reason: disputeForm.reason,
        description: disputeForm.description,
      });
    }
  };

  const handleResolveDispute = () => {
    if (selectedOrder && disputeForm.resolution) {
      resolveDisputeMutation.mutate({
        orderId: selectedOrder._id,
        status: disputeForm.status as "resolved" | "rejected" | "escalated",
        resolution: disputeForm.resolution,
        refundAmount: disputeForm.refundAmount || undefined,
      });
    }
  };

  const resetFilters = () => {
    setSearch("");
    setStatusFilter("all");
    setDisputeFilter("all");
    setDateRange({ start: "", end: "" });
    setPriceRange({ min: "", max: "" });
    setPage(1);
  };

  const orders = ordersData?.orders || [];
  const pagination = ordersData?.pagination;

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200";
      case "processing":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
      case "delivered":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
      case "cancelled":
        return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200";
    }
  };

  const getDisputeStatusColor = (status: string) => {
    switch (status) {
      case "open":
        return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
      case "resolved":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
      case "rejected":
        return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200";
      case "escalated":
        return "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200";
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Stats */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Orders Management
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            Manage orders, track status, and resolve disputes
          </p>
        </div>
      </div>

      {/* Statistics Cards */}
      {orderStats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <Package className="w-8 h-8 text-blue-600" />
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Total Orders
                  </p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {orderStats.totalOrders}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <DollarSign className="w-8 h-8 text-green-600" />
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Total Revenue
                  </p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    ₦{orderStats.totalRevenue?.toLocaleString()}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <AlertTriangle className="w-8 h-8 text-orange-600" />
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Disputed Orders
                  </p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {orderStats.disputedOrders}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <TrendingUp className="w-8 h-8 text-purple-600" />
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Avg Order Value
                  </p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    ₦{orderStats.avgOrderValue?.toFixed(0)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-7 gap-4">
            <div>
              <Label htmlFor="search">Search Orders</Label>
              <Input
                id="search"
                placeholder="Search by order ID, customer, vendor..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1); // Reset to first page when searching
                }}
                data-testid="input-search-orders"
              />
            </div>

            <div>
              <Label htmlFor="status-filter">Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="processing">Processing</SelectItem>
                  <SelectItem value="delivered">Delivered</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="dispute-filter">Disputes</Label>
              <Select value={disputeFilter} onValueChange={setDisputeFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All Orders" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Orders</SelectItem>
                  <SelectItem value="disputes">With Disputes</SelectItem>
                  <SelectItem value="no-disputes">No Disputes</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="start-date">Start Date</Label>
              <Input
                id="start-date"
                type="date"
                value={dateRange.start}
                onChange={(e) =>
                  setDateRange((prev) => ({ ...prev, start: e.target.value }))
                }
                data-testid="input-start-date"
              />
            </div>

            <div>
              <Label htmlFor="end-date">End Date</Label>
              <Input
                id="end-date"
                type="date"
                value={dateRange.end}
                onChange={(e) =>
                  setDateRange((prev) => ({ ...prev, end: e.target.value }))
                }
                data-testid="input-end-date"
              />
            </div>

            <div>
              <Label htmlFor="min-price">Min Price (₦)</Label>
              <Input
                id="min-price"
                type="number"
                placeholder="0"
                value={priceRange.min}
                onChange={(e) =>
                  setPriceRange((prev) => ({ ...prev, min: e.target.value }))
                }
                data-testid="input-min-price"
              />
            </div>

            <div className="flex items-end">
              <Button
                variant="outline"
                onClick={resetFilters}
                className="w-full"
                data-testid="button-reset-filters"
              >
                <X className="w-4 h-4 mr-2" />
                Reset
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Orders Table */}
      <Card>
        <CardContent className="p-0">
          {ordersLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
              <p className="mt-2 text-gray-600 dark:text-gray-400">
                Loading orders...
              </p>
            </div>
          ) : orders.length === 0 ? (
            <div className="text-center py-8">
              <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 dark:text-gray-400">
                No orders found
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Order ID
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Customer
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Vendor
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Total
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Dispute
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {orders.map((order: any) => (
                    <tr
                      key={order._id}
                      className="hover:bg-gray-50 dark:hover:bg-gray-700"
                    >
                      <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white">
                        #{order._id.slice(-8)}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-300">
                        {order.buyer?.name || "Unknown"}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-300">
                        {order.vendor?.name || "Unknown"}
                      </td>
                      <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white">
                        ₦{order.total.toLocaleString()}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(order.status)}`}
                        >
                          {order.status}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {order.dispute?.reason ? (
                          <span
                            className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getDisputeStatusColor(order.dispute.status)}`}
                          >
                            {order.dispute.status}
                          </span>
                        ) : (
                          <span className="text-gray-400">None</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-300">
                        {new Date(order.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 text-sm space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedOrder(order);
                            setShowOrderDetails(true);
                          }}
                          data-testid={`button-view-order-${order._id}`}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        {order.status === "delivered" &&
                          !order.dispute?.reason && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedOrder(order);
                                setDisputeAction("create");
                                setShowDisputeModal(true);
                              }}
                              data-testid={`button-create-dispute-${order._id}`}
                            >
                              <AlertTriangle className="w-4 h-4" />
                            </Button>
                          )}
                        {order.dispute?.reason &&
                          order.dispute.status === "open" && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedOrder(order);
                                setDisputeAction("resolve");
                                setShowDisputeModal(true);
                              }}
                              data-testid={`button-resolve-dispute-${order._id}`}
                            >
                              <CheckCircle className="w-4 h-4" />
                            </Button>
                          )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {pagination && pagination.totalPages > 1 && (
            <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  Showing {(pagination.page - 1) * pagination.limit + 1} to{" "}
                  {Math.min(
                    pagination.page * pagination.limit,
                    pagination.total,
                  )}{" "}
                  of {pagination.total} orders
                </div>
                <div className="flex space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(Math.max(1, page - 1))}
                    disabled={page === 1}
                    data-testid="button-prev-page"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setPage(Math.min(pagination.totalPages, page + 1))
                    }
                    disabled={page === pagination.totalPages}
                    data-testid="button-next-page"
                  >
                    Next
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Order Details Modal */}
      <Dialog open={showOrderDetails} onOpenChange={setShowOrderDetails}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Order Details</DialogTitle>
          </DialogHeader>
          {selectedOrder && (
            <div className="space-y-6">
              {/* Order Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Order ID</Label>
                  <p className="text-sm font-mono">#{selectedOrder._id}</p>
                </div>
                <div>
                  <Label>Status</Label>
                  <span
                    className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(selectedOrder.status)}`}
                  >
                    {selectedOrder.status}
                  </span>
                </div>
                <div>
                  <Label>Customer</Label>
                  <p className="text-sm">{selectedOrder.buyer?.name}</p>
                </div>
                <div>
                  <Label>Vendor</Label>
                  <p className="text-sm">{selectedOrder.vendor?.name}</p>
                </div>
                <div>
                  <Label>Total Amount</Label>
                  <p className="text-sm font-medium">
                    ₦{selectedOrder.total.toLocaleString()}
                  </p>
                </div>
                <div>
                  <Label>Date</Label>
                  <p className="text-sm">
                    {new Date(selectedOrder.createdAt).toLocaleString()}
                  </p>
                </div>
              </div>

              {/* Items */}
              <div>
                <Label>Order Items</Label>
                <div className="mt-2 space-y-2">
                  {selectedOrder.items.map((item: any, index: number) => (
                    <div
                      key={index}
                      className="flex justify-between items-center p-3 border rounded-lg"
                    >
                      <div>
                        <p className="font-medium">{item.name}</p>
                        <p className="text-sm text-gray-600">
                          Quantity: {item.quantity}
                        </p>
                      </div>
                      <p className="font-medium">
                        ₦{(item.price * item.quantity).toLocaleString()}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Dispute Info */}
              {selectedOrder.dispute?.reason && (
                <div>
                  <Label>Dispute Information</Label>
                  <div className="mt-2 p-4 border rounded-lg bg-red-50 dark:bg-red-900/20">
                    <div className="flex justify-between items-start mb-2">
                      <p className="font-medium text-red-800 dark:text-red-200">
                        Reason: {selectedOrder.dispute.reason}
                      </p>
                      <span
                        className={`px-2 py-1 text-xs font-semibold rounded-full ${getDisputeStatusColor(selectedOrder.dispute.status)}`}
                      >
                        {selectedOrder.dispute.status}
                      </span>
                    </div>
                    {selectedOrder.dispute.resolvedAt && (
                      <p className="text-sm text-gray-600 dark:text-gray-300">
                        Resolved:{" "}
                        {new Date(
                          selectedOrder.dispute.resolvedAt,
                        ).toLocaleString()}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Status Actions */}
              {["pending", "processing"].includes(selectedOrder.status) && (
                <div>
                  <Label>Update Status</Label>
                  <div className="mt-2 flex space-x-2">
                    {selectedOrder.status === "pending" && (
                      <Button
                        onClick={() =>
                          handleStatusChange(selectedOrder._id, "processing")
                        }
                        disabled={updateOrderStatusMutation.isPending}
                        data-testid="button-mark-processing"
                      >
                        Mark as Processing
                      </Button>
                    )}
                    {selectedOrder.status === "processing" && (
                      <Button
                        onClick={() =>
                          handleStatusChange(selectedOrder._id, "delivered")
                        }
                        disabled={updateOrderStatusMutation.isPending}
                        data-testid="button-mark-delivered"
                      >
                        Mark as Delivered
                      </Button>
                    )}
                    <Button
                      variant="destructive"
                      onClick={() =>
                        handleStatusChange(selectedOrder._id, "cancelled")
                      }
                      disabled={updateOrderStatusMutation.isPending}
                      data-testid="button-cancel-order"
                    >
                      Cancel Order
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Dispute Modal */}
      <Dialog open={showDisputeModal} onOpenChange={setShowDisputeModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {disputeAction === "create"
                ? "Create Dispute"
                : "Resolve Dispute"}
            </DialogTitle>
          </DialogHeader>

          {disputeAction === "create" ? (
            <div className="space-y-4">
              <div>
                <Label htmlFor="dispute-reason">Dispute Reason *</Label>
                <Input
                  id="dispute-reason"
                  value={disputeForm.reason}
                  onChange={(e) =>
                    setDisputeForm((prev) => ({
                      ...prev,
                      reason: e.target.value,
                    }))
                  }
                  placeholder="Brief reason for dispute"
                  data-testid="input-dispute-reason"
                />
              </div>
              <div>
                <Label htmlFor="dispute-description">Description</Label>
                <Textarea
                  id="dispute-description"
                  value={disputeForm.description}
                  onChange={(e) =>
                    setDisputeForm((prev) => ({
                      ...prev,
                      description: e.target.value,
                    }))
                  }
                  placeholder="Detailed description of the issue"
                  rows={3}
                  data-testid="textarea-dispute-description"
                />
              </div>
              <div className="flex justify-end space-x-2">
                <Button
                  variant="outline"
                  onClick={() => setShowDisputeModal(false)}
                  data-testid="button-cancel-dispute"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleCreateDispute}
                  disabled={
                    !disputeForm.reason || createDisputeMutation.isPending
                  }
                  data-testid="button-create-dispute"
                >
                  Create Dispute
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <Label htmlFor="dispute-status">Resolution Status *</Label>
                <Select
                  value={disputeForm.status}
                  onValueChange={(value) =>
                    setDisputeForm((prev) => ({ ...prev, status: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="resolved">Resolved</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                    <SelectItem value="escalated">Escalated</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="dispute-resolution">Resolution Details *</Label>
                <Textarea
                  id="dispute-resolution"
                  value={disputeForm.resolution}
                  onChange={(e) =>
                    setDisputeForm((prev) => ({
                      ...prev,
                      resolution: e.target.value,
                    }))
                  }
                  placeholder="Detailed resolution or action taken"
                  rows={3}
                  data-testid="textarea-dispute-resolution"
                />
              </div>
              <div>
                <Label htmlFor="refund-amount">Refund Amount (₦)</Label>
                <Input
                  id="refund-amount"
                  type="number"
                  value={disputeForm.refundAmount}
                  onChange={(e) =>
                    setDisputeForm((prev) => ({
                      ...prev,
                      refundAmount: Number(e.target.value),
                    }))
                  }
                  placeholder="0"
                  min="0"
                  max={selectedOrder?.total}
                  data-testid="input-refund-amount"
                />
              </div>
              <div className="flex justify-end space-x-2">
                <Button
                  variant="outline"
                  onClick={() => setShowDisputeModal(false)}
                  data-testid="button-cancel-resolve"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleResolveDispute}
                  disabled={
                    !disputeForm.resolution || resolveDisputeMutation.isPending
                  }
                  data-testid="button-resolve-dispute"
                >
                  Resolve Dispute
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

// Stores Management Component
const StoresManagement = () => {
  const [search, setSearch] = useState("");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedStore, setSelectedStore] = useState<any>(null);
  const [showMembersDialog, setShowMembersDialog] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    location: "",
    phone: "",
    email: "",
  });

  const { user } = useAdminAuth();
  const { toast } = useToast();

  const { data: stores, isLoading } = useQuery({
    queryKey: ["/api/admin/stores", { search }],
    queryFn: () => {
      const params = new URLSearchParams();
      if (search) params.append("search", search);
      const queryString = params.toString();
      return adminApiRequest(
        "GET",
        `/api/admin/stores${queryString ? "?" + queryString : ""}`,
      );
    },
  });

  const createStoreMutation = useMutation({
    mutationFn: (storeData: any) =>
      adminApiRequest("POST", "/api/admin/stores", storeData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stores"] });
      setIsCreateDialogOpen(false);
      setFormData({ name: "", description: "", location: "", phone: "", email: "" });
      toast({ title: "Store created successfully" });
    },
    onError: (error: any) => {
      toast({
        title: "Error creating store",
        description: error.response?.data?.error || "Failed to create store",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = () => {
    if (!formData.name || !formData.location) {
      toast({
        title: "Validation Error",
        description: "Name and location are required",
        variant: "destructive",
      });
      return;
    }
    createStoreMutation.mutate(formData);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Stores Management</CardTitle>
            <Button
              onClick={() => setIsCreateDialogOpen(true)}
              data-testid="button-create-store"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Store
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Search Bar */}
          <div className="mb-6">
            <div className="relative">
              <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search stores..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
                data-testid="input-search-stores"
              />
            </div>
          </div>

          {/* Stores Table */}
          {isLoading ? (
            <div className="text-center py-8">
              <p className="text-gray-600 dark:text-gray-400">Loading stores...</p>
            </div>
          ) : !stores || stores.length === 0 ? (
            <div className="text-center py-8">
              <Store className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 dark:text-gray-400">
                No stores found. Create your first store to get started.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-800">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Store Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Location
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Contact
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                  {stores.map((store: any) => (
                    <tr key={store._id || store.id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <Store className="w-5 h-5 text-gray-400 mr-3" />
                          <div>
                            <div className="text-sm font-medium text-gray-900 dark:text-white">
                              {store.name}
                            </div>
                            {store.description && (
                              <div className="text-sm text-gray-500 dark:text-gray-400">
                                {store.description}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {store.location}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        <div>{store.phone || "—"}</div>
                        <div>{store.email || "—"}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Badge
                          variant={store.isActive ? "default" : "secondary"}
                          data-testid={`badge-store-status-${store._id || store.id}`}
                        >
                          {store.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedStore(store);
                            setShowMembersDialog(true);
                          }}
                          data-testid={`button-view-store-${store._id || store.id}`}
                        >
                          <Users className="w-4 h-4 mr-1" />
                          Members
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Store Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Store</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="store-name">Store Name *</Label>
              <Input
                id="store-name"
                value={formData.name}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, name: e.target.value }))
                }
                placeholder="Enter store name"
                data-testid="input-store-name"
              />
            </div>
            <div>
              <Label htmlFor="store-location">Location *</Label>
              <Input
                id="store-location"
                value={formData.location}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, location: e.target.value }))
                }
                placeholder="Enter store location"
                data-testid="input-store-location"
              />
            </div>
            <div>
              <Label htmlFor="store-description">Description</Label>
              <Textarea
                id="store-description"
                value={formData.description}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, description: e.target.value }))
                }
                placeholder="Brief description of the store"
                rows={3}
                data-testid="textarea-store-description"
              />
            </div>
            <div>
              <Label htmlFor="store-phone">Phone</Label>
              <Input
                id="store-phone"
                value={formData.phone}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, phone: e.target.value }))
                }
                placeholder="+234..."
                data-testid="input-store-phone"
              />
            </div>
            <div>
              <Label htmlFor="store-email">Email</Label>
              <Input
                id="store-email"
                type="email"
                value={formData.email}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, email: e.target.value }))
                }
                placeholder="store@example.com"
                data-testid="input-store-email"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsCreateDialogOpen(false)}
              data-testid="button-cancel-create-store"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={createStoreMutation.isPending}
              data-testid="button-submit-create-store"
            >
              {createStoreMutation.isPending ? "Creating..." : "Create Store"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Store Members Dialog - Coming Soon */}
      <Dialog open={showMembersDialog} onOpenChange={setShowMembersDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Store Members - {selectedStore?.name}</DialogTitle>
          </DialogHeader>
          <div className="text-center py-8">
            <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Store member management functionality is being set up.
            </p>
            <p className="text-sm text-muted-foreground">
              You'll be able to allocate providers to stores and manage their permissions here.
            </p>
          </div>
          <DialogFooter>
            <Button onClick={() => setShowMembersDialog(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
