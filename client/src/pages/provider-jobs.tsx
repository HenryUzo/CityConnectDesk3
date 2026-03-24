import { useAuth } from "@/hooks/use-auth";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import {
  CheckCircle,
  Clock,
  AlertCircle,
  Briefcase,
  MapPin,
  User,
  DollarSign,
  MessageSquare,
} from "lucide-react";
import { ProviderShell } from "@/components/provider/ProviderShell";
import { EmptyState, InlineErrorState, PageSkeleton } from "@/components/shared/page-states";
import { ProviderFilterActionBar, ProviderMetricCard, ProviderStatusBadge } from "@/components/provider/provider-primitives";
import formatDate from "@/utils/formatDate";
import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { normalizeServiceRequestStatus } from "@/lib/serviceRequestStatus";

interface ServiceRequest {
  id: string;
  title?: string;
  description?: string;
  category?: string;
  categoryLabel?: string;
  issueType?: string;
  budget?: number;
  location?: string;
  urgency?: string;
  status: string;
  createdAt?: string;
  updatedAt?: string;
  buyer?: {
    id?: string;
    name?: string;
    email?: string;
  };
  assignedProviderId?: string;
  completedAt?: string;
}

interface RequestMessage {
  id: string;
  requestId: string;
  senderId: string;
  senderRole: "admin" | "resident" | "provider";
  message: string;
  createdAt?: string;
}

function normalizeCategoryKey(value?: string | null) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function resolveRequestCategoryLabel(request?: ServiceRequest | null) {
  const raw = String(request?.categoryLabel || request?.issueType || request?.category || "").trim();
  if (!raw) return "General";
  return raw
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function resolveRequestCategoryKey(request?: ServiceRequest | null) {
  if (!request) return "";
  const categoryKey = normalizeCategoryKey(request.category);
  const inferredKey = normalizeCategoryKey(request.categoryLabel || request.issueType || "");
  if (categoryKey && categoryKey !== "maintenance_repair") return categoryKey;
  return inferredKey || categoryKey;
}

export default function ProviderJobs() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [activeChatRequestId, setActiveChatRequestId] = useState<string | null>(null);
  const [messageDraft, setMessageDraft] = useState("");

  // Fetch assigned jobs/service requests for the provider
  const {
    data: jobs = [],
    isLoading,
    error: jobsError,
  } = useQuery<ServiceRequest[]>({
    queryKey: ["provider-jobs", user?.id],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/service-requests?assignedProviderId=${user?.id}`);
      return res.json() as Promise<ServiceRequest[]>;
    },
    enabled: !!user?.id,
    staleTime: 10_000,
    refetchInterval: 20_000,
  });

  const filteredJobs = useMemo(
    () => {
      if (statusFilter === "all") return jobs;
      if (statusFilter === "pending") {
        return jobs.filter((job: ServiceRequest) =>
          ["pending", "pending_inspection"].includes(normalizeServiceRequestStatus(job.status)),
        );
      }
      return jobs.filter(
        (job: ServiceRequest) => normalizeServiceRequestStatus(job.status) === statusFilter,
      );
    },
    [jobs, statusFilter]
  );

  const stats = useMemo(
    () => ({
      total: jobs.length,
      pending: jobs.filter((j: ServiceRequest) =>
        ["pending", "pending_inspection", "assigned"].includes(normalizeServiceRequestStatus(j.status)),
      ).length,
      inProgress: jobs.filter(
        (j: ServiceRequest) =>
          ["assigned_for_job", "in_progress"].includes(normalizeServiceRequestStatus(j.status))
      ).length,
      completed: jobs.filter(
        (j: ServiceRequest) => j.status === "completed"
      ).length,
    }),
    [jobs]
  );

  const activeChatRequest = useMemo(
    () => jobs.find((job) => job.id === activeChatRequestId) ?? null,
    [jobs, activeChatRequestId],
  );

  const {
    data: requestMessages = [],
    isLoading: isLoadingMessages,
    error: messagesError,
  } = useQuery<RequestMessage[]>({
    queryKey: ["provider-request-messages", activeChatRequestId],
    enabled: Boolean(activeChatRequestId),
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/service-requests/${activeChatRequestId}/messages`);
      return res.json() as Promise<RequestMessage[]>;
    },
    staleTime: 2_000,
    refetchInterval: 8_000,
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

  const sendMessageMutation = useMutation({
    mutationFn: async (payload: { requestId: string; message: string }) => {
      const res = await apiRequest("POST", `/api/service-requests/${payload.requestId}/messages`, {
        message: payload.message,
      });
      return res.json() as Promise<RequestMessage>;
    },
    onSuccess: (createdMessage: RequestMessage) => {
      setMessageDraft("");
      queryClient.setQueryData<RequestMessage[]>(
        ["provider-request-messages", createdMessage.requestId],
        (prev = []) => {
          if (prev.some((item) => item.id === createdMessage.id)) return prev;
          return [...prev, createdMessage];
        },
      );
      queryClient.invalidateQueries({ queryKey: ["provider-chat-messages", createdMessage.requestId] });
      queryClient.invalidateQueries({ queryKey: ["provider-dashboard-request-messages", createdMessage.requestId] });
    },
  });

  return (
    <ProviderShell title="My Jobs" subtitle="Track assigned work, progress, and resident updates.">
      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <ProviderMetricCard title="Total jobs" value={stats.total} hint="All assigned" icon={Briefcase} tone="default" />
          <ProviderMetricCard title="Pending" value={stats.pending} hint="Awaiting action" icon={Clock} tone="warning" />
          <ProviderMetricCard title="In progress" value={stats.inProgress} hint="Active delivery" icon={AlertCircle} tone="info" />
          <ProviderMetricCard title="Completed" value={stats.completed} hint="Finished jobs" icon={CheckCircle} tone="success" />
        </div>

        {/* Jobs Table */}
        <Card>
          <CardHeader>
            <CardTitle>Jobs List</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="all" onValueChange={setStatusFilter}>
              <ProviderFilterActionBar
                leading={<p className="text-sm text-muted-foreground">Filter jobs by stage</p>}
                trailing={
                  <TabsList aria-label="Filter jobs by status">
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="pending">Pending</TabsTrigger>
                <TabsTrigger value="assigned">Assigned for inspection</TabsTrigger>
                <TabsTrigger value="assigned_for_job">Assigned for job</TabsTrigger>
                <TabsTrigger value="in_progress">In Progress</TabsTrigger>
                <TabsTrigger value="completed">Completed</TabsTrigger>
                  </TabsList>
                }
              />

              <TabsContent value={statusFilter} className="mt-4">
                {jobsError ? (
                  <InlineErrorState
                    description={jobsError instanceof Error ? jobsError.message : "Unable to load jobs."}
                  />
                ) : isLoading ? (
                  <PageSkeleton withHeader={false} rows={3} />
                ) : filteredJobs.length === 0 ? (
                  <EmptyState
                    icon={MessageSquare}
                    title="No jobs found"
                    description="There are no jobs matching this filter right now."
                  />
                ) : (
                  <div className="overflow-hidden rounded-2xl border border-emerald-100 bg-white/95 shadow-sm">
                    <div className="overflow-x-auto" tabIndex={0} aria-label="Jobs table">
                    <Table>
                      <caption className="sr-only">Provider jobs list with category, customer, status, and actions</caption>
                      <TableHeader>
                        <TableRow className="border-b border-emerald-100/80 bg-emerald-50/50 hover:bg-emerald-50/50">
                          <TableHead scope="col" className="text-xs uppercase tracking-wide text-muted-foreground">Request</TableHead>
                          <TableHead scope="col" className="text-xs uppercase tracking-wide text-muted-foreground">Resident</TableHead>
                          <TableHead scope="col" className="text-xs uppercase tracking-wide text-muted-foreground">Stage</TableHead>
                          <TableHead scope="col" className="text-xs uppercase tracking-wide text-muted-foreground">Updated</TableHead>
                          <TableHead scope="col" className="text-right text-xs uppercase tracking-wide text-muted-foreground">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredJobs.map((job: ServiceRequest) => (
                          <TableRow key={job.id} className="border-b border-emerald-100/60 align-top hover:bg-emerald-50/30">
                            <TableCell className="py-4">
                              <div className="space-y-2">
                                <div className="flex flex-wrap items-center gap-2">
                                  <p className="text-sm font-semibold text-foreground">
                                    {job.title || job.description || "Untitled Job"}
                                  </p>
                                  <Badge variant="outline" className="border-emerald-200 bg-white text-emerald-700">
                                    {resolveRequestCategoryLabel(job)}
                                  </Badge>
                                </div>
                                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                                  <span className="inline-flex items-center gap-1">
                                    <MapPin className="h-3.5 w-3.5" />
                                    {job.location || "Location not set"}
                                  </span>
                                  <span className="inline-flex items-center gap-1">
                                    <DollarSign className="h-3.5 w-3.5" />
                                    {job.budget ? `NGN ${job.budget.toLocaleString()}` : "Budget TBD"}
                                  </span>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="py-4">
                              <span className="inline-flex items-center gap-2 rounded-full bg-muted px-3 py-1 text-sm text-foreground">
                                <User className="h-3.5 w-3.5 text-muted-foreground" />
                                {job.buyer?.name || "Unknown resident"}
                              </span>
                            </TableCell>
                            <TableCell className="py-4">
                              <div className="flex flex-col items-start gap-1.5">
                                <ProviderStatusBadge status={job.status} category={resolveRequestCategoryKey(job)} />
                                {job.urgency ? (
                                  <ProviderStatusBadge status={job.urgency} variant="urgency" />
                                ) : null}
                              </div>
                            </TableCell>
                            <TableCell className="py-4 text-sm text-muted-foreground whitespace-nowrap">
                              {job.updatedAt || job.createdAt
                                ? formatDate(job.updatedAt || job.createdAt || "")
                                : "N/A"}
                            </TableCell>
                            <TableCell className="py-4">
                              <div className="flex items-center justify-end gap-2">
                                <Button
                                  variant="default"
                                  size="sm"
                                  className="rounded-full bg-emerald-600 px-3 text-white hover:bg-emerald-700"
                                  onClick={() => setLocation(`/provider/chat?requestId=${encodeURIComponent(job.id)}`)}
                                >
                                  Open chat
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="rounded-full border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                                  onClick={() => setLocation(`/service-requests?id=${encodeURIComponent(job.id)}`)}
                                >
                                  Details
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    </div>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {activeChatRequest ? (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base">
                Resident Chat: {activeChatRequest.title || resolveRequestCategoryLabel(activeChatRequest) || "Service Request"}
              </CardTitle>
              <ProviderStatusBadge
                status={activeChatRequest.status}
                category={resolveRequestCategoryKey(activeChatRequest)}
              />
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border bg-muted/20 p-3 max-h-[360px] overflow-y-auto space-y-2">
                {messagesError ? (
                  <InlineErrorState
                    description={messagesError instanceof Error ? messagesError.message : "Unable to load messages."}
                  />
                ) : isLoadingMessages ? (
                  <PageSkeleton withHeader={false} rows={1} />
                ) : orderedMessages.length === 0 ? (
                  <EmptyState
                    icon={MessageSquare}
                    title="No messages yet"
                    description="Start the conversation with the resident from this panel."
                  />
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
    </ProviderShell>
  );
}
