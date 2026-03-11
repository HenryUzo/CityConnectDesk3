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
  MapPin,
  User,
  DollarSign,
  MessageSquare,
} from "lucide-react";
import { ProviderLayout } from "@/components/admin/ProviderLayout";
import formatDate from "@/utils/formatDate";
import { useState, useMemo } from "react";
import { Link, useLocation } from "wouter";
import { formatServiceRequestStatusLabel, normalizeServiceRequestStatus } from "@/lib/serviceRequestStatus";

interface ServiceRequest {
  id: string;
  title?: string;
  description?: string;
  category?: string;
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

export default function ProviderJobs() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [activeChatRequestId, setActiveChatRequestId] = useState<string | null>(null);
  const [messageDraft, setMessageDraft] = useState("");

  // Fetch assigned jobs/service requests for the provider
  const { data: jobs = [], isLoading } = useQuery<ServiceRequest[]>({
    queryKey: ["provider-jobs", user?.id],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/service-requests?assignedProviderId=${user?.id}`);
      return res.json() as Promise<ServiceRequest[]>;
    },
    enabled: !!user?.id,
  });

  const getStatusColor = (status: string) => {
    const key = normalizeServiceRequestStatus(status);
    const statusMap: { [key: string]: string } = {
      pending: "bg-yellow-100 text-yellow-800",
      pending_inspection: "bg-amber-100 text-amber-800",
      in_progress: "bg-blue-100 text-blue-800",
      completed: "bg-green-100 text-green-800",
      cancelled: "bg-red-100 text-red-800",
      assigned: "bg-purple-100 text-purple-800",
      assigned_for_job: "bg-indigo-100 text-indigo-800",
    };
    return statusMap[key] || "bg-gray-100 text-gray-800";
  };

  const getStatusIcon = (status: string) => {
    switch (normalizeServiceRequestStatus(status)) {
      case "pending":
      case "pending_inspection":
        return <Clock className="w-4 h-4" />;
      case "in_progress":
        return <AlertCircle className="w-4 h-4" />;
      case "completed":
        return <CheckCircle className="w-4 h-4" />;
      case "assigned":
      case "assigned_for_job":
        return <MessageSquare className="w-4 h-4" />;
      default:
        return <Clock className="w-4 h-4" />;
    }
  };

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

  const { data: requestMessages = [], isLoading: isLoadingMessages } = useQuery<RequestMessage[]>({
    queryKey: ["provider-request-messages", activeChatRequestId],
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

  const sendMessageMutation = useMutation({
    mutationFn: async (payload: { requestId: string; message: string }) => {
      const res = await apiRequest("POST", `/api/service-requests/${payload.requestId}/messages`, {
        message: payload.message,
      });
      return res.json() as Promise<RequestMessage>;
    },
    onSuccess: () => {
      setMessageDraft("");
      queryClient.invalidateQueries({ queryKey: ["provider-request-messages", activeChatRequestId] });
    },
  });

  return (
    <ProviderLayout title="My Jobs">
      <div className="space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Total Jobs</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats.total}</div>
              <p className="text-xs text-gray-500 mt-1">All time jobs</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Pending</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-yellow-600">
                {stats.pending}
              </div>
              <p className="text-xs text-gray-500 mt-1">Awaiting acceptance</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">
                In Progress
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-blue-600">
                {stats.inProgress}
              </div>
              <p className="text-xs text-gray-500 mt-1">Active jobs</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Completed</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-600">
                {stats.completed}
              </div>
              <p className="text-xs text-gray-500 mt-1">Finished jobs</p>
            </CardContent>
          </Card>
        </div>

        {/* Jobs Table */}
        <Card>
          <CardHeader>
            <CardTitle>Jobs List</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="all" onValueChange={setStatusFilter}>
              <TabsList>
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="pending">Pending</TabsTrigger>
                <TabsTrigger value="assigned">Assigned for inspection</TabsTrigger>
                <TabsTrigger value="assigned_for_job">Assigned for job</TabsTrigger>
                <TabsTrigger value="in_progress">In Progress</TabsTrigger>
                <TabsTrigger value="completed">Completed</TabsTrigger>
              </TabsList>

              <TabsContent value={statusFilter} className="mt-4">
                {isLoading ? (
                  <div className="flex justify-center py-8">
                    <p>Loading jobs...</p>
                  </div>
                ) : filteredJobs.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12">
                    <p className="text-gray-500 mb-4">No jobs found</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Title</TableHead>
                          <TableHead>Category</TableHead>
                          <TableHead>Client</TableHead>
                          <TableHead>Location</TableHead>
                          <TableHead>Budget</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead>Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredJobs.map((job: ServiceRequest) => (
                          <TableRow key={job.id}>
                            <TableCell className="font-medium max-w-xs">
                              {job.title || job.description || "Untitled Job"}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">
                                {job.category || "General"}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <User className="w-4 h-4 text-gray-400" />
                                <span className="text-sm">
                                  {job.buyer?.name || "Unknown"}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1 text-sm">
                                <MapPin className="w-4 h-4 text-gray-400" />
                                {job.location || "Not specified"}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1 font-medium">
                                <DollarSign className="w-4 h-4" />
                                {job.budget ? job.budget.toLocaleString() : "TBD"}
                              </div>
                            </TableCell>
                            <TableCell>
                                <Badge
                                  className={`${getStatusColor(job.status)} flex items-center gap-1 w-fit`}
                                >
                                  {getStatusIcon(job.status)}
                                {formatServiceRequestStatusLabel(job.status, job.category)}
                                </Badge>
                            </TableCell>
                            <TableCell className="text-sm text-gray-500">
                              {job.createdAt
                                ? formatDate(job.createdAt)
                                : "N/A"}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setLocation(`/provider/chat?requestId=${encodeURIComponent(job.id)}`)}
                                >
                                  Chat
                                </Button>
                                <Link href={`/service-requests?id=${job.id}`}>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-blue-600 hover:text-blue-800"
                                  >
                                    View Details
                                  </Button>
                                </Link>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
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
                Resident Chat: {activeChatRequest.title || activeChatRequest.category || "Service Request"}
              </CardTitle>
              <Badge variant="outline">{activeChatRequest.status}</Badge>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border bg-muted/20 p-3 max-h-[360px] overflow-y-auto space-y-2">
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
