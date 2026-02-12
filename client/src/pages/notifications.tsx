import { useNotifications } from "@/contexts/NotificationsContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useMemo } from "react";
import ResidentShell from "@/components/layout/ResidentShell";

export default function NotificationsPage() {
  const { notifications, markRead, markAllRead } = useNotifications();
  const hasUnread = useMemo(
    () => notifications.some((item) => !item.isRead),
    [notifications],
  );

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
            <Card
              key={notification.id}
              className={notification.isRead ? "opacity-80" : ""}
            >
              <CardHeader className="flex flex-row items-start justify-between space-y-0">
                <div>
                  <CardTitle className="text-base">
                    {notification.title}
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">
                    {new Date(notification.createdAt).toLocaleString()}
                  </p>
                </div>
                {!notification.isRead && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => markRead(notification.id)}
                  >
                    Mark read
                  </Button>
                )}
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                {notification.message}
              </CardContent>
            </Card>
          ))
        )}
      </div>
      </div>
    </ResidentShell>
  );
}
