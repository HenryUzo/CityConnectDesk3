import { useMemo, useState } from "react";
import { Bell } from "lucide-react";
import { useLocation } from "wouter";
import { useNotifications } from "@/contexts/NotificationsContext";
import { useAuth } from "@/hooks/use-auth";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { resolveNotificationTarget } from "@/lib/notificationRouting";

export function NotificationBell({ collapsed }: { collapsed?: boolean }) {
  const [, setLocation] = useLocation();
  const [open, setOpen] = useState(false);
  const { user } = useAuth();
  const { notifications, unreadCount, markRead } = useNotifications();
  const previewItems = useMemo(() => notifications.slice(0, 10), [notifications]);

  const formatTimestamp = (value: string) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const openNotificationsPage = () => {
    setOpen(false);
    setLocation("/notifications");
  };

  const handleOpenPreviewItem = (notification: (typeof notifications)[number]) => {
    const target = resolveNotificationTarget(notification, user?.role);
    if (!notification.isRead) {
      void markRead(notification.id);
    }
    setOpen(false);
    setLocation(target || "/notifications");
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={`relative inline-flex items-center gap-2 rounded-2xl px-3 py-2 text-sm font-semibold text-white/90 transition hover:bg-white/10 ${
            collapsed ? "justify-center px-2" : ""
          }`}
          aria-label="View notifications"
        >
          <Bell size={20} className="text-white/80" />
          {!collapsed && <span>Notifications</span>}
          {unreadCount > 0 && (
            <span className="absolute -right-1 -top-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-semibold text-white">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>

      <PopoverContent
        side="right"
        align="start"
        sideOffset={12}
        className={cn(
          "w-[340px] rounded-2xl border-[#D0D5DD] bg-white p-0 shadow-[0_24px_48px_-12px_rgba(16,24,40,0.18)]",
        )}
      >
        <div className="border-b border-[#EAECF0] px-4 py-3">
          <p className="text-sm font-semibold text-[#101828]">Notifications</p>
        </div>

        <div className="max-h-[360px] overflow-y-auto p-2">
          {previewItems.length > 0 ? (
            <div className="space-y-1">
              {previewItems.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  onClick={() => handleOpenPreviewItem(item)}
                  className="w-full rounded-xl px-3 py-2 text-left transition hover:bg-[#F2F4F7]"
                >
                  <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-semibold text-[#101828]">{item.title}</p>
                      <p className="mt-0.5 line-clamp-2 text-[12px] text-[#667085]">{item.message}</p>
                      <p className="mt-1 text-[11px] text-[#98A2B3]">{formatTimestamp(item.createdAt)}</p>
                    </div>
                    {!item.isRead ? (
                      <span className="mt-1 inline-flex h-2.5 w-2.5 rounded-full bg-[#F04438]" />
                    ) : null}
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <p className="px-3 py-6 text-center text-[13px] text-[#667085]">No notifications yet.</p>
          )}
        </div>

        <div className="border-t border-[#EAECF0] p-2">
          <button
            type="button"
            onClick={openNotificationsPage}
            className="w-full rounded-xl px-3 py-2 text-sm font-semibold text-[#027A48] transition hover:bg-[#ECFDF3]"
          >
            See all notifications
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
