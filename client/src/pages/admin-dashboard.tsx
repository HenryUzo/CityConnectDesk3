import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { 
  LogOut, 
  Users, 
  UserCheck, 
  ClipboardList, 
  AlertTriangle,
  Search,
  Eye,
  Ban,
  CheckCircle,
  X
} from "lucide-react";

export default function AdminDashboard() {
  const { user, logoutMutation } = useAuth();
  const { toast } = useToast();

  const { data: stats } = useQuery({
    queryKey: ["/api/admin/stats"],
  });

  const { data: allUsers = [] } = useQuery({
    queryKey: ["/api/admin/users"],
  });

  const { data: allRequests = [] } = useQuery({
    queryKey: ["/api/service-requests"],
  });

  const { data: pendingProviders = [] } = useQuery({
    queryKey: ["/api/admin/providers/pending"],
  });

  const approveProviderMutation = useMutation({
    mutationFn: async (providerId: string) => {
      return await apiRequest("POST", `/api/admin/providers/${providerId}/approve`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/providers/pending"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({
        title: "Provider Approved",
        description: "The provider has been successfully approved!",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleLogout = async () => {
    await logoutMutation.mutateAsync();
  };

  const residents = allUsers.filter((u: any) => u.role === 'resident');
  const providers = allUsers.filter((u: any) => u.role === 'provider');

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-gray-100 text-gray-800';
      case 'assigned': return 'bg-blue-100 text-blue-800';
      case 'in_progress': return 'bg-yellow-100 text-yellow-800';
      case 'completed': return 'bg-green-100 text-green-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="bg-card shadow-sm border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-bold text-primary">CityConnect</h1>
              <span className="ml-3 text-sm text-muted-foreground">Admin Dashboard</span>
            </div>
            <div className="flex items-center space-x-4">
              <Button variant="ghost" size="sm" onClick={handleLogout} data-testid="button-logout">
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-foreground mb-2">Platform Overview</h2>
          <p className="text-muted-foreground">Monitor and manage your CityConnect platform</p>
        </div>

        {/* Stats Cards */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
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
              <p className="text-xs text-secondary mt-2">
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
              <p className="text-xs text-accent mt-2">
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
              <p className="text-xs text-secondary mt-2">
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
                <TabsTrigger value="requests" data-testid="tab-requests">
                  Requests ({allRequests.length})
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
                              {provider.serviceCategory?.replace('_', ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())} • {provider.email}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {provider.phone} • Joined: {new Date(provider.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <Badge className={provider.isApproved ? "bg-green-100 text-green-800" : "bg-orange-100 text-orange-800"}>
                            {provider.isApproved ? 'Approved' : 'Pending'}
                          </Badge>
                          <div className="flex gap-2 mt-2">
                            <Button variant="ghost" size="sm">
                              <Eye className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="sm">
                              <Ban className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                      <div className="mt-3 flex items-center text-sm text-muted-foreground">
                        <span className="mr-4">Rating: <span className="text-foreground font-medium">{provider.rating || 'N/A'}</span></span>
                        <span className="mr-4">Experience: <span className="text-foreground font-medium">{provider.experience || 0} years</span></span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </TabsContent>

            <TabsContent value="requests">
              <CardContent>
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold text-foreground">All Service Requests</h3>
                  <select className="px-3 py-2 border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring bg-background">
                    <option>All Status</option>
                    <option>Pending</option>
                    <option>Assigned</option>
                    <option>In Progress</option>
                    <option>Completed</option>
                    <option>Cancelled</option>
                  </select>
                </div>
                
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-3 px-4 font-medium text-foreground">Request ID</th>
                        <th className="text-left py-3 px-4 font-medium text-foreground">Service</th>
                        <th className="text-left py-3 px-4 font-medium text-foreground">Resident</th>
                        <th className="text-left py-3 px-4 font-medium text-foreground">Provider</th>
                        <th className="text-left py-3 px-4 font-medium text-foreground">Status</th>
                        <th className="text-left py-3 px-4 font-medium text-foreground">Date</th>
                        <th className="text-left py-3 px-4 font-medium text-foreground">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {allRequests.map((request: any) => (
                        <tr key={request.id} className="border-b border-border hover:bg-background" data-testid={`request-${request.id}`}>
                          <td className="py-3 px-4 text-foreground font-mono text-sm">
                            #{request.id.slice(0, 8)}
                          </td>
                          <td className="py-3 px-4 text-foreground">
                            {request.category.replace('_', ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}
                          </td>
                          <td className="py-3 px-4 text-muted-foreground">
                            Resident User
                          </td>
                          <td className="py-3 px-4 text-muted-foreground">
                            {request.providerId ? 'Assigned' : 'Unassigned'}
                          </td>
                          <td className="py-3 px-4">
                            <Badge className={getStatusColor(request.status)}>
                              {request.status.replace('_', ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}
                            </Badge>
                          </td>
                          <td className="py-3 px-4 text-muted-foreground">
                            {new Date(request.createdAt).toLocaleDateString()}
                          </td>
                          <td className="py-3 px-4">
                            <Button variant="ghost" size="sm">
                              <Eye className="w-4 h-4" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </TabsContent>
          </Tabs>
        </Card>
      </div>
    </div>
  );
}
