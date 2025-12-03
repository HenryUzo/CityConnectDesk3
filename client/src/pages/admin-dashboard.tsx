import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { adminApiRequest } from "@/lib/adminApi";
import {
  Users,
  UserCheck,
  ClipboardList,
  AlertTriangle,
  Search,
  Eye,
  Ban,
  CheckCircle,
  X,
} from "lucide-react";
import { AdminLayout } from "@/components/admin/AdminLayout";

// ---------- Interfaces ----------
interface Stats {
  totalUsers: number;
  totalProviders: number;
  totalRequests: number;
  pendingApprovals: number;
}

interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: "resident" | "provider" | "admin";
  isActive: boolean;
  location?: string;
  createdAt: string;
  serviceCategory?: string;
  experience?: number;
  rating?: number;
  isApproved?: boolean;
}

interface ServiceRequest {
  id: string;
  category: string;
  status: "pending" | "assigned" | "in_progress" | "completed" | "cancelled";
  createdAt: string;
  providerId?: string;
  residentId?: string;
  description?: string;
  urgency?: string;
  location?: string;
  scheduledDate?: string;
  inspectionDates?: string[];
  adviceMessage?: string;
  resident?: {
    name: string;
    email: string;
    phone: string;
    location?: string;
  };
  provider?: {
    name:string;
    email: string;
    phone: string;
  };
}

export default function AdminDashboard() {
  const { toast } = useToast();

  // Stats
  const { data: stats } = useQuery<Stats>({
    queryKey: ["/api/admin/dashboard/stats"],
  });

  // All users (auto-refresh)
  const { data: allUsers = [] } = useQuery<any[]>({
    queryKey: [`${import.meta.env.VITE_API_URL}/api/admin/users/all`],
    queryFn: async () => {
      const r = await adminApiRequest("GET", "/api/admin/users/all");
      return Array.isArray(r) ? r : (r?.items ?? []);
    },
    refetchInterval: 5000,
  });

  // All requests (auto-refresh)
  const { data: allRequests = [] } = useQuery<ServiceRequest[]>({
    queryKey: [`${import.meta.env.VITE_API_URL}/api/service-requests`],
    queryFn: async () => {
      const r = await apiRequest("GET", "/api/service-requests");
      return Array.isArray(r) ? r : [];
    },
    refetchInterval: 5000,
  });

  // Pending providers (auto-refresh)
  const { data: pendingProviders = [] } = useQuery<User[]>({
    queryKey: [`${import.meta.env.VITE_API_URL}/api/admin/providers/pending`],
    refetchInterval: 5000,
  });

  const approveProviderMutation = useMutation({
    mutationFn: async (providerId: string) => {
      return await apiRequest("POST", `/api/admin/providers/${providerId}/approve`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/providers/pending"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users/all"] });
      toast({
        title: "Provider Approved",
        description: "The provider has been successfully approved!",
      });
    },
  });

  const residents = allUsers.filter((u: any) => u.role === "resident");
  const providers = allUsers.filter((u: any) => u.role === "provider");

  return (
    <AdminLayout title="Platform Overview">
      <div className="space-y-8">
        {/* Stats Cards */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Users</p>
                  <p className="text-2xl font-bold text-foreground" data-testid="text-total-users">
                    {stats?.totalUsers || allUsers.length}
                  </p>
                </div>
                <div className="bg-primary/10 p-3 rounded-lg">
                  <Users className="w-6 h-6 text-primary" />
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                {residents.length} residents, {providers.length} providers
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Service Providers</p>
                  <p className="text-2xl font-bold text-foreground" data-testid="text-total-providers">
                    {stats?.totalProviders || providers.length}
                  </p>
                </div>
                <div className="bg-secondary/10 p-3 rounded-lg">
                  <UserCheck className="w-6 h-6 text-secondary" />
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                {pendingProviders.length} pending approval
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Requests</p>
                  <p className="text-2xl font-bold text-foreground" data-testid="text-total-requests">
                    {stats?.totalRequests || allRequests.length}
                  </p>
                </div>
                <div className="bg-accent/10 p-3 rounded-lg">
                  <ClipboardList className="w-6 h-6 text-accent" />
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                {allRequests.filter((r: any) => ['pending', 'assigned', 'in_progress'].includes(r.status)).length} active
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Pending Approvals</p>
                  <p className="text-2xl font-bold text-foreground" data-testid="text-pending-approvals">
                    {stats?.pendingApprovals || pendingProviders.length}
                  </p>
                </div>
                <div className="bg-red-100 p-3 rounded-lg">
                  <AlertTriangle className="w-6 h-6 text-red-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Management Tabs */}
        <Card>
          <Tabs defaultValue="overview">
            <CardHeader>
              <TabsList>
                <TabsTrigger value="overview" data-testid="tab-overview">
                  Overview
                </TabsTrigger>
                <TabsTrigger value="users" data-testid="tab-users">
                  Users ({residents.length})
                </TabsTrigger>
                <TabsTrigger value="providers" data-testid="tab-providers">
                  Providers ({providers.length})
                </TabsTrigger>
              </TabsList>
            </CardHeader>

            <TabsContent value="overview">
              <CardContent>
                <div className="grid lg:grid-cols-2 gap-6">
                  {/* Recent Activity */}
                  <div>
                    <h3 className="text-lg font-semibold text-foreground mb-4">Recent Activities</h3>
                    <div className="space-y-4">
                      {allRequests.slice(0, 5).map((request: any) => (
                        <div key={request.id} className="flex items-center space-x-4" data-testid={`activity-${request.id}`}>
                          <div className="bg-secondary text-secondary-foreground w-8 h-8 rounded-full flex items-center justify-center text-sm">
                            <ClipboardList className="w-4 h-4" />
                          </div>
                          <div className="flex-1">
                            <p className="text-sm font-medium text-foreground">
                              New {request.category.replace('_', ' ')} request
                            </p>
                            <p className="text-xs text-muted-foreground">
                              #{request.id.slice(0, 8)}
                            </p>
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {new Date(request.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Pending Approvals */}
                  <div>
                    <h3 className="text-lg font-semibold text-foreground mb-4">Pending Provider Approvals</h3>
                    <div className="space-y-4">
                      {pendingProviders.length > 0 ? (
                        pendingProviders.map((provider: any) => (
                          <div key={provider.id} className="flex items-center justify-between p-3 bg-muted rounded-lg" data-testid={`pending-provider-${provider.id}`}>
                            <div>
                              <p className="text-sm font-medium text-foreground">{provider.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {provider.serviceCategory?.replace('_', ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())} • 
                                {provider.experience} years experience
                              </p>
                            </div>
                            <div className="flex space-x-2">
                              <Button 
                                size="sm" 
                                onClick={() => approveProviderMutation.mutate(provider.id)}
                                disabled={approveProviderMutation.isPending}
                                data-testid={`button-approve-${provider.id}`}
                              >
                                <CheckCircle className="w-4 h-4 mr-1" />
                                Approve
                              </Button>
                              <Button size="sm" variant="destructive">
                                <X className="w-4 h-4 mr-1" />
                                Reject
                              </Button>
                            </div>
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-muted-foreground">No pending approvals</p>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </TabsContent>

            <TabsContent value="users">
              <CardContent>
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold text-foreground">Resident Users</h3>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                    <Input 
                      placeholder="Search users..." 
                      className="pl-10 w-64"
                      data-testid="input-search-users"
                    />
                  </div>
                </div>
                
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-3 px-4 font-medium text-foreground">Name</th>
                        <th className="text-left py-3 px-4 font-medium text-foreground">Email</th>
                        <th className="text-left py-3 px-4 font-medium text-foreground">Phone</th>
                        <th className="text-left py-3 px-4 font-medium text-foreground">Location</th>
                        <th className="text-left py-3 px-4 font-medium text-foreground">Status</th>
                        <th className="text-left py-3 px-4 font-medium text-foreground">Joined</th>
                        <th className="text-left py-3 px-4 font-medium text-foreground">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {residents.map((user: any) => (
                        <tr key={user.id} className="border-b border-border hover:bg-background" data-testid={`user-${user.id}`}>
                          <td className="py-3 px-4">
                            <div className="font-medium text-foreground">{user.name}</div>
                          </td>
                          <td className="py-3 px-4 text-muted-foreground">{user.email}</td>
                          <td className="py-3 px-4 text-muted-foreground">{user.phone}</td>
                          <td className="py-3 px-4 text-muted-foreground">{user.location || 'Not specified'}</td>
                          <td className="py-3 px-4">
                            <Badge className={user.isActive ? "bg-secondary/10 text-secondary" : "bg-red-100 text-red-800"}>
                              {user.isActive ? 'Active' : 'Inactive'}
                            </Badge>
                          </td>
                          <td className="py-3 px-4 text-muted-foreground">
                            {new Date(user.createdAt).toLocaleDateString()}
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex space-x-2">
                              <Button variant="ghost" size="sm">
                                <Eye className="w-4 h-4" />
                              </Button>
                              <Button variant="ghost" size="sm">
                                <Ban className="w-4 h-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </TabsContent>

            <TabsContent value="providers">
              <CardContent>
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold text-foreground">Service Providers</h3>
                  <div className="flex space-x-2">
                    <select className="px-3 py-2 border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring bg-background">
                      <option>All Categories</option>
                      <option>Electrician</option>
                      <option>Plumber</option>
                      <option>Carpenter</option>
                      <option>Market Runner</option>
                    </select>
                    <select className="px-3 py-2 border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring bg-background">
                      <option>All Status</option>
                      <option>Approved</option>
                      <option>Pending</option>
                      <option>Suspended</option>
                    </select>
                  </div>
                </div>
                
                <div className="space-y-4">
                  {providers.map((provider: any) => (
                    <div key={provider.id} className="border border-border rounded-lg p-4" data-testid={`provider-${provider.id}`}>
                      <div className="flex justify-between items-start">
                        <div className="flex items-center">
                          <div className="w-12 h-12 bg-primary rounded-full flex items-center justify-center mr-4">
                            <UserCheck className="w-6 h-6 text-primary-foreground" />
                          </div>
                          <div>
                            <h4 className="font-semibold text-foreground">{provider.name}</h4>
                            <p className="text-sm text-muted-foreground">
                              {provider.serviceCategory?.replace('_', ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Badge className={provider.isApproved ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"}>
                            {provider.isApproved ? 'Approved' : 'Pending'}
                          </Badge>
                          <Badge className={provider.isActive ? "bg-secondary/10 text-secondary" : "bg-red-100 text-red-800"}>
                            {provider.isActive ? 'Active' : 'Inactive'}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </TabsContent>
          </Tabs>
        </Card>
      </div>
    </AdminLayout>
  );
}
