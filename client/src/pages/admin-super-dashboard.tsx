import { useState, useEffect, createContext, useContext, ReactNode } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { adminApiRequest, setAdminToken, setCurrentEstate } from "@/lib/adminApi";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  EyeOff
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
    throw new Error('useAdminAuth must be used within AdminAuthProvider');
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
    window.addEventListener('admin-auth-failed', handleAuthFailure);
    return () => window.removeEventListener('admin-auth-failed', handleAuthFailure);
  }, []);

  // Auto-refresh token on mount if refresh token exists
  useEffect(() => {
    const refreshTokenFromStorage = sessionStorage.getItem('admin_refresh_token');
    if (refreshTokenFromStorage && !token) {
      refreshToken();
    }
  }, []);

  const refreshToken = async () => {
    const refreshTokenValue = sessionStorage.getItem('admin_refresh_token');
    if (!refreshTokenValue) return;

    try {
      const response: any = await adminApiRequest("POST", "/api/admin/auth/refresh", { 
        refreshToken: refreshTokenValue 
      });
      
      // Race-proof: Set tokens immediately
      setAdminToken(response.accessToken);
      setToken(response.accessToken);
      setUser(response.user);
      sessionStorage.setItem('admin_refresh_token', response.refreshToken);
      
      // Restore estate selection if user has memberships
      if (response.user.memberships && response.user.memberships.length > 0 && !selectedEstateId) {
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
      const response: any = await adminApiRequest("POST", "/api/admin/auth/login", { email, password });
      
      // Race-proof: Set tokens immediately before any queries can fire
      setAdminToken(response.accessToken);
      setToken(response.accessToken);
      setUser(response.user);
      sessionStorage.setItem('admin_refresh_token', response.refreshToken);
      
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
    sessionStorage.removeItem('admin_refresh_token');
    setToken(null);
    setUser(null);
    setLocation('/');
  };

  return (
    <AdminAuthContext.Provider value={{ 
      user, 
      token, 
      selectedEstateId, 
      setSelectedEstateId, 
      login, 
      logout, 
      isLoading, 
      refreshToken 
    }}>
      {children}
    </AdminAuthContext.Provider>
  );
};

// Legacy API request function - now uses centralized adminApiRequest

// Admin Login Component
const AdminLogin = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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
      setLocation('/admin-dashboard');
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
          <p className="text-muted-foreground">
            Multi-tenant Admin Dashboard
          </p>
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
              {isLoading ? 'Signing in...' : 'Sign In'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

// Sidebar Navigation
const AdminSidebar = ({ activeTab, setActiveTab, isMobileOpen, setIsMobileOpen }: {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isMobileOpen: boolean;
  setIsMobileOpen: (open: boolean) => void;
}) => {
  const { user, logout } = useAdminAuth();

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'estates', label: 'Estates', icon: Building2 },
    { id: 'users', label: 'Users', icon: Users },
    { id: 'providers', label: 'Providers', icon: UserCheck },
    { id: 'requests', label: 'Service Requests', icon: ClipboardList },
    { id: 'marketplace', label: 'Marketplace', icon: ShoppingCart },
    { id: 'orders', label: 'Orders', icon: Package },
    { id: 'analytics', label: 'Analytics', icon: FileBarChart },
    { id: 'notifications', label: 'Notifications', icon: MessageSquare },
    { id: 'settings', label: 'Settings', icon: Settings },
    { id: 'audit', label: 'Audit Logs', icon: Shield },
  ];

  const isSuperAdmin = user?.globalRole === 'super_admin';

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
      <div className={`
        fixed left-0 top-0 h-full w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 z-50
        transform transition-transform duration-300 ease-in-out
        ${isMobileOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:translate-x-0 lg:relative lg:z-0
      `}>
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
                {user?.globalRole?.replace('_', ' ').toUpperCase()}
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
            if (!isSuperAdmin && ['estates', 'audit'].includes(item.id)) {
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
                  ${isActive 
                    ? 'bg-primary text-primary-foreground' 
                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
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
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [editingUser, setEditingUser] = useState<any>(null);
  const [showAddUser, setShowAddUser] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    globalRole: ''
  });
  
  const { data: users, isLoading } = useQuery({
    queryKey: ['/api/admin/users', { search, globalRole: roleFilter === 'all' ? undefined : roleFilter }],
    queryFn: () => adminApiRequest('GET', '/api/admin/users', {
      search: search || undefined,
      globalRole: roleFilter === 'all' ? undefined : roleFilter
    }),
  });

  const toggleUserStatusMutation = useMutation({
    mutationFn: ({ userId, isActive }: { userId: string, isActive: boolean }) => 
      adminApiRequest('PATCH', `/api/admin/users/${userId}`, { isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
    },
  });

  const createUserMutation = useMutation({
    mutationFn: (userData: any) => 
      adminApiRequest('POST', '/api/admin/users', userData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
      setShowAddUser(false);
      resetForm();
    },
  });

  const updateUserMutation = useMutation({
    mutationFn: ({ userId, userData }: { userId: string, userData: any }) => 
      adminApiRequest('PATCH', `/api/admin/users/${userId}`, userData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
      setEditingUser(null);
      resetForm();
    },
  });

  const handleToggleUserStatus = (userId: string, currentStatus: boolean) => {
    toggleUserStatusMutation.mutate({ userId, isActive: !currentStatus });
  };

  const resetForm = () => {
    setFormData({ name: '', email: '', phone: '', password: '', globalRole: '' });
  };

  const handleOpenEditDialog = (user: any) => {
    setEditingUser(user);
    setFormData({
      name: user.name || '',
      email: user.email || '',
      phone: user.phone || '',
      password: '',
      globalRole: user.globalRole || ''
    });
  };

  const handleSubmit = () => {
    const { password, ...baseData } = formData;
    const userData = password ? { ...baseData, password } : baseData; // Only include password if provided

    if (editingUser) {
      updateUserMutation.mutate({ userId: editingUser._id, userData });
    } else {
      createUserMutation.mutate(userData);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-8 bg-gray-200 rounded w-1/4 animate-pulse"></div>
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-16 bg-gray-200 rounded animate-pulse"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">User Management</h1>
          <p className="text-gray-600 dark:text-gray-400">Manage users and their estate assignments</p>
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
              <SelectTrigger className="w-48" data-testid="select-role-filter">
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
              {users?.map((user: any) => (
                <TableRow key={user._id} data-testid={`row-user-${user._id}`}>
                  <TableCell className="font-medium">{user.name}</TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>{user.phone}</TableCell>
                  <TableCell>
                    <Badge variant={user.globalRole === 'super_admin' ? 'default' : 'secondary'}>
                      {user.globalRole || 'User'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={user.isActive ? 'default' : 'destructive'}>
                      {user.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleDateString() : 'Never'}
                  </TableCell>
                  <TableCell>
                    <div className="flex space-x-2">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => handleOpenEditDialog(user)}
                        data-testid={`button-edit-user-${user._id}`}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button 
                        variant={user.isActive ? "destructive" : "default"} 
                        size="sm"
                        onClick={() => handleToggleUserStatus(user._id, user.isActive)}
                        disabled={toggleUserStatusMutation.isPending}
                        data-testid={`button-toggle-user-${user._id}`}
                      >
                        {user.isActive ? <XCircle className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {(!users || users.length === 0) && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                    No users found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Add/Edit User Dialog */}
      <Dialog open={showAddUser || editingUser !== null} onOpenChange={(open) => {
        if (!open) {
          setShowAddUser(false);
          setEditingUser(null);
        }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingUser ? 'Edit User' : 'Add New User'}
            </DialogTitle>
            <DialogDescription>
              {editingUser ? 'Update user information and permissions.' : 'Create a new user account.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Input 
              placeholder="Full Name" 
              value={formData.name}
              onChange={(e) => setFormData({...formData, name: e.target.value})}
              data-testid="input-user-name" 
            />
            <Input 
              placeholder="Email Address" 
              type="email" 
              value={formData.email}
              onChange={(e) => setFormData({...formData, email: e.target.value})}
              data-testid="input-user-email" 
            />
            <Input 
              placeholder="Phone Number" 
              value={formData.phone}
              onChange={(e) => setFormData({...formData, phone: e.target.value})}
              data-testid="input-user-phone" 
            />
            {!editingUser && (
              <Input 
                placeholder="Password" 
                type="password" 
                value={formData.password}
                onChange={(e) => setFormData({...formData, password: e.target.value})}
                data-testid="input-user-password" 
              />
            )}
            <Select value={formData.globalRole} onValueChange={(value) => setFormData({...formData, globalRole: value})}>
              <SelectTrigger data-testid="select-user-role">
                <SelectValue placeholder="Select Role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">No Global Role</SelectItem>
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
              disabled={createUserMutation.isPending || updateUserMutation.isPending}
              data-testid="button-save-user"
            >
              {createUserMutation.isPending || updateUserMutation.isPending 
                ? 'Saving...' 
                : (editingUser ? 'Update User' : 'Create User')
              }
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// Providers Management Component
const ProvidersManagement = () => {
  const [search, setSearch] = useState('');
  const [approvalFilter, setApprovalFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  
  const { data: providers, isLoading } = useQuery({
    queryKey: ['/api/admin/providers', { search, approved: approvalFilter === 'all' ? undefined : approvalFilter, category: categoryFilter === 'all' ? undefined : categoryFilter }],
    queryFn: () => adminApiRequest('GET', '/api/admin/providers', {
      search: search || undefined,
      approved: approvalFilter === 'all' ? undefined : approvalFilter,
      category: categoryFilter === 'all' ? undefined : categoryFilter
    }),
  });

  const approveMutation = useMutation({
    mutationFn: ({ providerId, approved }: { providerId: string, approved: boolean }) => 
      adminApiRequest('PATCH', `/api/admin/providers/${providerId}/approve`, { approved }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/providers'] });
    },
  });

  const handleApproval = (providerId: string, approved: boolean) => {
    approveMutation.mutate({ providerId, approved });
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-8 bg-gray-200 rounded w-1/4 animate-pulse"></div>
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-16 bg-gray-200 rounded animate-pulse"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Provider Management</h1>
          <p className="text-gray-600 dark:text-gray-400">Approve and manage service providers</p>
        </div>
      </div>

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
              <SelectTrigger className="w-48" data-testid="select-approval-filter">
                <SelectValue placeholder="Filter by approval" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Providers</SelectItem>
                <SelectItem value="true">Approved</SelectItem>
                <SelectItem value="false">Pending Approval</SelectItem>
              </SelectContent>
            </Select>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-48" data-testid="select-category-filter">
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
                <TableHead>Categories</TableHead>
                <TableHead>Experience</TableHead>
                <TableHead>Rating</TableHead>
                <TableHead>Total Jobs</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {providers?.map((provider: any) => (
                <TableRow key={provider._id} data-testid={`row-provider-${provider._id}`}>
                  <TableCell className="font-medium">{provider.userId}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {provider.categories?.slice(0, 2).map((category: string) => (
                        <Badge key={category} variant="outline" className="text-xs">
                          {category.replace('_', ' ')}
                        </Badge>
                      ))}
                      {provider.categories?.length > 2 && (
                        <Badge variant="outline" className="text-xs">
                          +{provider.categories.length - 2} more
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{provider.experience} years</TableCell>
                  <TableCell>
                    <div className="flex items-center">
                      <Star className="w-4 h-4 fill-yellow-400 text-yellow-400 mr-1" />
                      {provider.rating?.toFixed(1) || 'N/A'}
                    </div>
                  </TableCell>
                  <TableCell>{provider.totalJobs}</TableCell>
                  <TableCell>
                    <Badge variant={provider.isApproved ? 'default' : 'destructive'}>
                      {provider.isApproved ? 'Approved' : 'Pending'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex space-x-2">
                      {!provider.isApproved ? (
                        <Button 
                          variant="default" 
                          size="sm"
                          onClick={() => handleApproval(provider._id, true)}
                          disabled={approveMutation.isPending}
                          data-testid={`button-approve-provider-${provider._id}`}
                        >
                          <CheckCircle className="w-4 h-4" />
                        </Button>
                      ) : (
                        <Button 
                          variant="destructive" 
                          size="sm"
                          onClick={() => handleApproval(provider._id, false)}
                          disabled={approveMutation.isPending}
                          data-testid={`button-reject-provider-${provider._id}`}
                        >
                          <XCircle className="w-4 h-4" />
                        </Button>
                      )}
                      <Button variant="outline" size="sm" data-testid={`button-edit-provider-${provider._id}`}>
                        <Edit className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {(!providers || providers.length === 0) && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                    No providers found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

// Dashboard Stats Component
const DashboardStats = () => {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['/api/admin/dashboard/stats'],
    queryFn: () => adminApiRequest('GET', '/api/admin/dashboard/stats'),
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
      title: 'Total Users',
      value: stats?.totalUsers || 0,
      icon: Users,
      change: '+12.5%',
      trend: 'up'
    },
    {
      title: 'Active Estates',
      value: stats?.totalEstates || 0,
      icon: Building2,
      change: '+3.2%',
      trend: 'up'
    },
    {
      title: 'Service Providers',
      value: stats?.totalProviders || 0,
      icon: UserCheck,
      change: '+8.1%',
      trend: 'up'
    },
    {
      title: 'Total Revenue',
      value: `₦${(stats?.totalRevenue || 0).toLocaleString()}`,
      icon: DollarSign,
      change: '+15.3%',
      trend: 'up'
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
                  <p className="text-2xl font-bold text-foreground" data-testid={`stat-${stat.title.toLowerCase().replace(' ', '-')}`}>
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
                <span className="text-sm text-muted-foreground ml-1">vs last month</span>
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
  const [activeTab, setActiveTab] = useState('dashboard');
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
            {activeTab === 'dashboard' && (
              <div>
                <div className="mb-6">
                  <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                    Dashboard Overview
                  </h1>
                  <p className="text-gray-600 dark:text-gray-400">
                    Welcome back, {user.name}! Here's what's happening across your platform.
                  </p>
                </div>

                <DashboardStats />

                {/* Recent Activity */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>Recent Activity</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div className="flex items-center space-x-4">
                          <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                            <Users className="w-4 h-4 text-blue-600" />
                          </div>
                          <div className="flex-1">
                            <p className="text-sm font-medium">New user registered</p>
                            <p className="text-xs text-muted-foreground">Lekki Estate - 2 minutes ago</p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-4">
                          <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                            <ClipboardList className="w-4 h-4 text-green-600" />
                          </div>
                          <div className="flex-1">
                            <p className="text-sm font-medium">Service request completed</p>
                            <p className="text-xs text-muted-foreground">Victoria Island - 15 minutes ago</p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-4">
                          <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center">
                            <AlertTriangle className="w-4 h-4 text-orange-600" />
                          </div>
                          <div className="flex-1">
                            <p className="text-sm font-medium">Provider approval pending</p>
                            <p className="text-xs text-muted-foreground">Ikoyi Estate - 1 hour ago</p>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Estate Performance</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium">Lekki Estate</span>
                          <div className="flex items-center space-x-2">
                            <div className="w-20 h-2 bg-gray-200 rounded-full">
                              <div className="w-16 h-2 bg-green-500 rounded-full"></div>
                            </div>
                            <span className="text-xs text-muted-foreground">85%</span>
                          </div>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium">Victoria Island</span>
                          <div className="flex items-center space-x-2">
                            <div className="w-20 h-2 bg-gray-200 rounded-full">
                              <div className="w-14 h-2 bg-blue-500 rounded-full"></div>
                            </div>
                            <span className="text-xs text-muted-foreground">72%</span>
                          </div>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium">Ikoyi Estate</span>
                          <div className="flex items-center space-x-2">
                            <div className="w-20 h-2 bg-gray-200 rounded-full">
                              <div className="w-12 h-2 bg-yellow-500 rounded-full"></div>
                            </div>
                            <span className="text-xs text-muted-foreground">68%</span>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            )}

            {activeTab === 'users' && <UsersManagement />}
            {activeTab === 'providers' && <ProvidersManagement />}
            
            {activeTab !== 'dashboard' && activeTab !== 'users' && activeTab !== 'providers' && (
              <div className="text-center py-12">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                  {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} Management
                </h2>
                <p className="text-gray-600 dark:text-gray-400 mb-8">
                  This module is under development. Coming soon!
                </p>
                <Card className="max-w-md mx-auto">
                  <CardContent className="p-6">
                    <div className="text-muted-foreground">
                      <Package className="w-12 h-12 mx-auto mb-4" />
                      <p className="text-sm">
                        The {activeTab} management module will provide comprehensive tools for managing this aspect of your platform.
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