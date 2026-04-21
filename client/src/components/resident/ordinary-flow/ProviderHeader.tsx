import { Clock3, MapPin, Phone, ShieldCheck, Star } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { RequestSummaryButton } from "./RequestSummaryButton";

interface ProviderHeaderProps {
  providerName: string;
  providerRole: string;
  availabilityLabel: string;
  etaLabel: string;
  coverageLabel?: string;
  onReviewSummary: () => void;
}

export function ProviderHeader({
  providerName,
  providerRole,
  availabilityLabel,
  etaLabel,
  coverageLabel,
  onReviewSummary,
}: ProviderHeaderProps) {
  const initials = providerName
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0] || "")
    .join("")
    .toUpperCase();

  return (
    <div className="border-b border-[#EAECF0] bg-[#F8FAFC] px-5 py-2.5">
      <div className="rounded-xl border border-[#E4E7EC] bg-white px-3.5 py-2.5 shadow-[0_6px_14px_-14px_rgba(16,24,40,0.5)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3">
            <Avatar className="h-10 w-10 ring-2 ring-[#D1FADF]">
              <AvatarImage
                src={`https://api.dicebear.com/7.x/personas/svg?seed=${encodeURIComponent(providerName)}`}
                alt={providerName}
              />
              <AvatarFallback className="bg-[#ECFDF3] font-semibold text-[#027A48]">
                {initials || "PR"}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="truncate text-base font-semibold text-[#101828]">{providerName}</p>
              <p className="text-[13px] text-[#475467]">{providerRole}</p>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[#667085]">
                <span className="inline-flex items-center gap-1 text-[#027A48]">
                  <span className="h-2 w-2 rounded-full bg-[#12B76A]" />
                  {availabilityLabel}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Clock3 className="h-3.5 w-3.5" />
                  {etaLabel}
                </span>
                {coverageLabel ? (
                  <span className="inline-flex max-w-[260px] items-center gap-1 truncate">
                    <MapPin className="h-3 w-3" />
                    {coverageLabel}
                  </span>
                ) : null}
                <span className="inline-flex items-center gap-1">
                  <Star className="h-3 w-3 text-amber-500" />
                  4.8 rating
                </span>
                <span className="inline-flex items-center gap-1">
                  <ShieldCheck className="h-3 w-3 text-[#12B76A]" />
                  Verified
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-1.5">
            <Button type="button" variant="outline" size="sm" className="h-8 gap-1 px-2.5 text-xs" disabled>
              <Phone className="h-4 w-4" />
              Call provider
            </Button>
            <RequestSummaryButton onClick={onReviewSummary} />
          </div>
        </div>
      </div>
    </div>
  );
}
