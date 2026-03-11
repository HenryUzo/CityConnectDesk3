import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { io } from "socket.io-client";
import { ProviderLayout } from "@/components/admin/ProviderLayout";
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
import { useToast } from "@/hooks/use-toast";
import { useNotifications } from "@/contexts/NotificationsContext";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import { formatServiceRequestStatusLabel } from "@/lib/serviceRequestStatus";
import { cn } from "@/lib/utils";

interface ServiceRequest {
  id: string;
  title?: string;
  description?: string;
  category?: string;
  location?: string;
  urgency?: string;
  status: string;
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
  consultancyReportSubmittedAt?: string | null;
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

function formatLabel(value: string) {
  if (!value) return "New request";
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function statusTone(status: string) {
  const key = String(status || "").toLowerCase().replace(/[\s-]+/g, "_");
  const map: Record<string, string> = {
    draft: "border-slate-300 bg-slate-100 text-slate-700",
    assigned: "border-violet-300 bg-violet-100 text-violet-700",
    assigned_for_job: "border-indigo-300 bg-indigo-100 text-indigo-700",
    in_progress: "border-sky-300 bg-sky-100 text-sky-700",
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
  return {
    inspectionDate: inspectionDateRaw ? new Date(inspectionDateRaw).toLocaleString() : undefined,
    actualIssue: String((report as any).actualIssue || "Not provided"),
    causeOfIssue: String((report as any).causeOfIssue || "Not provided"),
    materialCostLabel: Number.isFinite(materialCost)
      ? `NGN ${materialCost.toLocaleString()}`
      : "Not provided",
    serviceCostLabel: Number.isFinite(serviceCost)
      ? `NGN ${serviceCost.toLocaleString()}`
      : "Not provided",
    preventiveRecommendation: String((report as any).preventiveRecommendation || "Not provided"),
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

  return {
    inspectionDate: inspectionDate || undefined,
    actualIssue: issue,
    causeOfIssue: cause,
    materialCostLabel: materialCost,
    serviceCostLabel: serviceCost,
    preventiveRecommendation: prevention,
  };
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
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [reportInspectionDate, setReportInspectionDate] = useState("");
  const [reportActualIssue, setReportActualIssue] = useState("");
  const [reportCauseOfIssue, setReportCauseOfIssue] = useState("");
  const [reportMaterialCost, setReportMaterialCost] = useState("");
  const [reportServiceCost, setReportServiceCost] = useState("");
  const [reportPreventiveRecommendation, setReportPreventiveRecommendation] = useState("");

  const requestIdFromQuery = useMemo(() => {
    const queryString = location.includes("?") ? location.split("?")[1] : "";
    return new URLSearchParams(queryString).get("requestId") || "";
  }, [location]);

  const { data: requests = [], isLoading: requestsLoading } = useQuery<ServiceRequest[]>({
    queryKey: ["provider-chat-requests"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/service-requests");
      const data = (await res.json()) as ServiceRequest[];
      return Array.isArray(data)
        ? data.filter((request) =>
            ["assigned", "assigned_for_job", "in_progress", "pending", "pending_inspection", "completed"].includes(
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
    if (["assigned_for_job", "in_progress", "completed", "cancelled"].includes(normalizedStatus)) {
      return "Consultancy report can only be generated during inspection (Pending inspection / Assigned for inspection).";
    }

    return "This request is not in an inspection stage yet.";
  }, [activeRequest, canGenerateConsultancyReport]);

  const { data: requestMessages = [], isLoading: messagesLoading } = useQuery<RequestMessage[]>({
    queryKey: ["provider-chat-messages", activeRequestId],
    enabled: Boolean(activeRequestId),
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
                `Actual issue: ${requestReport.actualIssue}`,
                `Cause of issue: ${requestReport.causeOfIssue}`,
                `Material cost: ${requestReport.materialCostLabel}`,
                `Service cost: ${requestReport.serviceCostLabel}`,
                `Preventive recommendation: ${requestReport.preventiveRecommendation}`,
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
            inspectionDate: consultancyReport.inspectionDate,
            actualIssue: consultancyReport.actualIssue,
            causeOfIssue: consultancyReport.causeOfIssue,
            materialCostLabel: consultancyReport.materialCostLabel,
            serviceCostLabel: consultancyReport.serviceCostLabel,
            preventiveRecommendation: consultancyReport.preventiveRecommendation,
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
          actualIssue: requestReport.actualIssue,
          causeOfIssue: requestReport.causeOfIssue,
          materialCostLabel: requestReport.materialCostLabel,
          serviceCostLabel: requestReport.serviceCostLabel,
          preventiveRecommendation: requestReport.preventiveRecommendation,
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

  const submitConsultancyReportMutation = useMutation({
    mutationFn: async (payload: {
      requestId: string;
      inspectionDate: string;
      actualIssue: string;
      causeOfIssue: string;
      materialCost: number;
      serviceCost: number;
      preventiveRecommendation: string;
    }) => {
      const res = await apiRequest(
        "POST",
        `/api/provider/service-requests/${payload.requestId}/consultancy-report`,
        {
          inspectionDate: payload.inspectionDate,
          actualIssue: payload.actualIssue,
          causeOfIssue: payload.causeOfIssue,
          materialCost: payload.materialCost,
          serviceCost: payload.serviceCost,
          preventiveRecommendation: payload.preventiveRecommendation,
        },
      );
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["provider-chat-requests"] });
      if (activeRequestId) {
        queryClient.invalidateQueries({ queryKey: ["provider-chat-messages", activeRequestId] });
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
    setReportActualIssue(report?.actualIssue || "");
    setReportCauseOfIssue(report?.causeOfIssue || "");
    setReportMaterialCost(report?.materialCost ? String(report.materialCost) : "");
    setReportServiceCost(report?.serviceCost ? String(report.serviceCost) : "");
    setReportPreventiveRecommendation(report?.preventiveRecommendation || "");
    setIsReportModalOpen(true);
  };

  const handleSendConsultancyReport = async () => {
    if (!activeRequestId) return;
    const materialCost = Number(reportMaterialCost);
    const serviceCost = Number(reportServiceCost);
    if (
      !reportInspectionDate ||
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
      actualIssue: reportActualIssue.trim(),
      causeOfIssue: reportCauseOfIssue.trim(),
      materialCost,
      serviceCost,
      preventiveRecommendation: reportPreventiveRecommendation.trim(),
    });
  };

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

  const handleSendComposerMessage = async () => {
    if (!activeRequestId) return;
    if (sendMessageMutation.isPending) return;

    const trimmed = messageDraft.trim();
    if (!trimmed && composerAttachments.length === 0) return;

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
    if (!user?.id) return;
    const socket = io();
    socket.emit("join", user.id);

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

    return () => {
      socket.disconnect();
    };
  }, [queryClient, user?.id]);

  return (
    <ProviderLayout title="Provider Chat">
      <div className="flex h-[calc(100vh-180px)] min-h-[620px] overflow-hidden rounded-[32px] border border-[#D0D5DD] bg-[#F8FAFC]">
        <div className="hidden h-full w-[332px] shrink-0 flex-col border-r border-[#0C7A57] bg-[#065F46] px-5 py-6 text-white lg:flex">
          <div>
            <p className="text-[28px] font-semibold tracking-[-0.02em]">My Requests</p>
            <p className="mt-1 text-xs text-emerald-100/90">
              Open any request to chat with the resident.
            </p>
          </div>

          <div className="city-scrollbar mt-4 min-h-0 flex-1 space-y-3 overflow-y-auto pr-1.5">
            <p className="text-sm font-semibold uppercase tracking-[0.06em] text-emerald-100/85">Recents</p>
            {requestsLoading ? (
              <p className="text-sm text-emerald-100/80">Loading requests...</p>
            ) : requests.length === 0 ? (
              <p className="text-sm text-emerald-100/80">No assigned requests yet.</p>
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
                      "w-full rounded-2xl border px-4 py-3.5 text-left transition-all",
                      isActive
                        ? "border-[#73E2BA]/70 bg-[#0C7355] shadow-[0_14px_24px_-20px_rgba(94,233,178,0.95)]"
                        : "border-transparent bg-[#0A6A4E]/60 hover:border-[#29A874]/45 hover:bg-[#0D7557]",
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="truncate text-[18px] font-semibold tracking-[-0.01em] text-white">
                        {formatLabel(request.category || request.title || "Service Request")}
                      </p>
                      {unreadCount > 0 ? (
                        <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[#F04438] px-1 text-[10px] font-semibold text-white">
                          {unreadCount > 9 ? "9+" : unreadCount}
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-2">
                      <p className="text-[13px] text-emerald-100/90">
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
                        {formatServiceRequestStatusLabel(request.status, request.category || request.title)}
                      </span>
                    </div>
                    <p className="mt-1 truncate text-[13px] text-emerald-100/85">
                      {request.location || "Location not set"}
                    </p>
                  </button>
                );
              })
            )}
          </div>
        </div>

        <div className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-r-[32px] bg-white">
          <div className="border-b border-[#EAECF0] bg-white px-5 py-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[24px] font-semibold tracking-[-0.02em] text-[#101828]">Resident Conversation</p>
                <p className="text-[12px] text-[#98A2B3]">
                  Coordinate updates, timelines, and attachments in real time.
                </p>
              </div>
              <div className="flex items-center gap-2">
                {activeRequest ? (
                  canGenerateConsultancyReport ? (
                    <Button variant="outline" size="sm" onClick={handleOpenReportModal}>
                      {hasConsultancyReport ? "Update report" : "Generate report"}
                    </Button>
                  ) : (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="inline-flex">
                          <Button variant="outline" size="sm" disabled>
                            {hasConsultancyReport ? "Update report" : "Generate report"}
                          </Button>
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>{generateReportDisabledReason}</TooltipContent>
                    </Tooltip>
                  )
                ) : null}
                <span className="inline-flex items-center rounded-full border border-[#D1FADF] bg-[#ECFDF3] px-3 py-1 text-sm font-semibold text-[#027A48]">
                  {activeRequest
                    ? formatLabel(activeRequest.category || activeRequest.title || "Service request")
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
                      activeRequest.category || activeRequest.title,
                    )}
                  </Badge>
                ) : null}
              </div>
            </div>

            <div className="mt-2 flex lg:hidden gap-2 overflow-x-auto pb-1">
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
                    <span>{formatLabel(request.category || request.title || "Request")}</span>
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

          <div className="city-scrollbar flex-1 min-h-0 overflow-y-auto bg-[#F8FAFC] px-5 py-4">
            <div className="mx-auto w-full max-w-5xl space-y-4">
              {activeRequest && canGenerateConsultancyReport ? (
                <div className="flex items-center justify-between rounded-2xl border border-[#D0D5DD] bg-white px-4 py-3">
                  <div>
                    <p className="text-sm font-semibold text-[#101828]">Consultancy report</p>
                    <p className="text-xs text-[#667085]">
                      {hasConsultancyReport
                        ? "Report submitted. Update it if your inspection findings changed."
                        : "Generate and send report to unlock payment request for admin/company."}
                    </p>
                  </div>
                  {canGenerateConsultancyReport ? (
                    <Button variant="outline" size="sm" onClick={handleOpenReportModal}>
                      {hasConsultancyReport ? "Update report" : "Generate report"}
                    </Button>
                  ) : (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="inline-flex">
                          <Button variant="outline" size="sm" disabled>
                            {hasConsultancyReport ? "Update report" : "Generate report"}
                          </Button>
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>{generateReportDisabledReason}</TooltipContent>
                    </Tooltip>
                  )}
                </div>
              ) : null}

              {!activeRequest ? (
                <div className="rounded-2xl border border-[#EAECF0] bg-white px-4 py-6 text-center text-sm text-[#667085]">
                  Select a request to open the conversation.
                </div>
              ) : messagesLoading ? (
                <div className="rounded-2xl border border-[#EAECF0] bg-white px-4 py-6 text-center text-sm text-[#667085]">
                  Loading messages...
                </div>
              ) : conversationItems.length === 0 ? (
                <div className="rounded-2xl border border-[#EAECF0] bg-white px-4 py-6 text-center text-sm text-[#667085]">
                  No messages yet. Send the first update to the resident.
                </div>
              ) : (
                <ChatThread items={conversationItems} />
              )}
              <div ref={chatBottomRef} />
            </div>
          </div>

          {activeRequest ? (
            <MessageComposer
              label={`Reply to resident${activeRequest.location ? ` · ${activeRequest.location}` : ""}`}
              value={messageDraft}
              onChange={setMessageDraft}
              onSend={handleSendComposerMessage}
              isSending={sendMessageMutation.isPending}
              attachments={composerAttachments}
              onAttachFiles={handleComposerAttachFiles}
              onRemoveAttachment={handleRemoveComposerAttachment}
              onShareLocation={handleShareLocationToComposer}
            />
          ) : (
            <div className="border-t border-[#EAECF0] bg-white px-5 py-3">
              <div className="mx-auto max-w-5xl rounded-xl border border-[#EAECF0] bg-[#F9FAFB] p-3">
                <p className="text-xs text-[#475467]">
                  Select a request from recents to start messaging the resident.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      <Dialog open={isReportModalOpen} onOpenChange={setIsReportModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Consultancy report</DialogTitle>
            <DialogDescription>
              Submit your inspection analysis. Admin/company can request payment only after this report is sent.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4">
            <div>
              <Label htmlFor="inspectionDate">Inspection date and time</Label>
              <Input
                id="inspectionDate"
                type="datetime-local"
                value={reportInspectionDate}
                onChange={(event) => setReportInspectionDate(event.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="actualIssue">Actual issue</Label>
              <Textarea
                id="actualIssue"
                value={reportActualIssue}
                onChange={(event) => setReportActualIssue(event.target.value)}
                placeholder="Describe the issue observed during inspection"
              />
            </div>
            <div>
              <Label htmlFor="causeOfIssue">Cause of issue</Label>
              <Textarea
                id="causeOfIssue"
                value={reportCauseOfIssue}
                onChange={(event) => setReportCauseOfIssue(event.target.value)}
                placeholder="Explain what is causing the issue"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="materialCost">Material cost (NGN)</Label>
                <Input
                  id="materialCost"
                  type="number"
                  min="0"
                  step="0.01"
                  value={reportMaterialCost}
                  onChange={(event) => setReportMaterialCost(event.target.value)}
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
                />
              </div>
            </div>
            <div>
              <Label htmlFor="preventiveRecommendation">Preventive recommendation</Label>
              <Textarea
                id="preventiveRecommendation"
                value={reportPreventiveRecommendation}
                onChange={(event) => setReportPreventiveRecommendation(event.target.value)}
                placeholder="Tell the resident how to prevent recurrence"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsReportModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSendConsultancyReport} disabled={submitConsultancyReportMutation.isPending}>
              {submitConsultancyReportMutation.isPending ? "Sending..." : "Send report"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ProviderLayout>
  );
}
