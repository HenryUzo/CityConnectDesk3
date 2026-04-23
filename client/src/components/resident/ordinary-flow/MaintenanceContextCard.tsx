import { CalendarClock, ClipboardList, MapPin, ShieldCheck, Wrench } from "lucide-react";

interface MaintenanceContextCardProps {
  title: string;
  assetLabel: string;
  itemTypeLabel: string;
  locationLabel?: string | null;
  conditionLabel?: string | null;
  planName: string;
  durationLabel?: string | null;
  scheduledForLabel?: string | null;
  nextStep: string;
  includedTasks?: string[];
}

function ContextPill({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof CalendarClock;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-[#E4E7EC] bg-white px-3 py-2">
      <div className="flex items-center gap-2">
        <div className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[#ECFDF3] text-[#027A48]">
          <Icon className="h-3.5 w-3.5" />
        </div>
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-[0.04em] text-[#667085]">{label}</p>
          <p className="truncate text-[13px] font-semibold text-[#101828]">{value}</p>
        </div>
      </div>
    </div>
  );
}

export function MaintenanceContextCard({
  title,
  assetLabel,
  itemTypeLabel,
  locationLabel,
  conditionLabel,
  planName,
  durationLabel,
  scheduledForLabel,
  nextStep,
  includedTasks = [],
}: MaintenanceContextCardProps) {
  const coveredText = includedTasks.filter(Boolean).slice(0, 4).join(", ");

  return (
    <div className="rounded-2xl border border-[#CFEAD9] bg-[linear-gradient(135deg,#F4FFF8_0%,#F9FAFB_100%)] p-4 shadow-[0_10px_24px_-20px_rgba(2,122,72,0.45)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="inline-flex items-center gap-1 rounded-full border border-[#ABEFC6] bg-white px-2.5 py-1 text-[11px] font-semibold text-[#027A48]">
            <ShieldCheck className="h-3.5 w-3.5" />
            Scheduled maintenance
          </div>
          <p className="mt-2 text-[16px] font-semibold text-[#101828]">{title}</p>
          <p className="mt-1 text-[13px] text-[#475467]">
            Your asset and plan details are already attached, so you only need to confirm timing or access notes.
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <ContextPill icon={Wrench} label="Asset" value={assetLabel} />
        <ContextPill icon={ClipboardList} label="Item type" value={itemTypeLabel} />
        <ContextPill icon={ShieldCheck} label="Plan" value={durationLabel ? `${planName} · ${durationLabel}` : planName} />
        <ContextPill
          icon={CalendarClock}
          label="Next visit"
          value={scheduledForLabel || "To be confirmed"}
        />
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <div className="rounded-xl border border-[#E4E7EC] bg-white px-3 py-2.5">
          <p className="text-[11px] font-medium uppercase tracking-[0.04em] text-[#667085]">Location</p>
          <p className="mt-1 flex items-center gap-1 text-[13px] text-[#101828]">
            <MapPin className="h-3.5 w-3.5 text-[#667085]" />
            {locationLabel || "Location not specified"}
          </p>
          {conditionLabel ? (
            <p className="mt-1 text-[12px] text-[#475467]">Condition: {conditionLabel}</p>
          ) : null}
        </div>

        <div className="rounded-xl border border-[#E4E7EC] bg-white px-3 py-2.5">
          <p className="text-[11px] font-medium uppercase tracking-[0.04em] text-[#667085]">Next step</p>
          <p className="mt-1 text-[13px] text-[#101828]">{nextStep}</p>
          {coveredText ? (
            <p className="mt-1 text-[12px] text-[#475467]">Covered: {coveredText}</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
