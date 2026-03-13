import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import { AdminAPI, adminApiRequest } from "@/lib/adminApi";
import { useToast } from "@/hooks/use-toast";
import { formatServiceRequestStatusLabel } from "@/lib/serviceRequestStatus";
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
  | "assigned_for_job"
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
  paymentRequestedAt?: string;
  approvedForJobAt?: string;
  approvedForJobBy?: string;
  paymentStatus?: string;
  consultancyReport?: {
    inspectionDate?: string;
    actualIssue?: string;
    causeOfIssue?: string;
    materialCost?: number;
    serviceCost?: number;
    totalRecommendation?: number;
    preventiveRecommendation?: string;
    submittedAt?: string;
  } | null;
  consultancyReportSubmittedAt?: string;
  closedAt?: string;
  closeReason?: string;
}

interface Provider {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  serviceCategory?: string;
  categories?: string[];
  metadata?: Record<string, unknown> | null;
  avatarUrl?: string | null;
  profileImage?: string | null;
  company?: string | null;
  rating?: string | number | null;
  experience?: number | null;
  isApproved?: boolean;
  isAvailable?: boolean;
}

interface ArtisanRequestsPanelProps {
  selectedEstateId: string | null;
  estates: any[];
  onSelectEstate: (estateId: string | null) => void;
  hideList?: boolean;
  actionTarget?: { id: string; action: string } | null;
  onActionHandled?: () => void;
}

const STATUS_COLORS: Record<RequestStatus, string> = {
  pending: "bg-yellow-50 text-yellow-700 border-yellow-200",
  pending_inspection: "bg-orange-50 text-orange-700 border-orange-200",
  assigned: "bg-purple-50 text-purple-700 border-purple-200",
  assigned_for_job: "bg-indigo-50 text-indigo-700 border-indigo-200",
  in_progress: "bg-blue-50 text-blue-700 border-blue-200",
  completed: "bg-green-50 text-green-700 border-green-200",
  cancelled: "bg-red-50 text-red-700 border-red-200",
};

const URGENCY_COLORS: Record<string, string> = {
  low: "bg-gray-100 text-gray-600",
  medium: "bg-yellow-100 text-yellow-700",
  high: "bg-orange-100 text-orange-700",
  emergency: "bg-red-100 text-red-700",
};

function readConsultancyReport(report: ServiceRequest["consultancyReport"]) {
  if (!report || typeof report !== "object") return null;
  const materialCost = Number((report as any).materialCost || 0);
  const serviceCost = Number((report as any).serviceCost || 0);
  const totalRecommendation =
    Number((report as any).totalRecommendation || 0) || materialCost + serviceCost;
  return {
    inspectionDate: String((report as any).inspectionDate || ""),
    actualIssue: String((report as any).actualIssue || ""),
    causeOfIssue: String((report as any).causeOfIssue || ""),
    materialCost: Number.isFinite(materialCost) ? materialCost : 0,
    serviceCost: Number.isFinite(serviceCost) ? serviceCost : 0,
    totalRecommendation: Number.isFinite(totalRecommendation) ? totalRecommendation : 0,
    preventiveRecommendation: String((report as any).preventiveRecommendation || ""),
    submittedAt: String((report as any).submittedAt || ""),
  };
}

function formatNgnAmount(value: number) {
  if (!Number.isFinite(value) || value <= 0) return "Not set";
  return `NGN ${value.toLocaleString()}`;
}

function normalizeCategoryKey(value?: string | null) {
  return String(value || "").trim().toLowerCase();
}

function providerMatchesCategory(provider: Provider, category?: string | null) {
  const normalized = normalizeCategoryKey(category);
  if (!normalized) return true;
  const categories = Array.isArray(provider.categories)
    ? provider.categories.map((c) => normalizeCategoryKey(c)).filter(Boolean)
    : [];
  if (categories.includes(normalized)) return true;
  const serviceCategory = normalizeCategoryKey(provider.serviceCategory);
  return serviceCategory ? serviceCategory === normalized : false;
}

function getProviderAvatar(provider: Provider) {
  if (provider.avatarUrl) return provider.avatarUrl;
  if (provider.profileImage) return provider.profileImage;
  const metadata = provider.metadata && typeof provider.metadata === "object"
    ? (provider.metadata as Record<string, unknown>)
    : null;
  const fromMetadata =
    (typeof metadata?.avatarUrl === "string" && metadata.avatarUrl) ||
    (typeof metadata?.profileImageUrl === "string" && metadata.profileImageUrl) ||
    (typeof metadata?.profilePicture === "string" && metadata.profilePicture) ||
    (typeof metadata?.profileImage === "string" && metadata.profileImage) ||
    null;
  return fromMetadata || null;
}

function getInitials(name?: string | null) {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  const [first, second] = parts;
  return `${first[0] || ""}${second ? second[0] : ""}`.toUpperCase();
}

export default function ArtisanRequestsPanel({
  selectedEstateId,
  estates,
  onSelectEstate,
  hideList = false,
  actionTarget,
  onActionHandled,
}: ArtisanRequestsPanelProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [location, setLocation] = useLocation();

  const [q, setQ] = useState("");
  const [status, setStatus] = useState<RequestStatus | "all">("all");
  const enabled = true;

  // Modal states
  const [assignRequest, setAssignRequest] = useState<ServiceRequest | null>(null);
  const [assignMode, setAssignMode] = useState<"inspection" | "job">("inspection");
  const [selectedProviderId, setSelectedProviderId] = useState<string>("");
  const [reassignRequest, setReassignRequest] = useState<ServiceRequest | null>(null);
  const [jobReassignRequest, setJobReassignRequest] = useState<ServiceRequest | null>(null);
  const [jobReassignProviderId, setJobReassignProviderId] = useState("");
  const [jobReassignReason, setJobReassignReason] = useState("");
  const [jobReassignEvidence, setJobReassignEvidence] = useState("");
  const [completeRequest, setCompleteRequest] = useState<ServiceRequest | null>(null);
  const [billedAmount, setBilledAmount] = useState("");
  const [closeReason, setCloseReason] = useState("");
  const [paymentRequestTarget, setPaymentRequestTarget] = useState<ServiceRequest | null>(null);
  const [paymentRequestMaterialCost, setPaymentRequestMaterialCost] = useState("");
  const [paymentRequestServiceCost, setPaymentRequestServiceCost] = useState("");
  const [paymentRequestNote, setPaymentRequestNote] = useState("");
  const [cancelRequest, setCancelRequest] = useState<ServiceRequest | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [adminNotes, setAdminNotes] = useState("");
  const actionHandledRef = useRef<{ id: string; action: string } | null>(null);

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

  const providerCategory = normalizeCategoryKey(
    assignRequest?.category || reassignRequest?.category || jobReassignRequest?.category || ""
  );

  // Fetch available providers
  const { data: providersData, isFetching: providersLoading } = useQuery<Provider[]>({
    queryKey: ["admin.providers", providerCategory],
    queryFn: () =>
      AdminAPI.providers.getAll({
        approved: true,
        ...(providerCategory ? { category: providerCategory } : {}),
      }),
    enabled: Boolean(assignRequest || reassignRequest || jobReassignRequest),
  });

  const providers = useMemo(() => {
    const list = providersData ?? [];
    if (!providerCategory) return list;
    return list.filter((provider) => providerMatchesCategory(provider, providerCategory));
  }, [providersData, providerCategory]);

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

  const requestPaymentMutation = useMutation({
    mutationFn: async ({
      id,
      payload,
    }: {
      id: string;
      payload: { amount?: string; materialCost?: number; serviceCost?: number; providerId?: string; note?: string };
    }) => {
      return await AdminAPI.bridge.requestJobPayment(id, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin.bridge.service-requests"] });
      toast({ title: "Payment request sent" });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to request payment",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    },
  });


  const reassignJobProviderMutation = useMutation({
    mutationFn: async ({
      id,
      payload,
    }: {
      id: string;
      payload: { providerId: string; reason: string; evidence: string };
    }) => {
      return await AdminAPI.bridge.reassignJobProvider(id, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin.bridge.service-requests"] });
      toast({ title: "Job provider changed" });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to change provider",
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

  const openRequestAction = (
    target: ServiceRequest,
    actionValue: string,
    requestIdValue: string,
    pathname?: string,
    clearLocation = true
  ) => {
    if (actionValue === "request-payment") {
      handleOpenRequestPayment(target);
    } else if (actionValue === "assign-provider" || actionValue === "assign-for-job") {
      setAssignMode(actionValue === "assign-for-job" ? "job" : "inspection");
      setAssignRequest(target);
      setSelectedProviderId("");
      setAdminNotes("");
    } else if (actionValue === "change-inspector") {
      setReassignRequest(target);
      setSelectedProviderId("");
      setAdminNotes("");
    } else if (actionValue === "change-provider") {
      handleOpenJobReassign(target);
    }

    actionHandledRef.current = { id: requestIdValue, action: actionValue };
    if (clearLocation && pathname) {
      setLocation(pathname);
    }
  };

  useEffect(() => {
    const search = typeof window !== "undefined" ? window.location.search : "";
    const queryString = search ? search.slice(1) : (location.includes("?") ? location.split("?")[1] : "");
    const params = new URLSearchParams(queryString);
    const action = params.get("action");
    const pathname = typeof window !== "undefined" ? window.location.pathname : location.split("?")[0];
    const requestIdParam =
      params.get("requestId") ||
      (pathname.startsWith("/admin-dashboard/requests/")
        ? pathname.split("/")[3]
        : "");

    const runAction = (actionValue: string, requestIdValue: string, clearLocation: boolean) => {
      const target = requests.find((r) => r.id === requestIdValue);
      if (target) {
        openRequestAction(target, actionValue, requestIdValue, pathname, clearLocation);
        return undefined;
      }

      let cancelled = false;
      adminApiRequest("GET", `/api/service-requests/${requestIdValue}`)
        .then((request: any) => {
          if (cancelled || !request) return;
          openRequestAction(request as ServiceRequest, actionValue, requestIdValue, pathname, clearLocation);
        })
        .catch(() => undefined);

      return () => {
        cancelled = true;
      };
    };

    if (actionTarget?.id && actionTarget?.action) {
      const cleanup = runAction(actionTarget.action, actionTarget.id, false);
      onActionHandled?.();
      return () => {
        if (typeof cleanup === "function") cleanup();
      };
    }

    if (!action || !requestIdParam) return undefined;

    if (
      actionHandledRef.current &&
      actionHandledRef.current.id === requestIdParam &&
      actionHandledRef.current.action === action
    ) {
      return undefined;
    }

    const cleanup = runAction(action, requestIdParam, true);
    return () => {
      if (typeof cleanup === "function") cleanup();
    };
  }, [actionTarget, location, onActionHandled, requests, setLocation]);

  // Action handlers
  const handleAssignProvider = () => {
    if (!assignRequest || !selectedProviderId) return;
    const isJobAssignment = assignMode === "job";

    if (isJobAssignment) {
      const paymentRequestedAt = assignRequest.paymentRequestedAt;
      const paymentStatus = String(assignRequest.paymentStatus || "").toLowerCase();
      if (!paymentRequestedAt) {
        toast({
          title: "Payment required",
          description: "Request payment from the resident before assigning for job.",
          variant: "destructive",
        });
        return;
      }
      if (paymentStatus !== "paid") {
        toast({
          title: "Payment not completed",
          description: "Resident payment must be completed before assigning for job.",
          variant: "destructive",
        });
        return;
      }
    }

    updateRequestMutation.mutate({
      id: assignRequest.id,
      updates: {
        providerId: selectedProviderId,
        status: isJobAssignment ? "assigned_for_job" : "assigned",
        assignedAt: new Date(),
        assignedInspectorId: isJobAssignment ? null : selectedProviderId,
        assignedJobProviderId: isJobAssignment ? selectedProviderId : null,
        approvedForJobAt: isJobAssignment ? new Date() : undefined,
        adminNotes: adminNotes || undefined,
      },
    });
    setAssignRequest(null);
    setAssignMode("inspection");
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
        assignedInspectorId: selectedProviderId,
        status: "assigned",
        assignedAt: new Date(),
        adminNotes: `${reassignRequest.adminNotes || ""}\n[Reassigned from provider ${previousProviderId} on ${new Date().toLocaleString()}]${adminNotes ? `\nReason: ${adminNotes}` : ""}`.trim(),
      },
    });
    setReassignRequest(null);
    setSelectedProviderId("");
    setAdminNotes("");
  };

  const handleOpenJobReassign = (request: ServiceRequest) => {
    setJobReassignRequest(request);
    setJobReassignProviderId("");
    setJobReassignReason("");
    setJobReassignEvidence("");
  };

  const handleSubmitJobReassign = async () => {
    if (!jobReassignRequest || !jobReassignProviderId) return;
    const reason = jobReassignReason.trim();
    const evidence = jobReassignEvidence.trim();
    if (reason.length < 5 || evidence.length < 3) {
      toast({
        title: "Reason and evidence are required",
        description: "Provide a clear reason and supporting evidence before changing the provider.",
        variant: "destructive",
      });
      return;
    }

    await reassignJobProviderMutation.mutateAsync({
      id: jobReassignRequest.id,
      payload: {
        providerId: jobReassignProviderId,
        reason,
        evidence,
      },
    });

    setJobReassignRequest(null);
    setJobReassignProviderId("");
    setJobReassignReason("");
    setJobReassignEvidence("");
  };

  const handleStartWork = (request: ServiceRequest) => {
    updateRequestMutation.mutate({
      id: request.id,
      updates: {
        status: "in_progress",
      },
    });
  };

  const handleOpenRequestPayment = (request: ServiceRequest) => {
    const report = readConsultancyReport(request.consultancyReport);
    const billedAmount = Number(request.billedAmount || 0);
    setPaymentRequestTarget(request);
    if (report) {
      setPaymentRequestMaterialCost(String(report.materialCost || 0));
      setPaymentRequestServiceCost(
        String(
          report.serviceCost ||
            (report.totalRecommendation > 0 && report.materialCost >= 0
              ? Math.max(report.totalRecommendation - report.materialCost, 0)
              : 0),
        ),
      );
    } else {
      setPaymentRequestMaterialCost("0");
      setPaymentRequestServiceCost(Number.isFinite(billedAmount) && billedAmount > 0 ? String(billedAmount) : "");
    }
    setPaymentRequestNote("");
  };

  const paymentRequestMaterialCostValue = Number(paymentRequestMaterialCost || 0);
  const paymentRequestServiceCostValue = Number(paymentRequestServiceCost || 0);
  const paymentRequestTotal =
    (Number.isFinite(paymentRequestMaterialCostValue) ? paymentRequestMaterialCostValue : 0) +
    (Number.isFinite(paymentRequestServiceCostValue) ? paymentRequestServiceCostValue : 0);

  const handleRequestPayment = async () => {
    if (!paymentRequestTarget) return;

    const materialCostValue = Number(paymentRequestMaterialCost || 0);
    const serviceCostValue = Number(paymentRequestServiceCost || 0);
    const totalAmount = materialCostValue + serviceCostValue;
    if (!Number.isFinite(materialCostValue) || materialCostValue < 0) {
      toast({
        title: "Invalid material cost",
        description: "Enter a valid material cost (0 or greater)",
        variant: "destructive",
      });
      return;
    }

    if (!Number.isFinite(serviceCostValue) || serviceCostValue < 0) {
      toast({
        title: "Invalid service charge",
        description: "Enter a valid service charge (0 or greater)",
        variant: "destructive",
      });
      return;
    }

    if (!Number.isFinite(totalAmount) || totalAmount <= 0) {
      toast({
        title: "Invalid total amount",
        description: "Material + service charge must be greater than 0",
        variant: "destructive",
      });
      return;
    }

    await requestPaymentMutation.mutateAsync({
      id: paymentRequestTarget.id,
      payload: {
        providerId: paymentRequestTarget.providerId,
        materialCost: materialCostValue,
        serviceCost: serviceCostValue,
        amount: totalAmount.toString(),
        note: paymentRequestNote.trim() || undefined,
      },
    });

    setPaymentRequestTarget(null);
    setPaymentRequestMaterialCost("");
    setPaymentRequestServiceCost("");
    setPaymentRequestNote("");
  };

  const handleClosePaymentRequestDialog = () => {
    if (requestPaymentMutation.isPending) return;
    setPaymentRequestTarget(null);
    setPaymentRequestMaterialCost("");
    setPaymentRequestServiceCost("");
    setPaymentRequestNote("");
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
      {!hideList && (
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
            <option value="pending_inspection">Pending inspection</option>
            <option value="assigned">Assigned for inspection</option>
            <option value="assigned_for_job">Assigned for job</option>
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
            {isFetching ? <span>Refreshing...</span> : null}
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
          <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-4">
            {requests.map((r: ServiceRequest) => {
              const paymentStatusValue = String(r.paymentStatus || "").toLowerCase();
              const hasPaymentRequest = Boolean(r.paymentRequestedAt);
              const isPaymentPending = hasPaymentRequest && paymentStatusValue === "pending";
              const isPaymentPaid = hasPaymentRequest && paymentStatusValue === "paid";
              const consultancyReport = readConsultancyReport(r.consultancyReport);
              const hasConsultancyReport =
                Boolean(r.consultancyReportSubmittedAt) || Boolean(consultancyReport);

              return (
                <div
                  key={r.id}
                  className="border border-border rounded-xl p-4 flex h-full flex-col gap-3 bg-white dark:bg-gray-900 shadow-sm hover:shadow-md transition-shadow"
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
                      {formatServiceRequestStatusLabel(r.status, r.category)}
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

                {/* Provider advice (consultancy report) */}
                {consultancyReport ? (
                  <div className="rounded-lg border border-[#D0D5DD] bg-[#F8FAFC] p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold text-[#344054]">Provider advice</p>
                      <Badge variant="outline" className="text-[10px] border-[#B2DDFF] bg-[#EFF8FF] text-[#175CD3]">
                        Report submitted
                      </Badge>
                    </div>
                    <p className="mt-2 text-xs text-[#344054] line-clamp-2">
                      <span className="font-medium text-[#101828]">Issue:</span>{" "}
                      {consultancyReport.actualIssue || "Not provided"}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-[#475467]">
                      <span className="rounded-full bg-white px-2 py-0.5 border border-[#EAECF0]">
                        Total: {formatNgnAmount(consultancyReport.totalRecommendation)}
                      </span>
                      {consultancyReport.inspectionDate ? (
                        <span className="rounded-full bg-white px-2 py-0.5 border border-[#EAECF0]">
                          Inspected {new Date(consultancyReport.inspectionDate).toLocaleDateString()}
                        </span>
                      ) : null}
                    </div>
                  </div>
                ) : null}

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
                  {r.paymentStatus && (
                    <div className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      <span>Payment: {String(r.paymentStatus).replace(/_/g, " ")}</span>
                    </div>
                  )}
                </div>

                {/* Billed amount for completed */}
                {r.status === "completed" && r.billedAmount && (
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="px-2 py-1 text-xs">
                      NGN {Number(r.billedAmount).toLocaleString()}
                    </Badge>
                  </div>
                )}

                {/* Actions */}
                <div className="mt-auto flex flex-wrap items-center justify-end gap-2 border-t pt-3">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setLocation(`/admin-dashboard/requests/${r.id}`)}
                    className="h-8 whitespace-nowrap"
                  >
                    View
                  </Button>

                  {/* Pending: Assign */}
                  {(r.status === "pending" || r.status === "pending_inspection") && (
                    <Button size="sm" onClick={() => setAssignRequest(r)} className="h-8 whitespace-nowrap">
                      Assign
                    </Button>
                  )}

                  {/* Assigned for inspection: payment request, approval, reassign */}
                  {r.status === "assigned" && (
                    <>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => handleOpenRequestPayment(r)}
                        disabled={
                          requestPaymentMutation.isPending ||
                          isPaymentPending ||
                          isPaymentPaid ||
                          !hasConsultancyReport
                        }
                        className="h-8 whitespace-nowrap"
                      >
                        {isPaymentPaid
                          ? "Payment paid"
                          : isPaymentPending
                            ? "Payment requested"
                            : !hasConsultancyReport
                              ? "Awaiting report"
                              : "Request payment"}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleMarkUnavailable(r)}
                        className="h-8 whitespace-nowrap"
                      >
                        Reassign
                      </Button>
                    </>
                  )}

                  {/* Assigned for job: provider can start work and admin can change provider */}
                  {r.status === "assigned_for_job" && (
                    <>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => handleStartWork(r)}
                        className="h-8 whitespace-nowrap"
                      >
                        Start
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleOpenJobReassign(r)}
                        className="h-8 whitespace-nowrap"
                      >
                        Change provider
                      </Button>
                    </>
                  )}

                  {/* In Progress: Complete (admin can still change provider with evidence) */}
                  {r.status === "in_progress" && (
                    <>
                      <Button size="sm" onClick={() => setCompleteRequest(r)} className="h-8 whitespace-nowrap">
                        Complete
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleOpenJobReassign(r)}
                        className="h-8 whitespace-nowrap"
                      >
                        Change provider
                      </Button>
                    </>
                  )}

                  {/* Cancel option for non-completed/cancelled */}
                  {!["completed", "cancelled"].includes(r.status) && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                      onClick={() => setCancelRequest(r)}
                    >
                      <XCircle className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
    )}

      {/* Assign Provider Dialog */}
      <Dialog
        open={Boolean(assignRequest)}
        onOpenChange={() => {
          setAssignRequest(null);
          setAssignMode("inspection");
          setSelectedProviderId("");
          setAdminNotes("");
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{assignMode === "job" ? "Assign Job Provider" : "Assign Inspector"}</DialogTitle>
            <DialogDescription>
              {assignMode === "job"
                ? "Select the provider who will own the job after payment."
                : "Select the provider who will carry out the inspection."}
              {assignRequest?.category
                ? ` Category: ${assignRequest.category.replaceAll("_", " ")}.`
                : ""}
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
                  {providersLoading ? (
                    <SelectItem value="loading" disabled>
                      Loading providers...
                    </SelectItem>
                  ) : providers.length > 0 ? (
                    providers.map((provider) => {
                      const avatarSrc = getProviderAvatar(provider);
                      const categoryLabel =
                        provider.serviceCategory || provider.categories?.[0] || providerCategory;
                      const metaParts = [
                        provider.company,
                        provider.experience != null ? `${provider.experience} yrs` : null,
                        provider.rating != null && provider.rating !== ""
                          ? `? ${Number(provider.rating).toFixed(1)}`
                          : null,
                      ].filter(Boolean);

                      return (
                        <SelectItem key={provider.id} value={provider.id}>
                          <div className="flex w-full items-center gap-3">
                            <Avatar className="h-8 w-8">
                              <AvatarImage src={avatarSrc || undefined} alt={provider.name} />
                              <AvatarFallback className="text-[11px]">
                                {getInitials(provider.name)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-slate-900">
                                {provider.name}
                              </p>
                              {metaParts.length ? (
                                <p className="truncate text-[11px] text-slate-500">
                                  {metaParts.join(" - ")}
                                </p>
                              ) : null}
                            </div>
                            <div className="ml-auto flex items-center gap-2">
                              {categoryLabel ? (
                                <Badge variant="secondary" className="text-[10px] capitalize">
                                  {categoryLabel.replaceAll("_", " ")}
                                </Badge>
                              ) : null}
                              {provider.isAvailable !== undefined ? (
                                <Badge
                                  variant="outline"
                                  className={
                                    provider.isAvailable
                                      ? "border-emerald-200 bg-emerald-50 text-[10px] text-emerald-700"
                                      : "border-slate-200 bg-slate-50 text-[10px] text-slate-600"
                                  }
                                >
                                  {provider.isAvailable ? "Available" : "Busy"}
                                </Badge>
                              ) : null}
                            </div>
                          </div>
                        </SelectItem>
                      );
                    })
                  ) : (
                    <SelectItem value="none" disabled>
                      {providerCategory
                        ? "No providers match this category"
                        : "No providers available"}
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
              <p className="mt-2 text-xs text-slate-500">
                {providerCategory
                  ? `Showing providers linked to ${providerCategory.replaceAll("_", " ")}.`
                  : "Showing all approved providers."}
              </p>
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
            <Button
              variant="outline"
              onClick={() => {
                setAssignRequest(null);
                setAssignMode("inspection");
                setSelectedProviderId("");
                setAdminNotes("");
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAssignProvider}
              disabled={!selectedProviderId || updateRequestMutation.isPending}
            >
              {updateRequestMutation.isPending ? "Assigning..." : assignMode === "job" ? "Assign for job" : "Assign inspector"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Request Payment Dialog */}
      <Dialog open={Boolean(paymentRequestTarget)} onOpenChange={handleClosePaymentRequestDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request job payment</DialogTitle>
            <DialogDescription>
              Review the provider report, adjust material/service charges, then send the payment card to the resident.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {paymentRequestTarget ? (() => {
              const report = readConsultancyReport(paymentRequestTarget.consultancyReport);
              if (!report) {
                return (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
                    No consultancy report has been submitted yet for this request.
                  </div>
                );
              }
              return (
                <div className="rounded-lg border border-[#EAECF0] bg-[#F9FAFB] p-3">
                  <p className="text-sm font-semibold text-[#101828]">Provider consultancy report</p>
                  <div className="mt-2 space-y-2 text-sm text-[#344054]">
                    <p><span className="font-medium">Inspection date:</span> {report.inspectionDate ? new Date(report.inspectionDate).toLocaleString() : "Not set"}</p>
                    <p><span className="font-medium">Issue:</span> {report.actualIssue || "Not provided"}</p>
                    <p><span className="font-medium">Cause:</span> {report.causeOfIssue || "Not provided"}</p>
                    <p>
                      <span className="font-medium">Recommendation:</span> Materials NGN {report.materialCost.toLocaleString()} + Service NGN {report.serviceCost.toLocaleString()}
                      {report.totalRecommendation > 0 ? ` (Total NGN ${report.totalRecommendation.toLocaleString()})` : ""}
                    </p>
                    <p><span className="font-medium">Prevention:</span> {report.preventiveRecommendation || "Not provided"}</p>
                  </div>
                </div>
              );
            })() : null}
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div>
                <Label htmlFor="job-payment-material">Material cost (NGN)</Label>
                <Input
                  id="job-payment-material"
                  type="number"
                  min="0"
                  step="0.01"
                  className="mt-1"
                  placeholder="e.g. 25000"
                  value={paymentRequestMaterialCost}
                  onChange={(event) => setPaymentRequestMaterialCost(event.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="job-payment-service">Service charge (NGN)</Label>
                <Input
                  id="job-payment-service"
                  type="number"
                  min="0"
                  step="0.01"
                  className="mt-1"
                  placeholder="e.g. 15000"
                  value={paymentRequestServiceCost}
                  onChange={(event) => setPaymentRequestServiceCost(event.target.value)}
                />
              </div>
            </div>
            <div className="rounded-md border border-[#D0D5DD] bg-[#F9FAFB] px-3 py-2 text-sm text-[#344054]">
              <span className="font-medium text-[#101828]">Total payment:</span>{" "}
              NGN {Number.isFinite(paymentRequestTotal) ? paymentRequestTotal.toLocaleString() : "0"}
            </div>
            <div>
              <Label htmlFor="job-payment-note">Note (optional)</Label>
              <Textarea
                id="job-payment-note"
                className="mt-1"
                placeholder="Add context for the resident (scope, inclusions, timeline, etc.)"
                value={paymentRequestNote}
                onChange={(event) => setPaymentRequestNote(event.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleClosePaymentRequestDialog}>
              Cancel
            </Button>
            <Button
              onClick={handleRequestPayment}
              disabled={
                requestPaymentMutation.isPending ||
                !Number.isFinite(paymentRequestTotal) ||
                paymentRequestTotal <= 0
              }
            >
              {requestPaymentMutation.isPending ? "Sending..." : "Send payment request"}
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
                  {providersLoading ? (
                    <SelectItem value="loading" disabled>
                      Loading providers...
                    </SelectItem>
                  ) : (
                    (() => {
                      const availableProviders = providers.filter(
                        (provider) => provider.id !== reassignRequest?.providerId
                      );
                      if (!availableProviders.length) {
                        return (
                          <SelectItem value="none" disabled>
                            No other providers match this category
                          </SelectItem>
                        );
                      }

                      return availableProviders.map((provider) => {
                        const avatarSrc = getProviderAvatar(provider);
                        const categoryLabel =
                          provider.serviceCategory || provider.categories?.[0] || providerCategory;
                        const metaParts = [
                          provider.company,
                          provider.experience != null ? `${provider.experience} yrs` : null,
                          provider.rating != null && provider.rating !== ""
                            ? `? ${Number(provider.rating).toFixed(1)}`
                            : null,
                        ].filter(Boolean);

                        return (
                          <SelectItem key={provider.id} value={provider.id}>
                            <div className="flex w-full items-center gap-3">
                              <Avatar className="h-8 w-8">
                                <AvatarImage src={avatarSrc || undefined} alt={provider.name} />
                                <AvatarFallback className="text-[11px]">
                                  {getInitials(provider.name)}
                                </AvatarFallback>
                              </Avatar>
                              <div className="min-w-0">
                                <p className="truncate text-sm font-medium text-slate-900">
                                  {provider.name}
                                </p>
                                {metaParts.length ? (
                                  <p className="truncate text-[11px] text-slate-500">
                                    {metaParts.join(" - ")}
                                  </p>
                                ) : null}
                              </div>
                              <div className="ml-auto flex items-center gap-2">
                                {categoryLabel ? (
                                  <Badge variant="secondary" className="text-[10px] capitalize">
                                    {categoryLabel.replaceAll("_", " ")}
                                  </Badge>
                                ) : null}
                                {provider.isAvailable !== undefined ? (
                                  <Badge
                                    variant="outline"
                                    className={
                                      provider.isAvailable
                                        ? "border-emerald-200 bg-emerald-50 text-[10px] text-emerald-700"
                                        : "border-slate-200 bg-slate-50 text-[10px] text-slate-600"
                                    }
                                  >
                                    {provider.isAvailable ? "Available" : "Busy"}
                                  </Badge>
                                ) : null}
                              </div>
                            </div>
                          </SelectItem>
                        );
                      });
                    })()
                  )}
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



      {/* Job Provider Change Dialog */}
      <Dialog
        open={Boolean(jobReassignRequest)}
        onOpenChange={(open) => {
          if (open) return;
          if (reassignJobProviderMutation.isPending) return;
          setJobReassignRequest(null);
          setJobReassignProviderId("");
          setJobReassignReason("");
          setJobReassignEvidence("");
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-indigo-500" />
              Change job provider
            </DialogTitle>
            <DialogDescription>
              Update the task owner after payment. Reason and evidence are required for audit.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>New Provider</Label>
              <Select value={jobReassignProviderId} onValueChange={setJobReassignProviderId}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Choose a provider..." />
                </SelectTrigger>
                <SelectContent>
                  {providersLoading ? (
                    <SelectItem value="loading" disabled>
                      Loading providers...
                    </SelectItem>
                  ) : (
                    (() => {
                      const availableProviders = providers.filter(
                        (provider) => provider.id !== jobReassignRequest?.providerId
                      );
                      if (!availableProviders.length) {
                        return (
                          <SelectItem value="none" disabled>
                            No other providers match this category
                          </SelectItem>
                        );
                      }

                      return availableProviders.map((provider) => {
                        const avatarSrc = getProviderAvatar(provider);
                        const categoryLabel =
                          provider.serviceCategory || provider.categories?.[0] || providerCategory;
                        const metaParts = [
                          provider.company,
                          provider.experience != null ? `${provider.experience} yrs` : null,
                          provider.rating != null && provider.rating !== ""
                            ? `? ${Number(provider.rating).toFixed(1)}`
                            : null,
                        ].filter(Boolean);

                        return (
                          <SelectItem key={provider.id} value={provider.id}>
                            <div className="flex w-full items-center gap-3">
                              <Avatar className="h-8 w-8">
                                <AvatarImage src={avatarSrc || undefined} alt={provider.name} />
                                <AvatarFallback className="text-[11px]">
                                  {getInitials(provider.name)}
                                </AvatarFallback>
                              </Avatar>
                              <div className="min-w-0">
                                <p className="truncate text-sm font-medium text-slate-900">
                                  {provider.name}
                                </p>
                                {metaParts.length ? (
                                  <p className="truncate text-[11px] text-slate-500">
                                    {metaParts.join(" - ")}
                                  </p>
                                ) : null}
                              </div>
                              <div className="ml-auto flex items-center gap-2">
                                {categoryLabel ? (
                                  <Badge variant="secondary" className="text-[10px] capitalize">
                                    {categoryLabel.replaceAll("_", " ")}
                                  </Badge>
                                ) : null}
                                {provider.isAvailable !== undefined ? (
                                  <Badge
                                    variant="outline"
                                    className={
                                      provider.isAvailable
                                        ? "border-emerald-200 bg-emerald-50 text-[10px] text-emerald-700"
                                        : "border-slate-200 bg-slate-50 text-[10px] text-slate-600"
                                    }
                                  >
                                    {provider.isAvailable ? "Available" : "Busy"}
                                  </Badge>
                                ) : null}
                              </div>
                            </div>
                          </SelectItem>
                        );
                      });
                    })()
                  )}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Reason</Label>
              <Textarea
                className="mt-1"
                placeholder="Explain why the current provider should be changed"
                value={jobReassignReason}
                onChange={(event) => setJobReassignReason(event.target.value)}
              />
            </div>
            <div>
              <Label>Evidence</Label>
              <Textarea
                className="mt-1"
                placeholder="Add supporting evidence (incident details, call log reference, report link, etc.)"
                value={jobReassignEvidence}
                onChange={(event) => setJobReassignEvidence(event.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setJobReassignRequest(null);
                setJobReassignProviderId("");
                setJobReassignReason("");
                setJobReassignEvidence("");
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmitJobReassign}
              disabled={
                reassignJobProviderMutation.isPending ||
                !jobReassignProviderId ||
                jobReassignReason.trim().length < 5 ||
                jobReassignEvidence.trim().length < 3
              }
            >
              {reassignJobProviderMutation.isPending ? "Updating..." : "Change provider"}
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
              <Label>Billed Amount (NGN)</Label>
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
