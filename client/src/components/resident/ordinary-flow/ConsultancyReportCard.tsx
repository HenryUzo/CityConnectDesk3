import { ClipboardList } from "lucide-react";

interface ConsultancyReportCardProps {
  inspectionDate?: string;
  actualIssue: string;
  causeOfIssue: string;
  materialCostLabel: string;
  serviceCostLabel: string;
  preventiveRecommendation: string;
  timestamp?: string;
}

export function ConsultancyReportCard({
  inspectionDate,
  actualIssue,
  causeOfIssue,
  materialCostLabel,
  serviceCostLabel,
  preventiveRecommendation,
  timestamp,
}: ConsultancyReportCardProps) {
  return (
    <div className="rounded-xl border border-[#D0D5DD] bg-white p-4 shadow-sm">
      <div className="flex items-start gap-2.5">
        <div className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[#D0D5DD] bg-[#F9FAFB] text-[#475467]">
          <ClipboardList className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[14px] font-semibold text-[#101828]">Consultancy report</p>
            {inspectionDate ? (
              <span className="inline-flex items-center rounded-full border border-[#D0D5DD] bg-[#F9FAFB] px-2 py-0.5 text-[11px] text-[#344054]">
                {inspectionDate}
              </span>
            ) : null}
          </div>

          <div className="space-y-2 text-[13px] text-[#344054]">
            <p>
              <span className="font-semibold text-[#101828]">Actual issue:</span> {actualIssue}
            </p>
            <p>
              <span className="font-semibold text-[#101828]">Cause of issue:</span> {causeOfIssue}
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              <p className="rounded-lg border border-[#EAECF0] bg-[#F9FAFB] px-2.5 py-2">
                <span className="block text-[11px] text-[#667085]">Material cost</span>
                <span className="font-semibold text-[#101828]">{materialCostLabel}</span>
              </p>
              <p className="rounded-lg border border-[#EAECF0] bg-[#F9FAFB] px-2.5 py-2">
                <span className="block text-[11px] text-[#667085]">Service cost</span>
                <span className="font-semibold text-[#101828]">{serviceCostLabel}</span>
              </p>
            </div>
            <p>
              <span className="font-semibold text-[#101828]">Preventive recommendation:</span>{" "}
              {preventiveRecommendation}
            </p>
          </div>

          {timestamp ? (
            <p className="text-[11px] text-[#98A2B3]">
              {new Date(timestamp).toLocaleString()}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
