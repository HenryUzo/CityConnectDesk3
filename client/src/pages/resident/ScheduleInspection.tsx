import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { DatePickerModal } from "@/components/ui/datepicker";
import { PriButton, SecButton } from "@/components/ui/buttons";
import { Calendar } from "@/components/ui/icon";
import Nav from "@/components/layout/Nav";
import MobileNavDrawer from "@/components/layout/MobileNavDrawer";
import { apiRequest } from "@/lib/queryClient";

type InspectionDraft = {
  selectedCategory?: string;
  description?: string;
  aiSummary?: string | null;
};

const INSPECTION_DRAFT_KEY = "citybuddy_inspection_draft";
const CITYBUDDY_BOOKING_EVENTS_KEY = "citybuddy_booking_events_v1";

function pushCityBuddyBookingEvent(evt: {
  citybuddySessionId?: string | null;
  serviceRequestId: string;
  title?: string | null;
  status?: string | null;
}) {
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(CITYBUDDY_BOOKING_EVENTS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    const list = Array.isArray(parsed) ? parsed : [];
    list.push({
      eventId: `${Date.now()}:${evt.serviceRequestId}`,
      createdAtIso: new Date().toISOString(),
      citybuddySessionId: evt.citybuddySessionId ?? null,
      serviceRequestId: evt.serviceRequestId,
      title: evt.title ?? null,
      status: evt.status ?? null,
    });
    window.localStorage.setItem(CITYBUDDY_BOOKING_EVENTS_KEY, JSON.stringify(list.slice(-30)));
  } catch {
    // ignore
  }
}

function safeParseDraft(raw: string | null): InspectionDraft {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};
    return parsed as InspectionDraft;
  } catch {
    return {};
  }
}

function cityBuddyCategoryToServiceCategorySlug(title?: string): string {
  switch ((title || "").trim().toLowerCase()) {
    case "surveillance monitoring":
      return "surveillance_monitoring";
    case "cleaning & janitorial":
      return "cleaning_janitorial";
    case "catering services":
      return "catering_services";
    case "it support":
      return "it_support";
    case "maintenance & repair":
      return "maintenance_repair";
    case "marketing & advertising":
      return "marketing_advertising";
    case "home tutors":
      return "home_tutors";
    case "furniture making":
      return "furniture_making";
    default:
      // Fallback to an existing enum value to avoid hard failures.
      return "appliance_repair";
  }
}

export default function ScheduleInspection() {
  const [, navigate] = useLocation();
  const citybuddySessionId = useMemo(() => {
    if (typeof window === "undefined") return null;
    return new URLSearchParams(window.location.search).get("citybuddySessionId");
  }, []);

  const [draft, setDraft] = useState<InspectionDraft>({});
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [appointment, setAppointment] = useState<{ date: string; time: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    setDraft(safeParseDraft(sessionStorage.getItem(INSPECTION_DRAFT_KEY)));
  }, []);

  const resolvedCategorySlug = useMemo(() => {
    return cityBuddyCategoryToServiceCategorySlug(draft.selectedCategory);
  }, [draft.selectedCategory]);

  const requestDescription = useMemo(() => {
    const userText = (draft.description || "").trim();
    const summary = (draft.aiSummary || "").trim();

    if (userText && summary) {
      return `${userText}\n\nAI summary:\n${summary}`;
    }
    if (userText) return userText;
    if (summary) return summary;
    return "Inspection requested";
  }, [draft.aiSummary, draft.description]);

  const handleApplyAppointment = (date: string, time: string) => {
    setAppointment({ date, time });
  };

  const handleConfirm = async () => {
    if (!appointment) return;
    if (isSubmitting) return;

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      // Backend expects preferredTime parseable by `new Date(...)`.
      const preferredTime = `${appointment.date} ${appointment.time}`;

      const res = await apiRequest("POST", "/api/service-requests", {
        category: resolvedCategorySlug,
        description: requestDescription,
        urgency: "medium",
        budget: "0",
        location: "Not specified",
        preferredTime,
        // Store the chosen inspection slot for admins to see.
        inspectionDates: [appointment.date],
        inspectionTimes: [appointment.time],
        status: "pending_inspection",
      });

      const created = (await res.json().catch(() => null)) as any;
      // If we have an ID, take the user to that request.
      if (created?.id) {
        pushCityBuddyBookingEvent({
          citybuddySessionId,
          serviceRequestId: String(created.id),
          title: draft.selectedCategory ? `Inspection — ${draft.selectedCategory}` : "Inspection request",
          status: String(created.status ?? "pending_inspection"),
        });
        navigate(`/service-requests?id=${encodeURIComponent(created.id)}`);
      } else {
        navigate("/service-requests");
      }
    } catch (err: any) {
      setSubmitError(err?.message || String(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-[#054f31]" data-name="Schedule inspection">
      <MobileNavDrawer
        onBookServiceClick={() => navigate("/resident/book-a-service/chat")}
        onNavigateToHomepage={() => navigate("/resident")}
        onNavigateToSettings={() => navigate("/resident/settings")}
        onNavigateToMarketplace={() => navigate("/resident/citymart")}
        onNavigateToServiceRequests={() => navigate("/service-requests")}
        currentPage="chat"
      />

      <div className="hidden lg:block h-full">
        <Nav
          onBookServiceClick={() => navigate("/resident/book-a-service/chat")}
          onNavigateToHomepage={() => navigate("/resident")}
          onNavigateToSettings={() => navigate("/resident/settings")}
          onNavigateToMarketplace={() => navigate("/resident/citymart")}
          onNavigateToServiceRequests={() => navigate("/service-requests")}
          currentPage="chat"
        />
      </div>

      <div className="flex-1 min-w-0 h-full bg-white rounded-bl-[40px] rounded-tl-[40px]">
        <div className="h-full flex flex-col p-[32px] gap-[24px]">
          <div className="flex items-start justify-between gap-[16px]">
            <div className="min-w-0">
              <p className="font-['General_Sans:Semibold',sans-serif] text-[20px] leading-[28px] text-[#101828]">
                Schedule an inspection
              </p>
              <p className="font-['General_Sans:Regular',sans-serif] text-[14px] leading-[20px] text-[#475467]">
                Pick a date and time, then confirm to create an inspection request.
              </p>
            </div>
            <div className="shrink-0">
              <SecButton onClick={() => navigate("/resident/book-a-service/chat")}>Back to chat</SecButton>
            </div>
          </div>

          <div className="bg-[#f5f6f6] rounded-[12px] p-[16px]">
            <p className="font-['General_Sans:Medium',sans-serif] text-[14px] leading-[20px] text-[#101828]">
              Category
            </p>
            <p className="font-['General_Sans:Regular',sans-serif] text-[14px] leading-[20px] text-[#475467] break-words">
              {draft.selectedCategory || "Not specified"}
            </p>
          </div>

          <div className="bg-[#f5f6f6] rounded-[12px] p-[16px]">
            <p className="font-['General_Sans:Medium',sans-serif] text-[14px] leading-[20px] text-[#101828]">
              Request details
            </p>
            <p className="font-['General_Sans:Regular',sans-serif] text-[14px] leading-[20px] text-[#475467] whitespace-pre-wrap break-words">
              {requestDescription}
            </p>
          </div>

          <div className="flex flex-col gap-[12px]">
            <div className="flex flex-wrap items-center gap-[12px]">
              <SecButton onClick={() => setIsDatePickerOpen(true)} disabled={isSubmitting}>
                <span className="inline-flex items-center gap-[8px]">
                  <Calendar />
                  <span>{appointment ? "Change date & time" : "Pick date & time"}</span>
                </span>
              </SecButton>

              {appointment && (
                <div className="text-[14px] text-[#475467]">
                  Selected: <span className="font-['General_Sans:Semibold',sans-serif]">{appointment.date}</span> at{" "}
                  <span className="font-['General_Sans:Semibold',sans-serif]">{appointment.time}</span>
                </div>
              )}
            </div>

            <div className="flex flex-wrap gap-[12px]">
              <PriButton onClick={handleConfirm} disabled={!appointment || isSubmitting}>
                {isSubmitting ? "Creating request..." : "Confirm inspection appointment"}
              </PriButton>
            </div>

            {submitError && (
              <p className="text-[14px] text-[#D92D20] whitespace-pre-wrap">{submitError}</p>
            )}
          </div>
        </div>
      </div>

      <DatePickerModal
        isOpen={isDatePickerOpen}
        onClose={() => setIsDatePickerOpen(false)}
        className="bg-[rgba(0,0,0,0.1)]"
        onApply={handleApplyAppointment}
      />
    </div>
  );
}
