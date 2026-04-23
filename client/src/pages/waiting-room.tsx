import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  BadgeCheck,
  Building2,
  CheckCircle2,
  Clock3,
  LifeBuoy,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useNotifications } from "@/contexts/NotificationsContext";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

function formatDateTime(value?: string | Date | null) {
  if (!value) return "Just now";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "Just now";
  return new Intl.DateTimeFormat("en-NG", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function getProviderDisplayName(user: any) {
  const name = String(user?.name || "").trim();
  if (name) return name;
  const email = String(user?.email || "").trim();
  if (email) return email;
  return "Provider";
}

export default function WaitingRoom() {
  const [, setLocation] = useLocation();
  const { user, refreshUser, logoutMutation } = useAuth();
  const { providerApproved } = useNotifications();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastCheckedAt, setLastCheckedAt] = useState<Date>(new Date());

  const providerName = getProviderDisplayName(user);
  const providerInitial = providerName.charAt(0).toUpperCase() || "P";
  const reviewProgress = user?.isApproved ? 100 : 66;

  const { data: providerCompany } = useQuery({
    queryKey: ["/api/provider/company", "waiting-room"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/provider/company");
      return res.json();
    },
    enabled: user?.role === "provider",
    retry: false,
    staleTime: 60_000,
  });

  const companyName = useMemo(() => {
    const raw = String(
      (providerCompany as any)?.companyName ||
        (providerCompany as any)?.name ||
        "",
    ).trim();
    return raw || "Business profile pending";
  }, [providerCompany]);

  const refreshApprovalStatus = useCallback(async () => {
    if (!user || user.role !== "provider") return;
    setIsRefreshing(true);
    try {
      const nextUser = await refreshUser();
      setLastCheckedAt(new Date());
      if (nextUser?.isApproved || providerApproved) {
        setLocation("/provider");
      }
    } catch (error) {
      console.error("Waiting room poll failed:", error);
    } finally {
      setIsRefreshing(false);
    }
  }, [providerApproved, refreshUser, setLocation, user]);

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
    const interval = setInterval(() => {
      void refreshApprovalStatus();
    }, 10_000);

    return () => {
      clearInterval(interval);
    };
  }, [refreshApprovalStatus, user]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-background to-background">
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.16),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(5,150,105,0.10),transparent_24%)]" />
        <div className="mx-auto flex min-h-screen max-w-7xl items-center px-4 py-8 sm:px-6 lg:px-8">
          <div className="grid w-full gap-6 lg:grid-cols-[1.2fr_0.9fr]">
            <section className="rounded-[36px] border border-white/10 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 px-6 py-8 text-white shadow-[0_32px_80px_rgba(2,6,23,0.45)] sm:px-8 lg:px-10">
              <div className="space-y-8">
                <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-4">
                    <Badge className="w-fit rounded-full border border-white/15 bg-white/10 px-4 py-1.5 text-[0.7rem] font-semibold uppercase tracking-[0.35em] text-emerald-50 hover:bg-white/10">
                      Provider onboarding
                    </Badge>
                    <div className="space-y-3">
                      <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
                        Your account is under review
                      </h1>
                      <p className="max-w-2xl text-base leading-7 text-white/72 sm:text-lg">
                        We&apos;re verifying your provider profile and business details for estate access.
                        Once approved, your dashboard opens automatically and your work queue becomes available.
                      </p>
                    </div>
                  </div>
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[24px] border border-emerald-200/20 bg-emerald-300/15 text-2xl font-semibold text-emerald-50 shadow-[0_20px_45px_rgba(16,185,129,0.22)]">
                    {providerInitial}
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  {[
                    {
                      label: "Account created",
                      description: "Your profile has been received.",
                      icon: CheckCircle2,
                      done: true,
                    },
                    {
                      label: "Compliance review",
                      description: "Admin is verifying your business details.",
                      icon: ShieldCheck,
                      done: true,
                      active: !user?.isApproved,
                    },
                    {
                      label: "Dashboard access",
                      description: "Provider tools unlock immediately after approval.",
                      icon: BadgeCheck,
                      done: Boolean(user?.isApproved),
                    },
                  ].map((item) => {
                    const Icon = item.icon;
                    return (
                      <div
                        key={item.label}
                        className={cn(
                          "rounded-[28px] border p-5 shadow-[0_18px_40px_rgba(2,6,23,0.22)] transition-colors",
                          item.active
                            ? "border-emerald-300/30 bg-emerald-400/10"
                            : "border-white/10 bg-white/5",
                        )}
                      >
                        <div className="flex items-start gap-4">
                          <div
                            className={cn(
                              "mt-0.5 flex h-11 w-11 items-center justify-center rounded-2xl",
                              item.done
                                ? "bg-emerald-300/20 text-emerald-100"
                                : "bg-white/10 text-white/70",
                            )}
                          >
                            <Icon className="h-5 w-5" />
                          </div>
                          <div className="space-y-1">
                            <p className="text-sm font-semibold text-white">{item.label}</p>
                            <p className="text-sm leading-6 text-white/65">{item.description}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <Card className="overflow-hidden rounded-[32px] border border-white/10 bg-white/5 text-white shadow-[0_24px_56px_rgba(2,6,23,0.28)] backdrop-blur-sm">
                  <div className="h-1.5 w-full bg-gradient-to-r from-emerald-300 via-teal-300 to-sky-300" />
                  <CardHeader className="space-y-3 pb-3">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.35em] text-white/50">
                          Review status
                        </p>
                        <CardTitle className="mt-2 text-2xl text-white">
                          Approval in progress
                        </CardTitle>
                      </div>
                      <Badge
                        variant="outline"
                        className="w-fit rounded-full border-amber-300/30 bg-amber-400/10 px-3 py-1 text-amber-50"
                      >
                        Awaiting admin sign-off
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-sm text-white/75">
                        <span>Verification progress</span>
                        <span>{reviewProgress}%</span>
                      </div>
                      <Progress
                        value={reviewProgress}
                        className="h-2.5 bg-white/10 [&>div]:bg-[linear-gradient(90deg,#6ee7b7_0%,#2dd4bf_60%,#38bdf8_100%)]"
                      />
                      <p className="text-sm leading-6 text-white/65">
                        We will redirect you as soon as approval lands. You can stay on this page or refresh manually.
                      </p>
                    </div>

                    <div className="flex flex-col gap-3 sm:flex-row">
                      <Button
                        onClick={() => void refreshApprovalStatus()}
                        disabled={isRefreshing}
                        className="rounded-full bg-emerald-500 px-6 text-white hover:bg-emerald-600"
                      >
                        <RefreshCw className={cn("mr-2 h-4 w-4", isRefreshing && "animate-spin")} />
                        {isRefreshing ? "Checking status..." : "Refresh status"}
                      </Button>
                      <Button
                        asChild
                        variant="outline"
                        className="rounded-full border-white/15 bg-white/5 text-white hover:bg-white/10 hover:text-white"
                      >
                        <Link href="/">Back to home</Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </section>

            <aside className="space-y-6">
              <Card className="overflow-hidden rounded-[32px] border border-emerald-100 bg-white/95 shadow-[0_28px_60px_rgba(5,79,49,0.12)] backdrop-blur">
                <div className="h-1.5 w-full bg-[linear-gradient(90deg,#0f766e_0%,#10b981_100%)]" />
                <CardHeader className="space-y-2 pb-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.35em] text-emerald-700/70">
                    Provider profile
                  </p>
                  <CardTitle className="text-2xl text-slate-950">{providerName}</CardTitle>
                  <p className="text-sm text-slate-500">
                    We&apos;re holding this account in a secure review queue until admin approval is complete.
                  </p>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="grid gap-4 rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
                        <Building2 className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                          Business
                        </p>
                        <p className="truncate text-sm font-semibold text-slate-900">{companyName}</p>
                      </div>
                    </div>
                    <div className="grid gap-3 text-sm md:grid-cols-2 lg:grid-cols-1">
                      <div>
                        <p className="text-slate-500">Email</p>
                        <p className="font-medium text-slate-900">{user?.email || "Not provided"}</p>
                      </div>
                      <div>
                        <p className="text-slate-500">Phone</p>
                        <p className="font-medium text-slate-900">{user?.phone || "Not provided"}</p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3 rounded-[24px] border border-amber-100 bg-amber-50/80 p-4">
                    <div className="flex items-center gap-2 text-amber-900">
                      <Clock3 className="h-4 w-4" />
                      <p className="text-sm font-semibold">Last checked</p>
                    </div>
                    <p className="text-sm text-amber-900/80">{formatDateTime(lastCheckedAt)}</p>
                    <p className="text-sm leading-6 text-amber-900/70">
                      This page checks your approval status every 10 seconds and redirects automatically once access is granted.
                    </p>
                  </div>

                  <div className="space-y-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.32em] text-slate-500">
                      What happens next
                    </p>
                    {[
                      "Admin verifies your provider profile.",
                      "Your account is approved for provider operations.",
                      "You are redirected into the provider dashboard automatically.",
                    ].map((line) => (
                      <div key={line} className="flex items-start gap-3 text-sm text-slate-700">
                        <div className="mt-1 h-2.5 w-2.5 rounded-full bg-emerald-500" />
                        <p className="leading-6">{line}</p>
                      </div>
                    ))}
                  </div>

                  <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
                    <Button
                      variant="outline"
                      className="justify-start rounded-2xl border-slate-200 text-slate-700 hover:bg-slate-50"
                    >
                      <LifeBuoy className="mr-2 h-4 w-4" />
                      Contact support
                    </Button>
                    <Button
                      variant="ghost"
                      className="justify-start rounded-2xl text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                      onClick={() => logoutMutation.mutate()}
                    >
                      Sign out
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </aside>
          </div>
        </div>
      </div>
    </div>
  );
}
