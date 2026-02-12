import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AdminAPI } from "@/lib/adminApi";
import { useToast } from "@/hooks/use-toast";
import { 
  User, 
  Clock, 
  MapPin, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle,
  UserCheck,
  RefreshCw,
  Calendar
} from "lucide-react";

type RequestStatus =
  | "pending"
  | "pending_inspection"
  | "assigned"
  | "in_progress"
  | "completed"
  | "cancelled";

interface ServiceRequest {
  id: string;
  category: string;
  description: string;
  status: RequestStatus;
  providerId?: string;
  residentId?: string;
  createdAt: string;
  updatedAt?: string;
  billedAmount?: string | number;
  urgency?: string;
  location?: string;
  specialInstructions?: string;
  adminNotes?: string;
  assignedAt?: string;
  closedAt?: string;
  closeReason?: string;
}

interface Provider {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  serviceCategory?: string;
  isApproved?: boolean;
  isAvailable?: boolean;
}

interface ArtisanRequestsPanelProps {
  selectedEstateId: string | null;
  estates: any[];
  onSelectEstate: (estateId: string | null) => void;
}

const STATUS_COLORS: Record<RequestStatus, string> = {
  pending: "bg-yellow-50 text-yellow-700 border-yellow-200",
  pending_inspection: "bg-orange-50 text-orange-700 border-orange-200",
  assigned: "bg-blue-50 text-blue-700 border-blue-200",
  in_progress: "bg-purple-50 text-purple-700 border-purple-200",
  completed: "bg-green-50 text-green-700 border-green-200",
  cancelled: "bg-red-50 text-red-700 border-red-200",
};

const URGENCY_COLORS: Record<string, string> = {
  low: "bg-gray-100 text-gray-600",
  medium: "bg-yellow-100 text-yellow-700",
  high: "bg-orange-100 text-orange-700",
  emergency: "bg-red-100 text-red-700",
};

export default function ArtisanRequestsPanel({
  selectedEstateId,
  estates,
  onSelectEstate,
}: ArtisanRequestsPanelProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<RequestStatus | "all">("all");
  const enabled = true;

  // Modal states
  const [viewRequest, setViewRequest] = useState<ServiceRequest | null>(null);
  const [assignRequest, setAssignRequest] = useState<ServiceRequest | null>(null);
  const [selectedProviderId, setSelectedProviderId] = useState<string>("");
  const [reassignRequest, setReassignRequest] = useState<ServiceRequest | null>(null);
  const [completeRequest, setCompleteRequest] = useState<ServiceRequest | null>(null);
  const [billedAmount, setBilledAmount] = useState("");
  const [closeReason, setCloseReason] = useState("");
  const [cancelRequest, setCancelRequest] = useState<ServiceRequest | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [adminNotes, setAdminNotes] = useState("");

  const estateOptions = [
    { value: "__all__", label: "All estates" },
    ...((Array.isArray(estates) ? estates : [])
      .map((estate, idx) => {
        const id = estate?._id || estate?.id || estate?.slug || `estate-${idx}`;
        return id ? { value: String(id), label: estate.name || estate.slug || id } : null;
      })
      .filter(Boolean) as { value: string; label: string }[]),
  ];

  // Fetch service requests
  const { data, isLoading, isFetching, error, refetch } = useQuery<ServiceRequest[], Error>({
    queryKey: [
      "admin.bridge.service-requests",
      { status, q, estateId: selectedEstateId || null },
    ],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (status !== "all") params.status = status;
      if (q.trim()) params.q = q.trim();
      if (selectedEstateId) params.estateId = selectedEstateId;
      return await AdminAPI.bridge.getServiceRequests(params);
    },
    enabled,
    staleTime: 15000,
    refetchInterval: false,
    refetchOnWindowFocus: false,
    placeholderData: (prev) => prev,
  });

  // Fetch available providers
  const { data: providersData } = useQuery<Provider[]>({
    queryKey: ["admin.providers"],
    queryFn: () => AdminAPI.providers.getAll({ isApproved: true }),
    enabled: Boolean(assignRequest || reassignRequest),
  });

  const providers = useMemo(() => {
    const list = providersData ?? [];
    // Filter providers by category if request has a category
    const requestCategory = assignRequest?.category || reassignRequest?.category;
    if (requestCategory) {
      return list.filter(
        (p) => !p.serviceCategory || p.serviceCategory === requestCategory
      );
    }
    return list;
  }, [providersData, assignRequest, reassignRequest]);

  // Update request mutation
  const updateRequestMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: any }) => {
      return await AdminAPI.bridge.updateServiceRequest(id, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin.bridge.service-requests"] });
      toast({ title: "Request updated successfully" });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to update request",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    },
  });

  const requests = useMemo<ServiceRequest[]>(() => {
    const list = data ?? [];
    const needle = q.trim().toLowerCase();
    if (!needle) return list;
    return list.filter(
      (r) =>
        r.description?.toLowerCase().includes(needle) ||
        r.category?.toLowerCase().includes(needle) ||
        r.id?.toLowerCase().includes(needle)
    );
  }, [data, q]);

  // Action handlers
  const handleAssignProvider = () => {
    if (!assignRequest || !selectedProviderId) return;
    updateRequestMutation.mutate({
      id: assignRequest.id,
      updates: {
        providerId: selectedProviderId,
        status: "assigned",
        assignedAt: new Date(),
        adminNotes: adminNotes || undefined,
      },
    });
    setAssignRequest(null);
    setSelectedProviderId("");
    setAdminNotes("");
  };

  const handleReassignProvider = () => {
    if (!reassignRequest || !selectedProviderId) return;
    const previousProviderId = reassignRequest.providerId;
    updateRequestMutation.mutate({
      id: reassignRequest.id,
      updates: {
        providerId: selectedProviderId,
        status: "assigned",
        assignedAt: new Date(),
        adminNotes: `${reassignRequest.adminNotes || ""}\n[Reassigned from provider ${previousProviderId} on ${new Date().toLocaleString()}]${adminNotes ? `\nReason: ${adminNotes}` : ""}`.trim(),
      },
    });
    setReassignRequest(null);
    setSelectedProviderId("");
    setAdminNotes("");
  };

  const handleStartWork = (request: ServiceRequest) => {
    updateRequestMutation.mutate({
      id: request.id,
      updates: {
        status: "in_progress",
      },
    });
  };

  const handleCompleteRequest = () => {
    if (!completeRequest) return;
    updateRequestMutation.mutate({
      id: completeRequest.id,
      updates: {
        status: "completed",
        billedAmount: billedAmount || "0",
        closedAt: new Date(),
        closeReason: closeReason || "Completed successfully",
      },
    });
    setCompleteRequest(null);
    setBilledAmount("");
    setCloseReason("");
  };

  const handleCancelRequest = () => {
    if (!cancelRequest) return;
    updateRequestMutation.mutate({
      id: cancelRequest.id,
      updates: {
        status: "cancelled",
        closedAt: new Date(),
        closeReason: cancelReason || "Cancelled by admin",
      },
    });
    setCancelRequest(null);
    setCancelReason("");
  };

  const handleMarkUnavailable = (request: ServiceRequest) => {
    // Provider is unavailable, open reassign modal
    setReassignRequest(request);
    setAdminNotes("Previous provider was unavailable");
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString("en-NG", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  };

  return (
    <>
      <Card className="p-0">
        <div
          className="relative h-32 w-full overflow-hidden rounded-t-xl"
          style={{
            backgroundImage:
              "linear-gradient(90deg, rgba(15,23,42,0.95), rgba(15,23,42,0.4)), url('https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&w=1600&q=80')",
          }}
        >
          <div className="absolute inset-0" />
          <div className="relative h-full flex items-center justify-between px-6">
            <h2 className="text-white font-semibold text-xl">Artisan Requests</h2>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => refetch()}
              className="gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </Button>
          </div>
        </div>
      <CardHeader className="pt-6">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <span className="text-xs text-muted-foreground">Estate</span>
            <div className="w-full sm:w-64">
              <Select
                value={selectedEstateId ?? "__all__"}
                onValueChange={(value) => onSelectEstate(value === "__all__" ? null : value)}
              >
                <SelectTrigger data-testid="select-requests-estate">
                  <SelectValue placeholder="All estates" />
                </SelectTrigger>
                <SelectContent>
                  {estateOptions.length > 0 ? (
                    estateOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                  ))
                ) : (
                  <SelectItem value="none" disabled>
                    {enabled ? "No estates available" : "Loading estates..."}
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
            </div>
          </div>
            <Badge variant="outline" className="text-xs text-muted-foreground">
            {selectedEstateId
              ? estateOptions.find((option) => option.value === selectedEstateId)?.label ||
                "Selected estate"
              : "All estates"}
          </Badge>
        </div>
      </CardHeader>
      <div className="px-4 sm:px-6 pb-3 space-y-3">
        <div className="flex flex-col sm:flex-row gap-2">
          <select
            className="px-3 py-2 border rounded-md bg-background w-full sm:w-48"
            value={status}
            onChange={(e) => setStatus(e.target.value as any)}
          >
            <option value="all">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="pending_inspection">Pending Inspection</option>
            <option value="assigned">Assigned</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <Input
            placeholder="Search description..."
            className="w-full sm:w-64"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <div className="flex items-center gap-2 ml-auto text-sm text-muted-foreground">
            <span>{requests.length} request(s)</span>
            {isFetching ? <span>Refreshingâ€¦</span> : null}
          </div>
        </div>
      </div>
      <CardContent>
        {error ? (
          <div className="text-sm text-red-600 whitespace-pre-wrap">
            Failed to load requests{"\n"}
            {error.message}
          </div>
        ) : !enabled ? (
          <div className="text-sm text-muted-foreground">
            Select an estate to view artisan service requests.
          </div>
        ) : isLoading ? (
          <div className="text-sm text-muted-foreground">Loading...</div>
        ) : requests.length === 0 ? (
          <div className="text-sm text-muted-foreground">No requests found.</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {requests.map((r: ServiceRequest) => (
              <div
                key={r.id}
                className="border border-border rounded-xl p-4 flex flex-col gap-3 bg-white dark:bg-gray-900 shadow-sm hover:shadow-md transition-shadow"
              >
                {/* Header */}
                <div className="flex items-start justify-between gap-3">
                  <div className="font-semibold text-base capitalize">
                    {r.category?.replaceAll("_", " ") || "Request"}
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <Badge
                      variant="outline"
                      className={`border px-2 py-1 text-xs capitalize ${STATUS_COLORS[r.status]}`}
                    >
                      {r.status.replaceAll("_", " ")}
                    </Badge>
                    {r.urgency && (
                      <Badge
                        variant="secondary"
                        className={`px-2 py-0.5 text-xs ${URGENCY_COLORS[r.urgency] || ""}`}
                      >
                        {r.urgency}
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Description */}
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {r.description}
                </p>

                {/* Meta info */}
                <div className="flex flex-col gap-1 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {formatDate(r.createdAt)}
                  </div>
                  {r.location && (
                    <div className="flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      <span className="truncate">{r.location}</span>
                    </div>
                  )}
                  {r.providerId && (
                    <div className="flex items-center gap-1">
                      <UserCheck className="w-3 h-3" />
                      <span>Provider assigned</span>
                    </div>
                  )}
                </div>

                {/* Billed amount for completed */}
                {r.status === "completed" && r.billedAmount && (
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="px-2 py-1 text-xs">
                      ₦ {Number(r.billedAmount).toLocaleString()}
                    </Badge>
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center gap-2 justify-end pt-2 border-t">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setViewRequest(r)}
                  >
                    View
                  </Button>

                  {/* Pending: Assign */}
                  {(r.status === "pending" || r.status === "pending_inspection") && (
                    <Button size="sm" onClick={() => setAssignRequest(r)}>
                      Assign
                    </Button>
                  )}

                  {/* Assigned: Start or Reassign if unavailable */}
                  {r.status === "assigned" && (
                    <>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => handleStartWork(r)}
                      >
                        Start
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleMarkUnavailable(r)}
                      >
                        Reassign
                      </Button>
                    </>
                  )}

                  {/* In Progress: Complete */}
                  {r.status === "in_progress" && (
                    <Button size="sm" onClick={() => setCompleteRequest(r)}>
                      Complete
                    </Button>
                  )}

                  {/* Cancel option for non-completed/cancelled */}
                  {!["completed", "cancelled"].includes(r.status) && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      onClick={() => setCancelRequest(r)}
                    >
                      <XCircle className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>

      {/* View Request Dialog */}
      <Dialog open={Boolean(viewRequest)} onOpenChange={() => setViewRequest(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="capitalize">
              {viewRequest?.category?.replaceAll("_", " ")} Request
            </DialogTitle>
            <DialogDescription>
              Request ID: {viewRequest?.id}
            </DialogDescription>
          </DialogHeader>
          {viewRequest && (
            <div className="space-y-4">
              {/* Status & Urgency */}
              <div className="flex items-center gap-2">
                <Badge
                  variant="outline"
                  className={`${STATUS_COLORS[viewRequest.status]}`}
                >
                  {viewRequest.status.replaceAll("_", " ")}
                </Badge>
                {viewRequest.urgency && (
                  <Badge className={URGENCY_COLORS[viewRequest.urgency]}>
                    {viewRequest.urgency}
                  </Badge>
                )}
              </div>

              {/* Description */}
              <div>
                <Label className="text-xs text-muted-foreground">Description</Label>
                <p className="mt-1">{viewRequest.description}</p>
              </div>

              {/* Location */}
              {viewRequest.location && (
                <div>
                  <Label className="text-xs text-muted-foreground">Location</Label>
                  <p className="mt-1 flex items-center gap-1">
                    <MapPin className="w-4 h-4" />
                    {viewRequest.location}
                  </p>
                </div>
              )}

              {/* Special Instructions */}
              {viewRequest.specialInstructions && (
                <div>
                  <Label className="text-xs text-muted-foreground">Special Instructions</Label>
                  <p className="mt-1">{viewRequest.specialInstructions}</p>
                </div>
              )}

              {/* Timeline */}
              <div className="border rounded-lg p-4 space-y-3">
                <Label className="text-sm font-medium">Timeline</Label>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Created:</span>
                    <span>{formatDate(viewRequest.createdAt)}</span>
                  </div>
                  {viewRequest.assignedAt && (
                    <div className="flex items-center gap-2">
                      <UserCheck className="w-4 h-4 text-blue-500" />
                      <span className="text-muted-foreground">Assigned:</span>
                      <span>{formatDate(viewRequest.assignedAt)}</span>
                    </div>
                  )}
                  {viewRequest.closedAt && (
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-green-500" />
                      <span className="text-muted-foreground">Closed:</span>
                      <span>{formatDate(viewRequest.closedAt)}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Billing */}
              {viewRequest.billedAmount && Number(viewRequest.billedAmount) > 0 && (
                <div>
                  <Label className="text-xs text-muted-foreground">Billed Amount</Label>
                  <p className="mt-1 text-lg font-semibold">
                    ₦ {Number(viewRequest.billedAmount).toLocaleString()}
                  </p>
                </div>
              )}

              {/* Admin Notes */}
              {viewRequest.adminNotes && (
                <div>
                  <Label className="text-xs text-muted-foreground">Admin Notes</Label>
                  <p className="mt-1 whitespace-pre-wrap text-sm bg-muted p-2 rounded">
                    {viewRequest.adminNotes}
                  </p>
                </div>
              )}

              {/* Close Reason */}
              {viewRequest.closeReason && (
                <div>
                  <Label className="text-xs text-muted-foreground">Close Reason</Label>
                  <p className="mt-1">{viewRequest.closeReason}</p>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewRequest(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign Provider Dialog */}
      <Dialog open={Boolean(assignRequest)} onOpenChange={() => setAssignRequest(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Provider</DialogTitle>
            <DialogDescription>
              Select a provider to handle this{" "}
              {assignRequest?.category?.replaceAll("_", " ")} request.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Select Provider</Label>
              <Select
                value={selectedProviderId}
                onValueChange={setSelectedProviderId}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Choose a provider..." />
                </SelectTrigger>
                <SelectContent>
                  {providers.length > 0 ? (
                    providers.map((provider) => (
                      <SelectItem key={provider.id} value={provider.id}>
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4" />
                          <span>{provider.name}</span>
                          {provider.serviceCategory && (
                            <Badge variant="secondary" className="text-xs ml-2">
                              {provider.serviceCategory.replaceAll("_", " ")}
                            </Badge>
                          )}
                        </div>
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value="none" disabled>
                      No providers available
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Admin Notes (optional)</Label>
              <Textarea
                className="mt-1"
                placeholder="Add any notes about this assignment..."
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignRequest(null)}>
              Cancel
            </Button>
            <Button
              onClick={handleAssignProvider}
              disabled={!selectedProviderId || updateRequestMutation.isPending}
            >
              {updateRequestMutation.isPending ? "Assigning..." : "Assign Provider"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reassign Provider Dialog (when provider unavailable) */}
      <Dialog open={Boolean(reassignRequest)} onOpenChange={() => setReassignRequest(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-orange-500" />
              Reassign Provider
            </DialogTitle>
            <DialogDescription>
              The current provider is unavailable. Select a new provider for this request.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-sm">
              <p className="font-medium text-orange-700">Provider Unavailable</p>
              <p className="text-orange-600 mt-1">
                The previously assigned provider cannot complete this request. 
                Please select an alternative provider.
              </p>
            </div>
            <div>
              <Label>Select New Provider</Label>
              <Select
                value={selectedProviderId}
                onValueChange={setSelectedProviderId}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Choose a new provider..." />
                </SelectTrigger>
                <SelectContent>
                  {providers
                    .filter((p) => p.id !== reassignRequest?.providerId)
                    .map((provider) => (
                      <SelectItem key={provider.id} value={provider.id}>
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4" />
                          <span>{provider.name}</span>
                        </div>
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Reason for Reassignment</Label>
              <Textarea
                className="mt-1"
                placeholder="Why is the provider being changed?"
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReassignRequest(null)}>
              Cancel
            </Button>
            <Button
              onClick={handleReassignProvider}
              disabled={!selectedProviderId || updateRequestMutation.isPending}
            >
              {updateRequestMutation.isPending ? "Reassigning..." : "Reassign Provider"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Complete Request Dialog */}
      <Dialog open={Boolean(completeRequest)} onOpenChange={() => setCompleteRequest(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-500" />
              Complete Request
            </DialogTitle>
            <DialogDescription>
              Mark this {completeRequest?.category?.replaceAll("_", " ")} request as completed.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Billed Amount (₦)</Label>
              <Input
                type="number"
                className="mt-1"
                placeholder="Enter the amount billed..."
                value={billedAmount}
                onChange={(e) => setBilledAmount(e.target.value)}
              />
            </div>
            <div>
              <Label>Completion Notes</Label>
              <Textarea
                className="mt-1"
                placeholder="Add any notes about the completed work..."
                value={closeReason}
                onChange={(e) => setCloseReason(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCompleteRequest(null)}>
              Cancel
            </Button>
            <Button
              onClick={handleCompleteRequest}
              disabled={updateRequestMutation.isPending}
              className="bg-green-600 hover:bg-green-700"
            >
              {updateRequestMutation.isPending ? "Completing..." : "Mark Complete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel Request Dialog */}
      <AlertDialog open={Boolean(cancelRequest)} onOpenChange={() => setCancelRequest(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <XCircle className="w-5 h-5 text-red-500" />
              Cancel Request
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to cancel this request? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Label>Reason for Cancellation</Label>
            <Textarea
              className="mt-1"
              placeholder="Why is this request being cancelled?"
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep Request</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancelRequest}
              className="bg-red-600 hover:bg-red-700"
              disabled={updateRequestMutation.isPending}
            >
              {updateRequestMutation.isPending ? "Cancelling..." : "Cancel Request"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
