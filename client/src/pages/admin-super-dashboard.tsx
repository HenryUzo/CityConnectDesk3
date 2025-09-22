import { useState, useEffect, createContext, useContext, ReactNode } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  AlertTriangle
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

const useAdminAuth = () => {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (token) {
      // Verify token and get user info
      const decoded = JSON.parse(atob(token.split('.')[1]));
      setUser({
        id: decoded.sub,
        email: decoded.email,
        name: decoded.name,
        globalRole: decoded.globalRole,
        memberships: decoded.memberships
      });
    }
  }, [token]);

  const login = async (email: string, password: string) => {
    try {
      const response: any = await apiRequest("POST", "/api/admin/auth/login", { email, password });
      // Store access token in memory only
      setToken(response.accessToken);
      setAdminToken(response.accessToken);
      setUser(response.user);
      
      // Only store refresh token temporarily - in production this should be httpOnly cookie
      sessionStorage.setItem('admin_refresh_token', response.refreshToken);
      return response;
    } catch (error) {
      throw error;
    }
  };

  const logout = () => {
    sessionStorage.removeItem('admin_refresh_token');
    setToken(null);
    setAdminToken(null);
    setUser(null);
    setLocation('/');
  };

  return { user, token, login, logout };
};

// Admin API request function that uses current token from context
let currentAdminToken: string | null = null;

const setAdminToken = (token: string | null) => {
  currentAdminToken = token;
};

const adminApiRequest = async (method: string, endpoint: string, data?: any) => {
  const headers: any = { 'Content-Type': 'application/json' };
  
  if (currentAdminToken) {
    headers['Authorization'] = `Bearer ${currentAdminToken}`;
  }

  const config: RequestInit = {
    method,
    headers,
    credentials: 'include',
  };

  if (data && (method === 'POST' || method === 'PATCH' || method === 'PUT')) {
    config.body = JSON.stringify(data);
  }

  const response = await fetch(endpoint, config);
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(errorData.error || `HTTP ${response.status}`);
  }

  return response.json();
};

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

            {activeTab !== 'dashboard' && (
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