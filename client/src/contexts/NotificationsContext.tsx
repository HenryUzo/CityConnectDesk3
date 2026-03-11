import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";

type Notification = {
  id: string;
  title: string;
  message: string;
  type?: string | null;
  metadata?: Record<string, unknown> | null;
  isRead: boolean;
  createdAt: string;
};

type NotificationsContextValue = {
  notifications: Notification[];
  unreadCount: number;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  refresh: () => Promise<void>;
  providerApproved: boolean;
};

const NotificationsContext = createContext<NotificationsContextValue | null>(null);

function isIgnorableNotificationsError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || "");
  return /\b401\b|\b403\b|\b404\b/i.test(message);
}

export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const socketRef = useRef<Socket | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [providerApproved, setProviderApproved] = useState(false);

  const isProviderApprovedNotification = useCallback((notification: Notification) => {
    const kind = notification.metadata && typeof notification.metadata === "object"
      ? (notification.metadata as Record<string, unknown>).kind
      : undefined;
    return kind === "provider_approved" || notification.type === "provider_approved";
  }, []);

  const refresh = useCallback(async () => {
    if (!user) return;
    try {
      const res = await apiRequest("GET", "/api/notifications");
      const data = (await res.json()) as Notification[];
      const normalized = Array.isArray(data) ? data : [];
      setNotifications(normalized);
      setProviderApproved(normalized.some(isProviderApprovedNotification));
    } catch (error) {
      if (isIgnorableNotificationsError(error)) {
        setNotifications([]);
        setProviderApproved(false);
        return;
      }
      throw error;
    }
  }, [isProviderApprovedNotification, user]);

  useEffect(() => {
    if (!user) {
      setNotifications([]);
      setProviderApproved(false);
      return;
    }
    refresh();
  }, [refresh, user]);

  useEffect(() => {
    if (!user) return;
    const socket = io();
    socketRef.current = socket;
    socket.emit("join", user.id);
    socket.on("notification:new", (payload: Notification) => {
      setNotifications((prev) => [payload, ...prev]);
      if (isProviderApprovedNotification(payload)) {
        setProviderApproved(true);
      }
      toast({
        title: payload.title,
        description: payload.message,
      });
    });
    socket.on("provider:approved", () => {
      setProviderApproved(true);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [isProviderApprovedNotification, toast, user]);

  const markRead = useCallback(async (id: string) => {
    try {
      await apiRequest("PATCH", `/api/notifications/${id}/read`);
    } catch (error) {
      if (!isIgnorableNotificationsError(error)) {
        throw error;
      }
    } finally {
      // Keep UI responsive even if backend mark-read failed.
      setNotifications((prev) =>
        prev.map((item) => (item.id === id ? { ...item, isRead: true } : item)),
      );
    }
  }, []);

  const markAllRead = useCallback(async () => {
    try {
      await apiRequest("POST", "/api/notifications/mark-all-read");
    } catch (error) {
      if (!isIgnorableNotificationsError(error)) {
        throw error;
      }
    } finally {
      setNotifications((prev) => prev.map((item) => ({ ...item, isRead: true })));
    }
  }, []);

  const unreadCount = useMemo(
    () => notifications.filter((item) => !item.isRead).length,
    [notifications],
  );

  const value = useMemo(
    () => ({
      notifications,
      unreadCount,
      markRead,
      markAllRead,
      refresh,
      providerApproved,
    }),
    [markAllRead, markRead, notifications, providerApproved, refresh, unreadCount],
  );

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}

export function useNotifications() {
  const context = useContext(NotificationsContext);
  if (!context) {
    throw new Error("useNotifications must be used within NotificationsProvider");
  }
  return context;
}
