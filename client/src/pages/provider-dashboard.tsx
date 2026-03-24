import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  Briefcase,
  CheckCircle2,
  Clock3,
  DollarSign,
  MapPin,
  MessageSquare,
  Package,
  Plus,
  Store,
  Wrench,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { ProviderShell } from "@/components/provider/ProviderShell";
import { DisabledActionHint } from "@/components/provider/DisabledActionHint";
import { EmptyState, InlineErrorState, PageSkeleton } from "@/components/shared/page-states";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { normalizeServiceRequestStatus } from "@/lib/serviceRequestStatus";
import { getProviderStoreAccessState, getStoreApprovalBadgeLabel } from "@/lib/provider-store-access";
import { ProviderFilterActionBar, ProviderMetricCard, ProviderStatusBadge } from "@/components/provider/provider-primitives";
import { PROVIDER_ANALYTICS_EVENTS, trackEvent } from "@/lib/analytics";

type ServiceRequest = {
  id: string;
  status: string;
  description?: string;
  category?: string;
  categoryLabel?: string;
  issueType?: string;
  budget?: string | number;
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
  approvalStatus?: string | null;
  estateAllocationCount?: number | null;
  estateNames?: string[] | null;
  hasEstateAllocation?: boolean;
  membership?: { role?: string; canManageItems?: boolean; canManageOrders?: boolean };
};

type OperationalAlert = {
  id: string;
  level: "critical" | "warning" | "info";
  title: string;
  description: string;
  actionLabel?: string;
  action?: () => void;
};

const ACTIVE_JOB_STATUSES = new Set([
  "assigned",
  "assigned_for_job",
  "in_progress",
  "work_completed_pending_resident",
  "disputed",
  "rework_required",
]);

function normalizeCategoryKey(value?: string | null) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function toCategoryLabel(category?: string) {
  if (!category) return "General service";
  return category
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function resolveRequestCategoryLabel(
  request?: Pick<ServiceRequest, "category" | "categoryLabel" | "issueType"> | null,
) {
  return toCategoryLabel(request?.categoryLabel || request?.issueType || request?.category);
}

function resolveRequestCategoryKey(
  request?: Pick<ServiceRequest, "category" | "categoryLabel" | "issueType"> | null,
) {
  const categoryKey = normalizeCategoryKey(request?.category);
  const inferredKey = normalizeCategoryKey(request?.categoryLabel || request?.issueType || "");
  if (categoryKey && categoryKey !== "maintenance_repair") return categoryKey;
  return inferredKey || categoryKey;
}

function parseBudgetValue(budget: ServiceRequest["budget"]) {
  const cleaned = String(budget ?? "0").replace(/[^0-9.]/g, "");
  const amount = Number.parseFloat(cleaned || "0");
  return Number.isFinite(amount) ? amount : 0;
}

function formatMoney(value: number) {
  return `NGN ${Math.max(0, value).toLocaleString()}`;
}

function formatDateLabel(value?: string) {
  if (!value) return "Date not set";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Date not set";
  return parsed.toLocaleDateString();
}

function sortByMostRecent<T extends { updatedAt?: string; createdAt?: string }>(items: T[]) {
  return [...items].sort((left, right) => {
    const leftTime = new Date(left.updatedAt || left.createdAt || 0).getTime();
    const rightTime = new Date(right.updatedAt || right.createdAt || 0).getTime();
    return rightTime - leftTime;
  });
}

function getAlertStyles(level: OperationalAlert["level"]) {
  if (level === "critical") {
    return {
      wrapper: "border-rose-200 bg-rose-50",
      badge: "bg-rose-100 text-rose-700 border border-rose-200",
    };
  }
  if (level === "warning") {
    return {
      wrapper: "border-amber-200 bg-amber-50",
      badge: "bg-amber-100 text-amber-700 border border-amber-200",
    };
  }
  return {
    wrapper: "border-blue-200 bg-blue-50",
    badge: "bg-blue-100 text-blue-700 border border-blue-200",
  };
}

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

  const isProvider = user?.role === "provider";

  useEffect(() => {
    if (!isProvider || !user?.id) return;
    trackEvent(PROVIDER_ANALYTICS_EVENTS.DASHBOARD_VIEWED, {
      has_company: Boolean((user as any)?.companyId),
      approved: Boolean(user?.isApproved),
    });
  }, [isProvider, user?.id, user?.isApproved]);

  const {
    data: availableRequestsData,
    isLoading: isLoadingAvailableRequests,
    error: availableRequestsError,
  } = useQuery<ServiceRequest[]>({
    queryKey: ["/api/service-requests", { status: "available" }],
    enabled: isProvider,
    staleTime: 15_000,
    refetchInterval: 30_000,
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/service-requests?status=available");
      return res.json() as Promise<ServiceRequest[]>;
    },
  });

  const {
    data: myRequestsData,
    isLoading: isLoadingMyRequests,
    error: myRequestsError,
  } = useQuery<ServiceRequest[]>({
    queryKey: ["/api/service-requests"],
    enabled: isProvider,
    staleTime: 10_000,
    refetchInterval: 20_000,
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/service-requests");
      return res.json() as Promise<ServiceRequest[]>;
    },
  });

  const {
    data: myStoresData,
    isLoading: isLoadingStores,
    error: storesError,
  } = useQuery<ProviderStore[]>({
    queryKey: ["/api/provider/stores"],
    enabled: isProvider,
    staleTime: 30_000,
    refetchInterval: 60_000,
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/provider/stores");
      return res.json() as Promise<ProviderStore[]>;
    },
  });

  const availableRequests = availableRequestsData ?? [];
  const myRequests = myRequestsData ?? [];
  const myStores = myStoresData ?? [];

  const acceptJobMutation = useMutation<Response, Error, string>({
    mutationFn: async (requestId) => apiRequest("POST", `/api/service-requests/${requestId}/accept`),
    onSuccess: async (_, requestId) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/service-requests"] }),
        queryClient.invalidateQueries({ queryKey: ["provider-jobs", user?.id] }),
        queryClient.invalidateQueries({ queryKey: ["provider-chat-requests"] }),
      ]);
      trackEvent(PROVIDER_ANALYTICS_EVENTS.JOB_ACCEPTED, {
        request_id: requestId,
      });
      toast({
        title: "Job accepted",
        description: "The request has been added to your active jobs.",
      });
    },
    onError: (error) => {
      toast({
        title: "Unable to accept job",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateJobStatusMutation = useMutation<Response, Error, { requestId: string; status: string }>({
    mutationFn: async ({ requestId, status }) =>
      apiRequest("PATCH", `/api/service-requests/${requestId}`, { status }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/service-requests"] }),
        queryClient.invalidateQueries({ queryKey: ["provider-jobs", user?.id] }),
        queryClient.invalidateQueries({ queryKey: ["provider-chat-requests"] }),
      ]);
      toast({
        title: "Status updated",
        description: "The job stage has been updated.",
      });
    },
    onError: (error) => {
      toast({
        title: "Status update failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const markWorkCompletedMutation = useMutation<Response, Error, { requestId: string }>({
    mutationFn: async ({ requestId }) =>
      apiRequest("POST", `/api/service-requests/${requestId}/work-completed`),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/service-requests"] }),
        queryClient.invalidateQueries({ queryKey: ["provider-jobs", user?.id] }),
        queryClient.invalidateQueries({ queryKey: ["provider-chat-requests"] }),
      ]);
      toast({
        title: "Work marked completed",
        description: "Resident confirmation is now pending.",
      });
    },
    onError: (error) => {
      toast({
        title: "Could not mark work completed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const createStoreMutation = useMutation<Response, Error, StoreFormData>({
    mutationFn: async (storeData) => apiRequest("POST", "/api/provider/stores", storeData),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/provider/stores"] }),
        queryClient.invalidateQueries({ queryKey: ["provider-stores", user?.id] }),
      ]);
      trackEvent(PROVIDER_ANALYTICS_EVENTS.STORE_CREATED, {
        has_phone: Boolean(storeFormData.phone),
        has_email: Boolean(storeFormData.email),
      });
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
        title: "Store submitted",
        description: "Store creation request sent for admin review.",
      });
    },
    onError: (error) => {
      toast({
        title: "Store creation failed",
        description: error.message || "Unable to create store.",
        variant: "destructive",
      });
    },
  });

  const sendMessageMutation = useMutation<RequestMessage, Error, { requestId: string; message: string }>({
    mutationFn: async ({ requestId, message }) => {
      const res = await apiRequest("POST", `/api/service-requests/${requestId}/messages`, { message });
      return res.json() as Promise<RequestMessage>;
    },
    onSuccess: (createdMessage) => {
      setMessageDraft("");
      queryClient.setQueryData<RequestMessage[]>(
        ["provider-dashboard-request-messages", createdMessage.requestId],
        (prev = []) => {
          if (prev.some((item) => item.id === createdMessage.id)) return prev;
          return [...prev, createdMessage];
        },
      );
      queryClient.invalidateQueries({ queryKey: ["provider-request-messages", createdMessage.requestId] });
      queryClient.invalidateQueries({ queryKey: ["provider-chat-messages", createdMessage.requestId] });
    },
    onError: (error) => {
      toast({
        title: "Message failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const activeJobs = useMemo(
    () => myRequests.filter((request) => ACTIVE_JOB_STATUSES.has(normalizeServiceRequestStatus(request.status))),
    [myRequests],
  );

  const completedJobs = useMemo(
    () => myRequests.filter((request) => normalizeServiceRequestStatus(request.status) === "completed"),
    [myRequests],
  );

  const availableQueue = useMemo(() => sortByMostRecent(availableRequests), [availableRequests]);
  const activeQueue = useMemo(() => sortByMostRecent(activeJobs), [activeJobs]);
  const recentCompleted = useMemo(() => sortByMostRecent(completedJobs).slice(0, 5), [completedJobs]);

  const activeChatRequest = useMemo(
    () => activeJobs.find((request) => request.id === activeChatRequestId) ?? null,
    [activeJobs, activeChatRequestId],
  );

  const {
    data: requestMessagesData,
    isLoading: isLoadingMessages,
    error: requestMessagesError,
  } = useQuery<RequestMessage[]>({
    queryKey: ["provider-dashboard-request-messages", activeChatRequestId],
    enabled: Boolean(activeChatRequestId) && isProvider,
    staleTime: 2_000,
    refetchInterval: 8_000,
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/service-requests/${activeChatRequestId}/messages`);
      return res.json() as Promise<RequestMessage[]>;
    },
  });

  const requestMessages = requestMessagesData ?? [];
  const orderedMessages = useMemo(
    () =>
      [...requestMessages].sort((left, right) => {
        const leftTime = left.createdAt ? new Date(left.createdAt).getTime() : 0;
        const rightTime = right.createdAt ? new Date(right.createdAt).getTime() : 0;
        return leftTime - rightTime;
      }),
    [requestMessages],
  );

  const monthlyEarnings = useMemo(
    () => completedJobs.reduce((sum, job) => sum + parseBudgetValue(job.budget), 0),
    [completedJobs],
  );

  const stats = {
    available: availableRequests.length,
    active: activeJobs.length,
    completed: completedJobs.length,
    monthlyEarnings,
  };

  const storeEntries = useMemo(
    () =>
      myStores.map((store) => ({
        store,
        access: getProviderStoreAccessState(store),
      })),
    [myStores],
  );

  const storeStats = useMemo(() => {
    const approved = storeEntries.filter((entry) => entry.access.isApproved).length;
    const blocked = storeEntries.filter((entry) => Boolean(entry.access.operationsBlockedReason)).length;
    const allocated = storeEntries.filter((entry) => entry.access.hasEstateAllocation).length;
    return {
      total: storeEntries.length,
      approved,
      blocked,
      allocated,
    };
  }, [storeEntries]);

  const operationalAlerts = useMemo<OperationalAlert[]>(() => {
    const alerts: OperationalAlert[] = [];

    if (!user?.isApproved) {
      alerts.push({
        id: "account-approval",
        level: "warning",
        title: "Provider account awaiting approval",
        description: "Core operations remain limited until your provider account is approved.",
      });
    }

    if (stats.available > 0) {
      alerts.push({
        id: "available-jobs",
        level: "info",
        title: `${stats.available} available ${stats.available === 1 ? "job" : "jobs"}`,
        description: "Review open requests quickly to improve conversion.",
        actionLabel: "Review queue",
        action: () => {
          const section = document.getElementById("available-jobs-panel");
          section?.scrollIntoView({ behavior: "smooth", block: "start" });
        },
      });
    }

    if (storeStats.total === 0) {
      alerts.push({
        id: "no-stores",
        level: "warning",
        title: "No marketplace store configured",
        description: "Create a store to sell inventory and receive store orders.",
        actionLabel: "Create store",
        action: () => setIsCreateStoreDialogOpen(true),
      });
    }

    storeEntries.forEach(({ store, access }) => {
      if (access.operationsBlockedReason) {
        alerts.push({
          id: `store-blocked-${store.id}`,
          level: "critical",
          title: `${store.name}: operations blocked`,
          description: access.operationsBlockedReason,
          actionLabel: "Open stores",
          action: () => setLocation("/provider/stores"),
        });
        return;
      }

      if (!access.hasEstateAllocation) {
        alerts.push({
          id: `store-allocation-${store.id}`,
          level: "warning",
          title: `${store.name}: awaiting estate allocation`,
          description: "Admin allocation is required before adding inventory.",
        });
      }
    });

    if (stats.active === 0 && stats.available === 0) {
      alerts.push({
        id: "idle-workload",
        level: "info",
        title: "No active workload",
        description: "You are clear right now. Monitor the queue for incoming requests.",
      });
    }

    return alerts.slice(0, 8);
  }, [stats.available, stats.active, storeEntries, storeStats.total, setLocation, user?.isApproved]);

  const averageTicket = stats.completed > 0 ? stats.monthlyEarnings / stats.completed : 0;

  if (!user) {
    return (
      <ProviderShell title="Loading provider workspace">
        <PageSkeleton rows={2} />
      </ProviderShell>
    );
  }

  if (!isProvider) {
    return (
      <ProviderShell title="Access denied">
        <EmptyState
          title="Provider access required"
          description="This workspace is only available to provider accounts."
          action={
            <Button variant="outline" onClick={() => setLocation("/")}>Return to dashboard</Button>
          }
        />
      </ProviderShell>
    );
  }

  return (
    <ProviderShell
      title="Provider Dashboard"
      subtitle="Action-first overview for jobs, earnings, and store operations."
      actions={
        <>
          <Button variant="outline" className="rounded-full" onClick={() => setLocation("/provider/jobs")}>Jobs workspace</Button>
          <Button className="rounded-full" onClick={() => setLocation("/provider/chat")}>
            Open chat
          </Button>
        </>
      }
    >
      <div className="space-y-6">
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <ProviderMetricCard
            title="Available jobs"
            value={stats.available}
            hint="Open queue"
            icon={Briefcase}
            tone="success"
            dataTestId="text-available-jobs"
          />
          <ProviderMetricCard
            title="Active jobs"
            value={stats.active}
            hint="Needs execution"
            icon={Clock3}
            tone="info"
            dataTestId="text-active-jobs"
          />
          <ProviderMetricCard
            title="Completed"
            value={stats.completed}
            hint="Delivered jobs"
            icon={CheckCircle2}
            tone="accent"
            dataTestId="text-completed-jobs"
          />
          <ProviderMetricCard
            title="Revenue"
            value={formatMoney(stats.monthlyEarnings)}
            hint="Based on completed jobs"
            icon={DollarSign}
            tone="warning"
            dataTestId="text-monthly-earnings"
          />
          <ProviderMetricCard
            title="Store status"
            value={`${storeStats.approved}/${storeStats.total}`}
            hint="Approved stores"
            icon={Store}
            tone="default"
          />
        </section>

        <ProviderFilterActionBar
          leading={<p className="text-sm text-muted-foreground">Operational shortcuts</p>}
          trailing={
            <>
              <Button variant="outline" size="sm" onClick={() => document.getElementById("available-jobs-panel")?.scrollIntoView({ behavior: "smooth", block: "start" })}>
                Review available queue
              </Button>
              <Button variant="outline" size="sm" onClick={() => document.getElementById("active-jobs-panel")?.scrollIntoView({ behavior: "smooth", block: "start" })}>
                Check active jobs
              </Button>
              <Button variant="outline" size="sm" onClick={() => setLocation("/provider/chat")}>Open resident chat</Button>
              <Button variant="outline" size="sm" onClick={() => setLocation("/provider/stores")}>Store operations</Button>
              <Button variant="outline" size="sm" onClick={() => setLocation("/provider/marketplace")}>Marketplace</Button>
            </>
          }
        />

        <div className="grid gap-6 xl:grid-cols-[1.7fr_1fr]">
          <div className="space-y-6">
            <Card id="available-jobs-panel" className="border-border">
              <CardHeader className="flex flex-row items-start justify-between gap-4 pb-3">
                <div>
                  <CardTitle className="text-lg">Available jobs</CardTitle>
                  <p className="text-sm text-muted-foreground">Newest resident requests you can pick up now.</p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setLocation("/provider/jobs")}>View all <ArrowRight className="ml-1 h-4 w-4" /></Button>
              </CardHeader>
              <CardContent className="space-y-3">
                {availableRequestsError ? (
                  <InlineErrorState
                    description={
                      availableRequestsError instanceof Error
                        ? availableRequestsError.message
                        : "Unable to load available jobs."
                    }
                  />
                ) : isLoadingAvailableRequests ? (
                  <PageSkeleton withHeader={false} rows={2} />
                ) : availableQueue.length === 0 ? (
                  <EmptyState
                    icon={Briefcase}
                    title="No available jobs"
                    description="New requests will appear here automatically."
                  />
                ) : (
                  availableQueue.slice(0, 6).map((request) => (
                    <div
                      key={request.id}
                      className="rounded-xl border border-border bg-card p-4"
                      data-testid={`job-${request.id}`}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-foreground">
                            {request.description || resolveRequestCategoryLabel(request)}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">Posted {formatDateLabel(request.createdAt)}</p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <ProviderStatusBadge status={request.urgency || ""} variant="urgency" />
                          <Badge variant="outline">{formatMoney(parseBudgetValue(request.budget))}</Badge>
                        </div>
                      </div>

                      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="h-3.5 w-3.5" />
                          {request.location || "Location pending"}
                        </span>
                          <span className="inline-flex items-center gap-1">
                            <Wrench className="h-3.5 w-3.5" />
                            {resolveRequestCategoryLabel(request)}
                          </span>
                      </div>

                      {request.specialInstructions ? (
                        <p className="mt-3 rounded-lg bg-muted/40 p-2 text-xs text-muted-foreground">{request.specialInstructions}</p>
                      ) : null}

                      <div className="mt-4 flex justify-end">
                        <Button
                          size="sm"
                          onClick={() => acceptJobMutation.mutate(request.id)}
                          disabled={acceptJobMutation.isPending}
                          data-testid={`button-accept-${request.id}`}
                        >
                          {acceptJobMutation.isPending ? "Accepting..." : "Accept job"}
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <Card id="active-jobs-panel" className="border-border">
              <CardHeader className="flex flex-row items-start justify-between gap-4 pb-3">
                <div>
                  <CardTitle className="text-lg">Active jobs</CardTitle>
                  <p className="text-sm text-muted-foreground">Requests currently assigned to you for inspection or delivery.</p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setLocation("/provider/jobs")}>View all <ArrowRight className="ml-1 h-4 w-4" /></Button>
              </CardHeader>
              <CardContent className="space-y-3">
                {myRequestsError ? (
                  <InlineErrorState
                    description={
                      myRequestsError instanceof Error
                        ? myRequestsError.message
                        : "Unable to load active jobs."
                    }
                  />
                ) : isLoadingMyRequests ? (
                  <PageSkeleton withHeader={false} rows={2} />
                ) : activeQueue.length === 0 ? (
                  <EmptyState
                    icon={Clock3}
                    title="No active jobs"
                    description="Accepted requests will appear here."
                  />
                ) : (
                  activeQueue.slice(0, 6).map((job) => {
                    const normalizedStatus = normalizeServiceRequestStatus(job.status);
                    return (
                      <div key={job.id} className="rounded-xl border border-border bg-card p-4" data-testid={`active-job-${job.id}`}>
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <p className="text-sm font-semibold text-foreground">
                              {job.description || resolveRequestCategoryLabel(job)}
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground">Updated {formatDateLabel(job.updatedAt || job.createdAt)}</p>
                          </div>
                          <ProviderStatusBadge status={job.status} category={resolveRequestCategoryKey(job)} />
                        </div>

                        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="h-3.5 w-3.5" />
                            {job.location || "Location pending"}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <DollarSign className="h-3.5 w-3.5" />
                            {formatMoney(parseBudgetValue(job.budget))}
                          </span>
                          <ProviderStatusBadge status={job.urgency || ""} variant="urgency" />
                        </div>

                        <div className="mt-4 flex flex-wrap justify-end gap-2">
                          <Button variant="outline" size="sm" onClick={() => setActiveChatRequestId(job.id)}>
                            Quick reply
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setLocation(`/provider/chat?requestId=${encodeURIComponent(job.id)}`)}
                          >
                            Open chat
                          </Button>
                          {normalizedStatus === "assigned_for_job" ? (
                            <Button
                              size="sm"
                              onClick={() => updateJobStatusMutation.mutate({ requestId: job.id, status: "in_progress" })}
                              disabled={updateJobStatusMutation.isPending}
                              data-testid={`button-start-${job.id}`}
                            >
                              Start job
                            </Button>
                          ) : null}
                          {normalizedStatus === "rework_required" ? (
                            <Button
                              size="sm"
                              onClick={() => updateJobStatusMutation.mutate({ requestId: job.id, status: "in_progress" })}
                              disabled={updateJobStatusMutation.isPending}
                              data-testid={`button-rework-${job.id}`}
                            >
                              Resume rework
                            </Button>
                          ) : null}
                          {normalizedStatus === "in_progress" ? (
                            <Button
                              size="sm"
                              onClick={() => markWorkCompletedMutation.mutate({ requestId: job.id })}
                              disabled={markWorkCompletedMutation.isPending}
                              data-testid={`button-mark-work-done-${job.id}`}
                            >
                              {markWorkCompletedMutation.isPending ? "Submitting..." : "Mark work done"}
                            </Button>
                          ) : null}
                          {normalizedStatus === "work_completed_pending_resident" ? (
                            <Button size="sm" variant="outline" disabled>
                              Awaiting resident confirmation
                            </Button>
                          ) : null}
                          {normalizedStatus === "disputed" ? (
                            <Button size="sm" variant="outline" disabled>
                              Awaiting admin review
                            </Button>
                          ) : null}
                        </div>
                      </div>
                    );
                  })
                )}
              </CardContent>
            </Card>

            {activeChatRequest ? (
              <Card className="border-border">
                <CardHeader className="flex flex-row items-start justify-between gap-3 pb-3">
                  <div>
                    <CardTitle className="text-base">Quick resident reply</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      {activeChatRequest.description || resolveRequestCategoryLabel(activeChatRequest)}
                    </p>
                  </div>
                  <ProviderStatusBadge
                    status={activeChatRequest.status}
                    category={resolveRequestCategoryKey(activeChatRequest)}
                  />
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="max-h-[260px] space-y-2 overflow-y-auto rounded-xl border border-border bg-muted/40 p-3">
                    {requestMessagesError ? (
                      <InlineErrorState
                        description={
                          requestMessagesError instanceof Error
                            ? requestMessagesError.message
                            : "Unable to load messages."
                        }
                      />
                    ) : isLoadingMessages ? (
                      <PageSkeleton withHeader={false} rows={1} />
                    ) : orderedMessages.length === 0 ? (
                      <EmptyState
                        icon={MessageSquare}
                        title="No messages yet"
                        description="Start the thread with the resident."
                      />
                    ) : (
                      orderedMessages.map((message) => (
                        <div key={message.id} className={message.senderRole === "provider" ? "flex justify-end" : "flex justify-start"}>
                          <div
                            className={
                              message.senderRole === "provider"
                                ? "max-w-[80%] rounded-xl bg-primary px-3 py-2 text-sm text-white"
                                : "max-w-[80%] rounded-xl border border-border bg-card px-3 py-2 text-sm text-foreground"
                            }
                          >
                            <p className="mb-1 text-[11px] uppercase tracking-wide opacity-75">{message.senderRole}</p>
                            <p>{message.message}</p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                  <div className="space-y-2">
                    <Textarea
                      value={messageDraft}
                      onChange={(event) => setMessageDraft(event.target.value)}
                      placeholder="Type a message to the resident..."
                      className="min-h-[90px]"
                    />
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        onClick={() => setLocation(`/provider/chat?requestId=${encodeURIComponent(activeChatRequest.id)}`)}
                      >
                        Open full chat
                      </Button>
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

          <div className="space-y-6">
            <Card className="border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Operational alerts</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {operationalAlerts.length === 0 ? (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
                    No blockers detected. Your dashboard is operational.
                  </div>
                ) : (
                  operationalAlerts.map((alert) => {
                    const styles = getAlertStyles(alert.level);
                    return (
                      <div key={alert.id} className={`rounded-xl border p-3 ${styles.wrapper}`}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="mb-1 flex items-center gap-2">
                              <Badge className={styles.badge}>{alert.level}</Badge>
                              <p className="text-sm font-semibold text-foreground">{alert.title}</p>
                            </div>
                            <p className="text-xs text-foreground">{alert.description}</p>
                          </div>
                          {alert.actionLabel && alert.action ? (
                            <Button variant="ghost" size="sm" className="h-7 px-2" onClick={alert.action}>
                              {alert.actionLabel}
                            </Button>
                          ) : null}
                        </div>
                      </div>
                    );
                  })
                )}
              </CardContent>
            </Card>

            <Card className="border-border">
              <CardHeader className="flex flex-row items-start justify-between gap-3 pb-3">
                <div>
                  <CardTitle className="text-base">Store operations</CardTitle>
                  <p className="text-sm text-muted-foreground">Approval, estate allocation, and permissions at a glance.</p>
                </div>
                <Button data-testid="button-create-store" onClick={() => setIsCreateStoreDialogOpen(true)}>
                  <Plus className="mr-1 h-4 w-4" />
                  Create store
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                {storesError ? (
                  <InlineErrorState
                    description={storesError instanceof Error ? storesError.message : "Unable to load stores."}
                  />
                ) : isLoadingStores ? (
                  <PageSkeleton withHeader={false} rows={2} />
                ) : storeEntries.length === 0 ? (
                  <EmptyState
                    icon={Store}
                    title="No stores configured"
                    description="Create your first store to unlock inventory and store orders."
                    action={
                      <Button onClick={() => setIsCreateStoreDialogOpen(true)} data-testid="button-create-first-store">
                        <Plus className="mr-1 h-4 w-4" />
                        Create your first store
                      </Button>
                    }
                  />
                ) : (
                  <>
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div className="rounded-lg border border-border bg-muted/40 px-2 py-1.5 text-center text-muted-foreground">
                        <p className="text-[11px] uppercase">Total</p>
                        <p className="text-sm font-semibold text-foreground">{storeStats.total}</p>
                      </div>
                      <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1.5 text-center text-emerald-700">
                        <p className="text-[11px] uppercase">Approved</p>
                        <p className="text-sm font-semibold">{storeStats.approved}</p>
                      </div>
                      <div className="rounded-lg border border-amber-200 bg-amber-50 px-2 py-1.5 text-center text-amber-700">
                        <p className="text-[11px] uppercase">Blocked</p>
                        <p className="text-sm font-semibold">{storeStats.blocked}</p>
                      </div>
                    </div>

                    <div className="space-y-3">
                      {storeEntries.slice(0, 4).map(({ store, access }) => {
                        const itemsActionReason = access.inventoryPageBlockedReason;
                        const ordersActionReason = access.orderUpdateBlockedReason;
                        const operationsActionReason = access.operationsBlockedReason;

                        return (
                          <div key={store.id} className="rounded-xl border border-border p-3" data-testid={`store-${store.id}`}>
                            <div className="mb-2 flex items-start justify-between gap-2">
                              <div>
                                <p className="text-sm font-semibold text-foreground">{store.name}</p>
                                <p className="text-xs text-muted-foreground">{store.location}</p>
                              </div>
                              <Badge variant={access.isApproved ? "default" : "secondary"}>
                                {getStoreApprovalBadgeLabel(store.approvalStatus)}
                              </Badge>
                            </div>

                            {operationsActionReason ? (
                              <div className="mb-2 rounded-lg border border-amber-200 bg-amber-50 px-2 py-1 text-xs text-amber-700">
                                {operationsActionReason}
                              </div>
                            ) : null}
                            {!operationsActionReason && !access.hasEstateAllocation ? (
                              <div className="mb-2 rounded-lg border border-blue-200 bg-blue-50 px-2 py-1 text-xs text-blue-700">
                                No estate allocation yet. Inventory add is blocked until allocation is complete.
                              </div>
                            ) : null}

                            <div className="flex flex-wrap gap-2">
                              <DisabledActionHint reason={itemsActionReason} actionName="dashboard_manage_items" metadata={{ store_id: store.id, section: "dashboard" }}>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  disabled={Boolean(itemsActionReason)}
                                  onClick={() => setLocation(`/provider/stores/${store.id}/items`)}
                                  data-testid={`button-manage-items-${store.id}`}
                                >
                                  <Package className="mr-1 h-4 w-4" />
                                  {access.canManageItems ? "Manage items" : "View inventory"}
                                </Button>
                              </DisabledActionHint>
                              <DisabledActionHint reason={ordersActionReason} actionName="dashboard_manage_orders" metadata={{ store_id: store.id, section: "dashboard" }}>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  disabled={Boolean(ordersActionReason)}
                                  onClick={() => setLocation(`/provider/stores/${store.id}/orders`)}
                                  data-testid={`button-view-orders-${store.id}`}
                                >
                                  {access.canManageOrders ? "Manage orders" : "View orders"}
                                </Button>
                              </DisabledActionHint>
                              <DisabledActionHint reason={operationsActionReason} actionName="dashboard_store_operations" metadata={{ store_id: store.id, section: "dashboard" }}>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  disabled={Boolean(operationsActionReason)}
                                  onClick={() => setLocation(`/provider/stores/${store.id}/dashboard`)}
                                  data-testid={`button-store-operations-${store.id}`}
                                >
                                  Store operations
                                </Button>
                              </DisabledActionHint>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                      Inventory and order counts are not yet exposed by provider store endpoints.
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            <Card className="border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Revenue and delivery trend</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="rounded-xl border border-border bg-muted/40 p-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Estimated revenue</p>
                  <p className="mt-1 text-xl font-semibold text-foreground">{formatMoney(stats.monthlyEarnings)}</p>
                  <p className="text-xs text-muted-foreground">Calculated from completed job budgets.</p>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-lg border border-border p-2">
                    <p className="text-muted-foreground">Completed jobs</p>
                    <p className="mt-1 text-sm font-semibold text-foreground">{stats.completed}</p>
                  </div>
                  <div className="rounded-lg border border-border p-2">
                    <p className="text-muted-foreground">Avg ticket</p>
                    <p className="mt-1 text-sm font-semibold text-foreground">{formatMoney(averageTicket)}</p>
                  </div>
                </div>

                {recentCompleted.length > 0 ? (
                  <div className="space-y-2">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Recent completions</p>
                    {recentCompleted.map((job) => (
                      <div key={job.id} className="rounded-lg border border-border p-2">
                        <p className="text-sm font-medium text-foreground">
                          {job.description || resolveRequestCategoryLabel(job)}
                        </p>
                        <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
                          <span>{formatDateLabel(job.updatedAt || job.createdAt)}</span>
                          <span>{formatMoney(parseBudgetValue(job.budget))}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Complete jobs to start seeing trend insights.</p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <Dialog open={isCreateStoreDialogOpen} onOpenChange={setIsCreateStoreDialogOpen}>
        <DialogContent className="w-[60vw] max-w-[95vw]" aria-describedby="create-store-description">
          <DialogHeader>
            <DialogTitle>Create new store</DialogTitle>
            <DialogDescription id="create-store-description">
              Submit your store details for admin review before estate allocation and operations.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="name">Store name *</Label>
              <Input
                id="name"
                value={storeFormData.name}
                onChange={(event) => setStoreFormData((prev) => ({ ...prev, name: event.target.value }))}
                placeholder="e.g., Fresh Groceries Store"
                data-testid="input-store-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={storeFormData.description}
                onChange={(event) =>
                  setStoreFormData((prev) => ({ ...prev, description: event.target.value }))
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
                onChange={(event) => setStoreFormData((prev) => ({ ...prev, location: event.target.value }))}
                placeholder="e.g., Block A, Ground Floor"
                data-testid="input-store-location"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                value={storeFormData.phone}
                onChange={(event) => setStoreFormData((prev) => ({ ...prev, phone: event.target.value }))}
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
                onChange={(event) => setStoreFormData((prev) => ({ ...prev, email: event.target.value }))}
                placeholder="store@example.com"
                data-testid="input-store-email"
              />
            </div>
            <div className="rounded-md border border-blue-200 bg-blue-50 p-3">
              <p className="text-sm text-blue-800">
                <strong>Note:</strong> Store requests go through admin review before estate allocation and operations become available.
              </p>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setIsCreateStoreDialogOpen(false)} data-testid="button-cancel-store">
              Cancel
            </Button>
            <Button
              onClick={() => createStoreMutation.mutate(storeFormData)}
              disabled={!storeFormData.name || !storeFormData.location || createStoreMutation.isPending}
              data-testid="button-submit-store"
            >
              {createStoreMutation.isPending ? "Submitting..." : "Submit for approval"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </ProviderShell>
  );
}
