import { ClipboardList } from "lucide-react";

interface ConsultancyReportCardProps {
  inspectionDate?: string;
  completionDeadline?: string;
  actualIssue: string;
  causeOfIssue: string;
  materialCostLabel: string;
  serviceCostLabel: string;
  preventiveRecommendation: string;
  evidenceUrls?: string[];
  evidenceCount?: number;
  timestamp?: string;
}

function isImageEvidence(url: string) {
  const value = String(url || "").trim().toLowerCase();
  if (!value) return false;
  if (value.startsWith("data:image/")) return true;
  return [".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp", ".svg"].some((ext) =>
    value.includes(ext),
  );
}

export function ConsultancyReportCard({
  inspectionDate,
  completionDeadline,
  actualIssue,
  causeOfIssue,
  materialCostLabel,
  serviceCostLabel,
  preventiveRecommendation,
  evidenceUrls = [],
  evidenceCount = 0,
  timestamp,
}: ConsultancyReportCardProps) {
  const normalizedEvidence = evidenceUrls
    .map((entry) => String(entry || "").trim())
    .filter(Boolean);
  const visibleEvidenceCount = normalizedEvidence.length || evidenceCount;

  return (
    <div className="rounded-xl border border-[#D0D5DD] bg-white p-3 shadow-sm">
      <div className="flex items-start gap-2.5">
        <div className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[#D0D5DD] bg-[#F9FAFB] text-[#475467]">
          <ClipboardList className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1 space-y-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[13px] font-semibold text-[#101828]">Consultancy report</p>
            {inspectionDate ? (
              <span className="inline-flex items-center rounded-full border border-[#D0D5DD] bg-[#F9FAFB] px-2 py-0.5 text-[11px] text-[#344054]">
                {inspectionDate}
              </span>
            ) : null}
            {completionDeadline ? (
              <span className="inline-flex items-center rounded-full border border-[#D0D5DD] bg-[#F9FAFB] px-2 py-0.5 text-[11px] text-[#344054]">
                Due {completionDeadline}
              </span>
            ) : null}
          </div>

          <div className="space-y-2 text-[12px] text-[#344054]">
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
            {visibleEvidenceCount > 0 ? (
              <div className="space-y-1.5">
                <p>
                  <span className="font-semibold text-[#101828]">Evidence:</span>{" "}
                  {visibleEvidenceCount} attachment{visibleEvidenceCount > 1 ? "s" : ""}
                </p>
                {normalizedEvidence.length > 0 ? (
                  <div className="grid gap-2 sm:grid-cols-3">
                    {normalizedEvidence.slice(0, 6).map((url, index) => (
                      <a
                        key={`${url.slice(0, 80)}-${index}`}
                        href={url}
                        target="_blank"
                        rel="noreferrer"
                        className="overflow-hidden rounded-md border border-[#D0D5DD] bg-[#F9FAFB]"
                      >
                        {isImageEvidence(url) ? (
                          <img
                            src={url}
                            alt={`Evidence ${index + 1}`}
                            className="h-20 w-full object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <span className="flex h-20 items-center justify-center px-2 text-center text-[11px] text-[#475467]">
                            Open evidence {index + 1}
                          </span>
                        )}
                      </a>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
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
