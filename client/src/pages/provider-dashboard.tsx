import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import {
  Star,
  Clock,
  CheckCircle,
  DollarSign,
  Briefcase,
  MapPin,
  Phone,
  User,
  Store,
  Plus,
  Package,
} from "lucide-react";
import { ProviderLayout } from "@/components/admin/ProviderLayout";
import { formatServiceRequestStatusLabel, normalizeServiceRequestStatus } from "@/lib/serviceRequestStatus";

type ServiceRequest = {
  id: string;
  status: string;
  description?: string;
  category?: string;
  budget?: string;
  location?: string;
  urgency?: string;
  createdAt?: string;
  updatedAt?: string;
  buyer?: { name?: string };
  specialInstructions?: string;
};

type RequestMessage = {
  id: string;
  requestId: string;
  senderId: string;
  senderRole: "admin" | "resident" | "provider";
  message: string;
  createdAt?: string;
};

type StoreFormData = {
  name: string;
  description: string;
  location: string;
  phone: string;
  email: string;
  estateId?: string;
};

type ProviderStore = {
  id: string;
  name: string;
  description?: string;
  location: string;
  phone?: string;
  email?: string;
  isActive?: boolean;
  membership?: { role?: string; canManageItems?: boolean };
};

export default function ProviderDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [isCreateStoreDialogOpen, setIsCreateStoreDialogOpen] = useState(false);
  const [activeChatRequestId, setActiveChatRequestId] = useState<string | null>(null);
  const [messageDraft, setMessageDraft] = useState("");
  const [storeFormData, setStoreFormData] = useState<StoreFormData>({
    name: "",
    description: "",
    location: "",
    phone: "",
    email: "",
    estateId: "",
  });

  // Redirect non-providers away from this page
  if (!user) {
    return (
      <ProviderLayout title="Loading...">
        <div className="flex items-center justify-center py-20">
          <p className="text-gray-500">Loading your profile...</p>
        </div>
      </ProviderLayout>
    );
  }

  if (user.role !== "provider") {
    return (
      <ProviderLayout title="Access Denied">
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <p className="text-red-600 font-semibold">Access Denied</p>
          <p className="text-gray-500">This page is only accessible to providers.</p>
          <Link href="/" className="text-blue-600 hover:underline">
            Return to Dashboard
          </Link>
        </div>
      </ProviderLayout>
    );
  }

  const { data: availableRequests = [] } = useQuery<ServiceRequest[]>({
    queryKey: ["/api/service-requests", { status: "available" }],
    queryFn: async () => {
      try {
        const res = await apiRequest("GET", "/api/service-requests?status=available");
        return res.json() as Promise<ServiceRequest[]>;
      } catch (error) {
        console.error("Error fetching available requests:", error);
        return [];
      }
    },
  });

  const { data: myRequests = [] } = useQuery<ServiceRequest[]>({
    queryKey: ["/api/service-requests"],
    queryFn: async () => {
      try {
        const res = await apiRequest("GET", "/api/service-requests");
        return res.json() as Promise<ServiceRequest[]>;
      } catch (error) {
        console.error("Error fetching my requests:", error);
        return [];
      }
    },
  });

  const { data: myStores = [], isLoading: isLoadingStores } = useQuery<
    ProviderStore[]
  >({
    queryKey: ["/api/provider/stores"],
    queryFn: async () => {
      try {
        const res = await apiRequest("GET", "/api/provider/stores");
        return res.json() as Promise<ProviderStore[]>;
      } catch (error) {
        console.error("Error fetching provider stores:", error);
        return [];
      }
    },
  });

  const acceptJobMutation = useMutation<Response, Error, string>({
    mutationFn: async (requestId: string) => {
      return await apiRequest(
        "POST",
        `/api/service-requests/${requestId}/accept`
      );
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

  const updateJobStatusMutation = useMutation<Response, Error, { requestId: string; status: string }>({
    mutationFn: async ({
      requestId,
      status,
    }: {
      requestId: string;
      status: string;
    }) => {
      return await apiRequest("PATCH", `/api/service-requests/${requestId}`, {
        status,
      });
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

  const createStoreMutation = useMutation<Response, Error, StoreFormData>({
    mutationFn: async (storeData: StoreFormData) => {
      return await apiRequest("POST", "/api/provider/stores", storeData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/provider/stores"] });
      setIsCreateStoreDialogOpen(false);
      setStoreFormData({
        name: "",
        description: "",
        location: "",
        phone: "",
        email: "",
        estateId: "",
      });
      toast({
        title: "Store Created",
        description: "Your store has been created successfully!",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create store",
        variant: "destructive",
      });
    },
  });

  const sendMessageMutation = useMutation({
    mutationFn: async (payload: { requestId: string; message: string }) => {
      const res = await apiRequest("POST", `/api/service-requests/${payload.requestId}/messages`, {
        message: payload.message,
      });
      return res.json() as Promise<RequestMessage>;
    },
    onSuccess: () => {
      setMessageDraft("");
      queryClient.invalidateQueries({ queryKey: ["provider-dashboard-request-messages", activeChatRequestId] });
    },
    onError: (error: Error) => {
      toast({
        title: "Message failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const activeJobs: ServiceRequest[] = myRequests.filter((r) =>
    ["assigned", "assigned_for_job", "in_progress"].includes(normalizeServiceRequestStatus(r.status))
  );
  const completedJobs: ServiceRequest[] = myRequests.filter(
    (r) => normalizeServiceRequestStatus(r.status) === "completed",
  );

  const activeChatRequest = useMemo(
    () => myRequests.find((r) => r.id === activeChatRequestId) ?? null,
    [myRequests, activeChatRequestId],
  );

  const { data: requestMessages = [], isLoading: isLoadingMessages } = useQuery<RequestMessage[]>({
    queryKey: ["provider-dashboard-request-messages", activeChatRequestId],
    enabled: Boolean(activeChatRequestId),
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/service-requests/${activeChatRequestId}/messages`);
      return res.json() as Promise<RequestMessage[]>;
    },
    refetchInterval: 5000,
  });

  const orderedMessages = useMemo(
    () =>
      [...requestMessages].sort((a, b) => {
        const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return aTime - bTime;
      }),
    [requestMessages],
  );

  const stats = {
    available: availableRequests.length,
    active: activeJobs.length,
    completed: completedJobs.length,
    monthlyEarnings: completedJobs.reduce((sum: number, job: any) => {
      const cleaned = String(job.budget ?? "0").replace(/[^0-9.]/g, "");
      const amount = parseFloat(cleaned || "0");
      return sum + (Number.isNaN(amount) ? 0 : amount);
    }, 0),
  };

  const getStatusColor = (status: string) => {
    switch (normalizeServiceRequestStatus(status)) {
      case "pending":
        return "bg-gray-100 text-gray-800";
      case "assigned":
        return "bg-purple-100 text-purple-800";
      case "assigned_for_job":
        return "bg-indigo-100 text-indigo-800";
      case "in_progress":
        return "bg-blue-100 text-blue-800";
      case "completed":
        return "bg-green-100 text-green-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getUrgencyColor = (urgency: string | undefined) => {
    if (!urgency) return 'bg-gray-100 text-gray-800';
    switch (urgency.toLowerCase()) {
      case "emergency":
        return "bg-red-100 text-red-800";
      case "high":
        return "bg-orange-100 text-orange-800";
      case "medium":
        return "bg-blue-100 text-blue-800";
      case "low":
        return "bg-green-100 text-green-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <ProviderLayout title={`Welcome, ${user?.name}!`}>
      <div className="space-y-8">
        {/* Header */}
        <div className="mb-8">
          {user?.serviceCategory ? (
            <p className="text-muted-foreground">
              {user.serviceCategory
                .replace("_", " ")
                .replace(/\b\w/g, (l: string) => l.toUpperCase())}{" "}
              •{user.isApproved ? " Approved Provider" : " Pending Approval"}
            </p>
          ) : (
            <p className="text-muted-foreground">Welcome to your dashboard</p>
          )}
        </div>
        {/* Stats Cards */}
        <div className="grid md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Available Jobs
                  </p>
                  <p
                    className="text-2xl font-bold text-foreground"
                    data-testid="text-available-jobs"
                  >
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
                  <p className="text-sm font-medium text-muted-foreground">
                    Active Jobs
                  </p>
                  <p
                    className="text-2xl font-bold text-foreground"
                    data-testid="text-active-jobs"
                  >
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
                  <p className="text-sm font-medium text-muted-foreground">
                    Completed
                  </p>
                  <p
                    className="text-2xl font-bold text-foreground"
                    data-testid="text-completed-jobs"
                  >
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
                  <p className="text-sm font-medium text-muted-foreground">
                    Earnings
                  </p>
                  <p
                    className="text-2xl font-bold text-foreground"
                    data-testid="text-monthly-earnings"
                  >
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
                <TabsTrigger value="stores" data-testid="tab-my-stores">
                  <Store className="w-4 h-4 mr-1" />
                  My Stores ({Array.isArray(myStores) ? myStores.length : 0})
                </TabsTrigger>
                <Link href="/provider/tasks">
                  <TabsTrigger value="tasks" data-testid="tab-my-tasks">
                    <CheckCircle className="w-4 h-4 mr-1" />
                    My Tasks
                  </TabsTrigger>
                </Link>
              </TabsList>
            </CardHeader>

            <TabsContent value="available">
              <CardContent>
                <div className="space-y-4">
                  {availableRequests.length > 0 ? (
                    availableRequests.map((request) => (
                      <div
                        key={request.id}
                        className="border border-border rounded-lg p-6 hover:shadow-md transition-shadow"
                        data-testid={`job-${request.id}`}
                      >
                        <div className="flex justify-between items-start mb-4">
                          <div>
                            <h3 className="font-semibold text-foreground text-lg">
                              {request.description}
                            </h3>
                            <p className="text-sm text-muted-foreground">
                              Posted{" "}
                              {new Date(request.createdAt ?? 0).toLocaleDateString()}
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
                            <span className="text-muted-foreground">
                              Category:
                            </span>
                            <span className="font-medium text-foreground ml-1">
                              {request.category
                                ?.replace("_", " ")
                                .replace(/\b\w/g, (l: string) =>
                                  l.toUpperCase()
                                )}
                            </span>
                          </div>
                          <Button
                            onClick={() => acceptJobMutation.mutate(request.id)}
                            disabled={acceptJobMutation.isPending}
                            data-testid={`button-accept-${request.id}`}
                          >
                            {acceptJobMutation.isPending
                              ? "Accepting..."
                              : "Accept Job"}
                          </Button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <Briefcase className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p>No available jobs at the moment</p>
                      <p className="text-sm">
                        New requests will appear here automatically
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </TabsContent>

            <TabsContent value="active">
              <CardContent>
                <div className="space-y-4">
                  {activeJobs.length > 0 ? (
                    activeJobs.map((job) => (
                      <div
                        key={job.id}
                        className="border border-border rounded-lg p-6 bg-blue-50/50"
                        data-testid={`active-job-${job.id}`}
                      >
                        <div className="flex justify-between items-start mb-4">
                          <div>
                            <h3 className="font-semibold text-foreground text-lg">
                              {job.description}
                            </h3>
                            <p className="text-sm text-muted-foreground">
                              Accepted{" "}
                              {new Date(job.updatedAt ?? 0).toLocaleDateString()}
                            </p>
                          </div>
                          <Badge className={getStatusColor(job.status)}>
                            {formatServiceRequestStatusLabel(job.status, job.category)}
                          </Badge>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                          <div className="text-sm">
                            <span className="text-muted-foreground">
                              Budget:
                            </span>
                            <span className="font-medium text-foreground ml-1">
                              {job.budget}
                            </span>
                          </div>
                          <div className="text-sm">
                            <span className="text-muted-foreground">
                              Location:
                            </span>
                            <span className="font-medium text-foreground ml-1">
                              {job.location}
                            </span>
                          </div>
                          <div className="text-sm">
                            <span className="text-muted-foreground">
                              Urgency:
                            </span>
                            <span className="font-medium text-foreground ml-1">
                              {job.urgency} priority
                            </span>
                          </div>
                        </div>

                        <div className="flex justify-between items-center">
                          <div className="flex space-x-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setLocation(`/provider/chat?requestId=${encodeURIComponent(job.id)}`)}
                            >
                              <Phone className="w-4 h-4 mr-2" />
                              Open Chat
                            </Button>
                          </div>
                          <div className="flex space-x-2">
                            {normalizeServiceRequestStatus(job.status) === "assigned_for_job" && (
                              <Button
                                size="sm"
                                onClick={() =>
                                  updateJobStatusMutation.mutate({
                                    requestId: job.id,
                                    status: "in_progress",
                                  })
                                }
                                disabled={updateJobStatusMutation.isPending}
                                data-testid={`button-start-${job.id}`}
                              >
                                Start Job
                              </Button>
                            )}
                            {normalizeServiceRequestStatus(job.status) === "in_progress" && (
                              <Button
                                size="sm"
                                onClick={() =>
                                  updateJobStatusMutation.mutate({
                                    requestId: job.id,
                                    status: "completed",
                                  })
                                }
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
                    completedJobs.map((job) => (
                      <div
                        key={job.id}
                        className="border border-border rounded-lg p-6"
                        data-testid={`completed-job-${job.id}`}
                      >
                        <div className="flex justify-between items-start mb-4">
                          <div>
                            <h3 className="font-semibold text-foreground text-lg">
                              {job.description}
                            </h3>
                            <p className="text-sm text-muted-foreground">
                              Completed{" "}
                              {new Date(job.updatedAt ?? 0).toLocaleDateString()}
                            </p>
                          </div>
                          <div className="flex items-center space-x-2">
                            <div className="flex items-center">
                              <Star className="w-4 h-4 text-yellow-400 fill-current" />
                              <span className="ml-1 text-sm font-medium">
                                5.0
                              </span>
                            </div>
                            <Badge className="bg-green-100 text-green-800">
                              Completed
                            </Badge>
                          </div>
                        </div>

                        <div className="flex justify-between items-center">
                          <div className="flex items-center space-x-4">
                            <div className="text-sm">
                              <span className="text-muted-foreground">
                                Earned:
                              </span>
                              <span className="font-medium text-foreground ml-1">
                                {job.budget}
                              </span>
                            </div>
                            <div className="text-sm">
                              <span className="text-muted-foreground">
                                Location:
                              </span>
                              <span className="font-medium text-foreground ml-1">
                                {job.location}
                              </span>
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

            <TabsContent value="stores">
              <CardContent>
                <div className="mb-4 flex justify-between items-center">
                  <div>
                    <h3 className="text-lg font-semibold">My Stores</h3>
                    <p className="text-sm text-muted-foreground">
                      Manage your marketplace stores and items
                    </p>
                  </div>
                  <Dialog
                    open={isCreateStoreDialogOpen}
                    onOpenChange={setIsCreateStoreDialogOpen}
                  >
                    <DialogTrigger asChild>
                      <Button data-testid="button-create-store">
                        <Plus className="w-4 h-4 mr-2" />
                        Create Store
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="w-[60vw] max-w-[95vw]">
                      <DialogHeader>
                        <DialogTitle>Create New Store</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <div className="space-y-2">
                          <Label htmlFor="name">Store Name *</Label>
                          <Input
                            id="name"
                            value={storeFormData.name}
                            onChange={(e) =>
                              setStoreFormData({
                                ...storeFormData,
                                name: e.target.value,
                              })
                            }
                            placeholder="e.g., Fresh Groceries Store"
                            data-testid="input-store-name"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="description">Description</Label>
                          <Textarea
                            id="description"
                            value={storeFormData.description}
                            onChange={(e) =>
                              setStoreFormData({
                                ...storeFormData,
                                description: e.target.value,
                              })
                            }
                            placeholder="Describe your store"
                            data-testid="input-store-description"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="location">Location *</Label>
                          <Input
                            id="location"
                            value={storeFormData.location}
                            onChange={(e) =>
                              setStoreFormData({
                                ...storeFormData,
                                location: e.target.value,
                              })
                            }
                            placeholder="e.g., Block A, Ground Floor"
                            data-testid="input-store-location"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="phone">Phone</Label>
                          <Input
                            id="phone"
                            value={storeFormData.phone}
                            onChange={(e) =>
                              setStoreFormData({
                                ...storeFormData,
                                phone: e.target.value,
                              })
                            }
                            placeholder="+234..."
                            data-testid="input-store-phone"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="email">Email</Label>
                          <Input
                            id="email"
                            type="email"
                            value={storeFormData.email}
                            onChange={(e) =>
                              setStoreFormData({
                                ...storeFormData,
                                email: e.target.value,
                              })
                            }
                            placeholder="store@example.com"
                            data-testid="input-store-email"
                          />
                        </div>
                        <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md">
                          <p className="text-sm text-blue-800 dark:text-blue-200">
                            <strong>Note:</strong> Your store will be submitted
                            for admin review. Once approved, admins will
                            allocate estates based on proximity to your
                            location.
                          </p>
                        </div>
                      </div>
                      <div className="flex justify-end space-x-2">
                        <Button
                          variant="outline"
                          onClick={() => setIsCreateStoreDialogOpen(false)}
                          data-testid="button-cancel-store"
                        >
                          Cancel
                        </Button>
                        <Button
                          onClick={() =>
                            createStoreMutation.mutate(storeFormData)
                          }
                          disabled={
                            !storeFormData.name ||
                            !storeFormData.location ||
                            createStoreMutation.isPending
                          }
                          data-testid="button-submit-store"
                        >
                          {createStoreMutation.isPending
                            ? "Submitting..."
                            : "Submit for Approval"}
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>

                <div className="space-y-4">
                  {isLoadingStores ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <p>Loading your stores...</p>
                    </div>
                  ) : myStores.length > 0 ? (
                    myStores.map((store) => (
                      <div
                        key={store.id}
                        className="border border-border rounded-lg p-6 hover:shadow-md transition-shadow"
                        data-testid={`store-${store.id}`}
                      >
                        <div className="flex justify-between items-start mb-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <Store className="w-5 h-5 text-primary" />
                              <h3 className="font-semibold text-foreground text-lg">
                                {store.name}
                              </h3>
                              {store.isActive ? (
                                <Badge className="bg-green-100 text-green-800">
                                  Active
                                </Badge>
                              ) : (
                                <Badge variant="outline">Inactive</Badge>
                              )}
                            </div>
                            {store.description && (
                              <p className="text-sm text-muted-foreground mb-3">
                                {store.description}
                              </p>
                            )}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                              <div className="flex items-center text-muted-foreground">
                                <MapPin className="w-4 h-4 mr-1" />
                                <span>{store.location}</span>
                              </div>
                              {store.phone && (
                                <div className="flex items-center text-muted-foreground">
                                  <Phone className="w-4 h-4 mr-1" />
                                  <span>{store.phone}</span>
                                </div>
                              )}
                              {store.membership && (
                                <div className="flex items-center text-muted-foreground">
                                  <Badge
                                    variant="outline"
                                    className="text-xs"
                                  >
                                    {store.membership.role}
                                  </Badge>
                                  {store.membership.canManageItems && (
                                    <span className="text-xs ml-2">
                                      • Can manage items
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex justify-between items-center pt-4 border-t">
                          <div className="flex space-x-4 text-sm text-muted-foreground">
                            <div className="flex items-center">
                              <Package className="w-4 h-4 mr-1" />
                              <span>0 items</span>
                            </div>
                            <div className="flex items-center">
                              <User className="w-4 h-4 mr-1" />
                              <span>0 orders</span>
                            </div>
                          </div>
                          <div className="flex space-x-2">
                            <Link
                              href={`/provider/stores/${store.id}/items`}
                            >
                              <Button
                                variant="outline"
                                size="sm"
                                data-testid={`button-manage-items-${store.id}`}
                              >
                                <Package className="w-4 h-4 mr-1" />
                                Manage Items
                              </Button>
                            </Link>
                            <Link href={`/provider/stores/${store.id}/orders`}>
                              <Button
                                variant="outline"
                                size="sm"
                                data-testid={`button-view-orders-${store.id}`}
                              >
                                View Orders
                              </Button>
                            </Link>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-12 text-muted-foreground">
                      <Store className="w-16 h-16 mx-auto mb-4 opacity-50" />
                      <h3 className="font-medium text-lg mb-2">
                        No stores yet
                      </h3>
                      <p className="text-sm mb-4">
                        Create your first store to start selling items in the
                        marketplace
                      </p>
                      <Button
                        onClick={() => setIsCreateStoreDialogOpen(true)}
                        data-testid="button-create-first-store"
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Create Your First Store
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </TabsContent>
          </Tabs>
        </Card>

        {activeChatRequest ? (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base">
                Resident Chat: {activeChatRequest.description || activeChatRequest.category || "Service Request"}
              </CardTitle>
              <Badge variant="outline">{activeChatRequest.status}</Badge>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border bg-muted/20 p-3 max-h-[320px] overflow-y-auto space-y-2">
                {isLoadingMessages ? (
                  <p className="text-sm text-muted-foreground">Loading messages...</p>
                ) : orderedMessages.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No messages yet. Start the conversation.</p>
                ) : (
                  orderedMessages.map((m) => (
                    <div key={m.id} className={m.senderRole === "provider" ? "flex justify-end" : "flex justify-start"}>
                      <div
                        className={
                          m.senderRole === "provider"
                            ? "max-w-[75%] rounded-xl bg-primary text-primary-foreground px-3 py-2 text-sm"
                            : "max-w-[75%] rounded-xl bg-background border px-3 py-2 text-sm"
                        }
                      >
                        <p className="text-[11px] opacity-80 mb-1">{m.senderRole}</p>
                        <p>{m.message}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="space-y-2">
                <Textarea
                  value={messageDraft}
                  onChange={(e) => setMessageDraft(e.target.value)}
                  placeholder="Type a message to the resident..."
                  className="min-h-[90px]"
                />
                <div className="flex justify-end">
                  <Button
                    onClick={() => {
                      if (!activeChatRequestId || !messageDraft.trim()) return;
                      sendMessageMutation.mutate({
                        requestId: activeChatRequestId,
                        message: messageDraft.trim(),
                      });
                    }}
                    disabled={!messageDraft.trim() || sendMessageMutation.isPending}
                  >
                    {sendMessageMutation.isPending ? "Sending..." : "Send message"}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </ProviderLayout>
  );
}
