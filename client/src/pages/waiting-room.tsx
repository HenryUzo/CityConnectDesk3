import { useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useNotifications } from "@/contexts/NotificationsContext";

export default function WaitingRoom() {
  const [, setLocation] = useLocation();
  const { user, refreshUser } = useAuth();
  const { providerApproved } = useNotifications();

  useEffect(() => {
    if (user?.role !== "provider") {
      setLocation("/");
      return;
    }
    if (user.isApproved || providerApproved) {
      setLocation("/provider");
    }
  }, [providerApproved, setLocation, user]);

  useEffect(() => {
    if (!user || user.role !== "provider") return;
    let isMounted = true;
    const interval = setInterval(async () => {
      try {
        const nextUser = await refreshUser();
        if (isMounted && nextUser?.isApproved) {
          setLocation("/provider");
        }
      } catch (error) {
        console.error("Waiting room poll failed:", error);
      }
    }, 10000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [refreshUser, setLocation, user]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-6">
      <div className="max-w-md text-center space-y-3">
        <h1 className="text-2xl font-semibold text-foreground">Approval Pending</h1>
        <p className="text-sm text-muted-foreground">
          Your provider account is awaiting approval from the admin. You will be redirected once verified.
        </p>
      </div>
    </div>
  );
}
