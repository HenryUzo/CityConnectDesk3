import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { io } from "socket.io-client";
import { ProviderShell } from "@/components/provider/ProviderShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { MessageComposer, type ComposerAttachment } from "@/components/resident/ordinary-flow/MessageComposer";
import { ChatThread, type ThreadItem } from "@/components/resident/ordinary-flow/ChatThread";
import { TypingPresenceIndicator } from "@/components/resident/ordinary-flow/TypingPresenceIndicator";
import { EmptyState, InlineErrorState, PageSkeleton } from "@/components/shared/page-states";
import { useToast } from "@/hooks/use-toast";
import { useNotifications } from "@/contexts/NotificationsContext";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import { formatServiceRequestStatusLabel } from "@/lib/serviceRequestStatus";
import { cn } from "@/lib/utils";

interface ServiceRequest {
  id: string;
  providerId?: string | null;
  title?: string;
  description?: string;
  category?: string;
  categoryLabel?: string;
  issueType?: string;
  location?: string;
  urgency?: string;
  status: string;
  consultancyReport?: {
    inspectionDate?: string;
    completionDeadline?: string;
    actualIssue?: string;
    causeOfIssue?: string;
    materialCost?: number;
    serviceCost?: number;
    totalRecommendation?: number;
    preventiveRecommendation?: string;
    evidence?: string[];
    submittedAt?: string;
  } | null;
  consultancyReportSubmittedAt?: string | null;
  assignedAt?: string | null;
  updatedAt?: string;
  createdAt?: string;
}

interface RequestMessage {
  id: string;
  requestId: string;
  senderId: string;
  senderRole: "admin" | "resident" | "provider";
  message: string;
  attachmentUrl?: string | null;
  createdAt?: string;
}

type RequestMessageSocketPayload = {
  requestId: string;
  message: RequestMessage;
};

type ServiceRequestUpdateSocketPayload = {
  requestId: string;
  request?: Partial<ServiceRequest> & { id?: string };
  at?: string;
};

type RequestTypingSocketPayload = {
  requestId: string;
  userId: string;
  senderRole: "resident" | "provider" | "admin";
  isTyping: boolean;
  at?: string;
};

function formatLabel(value: string) {
  if (!value) return "New request";
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function normalizeCategoryKey(value?: string | null) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function resolveRequestCategoryLabel(request?: ServiceRequest | null) {
  return request?.categoryLabel || request?.issueType || request?.category || request?.title || "Service request";
}

function resolveRequestCategoryKey(request?: ServiceRequest | null) {
  if (!request) return "";
  const categoryKey = normalizeCategoryKey(request.category);
  const inferredKey = normalizeCategoryKey(request.categoryLabel || request.issueType || request.title || "");
  if (categoryKey && categoryKey !== "maintenance_repair") return categoryKey;
  return inferredKey || categoryKey;
}

function toDate(value?: string | Date | null) {
  if (!value) return null;
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatElapsedDuration(startedAt: Date | null) {
  if (!startedAt) return "00:00:00";
  const diffMs = Math.max(Date.now() - startedAt.getTime(), 0);
  const totalSeconds = Math.floor(diffMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function statusTone(status: string) {
  const key = String(status || "").toLowerCase().replace(/[\s-]+/g, "_");
  const map: Record<string, string> = {
    draft: "border-slate-300 bg-slate-100 text-slate-700",
    assigned: "border-violet-300 bg-violet-100 text-violet-700",
    assigned_for_job: "border-indigo-300 bg-indigo-100 text-indigo-700",
    in_progress: "border-sky-300 bg-sky-100 text-sky-700",
    work_completed_pending_resident: "border-cyan-300 bg-cyan-100 text-cyan-700",
    rework_required: "border-amber-300 bg-amber-100 text-amber-700",
    disputed: "border-rose-300 bg-rose-100 text-rose-700",
    pending_inspection: "border-amber-300 bg-amber-100 text-amber-700",
    completed: "border-emerald-300 bg-emerald-100 text-emerald-700",
    cancelled: "border-rose-300 bg-rose-100 text-rose-700",
    pending: "border-slate-300 bg-slate-100 text-slate-700",
  };
  return map[key] || map.pending;
}

function parsePaymentRequestMessage(text: string) {
  const source = String(text || "").trim();
  if (!source) return null;
  if (!/^service payment requested:/i.test(source) && !/^service payment has been requested/i.test(source)) {
    return null;
  }

  const amountMatch = source.match(/ngn\s*([0-9,]+(?:\.[0-9]+)?)/i);
  const amount = amountMatch ? Number(amountMatch[1].replace(/,/g, "")) : NaN;
  const amountLabel = Number.isFinite(amount) && amount > 0 ? `NGN ${amount.toLocaleString()}` : "Amount pending";

  const note = source
    .replace(/^service payment requested:\s*/i, "")
    .replace(/^service payment has been requested\.?/i, "")
    .replace(/ngn\s*[0-9,]+(?:\.[0-9]+)?\.?/i, "")
    .trim();

  return {
    amountLabel,
    note: note || undefined,
  };
}

function normalizeConsultancyReport(report: ServiceRequest["consultancyReport"]) {
  if (!report || typeof report !== "object") return null;
  const materialCost = Number((report as any).materialCost || 0);
  const serviceCost = Number((report as any).serviceCost || 0);
  const inspectionDateRaw = String((report as any).inspectionDate || "");
  const completionDeadlineRaw = String((report as any).completionDeadline || "");
  const evidence = Array.isArray((report as any).evidence)
    ? (report as any).evidence.map((entry: unknown) => String(entry || "").trim()).filter(Boolean)
    : [];
  return {
    inspectionDate: inspectionDateRaw ? new Date(inspectionDateRaw).toLocaleString() : undefined,
    completionDeadline: completionDeadlineRaw
      ? new Date(completionDeadlineRaw).toLocaleString()
      : undefined,
    actualIssue: String((report as any).actualIssue || "Not provided"),
    causeOfIssue: String((report as any).causeOfIssue || "Not provided"),
    materialCostLabel: Number.isFinite(materialCost)
      ? `NGN ${materialCost.toLocaleString()}`
      : "Not provided",
    serviceCostLabel: Number.isFinite(serviceCost)
      ? `NGN ${serviceCost.toLocaleString()}`
      : "Not provided",
    preventiveRecommendation: String((report as any).preventiveRecommendation || "Not provided"),
    evidenceUrls: evidence,
  };
}

function parseConsultancyReportMessage(text: string) {
  const source = String(text || "").trim();
  const hasConsultancyPrefix = /^consultancy report submitted\./i.test(source);
  const hasReportFields =
    /inspection date:/i.test(source) &&
    /issue:/i.test(source) &&
    /cause:/i.test(source) &&
    /recommended material cost:/i.test(source) &&
    /recommended service cost:/i.test(source) &&
    /preventive recommendation:/i.test(source);
  if (!hasConsultancyPrefix && !hasReportFields) return null;

  const pick = (label: string) => {
    const regex = new RegExp(`${label}:\\s*(.+)$`, "im");
    return source.match(regex)?.[1]?.trim() || "";
  };

  const inspectionDate = pick("Inspection date");
  const issue = pick("Issue") || "Not provided";
  const cause = pick("Cause") || "Not provided";
  const materialCost = pick("Recommended material cost") || "Not provided";
  const serviceCost = pick("Recommended service cost") || "Not provided";
  const prevention = pick("Preventive recommendation") || "Not provided";
  const completionDeadline = pick("Completion deadline");
  const evidenceCountText = pick("Evidence attachments");
  const evidenceCountMatch = evidenceCountText.match(/(\d+)/);

  return {
    inspectionDate: inspectionDate || undefined,
    completionDeadline: completionDeadline || undefined,
    actualIssue: issue,
    causeOfIssue: cause,
    materialCostLabel: materialCost,
    serviceCostLabel: serviceCost,
    preventiveRecommendation: prevention,
    evidenceCount: evidenceCountMatch ? Number(evidenceCountMatch[1]) : undefined,
  };
}

type ReportEvidenceAttachment = {
  id: string;
  name: string;
  previewUrl: string;
  kind: "image";
  mimeType: string;
};

function buildReportEvidenceFromUrls(urls: string[]) {
  return urls
    .map((url, index) => String(url || "").trim())
    .filter(Boolean)
    .map<ReportEvidenceAttachment>((url, index) => ({
      id: `report-evidence-${index}-${url.slice(0, 24)}`,
      name: `Evidence ${index + 1}`,
      previewUrl: url,
      kind: "image",
      mimeType: "image/*",
    }));
}

export default function ProviderChatPage() {
  const [location, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { notifications, markRead } = useNotifications();
  const { user } = useAuth();
  const chatBottomRef = useRef<HTMLDivElement | null>(null);

  const [activeRequestId, setActiveRequestId] = useState<string | null>(null);
  const [messageDraft, setMessageDraft] = useState("");
  const [composerAttachments, setComposerAttachments] = useState<ComposerAttachment[]>([]);
  const [isResidentTyping, setIsResidentTyping] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [reportInspectionDate, setReportInspectionDate] = useState("");
  const [reportCompletionDeadline, setReportCompletionDeadline] = useState("");
  const [reportActualIssue, setReportActualIssue] = useState("");
  const [reportCauseOfIssue, setReportCauseOfIssue] = useState("");
  const [reportMaterialCost, setReportMaterialCost] = useState("");
  const [reportServiceCost, setReportServiceCost] = useState("");
  const [reportPreventiveRecommendation, setReportPreventiveRecommendation] = useState("");
  const [reportEvidence, setReportEvidence] = useState<ReportEvidenceAttachment[]>([]);
  const [elapsedTick, setElapsedTick] = useState(() => Date.now());
  const socketRef = useRef<ReturnType<typeof io> | null>(null);
  const selfTypingRef = useRef(false);
  const selfTypingStopTimerRef = useRef<number | null>(null);
  const residentTypingClearTimerRef = useRef<number | null>(null);

  const requestIdFromQuery = useMemo(() => {
    const queryString = location.includes("?") ? location.split("?")[1] : "";
    return new URLSearchParams(queryString).get("requestId") || "";
  }, [location]);

  const {
    data: requests = [],
    isLoading: requestsLoading,
    error: requestsError,
  } = useQuery<ServiceRequest[]>({
    queryKey: ["provider-chat-requests"],
    staleTime: 10_000,
    refetchInterval: 20_000,
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/service-requests");
      const data = (await res.json()) as ServiceRequest[];
      return Array.isArray(data)
        ? data.filter((request) =>
            [
              "assigned",
              "assigned_for_job",
              "in_progress",
              "work_completed_pending_resident",
              "rework_required",
              "disputed",
              "pending",
              "pending_inspection",
              "completed",
            ].includes(
              request.status,
            ),
          )
        : [];
    },
  });

  useEffect(() => {
    if (!requests.length) {
      setActiveRequestId(null);
      return;
    }

    if (activeRequestId && requests.some((request) => request.id === activeRequestId)) {
      return;
    }

    if (requestIdFromQuery && requests.some((request) => request.id === requestIdFromQuery)) {
      setActiveRequestId(requestIdFromQuery);
      return;
    }

    setActiveRequestId(requests[0].id);
  }, [activeRequestId, requestIdFromQuery, requests]);

  const unreadByRequestId = useMemo(() => {
    const map: Record<string, number> = {};
    for (const notification of notifications) {
      if (notification.isRead) continue;
      const meta = notification.metadata as Record<string, unknown> | null;
      const requestId = typeof meta?.requestId === "string" ? meta.requestId : "";
      const kind = typeof meta?.kind === "string" ? meta.kind : "";
      const senderRole = typeof meta?.senderRole === "string" ? meta.senderRole : "";
      if (!requestId || kind !== "request_message" || senderRole !== "resident") continue;
      map[requestId] = (map[requestId] || 0) + 1;
    }
    return map;
  }, [notifications]);

  const markRequestUnreadAsRead = async (requestId: string) => {
    const unread = notifications.filter((notification) => {
      if (notification.isRead) return false;
      const meta = notification.metadata as Record<string, unknown> | null;
      return (
        meta?.kind === "request_message" &&
        meta?.requestId === requestId &&
        meta?.senderRole === "resident"
      );
    });

    await Promise.all(unread.map((notification) => markRead(notification.id)));
  };

  const handleSelectRequest = async (requestId: string) => {
    setActiveRequestId(requestId);
    setLocation(`/provider/chat?requestId=${encodeURIComponent(requestId)}`);
    await markRequestUnreadAsRead(requestId);
  };

  useEffect(() => {
    if (!activeRequestId) return;
    void markRequestUnreadAsRead(activeRequestId);
  }, [activeRequestId]);

  const activeRequest = useMemo(
    () => requests.find((request) => request.id === activeRequestId) ?? null,
    [requests, activeRequestId],
  );

  const hasConsultancyReport = Boolean(activeRequest?.consultancyReportSubmittedAt || activeRequest?.consultancyReport);
  const canGenerateConsultancyReport = Boolean(
    activeRequest && ["assigned", "pending_inspection"].includes(String(activeRequest.status || "").toLowerCase()),
  );
  const generateReportDisabledReason = useMemo(() => {
    if (!activeRequest) return "Select a request to generate a consultancy report.";
    if (canGenerateConsultancyReport) return "";

    const normalizedStatus = String(activeRequest.status || "").toLowerCase().replace(/[\s-]+/g, "_");
    if (
      [
        "assigned_for_job",
        "in_progress",
        "work_completed_pending_resident",
        "rework_required",
        "disputed",
        "completed",
        "cancelled",
      ].includes(normalizedStatus)
    ) {
      return "Consultancy report can only be generated during inspection (Pending inspection / Assigned for inspection).";
    }

    return "This request is not in an inspection stage yet.";
  }, [activeRequest, canGenerateConsultancyReport]);

  const activeRequestStatus = useMemo(
    () => String(activeRequest?.status || "").toLowerCase().replace(/[\s-]+/g, "_"),
    [activeRequest?.status],
  );

  useEffect(() => {
    const timer = window.setInterval(() => setElapsedTick(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const activeInProgressElapsedLabel = useMemo(() => {
    if (activeRequestStatus !== "in_progress") return "";
    const startedAt = toDate(activeRequest?.updatedAt) || toDate(activeRequest?.assignedAt) || toDate(activeRequest?.createdAt);
    return formatElapsedDuration(startedAt);
  }, [activeRequest?.updatedAt, activeRequest?.assignedAt, activeRequest?.createdAt, activeRequestStatus, elapsedTick]);

  const clearSelfTypingStopTimer = useCallback(() => {
    if (selfTypingStopTimerRef.current !== null) {
      window.clearTimeout(selfTypingStopTimerRef.current);
      selfTypingStopTimerRef.current = null;
    }
  }, []);

  const clearResidentTypingTimer = useCallback(() => {
    if (residentTypingClearTimerRef.current !== null) {
      window.clearTimeout(residentTypingClearTimerRef.current);
      residentTypingClearTimerRef.current = null;
    }
  }, []);

  const emitTypingState = useCallback(
    (requestId: string, isTyping: boolean) => {
      if (!requestId) return;
      const socket = socketRef.current;
      if (socket) {
        socket.emit("request-typing", {
          requestId,
          userId: String(user?.id || ""),
          senderRole: "provider",
          isTyping,
        });
      }
      void apiRequest("POST", `/api/service-requests/${requestId}/typing`, {
        isTyping,
      }).catch(() => undefined);
    },
    [user?.id],
  );

  const stopSelfTyping = useCallback(
    (requestId?: string | null) => {
      clearSelfTypingStopTimer();
      const targetRequestId = String(requestId || activeRequestId || "").trim();
      if (!targetRequestId) return;
      if (!selfTypingRef.current) return;
      selfTypingRef.current = false;
      emitTypingState(targetRequestId, false);
    },
    [activeRequestId, clearSelfTypingStopTimer, emitTypingState],
  );

  const {
    data: requestMessages = [],
    isLoading: messagesLoading,
    error: messagesError,
  } = useQuery<RequestMessage[]>({
    queryKey: ["provider-chat-messages", activeRequestId],
    enabled: Boolean(activeRequestId),
    staleTime: 2_000,
    refetchInterval: 10_000,
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/service-requests/${activeRequestId}/messages`);
      return res.json() as Promise<RequestMessage[]>;
    },
  });

  const orderedMessages = useMemo(
    () =>
      [...requestMessages].sort((a, b) => {
        const first = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const second = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return first - second;
      }),
    [requestMessages],
  );

  const conversationItems = useMemo<ThreadItem[]>(
    () => {
      const items: ThreadItem[] = [];
      const requestReport = normalizeConsultancyReport(activeRequest?.consultancyReport || null);
      let hasReportCardInMessages = false;

      orderedMessages.forEach((message) => {
        const paymentCard = parsePaymentRequestMessage(message.message);
        if (paymentCard) {
          const reportSummaryNote = requestReport
            ? [
                requestReport.inspectionDate ? `Inspection date: ${requestReport.inspectionDate}` : "",
                requestReport.completionDeadline
                  ? `Completion deadline: ${requestReport.completionDeadline}`
                  : "",
                `Actual issue: ${requestReport.actualIssue}`,
                `Cause of issue: ${requestReport.causeOfIssue}`,
                `Material cost: ${requestReport.materialCostLabel}`,
                `Service cost: ${requestReport.serviceCostLabel}`,
                `Preventive recommendation: ${requestReport.preventiveRecommendation}`,
                requestReport.evidenceUrls?.length
                  ? `Evidence attachments: ${requestReport.evidenceUrls.length}`
                  : "",
              ]
                .filter(Boolean)
                .join("\n")
            : "";
          items.push({
            id: `${message.id}-payment`,
            kind: "payment",
            amountLabel: paymentCard.amountLabel,
            statusLabel: "Payment requested",
            note: [paymentCard.note, reportSummaryNote].filter(Boolean).join("\n"),
            requestedAt: message.createdAt,
            canPay: false,
          });
          return;
        }

        const consultancyReport = parseConsultancyReportMessage(message.message);
        if (consultancyReport) {
          hasReportCardInMessages = true;
          items.push({
            id: `${message.id}-consultancy-report`,
            kind: "consultancy_report",
            inspectionDate: consultancyReport.inspectionDate || requestReport?.inspectionDate,
            completionDeadline:
              consultancyReport.completionDeadline || requestReport?.completionDeadline,
            actualIssue: consultancyReport.actualIssue,
            causeOfIssue: consultancyReport.causeOfIssue,
            materialCostLabel: consultancyReport.materialCostLabel,
            serviceCostLabel: consultancyReport.serviceCostLabel,
            preventiveRecommendation: consultancyReport.preventiveRecommendation,
            evidenceUrls: requestReport?.evidenceUrls,
            evidenceCount: consultancyReport.evidenceCount,
            timestamp: message.createdAt,
          });
          return;
        }

        items.push({
          id: message.id,
          kind: "message",
          role: message.senderRole === "provider" ? "resident" : "provider",
          text: message.message,
          attachmentUrl: message.attachmentUrl || undefined,
          timestamp: message.createdAt,
        });
      });

      // Fallback: show the latest stored report even if older messages were plain text.
      if (requestReport && !hasReportCardInMessages) {
        items.push({
          id: "consultancy-report-from-request",
          kind: "consultancy_report",
          inspectionDate: requestReport.inspectionDate,
          completionDeadline: requestReport.completionDeadline,
          actualIssue: requestReport.actualIssue,
          causeOfIssue: requestReport.causeOfIssue,
          materialCostLabel: requestReport.materialCostLabel,
          serviceCostLabel: requestReport.serviceCostLabel,
          preventiveRecommendation: requestReport.preventiveRecommendation,
          evidenceUrls: requestReport.evidenceUrls,
          timestamp: activeRequest?.consultancyReportSubmittedAt || activeRequest?.updatedAt,
        });
      }

      return items;
    },
    [activeRequest?.consultancyReport, activeRequest?.consultancyReportSubmittedAt, activeRequest?.updatedAt, orderedMessages],
  );

  const sendMessageMutation = useMutation({
    mutationFn: async (payload: { requestId: string; message: string; attachmentUrl?: string }) => {
      const res = await apiRequest("POST", `/api/service-requests/${payload.requestId}/messages`, {
        message: payload.message,
        ...(payload.attachmentUrl ? { attachmentUrl: payload.attachmentUrl } : {}),
      });
      return res.json() as Promise<RequestMessage>;
    },
    onSuccess: (createdMessage) => {
      queryClient.setQueryData<RequestMessage[]>(
        ["provider-chat-messages", createdMessage.requestId],
        (prev = []) => {
          if (prev.some((item) => item.id === createdMessage.id)) return prev;
          return [...prev, createdMessage];
        },
      );
    },
    onError: (error: Error) => {
      toast({
        title: "Message failed",
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
        queryClient.invalidateQueries({ queryKey: ["provider-chat-requests"] }),
        queryClient.invalidateQueries({ queryKey: ["provider-jobs", user?.id] }),
        queryClient.invalidateQueries({ queryKey: ["/api/service-requests"] }),
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
        queryClient.invalidateQueries({ queryKey: ["provider-chat-requests"] }),
        queryClient.invalidateQueries({ queryKey: ["provider-jobs", user?.id] }),
        queryClient.invalidateQueries({ queryKey: ["/api/service-requests"] }),
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

  const submitConsultancyReportMutation = useMutation({
    mutationFn: async (payload: {
      requestId: string;
      inspectionDate: string;
      completionDeadline: string;
      actualIssue: string;
      causeOfIssue: string;
      materialCost: number;
      serviceCost: number;
      preventiveRecommendation: string;
      evidence: string[];
    }) => {
      const res = await apiRequest(
        "POST",
        `/api/provider/service-requests/${payload.requestId}/consultancy-report`,
        {
          inspectionDate: payload.inspectionDate,
          completionDeadline: payload.completionDeadline,
          actualIssue: payload.actualIssue,
          causeOfIssue: payload.causeOfIssue,
          materialCost: payload.materialCost,
          serviceCost: payload.serviceCost,
          preventiveRecommendation: payload.preventiveRecommendation,
          evidence: payload.evidence,
        },
      );
      return res.json();
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["provider-chat-requests"] }),
        queryClient.invalidateQueries({ queryKey: ["provider-jobs", user?.id] }),
        queryClient.invalidateQueries({ queryKey: ["/api/service-requests"] }),
      ]);
      if (activeRequestId) {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ["provider-chat-messages", activeRequestId] }),
          queryClient.invalidateQueries({ queryKey: ["provider-dashboard-request-messages", activeRequestId] }),
        ]);
      }
      toast({ title: "Consultancy report sent" });
      setIsReportModalOpen(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to send report",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleOpenReportModal = () => {
    if (!activeRequest) return;
    const report = activeRequest.consultancyReport;
    setReportInspectionDate(
      report?.inspectionDate ? new Date(report.inspectionDate).toISOString().slice(0, 16) : "",
    );
    setReportCompletionDeadline(
      report?.completionDeadline ? new Date(report.completionDeadline).toISOString().slice(0, 16) : "",
    );
    setReportActualIssue(report?.actualIssue || "");
    setReportCauseOfIssue(report?.causeOfIssue || "");
    setReportMaterialCost(report?.materialCost ? String(report.materialCost) : "");
    setReportServiceCost(report?.serviceCost ? String(report.serviceCost) : "");
    setReportPreventiveRecommendation(report?.preventiveRecommendation || "");
    setReportEvidence(buildReportEvidenceFromUrls(Array.isArray(report?.evidence) ? report.evidence : []));
    setIsReportModalOpen(true);
  };

  const handleSendConsultancyReport = async () => {
    if (!activeRequestId) return;
    const materialCost = Number(reportMaterialCost);
    const serviceCost = Number(reportServiceCost);
    if (
      !reportInspectionDate ||
      !reportCompletionDeadline ||
      !reportActualIssue.trim() ||
      !reportCauseOfIssue.trim() ||
      !reportPreventiveRecommendation.trim() ||
      !Number.isFinite(materialCost) ||
      materialCost < 0 ||
      !Number.isFinite(serviceCost) ||
      serviceCost < 0
    ) {
      toast({
        title: "Incomplete report",
        description: "Fill all report fields with valid values.",
        variant: "destructive",
      });
      return;
    }

    await submitConsultancyReportMutation.mutateAsync({
      requestId: activeRequestId,
      inspectionDate: new Date(reportInspectionDate).toISOString(),
      completionDeadline: new Date(reportCompletionDeadline).toISOString(),
      actualIssue: reportActualIssue.trim(),
      causeOfIssue: reportCauseOfIssue.trim(),
      materialCost,
      serviceCost,
      preventiveRecommendation: reportPreventiveRecommendation.trim(),
      evidence: reportEvidence.map((entry) => entry.previewUrl),
    });
  };

  const handleAttachReportEvidence = (files: File[]) => {
    const imageFiles = files.filter((file) => file.type.startsWith("image/"));
    if (imageFiles.length === 0) {
      toast({
        title: "Unsupported evidence file",
        description: "Upload image files for report evidence.",
        variant: "destructive",
      });
      return;
    }

    const roomLeft = Math.max(0, 8 - reportEvidence.length);
    if (!roomLeft) return;

    imageFiles.slice(0, roomLeft).forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = typeof reader.result === "string" ? reader.result : "";
        if (!result) return;
        setReportEvidence((prev) => [
          ...prev,
          {
            id: `${Date.now()}-${Math.random()}`,
            name: file.name,
            previewUrl: result,
            kind: "image",
            mimeType: file.type || "image/*",
          },
        ]);
      };
      reader.readAsDataURL(file);
    });
  };

  const handleRemoveReportEvidence = (attachmentId: string) => {
    setReportEvidence((prev) => prev.filter((entry) => entry.id !== attachmentId));
  };

  const reportMaterialCostValue = Number(reportMaterialCost);
  const reportServiceCostValue = Number(reportServiceCost);
  const reportCostsAreValid =
    Number.isFinite(reportMaterialCostValue) &&
    reportMaterialCostValue >= 0 &&
    Number.isFinite(reportServiceCostValue) &&
    reportServiceCostValue >= 0;
  const reportTotalCost = reportCostsAreValid ? reportMaterialCostValue + reportServiceCostValue : 0;
  const reportTimelineInvalid =
    Boolean(reportInspectionDate) &&
    Boolean(reportCompletionDeadline) &&
    new Date(reportCompletionDeadline).getTime() < new Date(reportInspectionDate).getTime();
  const reportFormMissingFields =
    !reportInspectionDate ||
    !reportCompletionDeadline ||
    !reportActualIssue.trim() ||
    !reportCauseOfIssue.trim() ||
    !reportPreventiveRecommendation.trim();
  const isReportFormReady = !reportFormMissingFields && reportCostsAreValid && !reportTimelineInvalid;

  const handleComposerAttachFiles = (files: File[]) => {
    const supportedFiles = files.filter(
      (file) => file.type.startsWith("image/") || file.type.startsWith("audio/"),
    );
    const roomLeft = Math.max(0, 3 - composerAttachments.length);
    if (!roomLeft) return;

    supportedFiles.slice(0, roomLeft).forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = typeof reader.result === "string" ? reader.result : "";
        if (!result) return;
        const kind = file.type.startsWith("audio/") ? "audio" : "image";
        setComposerAttachments((prev) => [
          ...prev,
          {
            id: `${Date.now()}-${Math.random()}`,
            name: file.name,
            previewUrl: result,
            kind,
            mimeType: file.type,
          },
        ]);
      };
      reader.readAsDataURL(file);
    });
  };

  const handleRemoveComposerAttachment = (attachmentId: string) => {
    setComposerAttachments((prev) => prev.filter((attachment) => attachment.id !== attachmentId));
  };

  const handleShareLocationToComposer = () => {
    if (!navigator.geolocation) {
      if (!activeRequest?.location) return;
      setMessageDraft((prev) =>
        prev.trim()
          ? `${prev}\nLocation update: ${activeRequest.location}`
          : `Location update: ${activeRequest.location}`,
      );
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude.toFixed(6);
        const lng = position.coords.longitude.toFixed(6);
        const mapLink = `https://maps.google.com/?q=${lat},${lng}`;
        setMessageDraft((prev) =>
          prev.trim()
            ? `${prev}\nMy current location: ${mapLink}`
            : `My current location: ${mapLink}`,
        );
      },
      () => {
        toast({
          title: "Location unavailable",
          description: "Could not access your current location.",
          variant: "destructive",
        });
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const handleProviderComposerChange = useCallback(
    (nextValue: string) => {
      setMessageDraft(nextValue);
      if (!activeRequestId) return;

      if (!nextValue.trim()) {
        stopSelfTyping(activeRequestId);
        return;
      }

      if (!selfTypingRef.current) {
        selfTypingRef.current = true;
        emitTypingState(activeRequestId, true);
      }

      clearSelfTypingStopTimer();
      selfTypingStopTimerRef.current = window.setTimeout(() => {
        stopSelfTyping(activeRequestId);
      }, 1800);
    },
    [activeRequestId, clearSelfTypingStopTimer, emitTypingState, stopSelfTyping],
  );

  const handleSendComposerMessage = async () => {
    if (!activeRequestId) return;
    if (sendMessageMutation.isPending) return;

    const trimmed = messageDraft.trim();
    if (!trimmed && composerAttachments.length === 0) return;
    stopSelfTyping(activeRequestId);

    try {
      if (composerAttachments.length === 0) {
        await sendMessageMutation.mutateAsync({
          requestId: activeRequestId,
          message: trimmed,
        });
      } else {
        for (let index = 0; index < composerAttachments.length; index += 1) {
          const attachment = composerAttachments[index];
          const attachmentLabel =
            attachment.kind === "audio" ? "Shared a voice note." : "Shared an attachment.";
          const messageText = index === 0 && trimmed ? trimmed : attachmentLabel;

          await sendMessageMutation.mutateAsync({
            requestId: activeRequestId,
            message: messageText,
            attachmentUrl: attachment.previewUrl,
          });
        }
      }

      setMessageDraft("");
      setComposerAttachments([]);
    } catch {
      // mutation error toast handles feedback
    }
  };

  useEffect(() => {
    if (!activeRequestId) return;
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [activeRequestId, orderedMessages.length]);

  useEffect(() => {
    if (activeRequestId) return;
    stopSelfTyping(null);
    clearResidentTypingTimer();
    setIsResidentTyping(false);
  }, [activeRequestId, clearResidentTypingTimer, stopSelfTyping]);

  useEffect(() => {
    if (!activeRequestId) return;

    let cancelled = false;
    const syncTypingState = async () => {
      try {
        const response = await apiRequest("GET", `/api/service-requests/${activeRequestId}/typing`);
        const typingState = (await response.json()) as { resident?: boolean };
        if (cancelled) return;
        setIsResidentTyping(Boolean(typingState?.resident));
      } catch {
        if (!cancelled) {
          setIsResidentTyping(false);
        }
      }
    };

    void syncTypingState();
    const interval = window.setInterval(() => {
      void syncTypingState();
    }, 1500);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [activeRequestId]);

  useEffect(() => {
    return () => {
      stopSelfTyping(activeRequestId);
      clearResidentTypingTimer();
      setIsResidentTyping(false);
    };
  }, [activeRequestId, clearResidentTypingTimer, stopSelfTyping]);

  useEffect(() => {
    const socket = io();
    socketRef.current = socket;
    const joinIdentity = String(user?.id || activeRequest?.providerId || "").trim();
    if (joinIdentity) {
      socket.emit("join", joinIdentity);
    }

    socket.on("request-message:new", (payload: RequestMessageSocketPayload) => {
      if (!payload?.requestId || !payload?.message) return;
      queryClient.setQueryData<RequestMessage[]>(
        ["provider-chat-messages", payload.requestId],
        (prev = []) => {
          if (prev.some((item) => item.id === payload.message.id)) return prev;
          return [...prev, payload.message];
        },
      );
    });

    socket.on("service-request:updated", (payload: ServiceRequestUpdateSocketPayload) => {
      if (!payload?.requestId) return;
      queryClient.setQueryData<ServiceRequest[]>(["provider-chat-requests"], (prev = []) =>
        prev.map((request) =>
          request.id === payload.requestId
            ? {
                ...request,
                ...(payload.request || {}),
                id: request.id,
                updatedAt: payload.request?.updatedAt || payload.at || request.updatedAt,
              }
            : request,
        ),
      );
    });

    socket.on("request-typing", (payload: RequestTypingSocketPayload) => {
      if (!payload?.requestId) return;
      if (payload.userId === user?.id) return;
      if (payload.senderRole !== "resident") return;

      if (!payload.isTyping) {
        clearResidentTypingTimer();
        setIsResidentTyping(false);
        return;
      }

      setIsResidentTyping(true);
      clearResidentTypingTimer();
      residentTypingClearTimerRef.current = window.setTimeout(() => {
        setIsResidentTyping(false);
      }, 4500);
    });

    return () => {
      socketRef.current = null;
      clearResidentTypingTimer();
      socket.disconnect();
    };
  }, [activeRequest?.providerId, activeRequestId, clearResidentTypingTimer, queryClient, user?.id]);

  return (
    <ProviderShell title="Provider Chat">
      <div className="grid h-[calc(100vh-180px)] min-h-[620px] overflow-hidden rounded-[28px] border border-[#D0D5DD] bg-white lg:grid-cols-[320px,minmax(0,1fr)]">
        <div className="hidden h-full shrink-0 flex-col border-r border-[#EAECF0] bg-[#F9FAFB] px-4 py-5 text-[#101828] lg:flex">
          <div>
            <p className="text-[24px] font-semibold tracking-[-0.02em]">My Requests</p>
            <p className="mt-1 text-xs text-[#667085]">
              Open any request to chat with the resident.
            </p>
          </div>

          <div className="city-scrollbar mt-4 min-h-0 flex-1 space-y-3 overflow-y-auto pr-1.5">
            <p className="text-xs font-semibold uppercase tracking-[0.06em] text-[#667085]">Recents</p>
            {requestsError ? (
              <InlineErrorState
                title="Unable to load requests"
                description={requestsError instanceof Error ? requestsError.message : "Could not load assigned requests."}
              />
            ) : requestsLoading ? (
              <PageSkeleton withHeader={false} rows={2} />
            ) : requests.length === 0 ? (
              <EmptyState
                title="No assigned requests yet"
                description="Assigned resident conversations will appear here."
              />
            ) : (
              requests.map((request) => {
                const isActive = request.id === activeRequestId;
                const unreadCount = unreadByRequestId[request.id] || 0;
                return (
                  <button
                    key={request.id}
                    type="button"
                    onClick={() => void handleSelectRequest(request.id)}
                    className={cn(
                      "w-full rounded-xl border px-3.5 py-3 text-left transition-colors",
                      isActive
                        ? "border-[#D0D5DD] bg-white shadow-sm"
                        : "border-transparent bg-transparent hover:border-[#D0D5DD] hover:bg-white",
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="truncate text-[16px] font-semibold tracking-[-0.01em] text-[#101828]">
                        {formatLabel(resolveRequestCategoryLabel(request))}
                      </p>
                      {unreadCount > 0 ? (
                        <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[#F04438] px-1 text-[10px] font-semibold text-white">
                          {unreadCount > 9 ? "9+" : unreadCount}
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-2">
                      <p className="text-[12px] text-[#667085]">
                        {new Date(request.updatedAt || request.createdAt || Date.now()).toLocaleDateString(
                          undefined,
                          {
                            month: "short",
                            day: "numeric",
                          },
                        )}
                      </p>
                      <span
                        className={cn(
                          "inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.02em]",
                          statusTone(request.status),
                        )}
                      >
                        {formatServiceRequestStatusLabel(request.status, resolveRequestCategoryKey(request))}
                      </span>
                      {String(request.status || "").toLowerCase().replace(/[\s-]+/g, "_") === "in_progress" ? (
                        <span className="inline-flex items-center rounded-full border border-[#7DD3FC] bg-[#F0F9FF] px-2.5 py-0.5 text-[10px] font-semibold text-[#0369A1]">
                          Elapsed: {formatElapsedDuration(toDate(request.updatedAt) || toDate(request.assignedAt) || toDate(request.createdAt))}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 truncate text-[12px] text-[#667085]">
                      {request.location || "Location not set"}
                    </p>
                  </button>
                );
              })
            )}
          </div>
        </div>

        <div className="flex min-w-0 flex-1 flex-col overflow-hidden bg-white">
          <div className="border-b border-[#EAECF0] bg-white px-4 py-3 sm:px-5">
            <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[22px] font-semibold tracking-[-0.02em] text-[#101828]">Resident Conversation</p>
                <p className="text-[12px] text-[#667085]">
                  Coordinate updates, timelines, and attachments in real time.
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                {activeRequest ? (
                  canGenerateConsultancyReport ? (
                    <Button variant="outline" size="sm" onClick={handleOpenReportModal}>
                      {hasConsultancyReport ? "Update report" : "Generate report"}
                    </Button>
                  ) : (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="inline-flex rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2" tabIndex={0} aria-label={generateReportDisabledReason}>
                          <Button variant="outline" size="sm" disabled>
                            {hasConsultancyReport ? "Update report" : "Generate report"}
                          </Button>
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>{generateReportDisabledReason}</TooltipContent>
                    </Tooltip>
                  )
                ) : null}
                {activeRequest && activeRequestStatus === "assigned_for_job" ? (
                  <Button
                    size="sm"
                    onClick={() => updateJobStatusMutation.mutate({ requestId: activeRequest.id, status: "in_progress" })}
                    disabled={updateJobStatusMutation.isPending || markWorkCompletedMutation.isPending}
                  >
                    Start job
                  </Button>
                ) : null}
                {activeRequest && activeRequestStatus === "rework_required" ? (
                  <Button
                    size="sm"
                    onClick={() => updateJobStatusMutation.mutate({ requestId: activeRequest.id, status: "in_progress" })}
                    disabled={updateJobStatusMutation.isPending || markWorkCompletedMutation.isPending}
                  >
                    Resume rework
                  </Button>
                ) : null}
                {activeRequest && activeRequestStatus === "in_progress" ? (
                  <Button
                    size="sm"
                    onClick={() => markWorkCompletedMutation.mutate({ requestId: activeRequest.id })}
                    disabled={updateJobStatusMutation.isPending || markWorkCompletedMutation.isPending}
                  >
                    {markWorkCompletedMutation.isPending ? "Submitting..." : "Mark work done"}
                  </Button>
                ) : null}
                {activeRequest && activeRequestStatus === "work_completed_pending_resident" ? (
                  <Button size="sm" variant="outline" disabled>
                    Awaiting resident confirmation
                  </Button>
                ) : null}
                {activeRequest && activeRequestStatus === "disputed" ? (
                  <Button size="sm" variant="outline" disabled>
                    Awaiting admin review
                  </Button>
                ) : null}
                <span className="inline-flex items-center rounded-full border border-[#D1FADF] bg-[#ECFDF3] px-3 py-1 text-sm font-semibold text-[#027A48]">
                  {activeRequest
                    ? formatLabel(resolveRequestCategoryLabel(activeRequest))
                    : "No request selected"}
                </span>
                {activeRequest ? (
                  <Badge
                    className={cn(
                      "rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.02em]",
                      statusTone(activeRequest.status),
                    )}
                  >
                    {formatServiceRequestStatusLabel(
                      activeRequest.status,
                      resolveRequestCategoryKey(activeRequest),
                    )}
                  </Badge>
                ) : null}
                {activeRequestStatus === "in_progress" ? (
                  <span className="inline-flex items-center rounded-full border border-[#7DD3FC] bg-[#F0F9FF] px-3 py-1 text-[11px] font-semibold text-[#0369A1]">
                    In progress: {activeInProgressElapsedLabel}
                  </span>
                ) : null}
              </div>
            </div>

            <div className="mx-auto mt-2 flex w-full max-w-5xl gap-2 overflow-x-auto pb-1 lg:hidden">
              {requests.map((request) => {
                const isActive = request.id === activeRequestId;
                const unreadCount = unreadByRequestId[request.id] || 0;
                return (
                  <button
                    key={request.id}
                    type="button"
                    onClick={() => void handleSelectRequest(request.id)}
                    className={cn(
                      "inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm whitespace-nowrap",
                      isActive
                        ? "border-[#039855] bg-[#ECFDF3] text-[#027A48]"
                        : "border-[#D0D5DD] bg-white text-[#344054]",
                    )}
                  >
                    <span>{formatLabel(resolveRequestCategoryLabel(request))}</span>
                    {unreadCount > 0 ? (
                      <Badge className="bg-rose-500 text-white hover:bg-rose-500">
                        {unreadCount > 9 ? "9+" : unreadCount}
                      </Badge>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="city-scrollbar flex-1 min-h-0 overflow-y-auto bg-[#FCFCFD] px-4 py-4 sm:px-5">
            <div className="mx-auto w-full max-w-5xl space-y-4">
              {activeRequest && canGenerateConsultancyReport && !hasConsultancyReport ? (
                <div className="flex items-center justify-between rounded-xl border border-[#D0D5DD] bg-white px-3.5 py-2.5">
                  <div>
                    <p className="text-sm font-semibold text-[#101828]">Consultancy report</p>
                    <p className="text-xs text-[#667085]">
                      Generate and send your report before admin/company can request payment.
                    </p>
                  </div>
                  <Button variant="outline" size="sm" onClick={handleOpenReportModal}>
                    Generate report
                  </Button>
                </div>
              ) : null}

              {!activeRequest ? (
                <EmptyState
                  title="Select a request"
                  description="Choose a request from recents to open the conversation."
                />
              ) : messagesError ? (
                <InlineErrorState
                  description={messagesError instanceof Error ? messagesError.message : "Unable to load messages."}
                />
              ) : messagesLoading ? (
                <PageSkeleton withHeader={false} rows={2} />
              ) : conversationItems.length === 0 ? (
                <EmptyState
                  title="No messages yet"
                  description="Send the first update to the resident."
                />
              ) : (
                <ChatThread items={conversationItems} />
              )}
              {activeRequest && isResidentTyping ? (
                <TypingPresenceIndicator label="Resident is typing..." className="mt-2" />
              ) : null}
              <div ref={chatBottomRef} />
            </div>
          </div>

          {activeRequest ? (
            <MessageComposer
              label={`Reply to resident${activeRequest.location ? ` - ${activeRequest.location}` : ""}`}
              value={messageDraft}
              onChange={handleProviderComposerChange}
              onSend={handleSendComposerMessage}
              isSending={sendMessageMutation.isPending}
              attachments={composerAttachments}
              onAttachFiles={handleComposerAttachFiles}
              onRemoveAttachment={handleRemoveComposerAttachment}
              onShareLocation={handleShareLocationToComposer}
              variant="citybuddy"
            />
          ) : (
            <div className="border-t border-[#EAECF0] bg-white px-5 py-3">
              <div className="mx-auto w-full max-w-5xl rounded-xl border border-[#EAECF0] bg-[#F9FAFB] p-3">
                <p className="text-xs text-[#475467]">
                  Select a request from recents to start messaging the resident.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      <Dialog open={isReportModalOpen} onOpenChange={setIsReportModalOpen}>
        <DialogContent className="max-w-2xl overflow-hidden border border-[#D0D5DD] p-0 sm:max-w-3xl">
          <DialogHeader className="border-b border-[#EAECF0] bg-[#F8FAFC] px-4 py-4 sm:px-5">
            <DialogTitle className="text-[22px] font-semibold tracking-[-0.02em] text-[#101828]">
              Consultancy report
            </DialogTitle>
            <DialogDescription className="text-sm text-[#475467]">
              Submit your inspection analysis. Admin/company can request payment only after this report is sent.
            </DialogDescription>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
              <span className="rounded-full border border-[#D0D5DD] bg-white px-2.5 py-1 font-medium text-[#344054]">
                {formatLabel(resolveRequestCategoryLabel(activeRequest || undefined))}
              </span>
              <span className="rounded-full border border-[#D1FADF] bg-[#ECFDF3] px-2.5 py-1 font-medium text-[#027A48]">
                Evidence: {reportEvidence.length}/8
              </span>
            </div>
          </DialogHeader>

          <div className="city-scrollbar max-h-[58vh] space-y-3 overflow-y-auto px-4 py-4 sm:max-h-[62vh] sm:px-5">
            <div className="rounded-xl border border-[#EAECF0] bg-[#FCFCFD] p-3 sm:p-4">
              <p className="text-sm font-semibold text-[#101828]">Timeline</p>
              <div className="mt-2.5 grid gap-3 sm:grid-cols-2">
                <div>
                  <Label htmlFor="inspectionDate">Inspection date and time</Label>
                  <Input
                    id="inspectionDate"
                    type="datetime-local"
                    value={reportInspectionDate}
                    onChange={(event) => setReportInspectionDate(event.target.value)}
                    className="mt-1 bg-white"
                  />
                </div>
                <div>
                  <Label htmlFor="completionDeadline">Expected completion deadline</Label>
                  <Input
                    id="completionDeadline"
                    type="datetime-local"
                    value={reportCompletionDeadline}
                    onChange={(event) => setReportCompletionDeadline(event.target.value)}
                    className="mt-1 bg-white"
                  />
                </div>
              </div>
              {reportTimelineInvalid ? (
                <p className="mt-2 text-xs font-medium text-[#B42318]">
                  Completion deadline must be later than inspection date.
                </p>
              ) : null}
            </div>

            <div className="rounded-xl border border-[#EAECF0] bg-white p-3 sm:p-4">
              <p className="text-sm font-semibold text-[#101828]">Inspection findings</p>
              <div className="mt-2.5 grid gap-3 lg:grid-cols-2">
                <div>
                  <Label htmlFor="actualIssue">Actual issue</Label>
                  <Textarea
                    id="actualIssue"
                    value={reportActualIssue}
                    onChange={(event) => setReportActualIssue(event.target.value)}
                    placeholder="Describe the issue observed during inspection"
                    className="mt-1 min-h-[82px] bg-[#FCFCFD] sm:min-h-[92px]"
                  />
                </div>
                <div>
                  <Label htmlFor="causeOfIssue">Cause of issue</Label>
                  <Textarea
                    id="causeOfIssue"
                    value={reportCauseOfIssue}
                    onChange={(event) => setReportCauseOfIssue(event.target.value)}
                    placeholder="Explain what is causing the issue"
                    className="mt-1 min-h-[82px] bg-[#FCFCFD] sm:min-h-[92px]"
                  />
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-[#EAECF0] bg-white p-3 sm:p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-[#101828]">Cost recommendation</p>
                <span className="rounded-full border border-[#B2DDFF] bg-[#EFF8FF] px-2.5 py-1 text-xs font-semibold text-[#175CD3]">
                  Total: NGN {Number.isFinite(reportTotalCost) ? reportTotalCost.toLocaleString() : "0"}
                </span>
              </div>
              <div className="mt-2.5 grid gap-3 sm:grid-cols-2">
                <div>
                  <Label htmlFor="materialCost">Material cost (NGN)</Label>
                  <Input
                    id="materialCost"
                    type="number"
                    min="0"
                    step="0.01"
                    value={reportMaterialCost}
                    onChange={(event) => setReportMaterialCost(event.target.value)}
                    className="mt-1 bg-[#FCFCFD]"
                  />
                </div>
                <div>
                  <Label htmlFor="serviceCost">Average service cost (NGN)</Label>
                  <Input
                    id="serviceCost"
                    type="number"
                    min="0"
                    step="0.01"
                    value={reportServiceCost}
                    onChange={(event) => setReportServiceCost(event.target.value)}
                    className="mt-1 bg-[#FCFCFD]"
                  />
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-[#EAECF0] bg-white p-3 sm:p-4">
              <Label htmlFor="preventiveRecommendation" className="text-sm font-semibold text-[#101828]">
                Preventive recommendation
              </Label>
              <Textarea
                id="preventiveRecommendation"
                value={reportPreventiveRecommendation}
                onChange={(event) => setReportPreventiveRecommendation(event.target.value)}
                placeholder="Tell the resident how to prevent recurrence"
                className="mt-2 min-h-[82px] bg-[#FCFCFD] sm:min-h-[92px]"
              />
            </div>

            <div className="rounded-xl border border-[#EAECF0] bg-white p-3 sm:p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Label htmlFor="reportEvidenceUpload" className="text-sm font-semibold text-[#101828]">
                  Evidence upload
                </Label>
                <span className="text-xs text-[#667085]">Up to 8 images</span>
              </div>
              <Input
                id="reportEvidenceUpload"
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(event) => {
                  const files = Array.from(event.target.files || []);
                  if (files.length) handleAttachReportEvidence(files);
                  event.currentTarget.value = "";
                }}
              />
              <label
                htmlFor="reportEvidenceUpload"
                className="mt-2 flex cursor-pointer items-center justify-center rounded-lg border border-dashed border-[#98A2B3] bg-[#F9FAFB] px-4 py-4 text-sm font-medium text-[#475467] transition-colors hover:border-[#12B76A] hover:bg-[#ECFDF3]"
              >
                Click to upload evidence images
              </label>
              {reportEvidence.length > 0 ? (
                <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                  {reportEvidence.map((evidence) => (
                    <div
                      key={evidence.id}
                      className="overflow-hidden rounded-md border border-[#D0D5DD] bg-[#F9FAFB]"
                    >
                      <img
                        src={evidence.previewUrl}
                        alt={evidence.name}
                        className="h-16 w-full object-cover sm:h-20"
                      />
                      <button
                        type="button"
                        className="w-full border-t border-[#D0D5DD] px-2 py-1 text-xs font-medium text-[#344054] hover:bg-[#EAECF0]"
                        onClick={() => handleRemoveReportEvidence(evidence.id)}
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-xs text-[#667085]">
                  Add clear photos of the issue, affected area, or completed inspection findings.
                </p>
              )}
            </div>
          </div>

          <DialogFooter className="flex-wrap gap-2 border-t border-[#EAECF0] bg-white px-4 py-3 sm:px-5">
            <div className="mr-auto text-xs text-[#667085]">
              {isReportFormReady ? "Report is ready to send." : "Complete required fields to send this report."}
            </div>
            <Button variant="outline" onClick={() => setIsReportModalOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSendConsultancyReport}
              disabled={submitConsultancyReportMutation.isPending || !isReportFormReady}
            >
              {submitConsultancyReportMutation.isPending ? "Sending..." : "Send report"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ProviderShell>
  );
}
