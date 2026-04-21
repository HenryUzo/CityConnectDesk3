import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Coins,
  Droplets,
  Flower2,
  Home,
  Lock,
  Package,
  Paintbrush,
  Plus,
  Shirt,
  Truck,
  Wrench,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useNotifications } from "@/contexts/NotificationsContext";
import { useAuth } from "@/hooks/use-auth";
import { RequestCard } from "@/components/resident/ordinary-flow/RequestCard";
import { formatServiceRequestStatusLabel } from "@/lib/serviceRequestStatus";
import { apiRequest } from "@/lib/queryClient";

interface RequestsSidebarProps {
  onCreateNew?: () => void;
  sessions?: Array<{
    id: string;
    title?: string;
    category?: string;
    updatedAt: string;
    snippet?: string;
    location?: string;
    status?: string;
  }>;
  draftSessions?: Array<{
    id: string;
    title?: string;
    category?: string;
    updatedAt: string;
    snippet?: string;
    location?: string;
    status?: string;
  }>;
  activeSessionId?: string | null;
  onSelectSession?: (id: string) => void;
  loadingSessionId?: string | null;
}

type RequestSession = {
  id: string;
  title: string;
  category?: string;
  categoryLabel?: string;
  status: string;
  location?: string;
  updatedAt?: string;
  snippet?: string;
  isDraft?: boolean;
  cancellationCase?: {
    id?: string;
    status?: string;
    reasonCode?: string;
    createdAt?: string;
    updatedAt?: string;
  } | null;
};

const CANCELLATION_REVIEW_REQUIRED_STATUSES = new Set([
  "assigned",
  "assigned_for_inspection",
  "assigned_for_job",
  "in_progress",
  "work_completed_pending_resident",
  "disputed",
  "rework_required",
  "completed",
]);

const statusToneByKey: Record<string, string> = {
  draft: "border-slate-300/80 bg-slate-100 text-slate-700",
  assigned: "border-violet-300/70 bg-violet-100 text-violet-700",
  assigned_for_job: "border-indigo-300/70 bg-indigo-100 text-indigo-700",
  in_progress: "border-sky-300/70 bg-sky-100 text-sky-700",
  work_completed_pending_resident: "border-cyan-300/70 bg-cyan-100 text-cyan-700",
  rework_required: "border-amber-300/70 bg-amber-100 text-amber-700",
  disputed: "border-rose-300/70 bg-rose-100 text-rose-700",
  pending_inspection: "border-amber-300/70 bg-amber-100 text-amber-700",
  cancellation_under_review: "border-fuchsia-300/70 bg-fuchsia-100 text-fuchsia-700",
  completed: "border-emerald-300/70 bg-emerald-100 text-emerald-700",
  cancelled: "border-rose-300/70 bg-rose-100 text-rose-700",
  pending: "border-slate-300/80 bg-slate-100 text-slate-700",
};

const iconByCategoryKey: Array<{ key: RegExp; icon: typeof Wrench }> = [
  { key: /(repair|maint|plumb|elect|hvac|fix)/i, icon: Wrench },
  { key: /(garden|landscape|lawn|flower)/i, icon: Flower2 },
  { key: /(logistics|delivery|transport)/i, icon: Truck },
  { key: /(laundry|clean)/i, icon: Shirt },
  { key: /(paint)/i, icon: Paintbrush },
  { key: /(water|drain)/i, icon: Droplets },
  { key: /(packag|moving)/i, icon: Package },
];

export function RequestsSidebar({
  onCreateNew,
  sessions,
  draftSessions = [],
  activeSessionId,
  onSelectSession,
  loadingSessionId,
}: RequestsSidebarProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const { notifications, markRead } = useNotifications();
  const queryClient = useQueryClient();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [recentsTab, setRecentsTab] = useState<"active" | "archived">("active");
  const [cancelTarget, setCancelTarget] = useState<RequestSession | null>(null);
  const [cancelReasonCode, setCancelReasonCode] = useState("");
  const [cancelReasonDetail, setCancelReasonDetail] = useState("");
  const [cancelPreferredResolution, setCancelPreferredResolution] = useState<
    "full_refund" | "partial_refund" | "cancel_without_refund"
  >("full_refund");

  const formatLabel = (value: string) => {
    if (!value) return "New request";
    return value
      .replace(/[_-]+/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/\b\w/g, (c) => c.toUpperCase());
  };

  const normalizeStatus = (value?: string) => {
    if (!value) return "draft";
    return value.toLowerCase().replace(/[\s-]+/g, "_").trim();
  };

  const getStatusTone = (status?: string) => statusToneByKey[normalizeStatus(status)] || statusToneByKey.draft;

  const getServiceIcon = (value?: string) => {
    const source = String(value || "");
    const matched = iconByCategoryKey.find((entry) => entry.key.test(source));
    return matched?.icon || Home;
  };

  const { data: wallet } = useQuery({
    queryKey: ["wallet"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/app/wallet");
      return res.json();
    },
  });

  const { data: recentRequests = [] } = useQuery({
    queryKey: ["my-recent-requests"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/app/service-requests/mine");
      return res.json();
    },
    enabled: !sessions,
    refetchInterval: 15000,
  });

  const coins = wallet?.coins ?? 0;
  const canCreateRequest = coins >= 100;
  const archivedStorageKey = useMemo(
    () => `resident_archived_request_ids_v1:${user?.id || user?.email || "anonymous"}`,
    [user?.email, user?.id],
  );

  const [archivedRequestIds, setArchivedRequestIds] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(archivedStorageKey);
      const parsed = raw ? (JSON.parse(raw) as unknown) : [];
      if (!Array.isArray(parsed)) return [];
      return parsed
        .map((value) => String(value || "").trim())
        .filter(Boolean);
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      const raw = localStorage.getItem(archivedStorageKey);
      const parsed = raw ? (JSON.parse(raw) as unknown) : [];
      if (!Array.isArray(parsed)) {
        setArchivedRequestIds([]);
        return;
      }
      const next = parsed
        .map((value) => String(value || "").trim())
        .filter(Boolean);
      setArchivedRequestIds(next);
    } catch {
      setArchivedRequestIds([]);
    }
  }, [archivedStorageKey]);

  const persistArchivedRequestIds = (nextIds: string[]) => {
    try {
      localStorage.setItem(archivedStorageKey, JSON.stringify(nextIds));
    } catch {
      // ignore storage errors
    }
  };

  const archiveRequest = (id: string) => {
    setArchivedRequestIds((prev) => {
      if (prev.includes(id)) return prev;
      const next = [id, ...prev];
      persistArchivedRequestIds(next);
      return next;
    });
  };

  const handleCreateNew = () => {
    if (!canCreateRequest) {
      toast({
        title: "Insufficient Coins",
        description: "You need at least 100 coins to create a service request. Subscribe to get more coins.",
        variant: "destructive",
      });
      return;
    }
    onCreateNew?.();
  };

  const handleDeleteRequest = async (request: RequestSession) => {
    const id = String(request.id || "").trim();
    if (!id || id.startsWith("draft")) return;

    const statusKey = normalizeStatus(request.status);
    const cancellationStatus = normalizeStatus(request.cancellationCase?.status);
    const hasOpenCancellationReview = ["requested", "under_review"].includes(cancellationStatus);
    if (CANCELLATION_REVIEW_REQUIRED_STATUSES.has(statusKey)) {
      if (hasOpenCancellationReview) {
        toast({
          title: "Already under review",
          description: "This cancellation request is already being reviewed by admin.",
        });
        return;
      }
      setCancelTarget(request);
      return;
    }

    try {
      setDeletingId(id);
      archiveRequest(id);
      queryClient.invalidateQueries({ queryKey: ["my-recent-requests"] });
      toast({ title: "Archived", description: "Conversation moved to archived." });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Could not archive conversation";
      toast({
        title: "Archive failed",
        description: message,
        variant: "destructive",
      });
    } finally {
      setDeletingId(null);
    }
  };

  const handleSubmitCancellationReview = async () => {
    if (!cancelTarget?.id) return;
    const reasonCode = cancelReasonCode.trim();
    const reasonDetail = cancelReasonDetail.trim();
    if (!reasonCode) {
      toast({
        title: "Reason category required",
        description: "Select a reason category before submitting.",
        variant: "destructive",
      });
      return;
    }
    if (reasonDetail.length < 10) {
      toast({
        title: "Add more detail",
        description: "Please explain why cancellation is required.",
        variant: "destructive",
      });
      return;
    }

    try {
      setDeletingId(cancelTarget.id);
      await apiRequest("POST", `/api/service-requests/${cancelTarget.id}/cancellation-cases`, {
        reasonCode,
        reasonDetail,
        preferredResolution: cancelPreferredResolution,
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["my-recent-requests"] }),
        queryClient.invalidateQueries({ queryKey: ["resident-active-request", cancelTarget.id] }),
        queryClient.invalidateQueries({ queryKey: ["admin.bridge.service-requests"] }),
      ]);
      toast({
        title: "Cancellation request submitted",
        description: "Admin will review your reason and update you.",
      });
      setCancelTarget(null);
      setCancelReasonCode("");
      setCancelReasonDetail("");
      setCancelPreferredResolution("full_refund");
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Could not submit cancellation request";
      toast({
        title: "Submission failed",
        description: message,
        variant: "destructive",
      });
    } finally {
      setDeletingId(null);
    }
  };

  const mergedRecents = useMemo(() => {
    const map = new Map<string, RequestSession>();

    const toSession = (raw: any, isDraft = false): RequestSession | null => {
      if (!raw) return null;
      const id = String(raw.id || "");
      if (!id) return null;
      const status = isDraft ? "draft" : String(raw.status || "draft");
      const categoryKey = raw.category ? String(raw.category) : undefined;
      const categoryLabel = raw.categoryLabel ? String(raw.categoryLabel) : undefined;
      return {
        id,
        title: formatLabel(raw.title || categoryLabel || categoryKey || "New request"),
        category: categoryKey,
        categoryLabel,
        status,
        location: raw.location || raw.snippet || undefined,
        snippet: raw.snippet || raw.description || undefined,
        updatedAt: raw.updatedAt || raw.createdAt,
        isDraft,
        cancellationCase:
          raw.cancellationCase && typeof raw.cancellationCase === "object"
            ? (raw.cancellationCase as RequestSession["cancellationCase"])
            : null,
      };
    };

    const add = (raw: any, isDraft = false) => {
      const session = toSession(raw, isDraft);
      if (!session) return;
      const existing = map.get(session.id);
      if (!existing) {
        map.set(session.id, session);
        return;
      }

      const existingTime = new Date(existing.updatedAt || 0).getTime();
      const nextTime = new Date(session.updatedAt || 0).getTime();
      if (nextTime >= existingTime) map.set(session.id, { ...existing, ...session });
    };

    draftSessions.forEach((draft) => add(draft, true));
    if (sessions?.length) {
      sessions.forEach((session) => add(session));
    } else {
      (recentRequests as any[]).forEach((request) => add(request));
    }

    return Array.from(map.values()).sort((a, b) => {
      const left = new Date(a.updatedAt || 0).getTime();
      const right = new Date(b.updatedAt || 0).getTime();
      return right - left;
    });
  }, [draftSessions, recentRequests, sessions]);

  const archivedIdSet = useMemo(() => new Set(archivedRequestIds), [archivedRequestIds]);
  const activeRecents = useMemo(
    () =>
      mergedRecents.filter((request) => request.isDraft || !archivedIdSet.has(String(request.id || ""))),
    [archivedIdSet, mergedRecents],
  );
  const archivedRecents = useMemo(
    () =>
      mergedRecents.filter((request) => !request.isDraft && archivedIdSet.has(String(request.id || ""))),
    [archivedIdSet, mergedRecents],
  );
  const visibleRecents = recentsTab === "archived" ? archivedRecents : activeRecents;

  const unreadByRequestId = useMemo(() => {
    const map: Record<string, number> = {};

    for (const notification of notifications) {
      if (notification.isRead) continue;
      const meta = notification.metadata as Record<string, unknown> | null;
      const requestId = typeof meta?.requestId === "string" ? meta.requestId : "";
      const kind = typeof meta?.kind === "string" ? meta.kind : "";
      const senderRole = typeof meta?.senderRole === "string" ? meta.senderRole : "";

      if (!requestId || kind !== "request_message" || senderRole !== "provider") continue;
      map[requestId] = (map[requestId] || 0) + 1;
    }

    return map;
  }, [notifications]);

  const markRequestUnreadAsRead = async (requestId: string) => {
    if (!requestId) return;

    const unread = notifications.filter((notification) => {
      if (notification.isRead) return false;
      const meta = notification.metadata as Record<string, unknown> | null;
      return (
        meta?.kind === "request_message" &&
        meta?.requestId === requestId &&
        meta?.senderRole === "provider"
      );
    });

    try {
      await Promise.all(unread.map((notification) => markRead(notification.id)));
    } catch {
      // Ignore notification mark-read failures so chat selection still proceeds.
    }
  };

  const handleSelectRequest = async (requestId: string) => {
    try {
      await markRequestUnreadAsRead(requestId);
    } finally {
      onSelectSession?.(requestId);
    }
  };

  return (
    <>
      <div className="h-full w-full rounded-[32px] border border-[#0C7A57] bg-[#065F46] px-5 py-6 text-white shadow-[0_16px_36px_-24px_rgba(0,0,0,0.8)]">
        <div className="flex h-full flex-col gap-5 overflow-hidden">
      <div className="flex items-center justify-between">
        <p className="text-[28px] font-semibold leading-none tracking-[-0.02em]">My Requests</p>
      </div>

      <div className="space-y-2">
        <Button
          onClick={handleCreateNew}
          disabled={!canCreateRequest}
          className="h-12 w-full rounded-xl bg-[#12B76A] text-base font-semibold text-white hover:bg-[#0EA561]"
        >
          {canCreateRequest ? (
            <>
              <Plus className="w-4 h-4 mr-2" />
              Create new request
            </>
          ) : (
            <>
              <Lock className="w-4 h-4 mr-2" />
              Create new request
            </>
          )}
        </Button>
        {!canCreateRequest && (
          <p className="text-center text-xs text-emerald-100/90">Subscribe to get more coins</p>
        )}
      </div>

      <div className="city-scrollbar min-h-0 flex-1 space-y-3 overflow-y-auto pr-1.5">
        <h3 className="text-sm font-semibold uppercase tracking-[0.06em] text-emerald-100/85">Recents</h3>
        <div className="inline-flex rounded-full border border-emerald-200/25 bg-emerald-900/25 p-1">
          <button
            type="button"
            onClick={() => setRecentsTab("active")}
            className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
              recentsTab === "active"
                ? "bg-white text-emerald-700"
                : "text-emerald-100/85 hover:text-white"
            }`}
          >
            Active ({activeRecents.length})
          </button>
          <button
            type="button"
            onClick={() => setRecentsTab("archived")}
            className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
              recentsTab === "archived"
                ? "bg-white text-emerald-700"
                : "text-emerald-100/85 hover:text-white"
            }`}
          >
            Archived ({archivedRecents.length})
          </button>
        </div>
        {visibleRecents.length === 0 ? (
          <p className="text-sm text-emerald-100/80">
            {recentsTab === "archived" ? "No archived conversations" : "No recent requests"}
          </p>
        ) : (
          visibleRecents.map((request) => {
            const isActive = request.id === activeSessionId;
            const busy = loadingSessionId === request.id || deletingId === request.id;
            const isDraft = Boolean(request.isDraft || request.id.startsWith("draft"));
            const unreadCount = !isDraft ? unreadByRequestId[request.id] || 0 : 0;
            const ServiceIcon = getServiceIcon(request.categoryLabel || request.category || request.title);
            const cancellationStatus = normalizeStatus(request.cancellationCase?.status);
            const hasOpenCancellationReview = ["requested", "under_review"].includes(cancellationStatus);

            return (
              <RequestCard
                key={request.id}
                title={request.title}
                location={request.location || request.snippet || "Location not set"}
                updatedAt={request.updatedAt || ""}
                statusLabel={
                  isDraft
                    ? "Draft"
                    : hasOpenCancellationReview
                      ? "Cancellation under review"
                      : formatServiceRequestStatusLabel(
                          request.status,
                          request.category || request.categoryLabel || request.title,
                        )
                }
                statusToneClassName={
                  hasOpenCancellationReview
                    ? getStatusTone("cancellation_under_review")
                    : getStatusTone(request.status)
                }
                icon={ServiceIcon}
                isActive={isActive}
                isBusy={busy}
                isDraft={isDraft}
                unreadCount={unreadCount}
                onOpen={() => handleSelectRequest(request.id)}
                onDelete={
                  !isDraft && recentsTab === "active"
                    ? () => handleDeleteRequest(request)
                    : undefined
                }
              />
            );
          })
        )}
      </div>

      <div className="rounded-xl border border-[#1B9E74]/45 bg-[#0A6A4E]/50 px-3 py-2">
        <div className="flex items-center gap-2 text-emerald-100/90">
          <Coins className="h-3.5 w-3.5 text-emerald-200/80" />
          <p className="text-[11px]">
            <span className="font-semibold text-white">{coins} city coins</span> available
          </p>
        </div>
        <p className="mt-1 text-[10px] text-emerald-100/65">Subscribe to refill coins</p>
      </div>
        </div>
      </div>
      <Dialog
        open={Boolean(cancelTarget)}
        onOpenChange={(open) => {
          if (!open && !deletingId) {
            setCancelTarget(null);
            setCancelReasonCode("");
            setCancelReasonDetail("");
            setCancelPreferredResolution("full_refund");
          }
        }}
      >
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle>Request cancellation review</DialogTitle>
            <DialogDescription>
              This request is already assigned/active. Tell us why you want to cancel so admin can review it.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1">
              <p className="text-sm font-medium text-[#101828]">Reason category</p>
              <Select value={cancelReasonCode} onValueChange={setCancelReasonCode}>
                <SelectTrigger>
                  <SelectValue placeholder="Select reason" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="wrong_provider">Wrong provider assigned</SelectItem>
                  <SelectItem value="quality_concern">Quality concern</SelectItem>
                  <SelectItem value="delay_no_show">Delay or no-show</SelectItem>
                  <SelectItem value="pricing_dispute">Pricing dispute</SelectItem>
                  <SelectItem value="safety_issue">Safety issue</SelectItem>
                  <SelectItem value="duplicate_request">Duplicate request</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <p className="text-sm font-medium text-[#101828]">Details</p>
              <textarea
                value={cancelReasonDetail}
                onChange={(event) => setCancelReasonDetail(event.target.value)}
                placeholder="Explain what happened and why cancellation is needed."
                className="min-h-[120px] w-full rounded-xl border border-[#D0D5DD] px-3 py-2 text-sm text-[#344054]"
              />
            </div>

            <div className="space-y-1">
              <p className="text-sm font-medium text-[#101828]">Preferred resolution</p>
              <Select
                value={cancelPreferredResolution}
                onValueChange={(value: "full_refund" | "partial_refund" | "cancel_without_refund") =>
                  setCancelPreferredResolution(value)
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="full_refund">Full refund</SelectItem>
                  <SelectItem value="partial_refund">Partial refund</SelectItem>
                  <SelectItem value="cancel_without_refund">Cancel without refund</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setCancelTarget(null);
                setCancelReasonCode("");
                setCancelReasonDetail("");
                setCancelPreferredResolution("full_refund");
              }}
              disabled={Boolean(deletingId)}
            >
              Close
            </Button>
            <Button onClick={handleSubmitCancellationReview} disabled={Boolean(deletingId)}>
              {deletingId ? "Submitting..." : "Submit for admin review"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
