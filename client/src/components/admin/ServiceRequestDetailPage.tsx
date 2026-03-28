import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Calendar,
  CheckCircle2,
  ClipboardList,
  Clock,
  Copy,
  Mail,
  MapPin,
  Phone,
  UserCheck,
  Users,
  Wrench,
} from "lucide-react";
import { adminApiRequest } from "@/lib/adminApi";
import { formatServiceRequestStatusLabel } from "@/lib/serviceRequestStatus";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

interface ServiceRequestDetailPageProps {
  requestId: string;
  onBack: () => void;
  onRequestPayment?: () => void;
  onAssignProvider?: () => void;
  onAssignForJob?: () => void;
  onChangeProvider?: () => void;
  onChangeInspector?: () => void;
}

type Party = {
  id?: string | null;
  name?: string | null;
  phone?: string | null;
  email?: string | null;
  location?: string | null;
  company?: string | null;
  rating?: string | number | null;
};

type RequestDetail = {
  id: string;
  category?: string;
  categoryLabel?: string;
  title?: string;
  status: string;
  updatedAt?: string | null;
  urgency?: string | null;
  createdAt?: string | null;
  assignedAt?: string | null;
  paymentRequestedAt?: string | null;
  approvedForJobAt?: string | null;
  closedAt?: string | null;
  billedAmount?: string | number | null;
  paymentStatus?: string | null;
  resident?: Party | null;
  provider?: Party | null;
  inspector?: Party | null;
  jobProvider?: Party | null;
  currentOwner?: {
    type?: string;
    label?: string;
    user?: Party | null;
  } | null;
  requestSummary?: {
    issueType?: string;
    areaAffected?: string;
    quantityLabel?: string;
    timeWindowLabel?: string;
    urgencyLabel?: string;
    notes?: string;
    photosCount?: number;
  } | null;
  locationSummary?: {
    addressLine?: string;
    estateName?: string;
    stateName?: string;
    lgaName?: string;
    display?: string;
  } | null;
  attachments?: {
    count?: number;
  } | null;
  providerReport?: {
    inspectionDate?: string;
    completionDeadline?: string;
    actualIssue?: string;
    causeOfIssue?: string;
    preventiveRecommendation?: string;
    materialCost?: number;
    serviceCost?: number;
    totalRecommendation?: number;
    evidence?: string[];
    submittedAt?: string;
  } | null;
  consultancyReport?: {
    inspectionDate?: string;
    completionDeadline?: string;
    actualIssue?: string;
    causeOfIssue?: string;
    preventiveRecommendation?: string;
    materialCost?: number;
    serviceCost?: number;
    totalRecommendation?: number;
    evidence?: string[];
    submittedAt?: string;
  } | null;
  paymentSummary?: {
    purpose?: string;
    consultancyFee?: number | null;
    materialCost?: number | null;
    serviceCost?: number | null;
    requestedTotal?: number | null;
    billedAmount?: number | null;
    status?: string;
    requestedAt?: string | null;
    approvedForJobAt?: string | null;
  } | null;
  timeline?: {
    createdAt?: string | null;
    assignedAt?: string | null;
    paymentRequestedAt?: string | null;
    consultancyReportSubmittedAt?: string | null;
    approvedForJobAt?: string | null;
    closedAt?: string | null;
  } | null;
  nextActions?: {
    canAssignProvider?: boolean;
    canChangeInspector?: boolean;
    canRequestPayment?: boolean;
    canAssignForJob?: boolean;
    canChangeProvider?: boolean;
  } | null;
  rawAnswers?: {
    description?: string;
  } | null;
  cancellationCase?: {
    id: string;
    status?: string | null;
    reasonCode?: string | null;
    reasonDetail?: string | null;
    preferredResolution?: string | null;
    adminDecision?: string | null;
    adminNote?: string | null;
    refundDecision?: string | null;
    refundAmount?: string | number | null;
    resolvedAt?: string | null;
    createdAt?: string | null;
    updatedAt?: string | null;
  } | null;
};

const STATUS_COLORS: Record<string, string> = {
  draft: "border-slate-200 bg-slate-50 text-slate-700",
  pending: "border-slate-200 bg-slate-50 text-slate-700",
  pending_inspection: "border-amber-200 bg-amber-50 text-amber-700",
  assigned: "border-indigo-200 bg-indigo-50 text-indigo-700",
  assigned_for_inspection: "border-indigo-200 bg-indigo-50 text-indigo-700",
  assigned_for_job: "border-blue-200 bg-blue-50 text-blue-700",
  assigned_for_maintenance: "border-emerald-200 bg-emerald-50 text-emerald-700",
  in_progress: "border-blue-200 bg-blue-50 text-blue-700",
  work_completed_pending_resident: "border-cyan-200 bg-cyan-50 text-cyan-700",
  disputed: "border-rose-200 bg-rose-50 text-rose-700",
  rework_required: "border-amber-200 bg-amber-50 text-amber-700",
  completed: "border-emerald-200 bg-emerald-50 text-emerald-700",
  cancelled: "border-rose-200 bg-rose-50 text-rose-700",
};

const URGENCY_COLORS: Record<string, string> = {
  low: "border-emerald-200 bg-emerald-50 text-emerald-700",
  medium: "border-slate-200 bg-slate-50 text-slate-700",
  high: "border-amber-200 bg-amber-50 text-amber-700",
  emergency: "border-rose-200 bg-rose-50 text-rose-700",
};

function formatDate(value?: string | null) {
  if (!value) return "Not set";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not set";
  return date.toLocaleString();
}

function formatNgnAmount(value?: number | string | null) {
  const amount = Number(value || 0);
  if (!Number.isFinite(amount) || amount <= 0) return "Not set";
  return `NGN ${amount.toLocaleString()}`;
}

function toDate(value?: string | Date | null) {
  if (!value) return null;
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatElapsedDuration(startedAt: Date | null, nowMs = Date.now()) {
  if (!startedAt) return "00:00:00";
  const diffMs = Math.max(nowMs - startedAt.getTime(), 0);
  const totalSeconds = Math.floor(diffMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function normalizeCategoryKey(value?: string | null) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function resolveCategoryForStatus(data?: RequestDetail | null) {
  if (!data) return "";
  const categoryKey = normalizeCategoryKey(data.category);
  const inferred = normalizeCategoryKey(data.categoryLabel || data.requestSummary?.issueType || "");
  if (categoryKey && categoryKey !== "maintenance_repair") return categoryKey;
  return inferred || categoryKey;
}

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-medium text-slate-900">{value && value.trim() ? value : "Not set"}</p>
    </div>
  );
}

export default function ServiceRequestDetailPage({
  requestId,
  onBack,
  onRequestPayment,
  onAssignProvider,
  onAssignForJob,
  onChangeProvider,
  onChangeInspector,
}: ServiceRequestDetailPageProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery<RequestDetail>({
    queryKey: ["admin-service-request", requestId],
    queryFn: () => adminApiRequest("GET", `/api/service-requests/${requestId}`),
  });
  const [reviewNote, setReviewNote] = useState("");
  const [refundDecision, setRefundDecision] = useState<"none" | "full" | "partial">("none");
  const [refundAmount, setRefundAmount] = useState("");
  const [elapsedTick, setElapsedTick] = useState(() => Date.now());
  const [selectedEvidenceImage, setSelectedEvidenceImage] = useState<string | null>(null);

  const reviewCancellationMutation = useMutation({
    mutationFn: async (payload: {
      action: "under_review" | "approve" | "reject";
      note: string;
      refundDecision?: "none" | "full" | "partial";
      refundAmount?: number;
    }) => {
      if (!data?.cancellationCase?.id) throw new Error("No cancellation case found");
      return adminApiRequest("PATCH", `/api/admin/cancellation-cases/${data.cancellationCase.id}`, payload);
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin-service-request", requestId] }),
        queryClient.invalidateQueries({ queryKey: ["admin.bridge.service-requests"] }),
      ]);
      setReviewNote("");
      setRefundDecision("none");
      setRefundAmount("");
      toast({ title: "Cancellation case updated" });
    },
    onError: (error: any) => {
      toast({
        title: "Update failed",
        description: error?.message || "Please try again.",
        variant: "destructive",
      });
    },
  });

  const statusTone = STATUS_COLORS[data?.status || ""] || "border-slate-200 bg-slate-50 text-slate-700";
  const urgencyTone = data?.urgency
    ? URGENCY_COLORS[String(data.urgency).toLowerCase()] || "border-slate-200 bg-slate-50 text-slate-700"
    : "";

  const ownerLabel = useMemo(() => {
    if (!data?.currentOwner?.label) return "Unassigned";
    const name = data.currentOwner.user?.name?.trim();
    return name ? `${data.currentOwner.label}: ${name}` : data.currentOwner.label;
  }, [data?.currentOwner]);

  const providerReportView = useMemo(() => {
    if (!data) return null;
    const summary = data.providerReport || {};
    const raw = data.consultancyReport || {};
    const rawEvidence = Array.isArray(raw.evidence)
      ? raw.evidence.map((entry) => String(entry || "").trim()).filter(Boolean)
      : [];
    const summaryEvidence = Array.isArray(summary.evidence)
      ? summary.evidence.map((entry) => String(entry || "").trim()).filter(Boolean)
      : [];
    const evidence = summaryEvidence.length ? summaryEvidence : rawEvidence;

    const inspectionDate =
      String(summary.inspectionDate || "").trim() || String(raw.inspectionDate || "").trim();
    const completionDeadline =
      String(summary.completionDeadline || "").trim() || String(raw.completionDeadline || "").trim();
    const submittedAt = String(summary.submittedAt || "").trim() || String(raw.submittedAt || "").trim();
    const actualIssue = String(summary.actualIssue || "").trim() || String(raw.actualIssue || "").trim();
    const causeOfIssue = String(summary.causeOfIssue || "").trim() || String(raw.causeOfIssue || "").trim();
    const preventiveRecommendation =
      String(summary.preventiveRecommendation || "").trim() ||
      String(raw.preventiveRecommendation || "").trim();

    const materialCost = Number.isFinite(Number(summary.materialCost))
      ? Number(summary.materialCost)
      : Number.isFinite(Number(raw.materialCost))
        ? Number(raw.materialCost)
        : null;
    const serviceCost = Number.isFinite(Number(summary.serviceCost))
      ? Number(summary.serviceCost)
      : Number.isFinite(Number(raw.serviceCost))
        ? Number(raw.serviceCost)
        : null;
    const totalRecommendation = Number.isFinite(Number(summary.totalRecommendation))
      ? Number(summary.totalRecommendation)
      : Number.isFinite(Number(raw.totalRecommendation))
        ? Number(raw.totalRecommendation)
        : materialCost != null && serviceCost != null
          ? materialCost + serviceCost
          : null;

    const hasAnyField = Boolean(
      inspectionDate ||
        completionDeadline ||
        submittedAt ||
        actualIssue ||
        causeOfIssue ||
        preventiveRecommendation ||
        evidence.length ||
        materialCost != null ||
        serviceCost != null ||
        totalRecommendation != null,
    );

    if (!hasAnyField) return null;
    return {
      inspectionDate: inspectionDate || undefined,
      completionDeadline: completionDeadline || undefined,
      submittedAt: submittedAt || undefined,
      actualIssue: actualIssue || undefined,
      causeOfIssue: causeOfIssue || undefined,
      preventiveRecommendation: preventiveRecommendation || undefined,
      materialCost,
      serviceCost,
      totalRecommendation,
      evidence,
    };
  }, [data]);

  const openCancellationCase =
    data?.cancellationCase &&
    ["requested", "under_review"].includes(String(data.cancellationCase.status || "").toLowerCase())
      ? data.cancellationCase
      : null;
  const inProgressElapsedLabel =
    data?.status === "in_progress"
      ? formatElapsedDuration(
          toDate(data.updatedAt) || toDate(data.timeline?.assignedAt) || toDate(data.assignedAt),
          elapsedTick,
        )
      : "";

  useEffect(() => {
    const timer = window.setInterval(() => setElapsedTick(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const handleMarkCancellationUnderReview = () => {
    const note = reviewNote.trim();
    if (note.length < 3) {
      toast({
        title: "Review note required",
        description: "Provide a short review note.",
        variant: "destructive",
      });
      return;
    }
    reviewCancellationMutation.mutate({
      action: "under_review",
      note,
      refundDecision: "none",
    });
  };

  const handleApproveCancellation = () => {
    const note = reviewNote.trim();
    if (note.length < 3) {
      toast({
        title: "Decision note required",
        description: "Provide a clear decision note.",
        variant: "destructive",
      });
      return;
    }
    const parsedRefundAmount = Number(refundAmount || 0);
    if (refundDecision === "partial" && (!Number.isFinite(parsedRefundAmount) || parsedRefundAmount <= 0)) {
      toast({
        title: "Invalid partial refund",
        description: "Enter a valid partial refund amount greater than zero.",
        variant: "destructive",
      });
      return;
    }
    reviewCancellationMutation.mutate({
      action: "approve",
      note,
      refundDecision,
      refundAmount: refundDecision === "partial" ? parsedRefundAmount : undefined,
    });
  };

  const handleRejectCancellation = () => {
    const note = reviewNote.trim();
    if (note.length < 3) {
      toast({
        title: "Decision note required",
        description: "Provide a clear rejection reason.",
        variant: "destructive",
      });
      return;
    }
    reviewCancellationMutation.mutate({
      action: "reject",
      note,
      refundDecision: "none",
    });
  };

  if (isLoading) {
    return <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-sm text-slate-500">Loading request details...</div>;
  }

  if (!data) {
    return <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-sm text-slate-500">Request not found.</div>;
  }

  return (
    <div className="space-y-6">
      <div className="sticky top-0 z-10 rounded-2xl border border-slate-200 bg-white/95 p-5 shadow-sm backdrop-blur">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-semibold text-slate-950">{data.title || data.categoryLabel || "Service Request"}</h1>
              <Badge variant="outline" className={cn("capitalize", statusTone)}>
                {formatServiceRequestStatusLabel(data.status, resolveCategoryForStatus(data))}
              </Badge>
              {data.urgency ? (
                <Badge variant="outline" className={cn("capitalize", urgencyTone)}>
                  {data.urgency}
                </Badge>
              ) : null}
              {data.status === "in_progress" ? (
                <Badge variant="outline" className="border-[#7DD3FC] bg-[#F0F9FF] text-[#0369A1]">
                  In progress: {inProgressElapsedLabel}
                </Badge>
              ) : null}
              <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-700 capitalize">
                {data.paymentSummary?.status || data.paymentStatus || "not requested"}
              </Badge>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600">
              <span>Request ID: {data.id}</span>
              <Button variant="ghost" size="sm" onClick={() => navigator.clipboard?.writeText(data.id)} className="h-7 px-2 text-xs">
                <Copy className="mr-1 h-3.5 w-3.5" />
                Copy ID
              </Button>
              <span>Resident: {data.resident?.name || "Not captured"}</span>
              <span>{ownerLabel}</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={onBack}>Back to requests</Button>
            {data.nextActions?.canAssignProvider ? (
              <Button size="sm" onClick={onAssignProvider}>Assign provider</Button>
            ) : null}
            {data.nextActions?.canChangeInspector ? (
              <Button variant="outline" size="sm" onClick={onChangeInspector}>Change inspector</Button>
            ) : null}
            {data.nextActions?.canRequestPayment ? (
              <Button size="sm" onClick={onRequestPayment}>Request payment</Button>
            ) : null}
            {data.nextActions?.canAssignForJob ? (
              <Button size="sm" onClick={onAssignForJob}>Assign for job</Button>
            ) : null}
            {data.nextActions?.canChangeProvider ? (
              <Button variant="outline" size="sm" onClick={onChangeProvider}>Change provider</Button>
            ) : null}
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(360px,1fr)]">
        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-2">
              <h2 className="text-base font-semibold text-slate-900">Resident</h2>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <InfoRow label="Name" value={data.resident?.name || "Not captured"} />
              <InfoRow label="Phone" value={data.resident?.phone || "Not provided"} />
              <InfoRow label="Email" value={data.resident?.email || "Not provided"} />
              <InfoRow label="Profile location" value={data.resident?.location || "Not provided"} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <h2 className="text-base font-semibold text-slate-900">Service request</h2>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <InfoRow label="Category" value={data.categoryLabel || data.category || "Not set"} />
              <InfoRow label="Issue type" value={data.requestSummary?.issueType || "Not set"} />
              <InfoRow label="Area / scope" value={data.requestSummary?.areaAffected || "Not set"} />
              <InfoRow label="Quantity" value={data.requestSummary?.quantityLabel || "Not set"} />
              <InfoRow label="Preferred time" value={data.requestSummary?.timeWindowLabel || "Not set"} />
              <InfoRow label="Urgency" value={data.requestSummary?.urgencyLabel || data.urgency || "Not set"} />
              <InfoRow label="Attachments" value={`${data.attachments?.count ?? 0} item(s)`} />
              <InfoRow label="Notes" value={data.requestSummary?.notes || "Not provided"} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <h2 className="text-base font-semibold text-slate-900">Location</h2>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2 flex items-start gap-2 text-sm text-slate-700">
                <MapPin className="mt-0.5 h-4 w-4 text-slate-400" />
                <span>{data.locationSummary?.display || "Not provided"}</span>
              </div>
              <InfoRow label="Address line" value={data.locationSummary?.addressLine || "Not provided"} />
              <InfoRow label="Estate" value={data.locationSummary?.estateName || "Not set"} />
              <InfoRow label="State" value={data.locationSummary?.stateName || "Not set"} />
              <InfoRow label="LGA" value={data.locationSummary?.lgaName || "Not set"} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-base font-semibold text-slate-900">Provider report</h2>
                {providerReportView ? (
                  <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700">Submitted</Badge>
                ) : (
                  <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-600">Awaiting report</Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <InfoRow label="Inspection date" value={providerReportView?.inspectionDate ? formatDate(providerReportView.inspectionDate) : "Not set"} />
              <InfoRow label="Completion deadline" value={providerReportView?.completionDeadline ? formatDate(providerReportView.completionDeadline) : "Not set"} />
              <InfoRow label="Submitted" value={providerReportView?.submittedAt ? formatDate(providerReportView.submittedAt) : "Not set"} />
              <div className="sm:col-span-2"><InfoRow label="Actual issue" value={providerReportView?.actualIssue || "Not provided"} /></div>
              <div className="sm:col-span-2"><InfoRow label="Cause of issue" value={providerReportView?.causeOfIssue || "Not provided"} /></div>
              <InfoRow label="Material cost" value={formatNgnAmount(providerReportView?.materialCost)} />
              <InfoRow label="Service cost" value={formatNgnAmount(providerReportView?.serviceCost)} />
              <div className="sm:col-span-2"><InfoRow label="Preventive recommendation" value={providerReportView?.preventiveRecommendation || "Not provided"} /></div>
              <InfoRow label="Evidence count" value={String(providerReportView?.evidence?.length || 0)} />
              {Array.isArray(providerReportView?.evidence) && providerReportView.evidence.length > 0 ? (
                <div className="sm:col-span-2">
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">Evidence</p>
                  <div className="grid gap-2 sm:grid-cols-3">
                    {providerReportView.evidence.slice(0, 8).map((evidenceUrl, evidenceIndex) => (
                      <button
                        type="button"
                        key={`${String(evidenceUrl).slice(0, 80)}-${evidenceIndex}`}
                        onClick={() => setSelectedEvidenceImage(String(evidenceUrl))}
                        className="overflow-hidden rounded-lg border border-slate-200 bg-slate-50 transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
                      >
                        <img
                          src={String(evidenceUrl)}
                          alt={`Evidence ${evidenceIndex + 1}`}
                          className="h-24 w-full object-cover"
                          loading="lazy"
                        />
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <h2 className="text-base font-semibold text-slate-900">Raw answers / conversation snapshot</h2>
            </CardHeader>
            <CardContent>
              <details className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                <summary className="cursor-pointer font-medium text-slate-900">Show raw captured answers</summary>
                <pre className="mt-3 whitespace-pre-wrap break-words font-sans text-sm text-slate-700">{data.rawAnswers?.description || "No raw answers captured."}</pre>
              </details>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-2">
              <h2 className="text-base font-semibold text-slate-900">Operations</h2>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-slate-700">
              <div className="flex items-center gap-2"><Users className="h-4 w-4 text-slate-400" />Resident: {data.resident?.name || "Not captured"}</div>
              <div className="flex items-center gap-2"><UserCheck className="h-4 w-4 text-slate-400" />Inspector: {data.inspector?.name || "Not assigned"}</div>
              <div className="flex items-center gap-2"><Wrench className="h-4 w-4 text-slate-400" />Job provider: {data.jobProvider?.name || "Not assigned"}</div>
              <div className="flex items-center gap-2"><ClipboardList className="h-4 w-4 text-slate-400" />Current owner: {ownerLabel}</div>
            </CardContent>
          </Card>

          {data.cancellationCase ? (
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-base font-semibold text-slate-900">Cancellation Review</h2>
                  <Badge
                    variant="outline"
                    className={
                      ["requested", "under_review"].includes(String(data.cancellationCase.status || "").toLowerCase())
                        ? "border-fuchsia-200 bg-fuchsia-50 text-fuchsia-700"
                        : String(data.cancellationCase.status || "").toLowerCase() === "approved"
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                          : "border-rose-200 bg-rose-50 text-rose-700"
                    }
                  >
                    {String(data.cancellationCase.status || "requested").replace(/_/g, " ")}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-slate-700">
                <InfoRow label="Reason code" value={data.cancellationCase.reasonCode || "Not set"} />
                <InfoRow label="Reason detail" value={data.cancellationCase.reasonDetail || "Not set"} />
                <InfoRow
                  label="Preferred resolution"
                  value={String(data.cancellationCase.preferredResolution || "Not set").replace(/_/g, " ")}
                />
                <InfoRow label="Submitted" value={formatDate(data.cancellationCase.createdAt || null)} />
                <InfoRow label="Admin note" value={data.cancellationCase.adminNote || "Not set"} />

                {openCancellationCase ? (
                  <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Admin decision</p>
                    <Textarea
                      placeholder="Add investigation notes and decision rationale..."
                      value={reviewNote}
                      onChange={(event) => setReviewNote(event.target.value)}
                      className="min-h-[90px] bg-white"
                    />
                    <div className="grid gap-2 sm:grid-cols-2">
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-slate-600">Refund decision</p>
                        <Select
                          value={refundDecision}
                          onValueChange={(value: "none" | "full" | "partial") => setRefundDecision(value)}
                        >
                          <SelectTrigger className="bg-white">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">No refund</SelectItem>
                            <SelectItem value="full">Full refund</SelectItem>
                            <SelectItem value="partial">Partial refund</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      {refundDecision === "partial" ? (
                        <div className="space-y-1">
                          <p className="text-xs font-medium text-slate-600">Partial amount (NGN)</p>
                          <input
                            value={refundAmount}
                            onChange={(event) => setRefundAmount(event.target.value)}
                            type="number"
                            min={0}
                            className="h-10 w-full rounded-md border border-input bg-white px-3 text-sm"
                            placeholder="e.g. 25000"
                          />
                        </div>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap gap-2 pt-1">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleMarkCancellationUnderReview}
                        disabled={reviewCancellationMutation.isPending}
                      >
                        Mark under review
                      </Button>
                      <Button
                        size="sm"
                        onClick={handleApproveCancellation}
                        disabled={reviewCancellationMutation.isPending}
                      >
                        Approve cancellation
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={handleRejectCancellation}
                        disabled={reviewCancellationMutation.isPending}
                      >
                        Reject cancellation
                      </Button>
                    </div>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader className="pb-2">
              <h2 className="text-base font-semibold text-slate-900">Timeline</h2>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-slate-700">
              <div className="flex items-center gap-2"><Calendar className="h-4 w-4 text-slate-400" />Created: {formatDate(data.timeline?.createdAt || data.createdAt)}</div>
              <div className="flex items-center gap-2"><UserCheck className="h-4 w-4 text-slate-400" />Assigned: {formatDate(data.timeline?.assignedAt || data.assignedAt)}</div>
              <div className="flex items-center gap-2"><Clock className="h-4 w-4 text-slate-400" />Payment requested: {formatDate(data.timeline?.paymentRequestedAt || data.paymentRequestedAt)}</div>
              <div className="flex items-center gap-2"><ClipboardList className="h-4 w-4 text-slate-400" />Report submitted: {formatDate(data.timeline?.consultancyReportSubmittedAt)}</div>
              <div className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-slate-400" />Approved for job: {formatDate(data.timeline?.approvedForJobAt || data.approvedForJobAt)}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <h2 className="text-base font-semibold text-slate-900">Payment</h2>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-slate-700">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Purpose</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">{data.paymentSummary?.purpose || "Not set"}</p>
              </div>
              <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-4">
                <div className="flex items-center justify-between"><span>Consultancy fee</span><span className="font-medium">{formatNgnAmount(data.paymentSummary?.consultancyFee)}</span></div>
                <div className="flex items-center justify-between"><span>Material cost</span><span className="font-medium">{formatNgnAmount(data.paymentSummary?.materialCost)}</span></div>
                <div className="flex items-center justify-between"><span>Service cost</span><span className="font-medium">{formatNgnAmount(data.paymentSummary?.serviceCost)}</span></div>
                <div className="flex items-center justify-between border-t border-slate-200 pt-2"><span className="font-medium text-slate-900">Requested total</span><span className="font-semibold text-slate-900">{formatNgnAmount(data.paymentSummary?.requestedTotal || data.paymentSummary?.billedAmount || data.billedAmount)}</span></div>
                <div className="flex items-center justify-between"><span>Status</span><span className="font-medium capitalize">{data.paymentSummary?.status || data.paymentStatus || "not requested"}</span></div>
                <div className="flex items-center justify-between"><span>Requested on</span><span className="font-medium">{formatDate(data.paymentSummary?.requestedAt || data.paymentRequestedAt)}</span></div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <h2 className="text-base font-semibold text-slate-900">Contact context</h2>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-slate-700">
              <div className="flex items-center gap-2"><Phone className="h-4 w-4 text-slate-400" />Resident phone: {data.resident?.phone || "Not provided"}</div>
              <div className="flex items-center gap-2"><Mail className="h-4 w-4 text-slate-400" />Resident email: {data.resident?.email || "Not provided"}</div>
              <div className="flex items-center gap-2"><Phone className="h-4 w-4 text-slate-400" />Provider phone: {data.currentOwner?.user?.phone || data.provider?.phone || "Not provided"}</div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog
        open={Boolean(selectedEvidenceImage)}
        onOpenChange={(open) => {
          if (!open) setSelectedEvidenceImage(null);
        }}
      >
        <DialogContent className="max-w-3xl border border-slate-200 p-0">
          <DialogHeader className="border-b border-slate-200 px-4 py-3">
            <DialogTitle className="text-base font-semibold text-slate-900">
              Evidence preview
            </DialogTitle>
          </DialogHeader>
          <div className="max-h-[75vh] overflow-auto bg-slate-950 p-2 sm:p-3">
            {selectedEvidenceImage ? (
              <img
                src={selectedEvidenceImage}
                alt="Evidence preview"
                className="mx-auto max-h-[70vh] w-auto max-w-full rounded-md object-contain"
              />
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
