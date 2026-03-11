import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
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
import { RequestCard } from "@/components/resident/ordinary-flow/RequestCard";
import { formatServiceRequestStatusLabel } from "@/lib/serviceRequestStatus";

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
  status: string;
  location?: string;
  updatedAt?: string;
  snippet?: string;
  isDraft?: boolean;
};

const statusToneByKey: Record<string, string> = {
  draft: "border-slate-300/80 bg-slate-100 text-slate-700",
  assigned: "border-violet-300/70 bg-violet-100 text-violet-700",
  assigned_for_job: "border-indigo-300/70 bg-indigo-100 text-indigo-700",
  in_progress: "border-sky-300/70 bg-sky-100 text-sky-700",
  pending_inspection: "border-amber-300/70 bg-amber-100 text-amber-700",
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
  const { notifications, markRead } = useNotifications();
  const queryClient = useQueryClient();
  const [deletingId, setDeletingId] = useState<string | null>(null);

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
      const res = await fetch("/api/app/wallet");
      if (!res.ok) throw new Error("Failed to fetch wallet");
      return res.json();
    },
  });

  const { data: recentRequests = [] } = useQuery({
    queryKey: ["my-recent-requests"],
    queryFn: async () => {
      const res = await fetch("/api/app/service-requests/mine?limit=8");
      if (!res.ok) throw new Error("Failed to fetch recent requests");
      return res.json();
    },
    enabled: !sessions,
    refetchInterval: 15000,
  });

  const coins = wallet?.coins ?? 0;
  const canCreateRequest = coins >= 100;

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

  const handleDeleteRequest = async (id: string) => {
    if (id.startsWith("draft")) return;

    try {
      setDeletingId(id);
      let res = await fetch(`/api/app/service-requests/${id}`, { method: "DELETE" });
      if (res.status === 404) {
        res = await fetch(`/api/service-requests/${id}`, { method: "DELETE" });
      }
      if (!res.ok) throw new Error(`Failed to delete request (${res.status})`);

      queryClient.invalidateQueries({ queryKey: ["my-recent-requests"] });
      if (id === activeSessionId) {
        onSelectSession?.("");
      }
      toast({ title: "Removed", description: "Conversation removed from recents." });
    } catch (error: any) {
      toast({
        title: "Delete failed",
        description: error?.message || "Could not remove conversation",
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
      return {
        id,
        title: formatLabel(raw.title || raw.category || "New request"),
        category: raw.category ? String(raw.category) : undefined,
        status,
        location: raw.location || raw.snippet || undefined,
        snippet: raw.snippet || raw.description || undefined,
        updatedAt: raw.updatedAt || raw.createdAt,
        isDraft,
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
      (recentRequests as any[])
        .filter((request) => String(request.status || "").toLowerCase() !== "cancelled")
        .forEach((request) => add(request));
    }

    return Array.from(map.values()).sort((a, b) => {
      const left = new Date(a.updatedAt || 0).getTime();
      const right = new Date(b.updatedAt || 0).getTime();
      return right - left;
    });
  }, [draftSessions, recentRequests, sessions]);

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
        {mergedRecents.length === 0 ? (
          <p className="text-sm text-emerald-100/80">No recent requests</p>
        ) : (
          mergedRecents.map((request) => {
            const isActive = request.id === activeSessionId;
            const busy = loadingSessionId === request.id || deletingId === request.id;
            const isDraft = Boolean(request.isDraft || request.id.startsWith("draft"));
            const unreadCount = !isDraft ? unreadByRequestId[request.id] || 0 : 0;
            const ServiceIcon = getServiceIcon(request.category || request.title);

            return (
              <RequestCard
                key={request.id}
                title={request.title}
                location={request.location || request.snippet || "Location not set"}
                updatedAt={request.updatedAt || ""}
                statusLabel={
                  isDraft
                    ? "Draft"
                    : formatServiceRequestStatusLabel(request.status, request.category || request.title)
                }
                statusToneClassName={getStatusTone(request.status)}
                icon={ServiceIcon}
                isActive={isActive}
                isBusy={busy}
                isDraft={isDraft}
                unreadCount={unreadCount}
                onOpen={() => handleSelectRequest(request.id)}
                onDelete={!isDraft ? () => handleDeleteRequest(request.id) : undefined}
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
  );
}
