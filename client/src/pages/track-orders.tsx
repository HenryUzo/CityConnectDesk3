import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  ArrowLeft, 
  ClipboardList, 
  LogOut, 
  Wallet,
  Wrench,
  ShoppingBag,
  Clock,
  CheckCircle,
  Phone,
  X
} from "lucide-react";

type StatusFilter = "all" | "pending" | "assigned" | "in_progress" | "completed" | "cancelled";
type ServiceRequest = {
  id: string;
  status: string;
  description?: string;
  category?: string;
  budget?: string;
  location?: string;
  urgency?: string;
  createdAt?: string;
  providerId?: string;
  buyer?: { name?: string; phone?: string };
};

export default function TrackOrders() {
  const { user, logoutMutation } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const { data: serviceRequests = [], isLoading } = useQuery<ServiceRequest[]>({
    queryKey: ["/api/service-requests"],
    queryFn: () => apiRequest("GET", "/api/service-requests").then((res) => res.json()),
  });

  const cancelRequestMutation = useMutation({
    mutationFn: async (requestId: string) => {
      return await apiRequest("PATCH", `/api/service-requests/${requestId}`, { 
        status: "cancelled" 
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/service-requests"] });
      toast({
        title: "Request Cancelled",
        description: "Your service request has been cancelled.",
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
    setLocation("/");
  };

  const filteredRequests = serviceRequests.filter((request: any) => {
    if (statusFilter === "all") return true;
    return request.status === statusFilter;
  });

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

  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case 'emergency': return 'bg-red-100 text-red-800';
      case 'high': return 'bg-orange-100 text-orange-800';
      case 'medium': return 'bg-blue-100 text-blue-800';
      case 'low': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getProgressSteps = (status: string) => {
    const steps = [
      { key: 'submitted', label: 'Submitted', active: true },
      { key: 'assigned', label: 'Assigned', active: ['assigned', 'in_progress', 'completed'].includes(status) },
      { key: 'in_progress', label: 'In Progress', active: ['in_progress', 'completed'].includes(status) },
      { key: 'completed', label: 'Completed', active: status === 'completed' },
    ];
    return steps;
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="bg-card shadow-sm border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-bold text-primary">CityConnect</h1>
              <span className="ml-3 text-sm text-muted-foreground">Track Orders</span>
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex items-center bg-muted rounded-lg px-3 py-1">
                <Wallet className="w-4 h-4 mr-2 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Wallet:</span>
                <span className="ml-2 font-semibold text-foreground">₦25,000</span>
              </div>
              <Button variant="ghost" size="sm" onClick={handleLogout} data-testid="button-logout">
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <Button 
            variant="ghost" 
            onClick={() => setLocation("/resident")} 
            className="mb-4"
            data-testid="button-back-dashboard"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
          <div className="flex items-center mb-4">
            <ClipboardList className="w-8 h-8 text-primary mr-3" />
            <div>
              <h1 className="text-3xl font-bold text-foreground">Track Your Requests</h1>
              <p className="text-muted-foreground mt-2">Monitor the status of all your service requests</p>
            </div>
          </div>
        </div>

        {/* Status Filter */}
        <div className="mb-6">
          <div className="flex flex-wrap gap-2">
            {[
              { key: "all", label: "All" },
              { key: "pending", label: "Pending" },
              { key: "assigned", label: "Assigned" },
              { key: "in_progress", label: "In Progress" },
              { key: "completed", label: "Completed" },
              { key: "cancelled", label: "Cancelled" },
            ].map((filter) => (
              <Button
                key={filter.key}
                variant={statusFilter === filter.key ? "default" : "outline"}
                size="sm"
                onClick={() => setStatusFilter(filter.key as StatusFilter)}
                data-testid={`filter-${filter.key}`}
              >
                {filter.label}
              </Button>
            ))}
          </div>
        </div>

        {/* Orders List */}
        <div className="space-y-4">
          {isLoading ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">Loading your requests...</p>
            </div>
          ) : filteredRequests.length > 0 ? (
            filteredRequests.map((request: any) => (
              <Card key={request.id} className="hover:shadow-md transition-shadow" data-testid={`request-${request.id}`}>
                <CardContent className="p-6">
                  <div className="flex flex-col md:flex-row md:items-center justify-between mb-4">
                    <div className="flex items-center mb-4 md:mb-0">
                      <div className="w-12 h-12 bg-primary rounded-lg flex items-center justify-center mr-4">
                        {request.category === 'market_runner' ? (
                          <ShoppingBag className="w-6 h-6 text-primary-foreground" />
                        ) : (
                          <Wrench className="w-6 h-6 text-primary-foreground" />
                        )}
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-foreground">{request.description}</h3>
                        <p className="text-muted-foreground">
                          {request.category.replace('_', ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())} • 
                          Submitted {new Date(request.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge className={getUrgencyColor(request.urgency)}>
                        {request.urgency} Priority
                      </Badge>
                      <Badge className={getStatusColor(request.status)}>
                        {request.status.replace('_', ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}
                      </Badge>
                    </div>
                  </div>
                  
                  <div className="mb-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Budget:</span>
                        <span className="font-medium text-foreground ml-1">{request.budget}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Location:</span>
                        <span className="font-medium text-foreground ml-1">{request.location}</span>
                      </div>
                      {request.providerId && (
                        <div>
                          <span className="text-muted-foreground">Provider:</span>
                          <span className="font-medium text-foreground ml-1">Assigned</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Progress Timeline */}
                  {request.status !== 'cancelled' && (
                    <div className="mb-4">
                      <div className="flex items-center text-sm">
                        {getProgressSteps(request.status).map((step, index) => (
                          <div key={step.key} className="flex items-center">
                            <div className={`flex items-center ${step.active ? 'text-green-600' : 'text-muted-foreground'}`}>
                              <div className={`w-3 h-3 rounded-full mr-2 ${step.active ? 'bg-green-600' : 'bg-muted'}`}></div>
                              <span>{step.label}</span>
                            </div>
                            {index < getProgressSteps(request.status).length - 1 && (
                              <div className={`flex-1 h-px mx-2 ${step.active && getProgressSteps(request.status)[index + 1].active ? 'bg-green-600' : 'bg-muted'}`}></div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {request.specialInstructions && (
                    <div className="mb-4 p-3 bg-muted rounded-lg">
                      <p className="text-sm text-foreground italic">
                        <strong>Special Instructions:</strong> {request.specialInstructions}
                      </p>
                    </div>
                  )}

                  <div className="flex justify-between items-center">
                    <div className="text-sm text-muted-foreground">
                      Request ID: #{request.id.slice(0, 8)}
                    </div>
                    <div className="flex gap-2">
                      {request.providerId && request.status !== 'completed' && (
                        <Button variant="outline" size="sm" data-testid={`button-contact-${request.id}`}>
                          <Phone className="w-4 h-4 mr-1" />
                          Contact Provider
                        </Button>
                      )}
                      {request.status === 'pending' && (
                        <Button 
                          variant="destructive" 
                          size="sm"
                          onClick={() => cancelRequestMutation.mutate(request.id)}
                          disabled={cancelRequestMutation.isPending}
                          data-testid={`button-cancel-${request.id}`}
                        >
                          <X className="w-4 h-4 mr-1" />
                          Cancel Request
                        </Button>
                      )}
                      {request.status === 'completed' && (
                        <Button variant="outline" size="sm" data-testid={`button-rate-${request.id}`}>
                          Rate Service
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <Card>
              <CardContent className="p-12 text-center">
                <ClipboardList className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-50" />
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  {statusFilter === "all" ? "No service requests yet" : `No ${statusFilter.replace('_', ' ')} requests`}
                </h3>
                <p className="text-muted-foreground mb-6">
                  {statusFilter === "all" 
                    ? "Start by booking a service from your dashboard!" 
                    : `You don't have any ${statusFilter.replace('_', ' ')} requests at the moment.`}
                </p>
                {statusFilter === "all" && (
                  <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    <Button onClick={() => setLocation("/book-artisan")} data-testid="button-book-artisan">
                      <Wrench className="w-4 h-4 mr-2" />
                      Book Artisan
                    </Button>
                    <Button variant="secondary" onClick={() => setLocation("/book-market-run")} data-testid="button-book-market-run">
                      <ShoppingBag className="w-4 h-4 mr-2" />
                      Request Market Run
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
