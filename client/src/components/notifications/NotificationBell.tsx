import { Bell } from "lucide-react";
import { useLocation } from "wouter";
import { useNotifications } from "@/contexts/NotificationsContext";

export function NotificationBell({ collapsed }: { collapsed?: boolean }) {
  const [, setLocation] = useLocation();
  const { unreadCount } = useNotifications();

  return (
    <button
      type="button"
      onClick={() => setLocation("/notifications")}
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
  );
}
