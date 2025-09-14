import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { 
  LogOut, 
  Star, 
  Clock, 
  CheckCircle, 
  DollarSign,
  Briefcase,
  MapPin,
  Phone,
  User
} from "lucide-react";

export default function ProviderDashboard() {
  const { user, logoutMutation } = useAuth();
  const { toast } = useToast();

  const { data: availableRequests = [] } = useQuery({
    queryKey: ["/api/service-requests", { status: "available" }],
  });

  const { data: myRequests = [] } = useQuery({
    queryKey: ["/api/service-requests"],
  });

  const acceptJobMutation = useMutation({
    mutationFn: async (requestId: string) => {
      return await apiRequest("POST", `/api/service-requests/${requestId}/accept`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/service-requests"] });
      toast({
        title: "Job Accepted",
        description: "You have successfully accepted this job!",
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

  const updateJobStatusMutation = useMutation({
    mutationFn: async ({ requestId, status }: { requestId: string; status: string }) => {
      return await apiRequest("PATCH", `/api/service-requests/${requestId}`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/service-requests"] });
      toast({
        title: "Status Updated",
        description: "Job status has been updated successfully!",
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

  const activeJobs = myRequests.filter((r: any) => ['assigned', 'in_progress'].includes(r.status));
  const completedJobs = myRequests.filter((r: any) => r.status === 'completed');

  const stats = {
    available: availableRequests.length,
    active: activeJobs.length,
    completed: completedJobs.length,
    monthlyEarnings: completedJobs.reduce((sum: number, job: any) => {
      const amount = parseFloat(job.budget.split('-')[1]?.replace(/[₦,]/g, '') || '0');
      return sum + (amount || 0);
    }, 0)
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-gray-100 text-gray-800';
      case 'assigned': return 'bg-blue-100 text-blue-800';
      case 'in_progress': return 'bg-yellow-100 text-yellow-800';
      case 'completed': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case 'emergency': return 'bg-red-100 text-red-800';
      case 'high': return 'bg-orange-100 text-orange-800';
      case 'medium': return 'bg-blue-100 text-blue-800';
      case 'low': return 'bg-green-100 text-green-800';
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
              <span className="ml-3 text-sm text-muted-foreground">Provider Dashboard</span>
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <span className="text-sm text-muted-foreground">Rating:</span>
                <div className="flex items-center">
                  <Star className="w-4 h-4 text-yellow-400 fill-current" />
                  <span className="ml-1 font-semibold text-foreground" data-testid="text-provider-rating">
                    {user?.rating || "4.8"}
                  </span>
                </div>
              </div>
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
          <h2 className="text-2xl font-bold text-foreground mb-2">
            Welcome, <span data-testid="text-provider-name">{user?.name}!</span>
          </h2>
          <p className="text-muted-foreground">
            {user?.serviceCategory?.replace('_', ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())} • 
            {user?.isApproved ? ' Approved Provider' : ' Pending Approval'}
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Available Jobs</p>
                  <p className="text-2xl font-bold text-foreground" data-testid="text-available-jobs">
                    {stats.available}
                  </p>
                </div>
                <div className="bg-accent/10 p-3 rounded-lg">
                  <Briefcase className="w-6 h-6 text-accent" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Active Jobs</p>
                  <p className="text-2xl font-bold text-foreground" data-testid="text-active-jobs">
                    {stats.active}
                  </p>
                </div>
                <div className="bg-primary/10 p-3 rounded-lg">
                  <Clock className="w-6 h-6 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Completed</p>
                  <p className="text-2xl font-bold text-foreground" data-testid="text-completed-jobs">
                    {stats.completed}
                  </p>
                </div>
                <div className="bg-secondary/10 p-3 rounded-lg">
                  <CheckCircle className="w-6 h-6 text-secondary" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Earnings</p>
                  <p className="text-2xl font-bold text-foreground" data-testid="text-monthly-earnings">
                    ₦{stats.monthlyEarnings.toLocaleString()}
                  </p>
                </div>
                <div className="bg-green-100 p-3 rounded-lg">
                  <DollarSign className="w-6 h-6 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Jobs Tabs */}
        <Card>
          <Tabs defaultValue="available">
            <CardHeader>
              <TabsList>
                <TabsTrigger value="available" data-testid="tab-available-jobs">
                  Available Jobs ({stats.available})
                </TabsTrigger>
                <TabsTrigger value="active" data-testid="tab-active-jobs">
                  Active Jobs ({stats.active})
                </TabsTrigger>
                <TabsTrigger value="completed" data-testid="tab-completed-jobs">
                  Completed ({stats.completed})
                </TabsTrigger>
              </TabsList>
            </CardHeader>

            <TabsContent value="available">
              <CardContent>
                <div className="space-y-4">
                  {availableRequests.length > 0 ? (
                    availableRequests.map((request: any) => (
                      <div 
                        key={request.id} 
                        className="border border-border rounded-lg p-6 hover:shadow-md transition-shadow"
                        data-testid={`job-${request.id}`}
                      >
                        <div className="flex justify-between items-start mb-4">
                          <div>
                            <h3 className="font-semibold text-foreground text-lg">{request.description}</h3>
                            <p className="text-sm text-muted-foreground">
                              Posted {new Date(request.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Badge className={getUrgencyColor(request.urgency)}>
                              {request.urgency} Priority
                            </Badge>
                            <Badge variant="outline">{request.budget}</Badge>
                          </div>
                        </div>

                        <div className="flex items-center space-x-4 text-sm text-muted-foreground mb-4">
                          <div className="flex items-center">
                            <MapPin className="w-4 h-4 mr-1" />
                            <span>{request.location}</span>
                          </div>
                          <div className="flex items-center">
                            <User className="w-4 h-4 mr-1" />
                            <span>Resident Request</span>
                          </div>
                        </div>

                        {request.specialInstructions && (
                          <p className="text-sm text-foreground mb-4 italic">
                            "{request.specialInstructions}"
                          </p>
                        )}

                        <div className="flex justify-between items-center">
                          <div className="text-sm">
                            <span className="text-muted-foreground">Category:</span>
                            <span className="font-medium text-foreground ml-1">
                              {request.category.replace('_', ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}
                            </span>
                          </div>
                          <Button 
                            onClick={() => acceptJobMutation.mutate(request.id)}
                            disabled={acceptJobMutation.isPending}
                            data-testid={`button-accept-${request.id}`}
                          >
                            {acceptJobMutation.isPending ? "Accepting..." : "Accept Job"}
                          </Button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <Briefcase className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p>No available jobs at the moment</p>
                      <p className="text-sm">New requests will appear here automatically</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </TabsContent>

            <TabsContent value="active">
              <CardContent>
                <div className="space-y-4">
                  {activeJobs.length > 0 ? (
                    activeJobs.map((job: any) => (
                      <div 
                        key={job.id} 
                        className="border border-border rounded-lg p-6 bg-blue-50/50"
                        data-testid={`active-job-${job.id}`}
                      >
                        <div className="flex justify-between items-start mb-4">
                          <div>
                            <h3 className="font-semibold text-foreground text-lg">{job.description}</h3>
                            <p className="text-sm text-muted-foreground">
                              Accepted {new Date(job.updatedAt).toLocaleDateString()}
                            </p>
                          </div>
                          <Badge className={getStatusColor(job.status)}>
                            {job.status.replace('_', ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}
                          </Badge>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                          <div className="text-sm">
                            <span className="text-muted-foreground">Budget:</span>
                            <span className="font-medium text-foreground ml-1">{job.budget}</span>
                          </div>
                          <div className="text-sm">
                            <span className="text-muted-foreground">Location:</span>
                            <span className="font-medium text-foreground ml-1">{job.location}</span>
                          </div>
                          <div className="text-sm">
                            <span className="text-muted-foreground">Urgency:</span>
                            <span className="font-medium text-foreground ml-1">
                              {job.urgency} priority
                            </span>
                          </div>
                        </div>

                        <div className="flex justify-between items-center">
                          <div className="flex space-x-2">
                            <Button size="sm" variant="outline">
                              <Phone className="w-4 h-4 mr-2" />
                              Contact Customer
                            </Button>
                          </div>
                          <div className="flex space-x-2">
                            {job.status === 'assigned' && (
                              <Button 
                                size="sm"
                                onClick={() => updateJobStatusMutation.mutate({ 
                                  requestId: job.id, 
                                  status: 'in_progress' 
                                })}
                                disabled={updateJobStatusMutation.isPending}
                                data-testid={`button-start-${job.id}`}
                              >
                                Start Job
                              </Button>
                            )}
                            {job.status === 'in_progress' && (
                              <Button 
                                size="sm"
                                onClick={() => updateJobStatusMutation.mutate({ 
                                  requestId: job.id, 
                                  status: 'completed' 
                                })}
                                disabled={updateJobStatusMutation.isPending}
                                data-testid={`button-complete-${job.id}`}
                              >
                                Mark Complete
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <Clock className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p>No active jobs</p>
                      <p className="text-sm">Accepted jobs will appear here</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </TabsContent>

            <TabsContent value="completed">
              <CardContent>
                <div className="space-y-4">
                  {completedJobs.length > 0 ? (
                    completedJobs.map((job: any) => (
                      <div 
                        key={job.id} 
                        className="border border-border rounded-lg p-6"
                        data-testid={`completed-job-${job.id}`}
                      >
                        <div className="flex justify-between items-start mb-4">
                          <div>
                            <h3 className="font-semibold text-foreground text-lg">{job.description}</h3>
                            <p className="text-sm text-muted-foreground">
                              Completed {new Date(job.updatedAt).toLocaleDateString()}
                            </p>
                          </div>
                          <div className="flex items-center space-x-2">
                            <div className="flex items-center">
                              <Star className="w-4 h-4 text-yellow-400 fill-current" />
                              <span className="ml-1 text-sm font-medium">5.0</span>
                            </div>
                            <Badge className="bg-green-100 text-green-800">Completed</Badge>
                          </div>
                        </div>

                        <div className="flex justify-between items-center">
                          <div className="flex items-center space-x-4">
                            <div className="text-sm">
                              <span className="text-muted-foreground">Earned:</span>
                              <span className="font-medium text-foreground ml-1">{job.budget}</span>
                            </div>
                            <div className="text-sm">
                              <span className="text-muted-foreground">Location:</span>
                              <span className="font-medium text-foreground ml-1">{job.location}</span>
                            </div>
                          </div>
                          <Button variant="outline" size="sm">
                            View Details
                          </Button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <CheckCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p>No completed jobs yet</p>
                      <p className="text-sm">Completed jobs will appear here</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </TabsContent>
          </Tabs>
        </Card>
      </div>
    </div>
  );
}
