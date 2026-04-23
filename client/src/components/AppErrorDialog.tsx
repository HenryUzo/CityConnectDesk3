import { useEffect, useMemo, useState } from "react";
import { AlertCircle, RefreshCw, ShieldAlert, WifiOff } from "lucide-react";
import { useLocation } from "wouter";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { dismissAppError, subscribeToAppError } from "@/lib/appErrorDialogBus";
import {
  type AppErrorAction,
  type AppErrorInput,
  presentAppError,
} from "@/lib/errorPresentation";
import { cn } from "@/lib/utils";

const toneStyles = {
  danger: {
    shell: "bg-red-50 text-red-700 ring-red-100",
    icon: AlertCircle,
    accent: "from-red-500/12 via-red-500/4 to-transparent",
  },
  warning: {
    shell: "bg-amber-50 text-amber-700 ring-amber-100",
    icon: ShieldAlert,
    accent: "from-amber-500/14 via-amber-500/5 to-transparent",
  },
  info: {
    shell: "bg-sky-50 text-sky-700 ring-sky-100",
    icon: WifiOff,
    accent: "from-sky-500/12 via-sky-500/4 to-transparent",
  },
} as const;

function dashboardPathForCurrentRoute() {
  if (typeof window === "undefined") return "/resident";
  const path = window.location.pathname;
  if (path.startsWith("/admin")) return "/admin-dashboard";
  if (path.startsWith("/provider")) return "/provider";
  if (path.startsWith("/company")) return "/company-dashboard";
  return "/resident";
}

export default function AppErrorDialog() {
  const [, setLocation] = useLocation();
  const [payload, setPayload] = useState<AppErrorInput | null>(null);

  useEffect(() => subscribeToAppError(setPayload), []);

  const presentation = useMemo(() => {
    if (!payload) return null;
    return presentAppError(payload);
  }, [payload]);

  if (!presentation) return null;

  const tone = toneStyles[presentation.tone];
  const ToneIcon = tone.icon;

  const closeDialog = () => {
    dismissAppError();
  };

  const navigateTo = (href: string) => {
    if (href.startsWith("http") || href.startsWith("mailto:")) {
      window.location.assign(href);
      return;
    }
    setLocation(href);
  };

  const runAction = (action: AppErrorAction) => {
    switch (action.kind) {
      case "navigate":
        closeDialog();
        navigateTo(action.href || "/");
        break;
      case "dashboard":
        closeDialog();
        navigateTo(dashboardPathForCurrentRoute());
        break;
      case "reload":
        closeDialog();
        window.location.reload();
        break;
      case "back":
        closeDialog();
        if (window.history.length > 1) {
          window.history.back();
        } else {
          navigateTo(dashboardPathForCurrentRoute());
        }
        break;
      case "contact": {
        const supportEmail =
          String(import.meta.env.VITE_SUPPORT_EMAIL || "").trim() || "support@cityconnect.app";
        const subject = encodeURIComponent("CityConnect support request");
        const body = encodeURIComponent(
          [
            presentation.message,
            presentation.nextStep,
            presentation.technicalDetails ? `\nTechnical details:\n${presentation.technicalDetails}` : "",
          ]
            .filter(Boolean)
            .join("\n"),
        );
        closeDialog();
        window.location.assign(`mailto:${supportEmail}?subject=${subject}&body=${body}`);
        break;
      }
      case "close":
      default:
        closeDialog();
        break;
    }
  };

  return (
    <Dialog open={Boolean(payload)} onOpenChange={(open) => !open && closeDialog()}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-[420px] overflow-hidden rounded-[26px] border border-slate-200 bg-white p-0 shadow-[0_24px_80px_rgba(15,23,42,0.22)]">
        <div className={cn("h-20 bg-gradient-to-br", tone.accent)} />
        <div className="-mt-12 px-6 pb-6">
          <div className={cn("mb-5 inline-flex h-14 w-14 items-center justify-center rounded-2xl ring-8", tone.shell)}>
            <ToneIcon className="h-6 w-6" />
          </div>

          <DialogHeader className="space-y-3 text-left">
            <DialogTitle className="text-xl font-semibold tracking-tight text-slate-950">
              {presentation.title}
            </DialogTitle>
            <DialogDescription className="text-[15px] leading-6 text-slate-600">
              {presentation.message}
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="mt-6 gap-2 sm:flex-row">
            {presentation.secondaryAction ? (
              <Button
                type="button"
                variant="outline"
                className="h-11 rounded-full border-slate-200 px-5"
                onClick={() => runAction(presentation.secondaryAction!)}
              >
                {presentation.secondaryAction.kind === "reload" ? (
                  <RefreshCw className="mr-2 h-4 w-4" />
                ) : null}
                {presentation.secondaryAction.label}
              </Button>
            ) : null}
            <Button
              type="button"
              className="h-11 rounded-full bg-slate-950 px-5 text-white hover:bg-slate-800"
              onClick={() => runAction(presentation.primaryAction)}
            >
              {presentation.primaryAction.kind === "reload" ? (
                <RefreshCw className="mr-2 h-4 w-4" />
              ) : null}
              {presentation.primaryAction.label}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
