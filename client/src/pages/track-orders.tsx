import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  ClipboardList, 
  Wrench,
  ShoppingBag,
  Clock,
  CheckCircle,
  Phone,
  X
} from "lucide-react";
import ResidentShell from "@/components/layout/ResidentShell";

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
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const highlightScrolledRef = useRef(false);
  const highlightTimerRef = useRef<number | null>(null);

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

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const highlight = params.get("highlight");
    if (highlight) {
      setHighlightId(highlight);
    }
  }, []);

  useEffect(() => {
    if (
      typeof window === "undefined" ||
      !highlightId ||
      highlightScrolledRef.current
    ) {
      return;
    }

    const node = document.querySelector<HTMLElement>(`[data-highlight-id="${highlightId}"]`);
    if (!node) return;

    node.scrollIntoView({ behavior: "smooth", block: "center" });
    highlightScrolledRef.current = true;

    highlightTimerRef.current = window.setTimeout(() => {
      const params = new URLSearchParams(window.location.search);
      params.delete("highlight");
      const search = params.toString();
      const base = `${window.location.pathname}${search ? `?${search}` : ""}`;
      window.history.replaceState(null, "", base);
    }, 2200);

    return () => {
      if (highlightTimerRef.current) {
        window.clearTimeout(highlightTimerRef.current);
        highlightTimerRef.current = null;
      }
    };
  }, [highlightId]);

  return (
    <ResidentShell currentPage="requests">
      <div className="max-w-5xl mx-auto p-8 space-y-6">
        <div className="flex items-center">
          <ClipboardList className="w-8 h-8 text-primary mr-3" />
          <div>
            <h1 className="text-3xl font-bold text-foreground">Track Your Requests</h1>
            <p className="text-muted-foreground mt-1">Monitor the status of all your service requests</p>
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
            filteredRequests.map((request: any) => {
              const isHighlighted = highlightId === request.id;
              const cardClasses = [
                "transition-shadow hover:shadow-lg",
                isHighlighted ? "ring-2 ring-emerald-500 shadow-2xl bg-emerald-50/60" : "",
              ]
                .filter(Boolean)
                .join(" ");

              return (
                <Card
                  key={request.id}
                  className={cardClasses}
                  data-testid={`request-${request.id}`}
                  data-highlight-id={request.id}
                >
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
                    <div className="flex items-center gap-2">
                      <Badge className={`${getStatusColor(request.status)}`}>{request.status.replace('_', ' ')}</Badge>
                      <Badge className={`${getUrgencyColor(request.urgency)}`}>{request.urgency}</Badge>
                    </div>
                  </div>

                  {/* Progress Tracker */}
                  <div className="my-6">
                    <div className="flex justify-between">
                      {getProgressSteps(request.status).map((step, index) => (
                        <div key={step.key} className="flex-1 flex flex-col items-center relative">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step.active ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                            {step.active ? <CheckCircle className="w-5 h-5" /> : <Clock className="w-5 h-5" />}
                          </div>
                          <p className={`mt-2 text-xs text-center ${step.active ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}>{step.label}</p>
                          {index < getProgressSteps(request.status).length - 1 && (
                            <div className={`absolute top-4 left-1/2 w-full h-0.5 ${getProgressSteps(request.status)[index + 1].active ? 'bg-primary' : 'bg-muted'}`} />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                    <div>
                      <p className="font-semibold">Budget</p>
                      <p className="text-muted-foreground">{request.budget}</p>
                    </div>
                    <div>
                      <p className="font-semibold">Location</p>
                      <p className="text-muted-foreground">{request.location}</p>
                    </div>
                    {request.providerId && (
                      <div>
                        <p className="font-semibold">Assigned Provider</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Phone className="w-4 h-4 text-muted-foreground" />
                          <span className="text-muted-foreground">{request.buyer?.name} ({request.buyer?.phone})</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {request.status === 'pending' && (
                    <div className="mt-6 flex justify-end">
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => cancelRequestMutation.mutate(request.id)}
                        disabled={cancelRequestMutation.isPending}
                        data-testid={`button-cancel-${request.id}`}
                      >
                        <X className="w-4 h-4 mr-2" />
                        Cancel Request
                      </Button>
                    </div>
                  )}
                </CardContent>
                </Card>
              );
            })
          ) : (
            <div className="text-center py-16">
              <ClipboardList className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">No requests found</h3>
              <p className="text-muted-foreground">
                Your active and past service requests will appear here.
              </p>
            </div>
          )}
        </div>
      </div>
    </ResidentShell>
  );
}
