import { useNotifications } from "@/contexts/NotificationsContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useMemo } from "react";
import { useLocation } from "wouter";
import ResidentShell from "@/components/layout/ResidentShell";
import { useAuth } from "@/hooks/use-auth";

export default function NotificationsPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { notifications, markRead, markAllRead } = useNotifications();
  const hasUnread = useMemo(
    () => notifications.some((item) => !item.isRead),
    [notifications],
  );

  const getNotificationTarget = (notification: (typeof notifications)[number]) => {
    const metadata = notification.metadata as Record<string, unknown> | null;
    const requestId = typeof metadata?.requestId === "string" ? metadata.requestId : "";
    if (!requestId) return null;

    if (user?.role === "provider") {
      return `/provider/chat?requestId=${encodeURIComponent(requestId)}`;
    }
    if (user?.role === "resident") {
      return `/resident/requests/ordinary?requestId=${encodeURIComponent(requestId)}`;
    }
    return null;
  };

  const handleOpenNotification = async (notification: (typeof notifications)[number]) => {
    const target = getNotificationTarget(notification);
    if (!target) return;

    if (!notification.isRead) {
      await markRead(notification.id);
    }
    setLocation(target);
  };

  return (
    <ResidentShell currentPage="homepage">
      <div className="mx-auto w-full max-w-3xl p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Notifications</h1>
        <Button
          variant="outline"
          onClick={() => markAllRead()}
          disabled={!hasUnread}
        >
          Mark all read
        </Button>
      </div>

      <div className="space-y-4">
        {notifications.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-sm text-muted-foreground">
              You have no notifications yet.
            </CardContent>
          </Card>
        ) : (
          notifications.map((notification) => (
            (() => {
              const target = getNotificationTarget(notification);
              return (
            <Card
              key={notification.id}
              className={`${notification.isRead ? "opacity-80" : ""} ${target ? "cursor-pointer hover:border-primary/40 transition-colors" : ""}`}
              role={target ? "button" : undefined}
              tabIndex={target ? 0 : undefined}
              onClick={target ? () => void handleOpenNotification(notification) : undefined}
              onKeyDown={
                target
                  ? (event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        void handleOpenNotification(notification);
                      }
                    }
                  : undefined
              }
            >
              <CardHeader className="flex flex-row items-start justify-between space-y-0">
                <div>
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-base">{notification.title}</CardTitle>
                    {!notification.isRead && <Badge className="bg-rose-500 hover:bg-rose-500">Unread</Badge>}
                    {(notification.metadata as Record<string, unknown> | null)?.kind === "request_message" ? (
                      <Badge variant="outline">New message</Badge>
                    ) : null}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {new Date(notification.createdAt).toLocaleString()}
                  </p>
                </div>
                {!notification.isRead && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={(event) => {
                      event.stopPropagation();
                      void markRead(notification.id);
                    }}
                  >
                    Mark read
                  </Button>
                )}
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                {notification.message}
                {target ? <p className="mt-2 text-xs text-primary">Open chat</p> : null}
              </CardContent>
            </Card>
              );
            })()
          ))
        )}
      </div>
      </div>
    </ResidentShell>
  );
}
