import type { ServiceRequest } from "@shared/schema";
import { normalizeCategoryKey, resolveServiceRequestCategory } from "./serviceCategoryResolver";

type LooseRequest = Partial<ServiceRequest> & Record<string, any>;

type RelatedParty = {
  id?: string | null;
  name?: string | null;
  phone?: string | null;
  email?: string | null;
  location?: string | null;
  company?: string | null;
  rating?: string | number | null;
};

function firstText(...values: Array<unknown>): string {
  for (const value of values) {
    const text = String(value ?? "").trim();
    if (text) return text;
  }
  return "";
}

function toOptionalNumber(value: unknown): number | null {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : null;
}

function toOptionalInteger(value: unknown): number | null {
  const amount = Number(value);
  return Number.isInteger(amount) ? amount : null;
}

function humanizeCategoryKey(value?: string | null): string {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) return "Service request";
  return normalized
    .replace(/_/g, " ")
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

export function parseLegacyRequestDescription(description?: string | null) {
  const source = String(description || "").trim();
  if (!source) {
    return {
      issueType: "",
      areaAffected: "",
      quantityLabel: "",
      timeWindowLabel: "",
      urgencyLabel: "",
      locationLabel: "",
      notes: "",
      photosCount: null as number | null,
    };
  }

  const boundaryLabels =
    "Issue|Quantity|Preferred time|Time window|Urgency|Location|Notes|Photos attached|Attachments|Photos|Which area is affected";
  const pick = (labelPattern: string) => {
    const regex = new RegExp(
      `${labelPattern}:\\s*([\\s\\S]*?)(?=\\n|\\s(?:${boundaryLabels}):|$)`,
      "i",
    );
    return source.match(regex)?.[1]?.trim() || "";
  };

  const photosText = pick("Photos attached|Attachments|Photos");
  const photosMatch = photosText.match(/(\d+)/);

  return {
    issueType: pick("Issue"),
    areaAffected: pick("Which area is affected"),
    quantityLabel: pick("Quantity"),
    timeWindowLabel: pick("Preferred time|Time window"),
    urgencyLabel: pick("Urgency"),
    locationLabel: pick("Location"),
    notes: pick("Notes"),
    photosCount: photosMatch ? Number(photosMatch[1]) : null,
  };
}

export function readConsultancyReportSummary(report: unknown) {
  if (!report || typeof report !== "object") {
    return null;
  }

  const raw = report as Record<string, unknown>;
  const materialCost = toOptionalNumber(raw.materialCost) ?? 0;
  const serviceCost = toOptionalNumber(raw.serviceCost) ?? 0;
  const totalRecommendation =
    toOptionalNumber(raw.totalRecommendation) ?? materialCost + serviceCost;

  return {
    inspectionDate: firstText(raw.inspectionDate),
    completionDeadline: firstText(raw.completionDeadline),
    actualIssue: firstText(raw.actualIssue),
    causeOfIssue: firstText(raw.causeOfIssue),
    preventiveRecommendation: firstText(raw.preventiveRecommendation),
    evidence: Array.isArray(raw.evidence)
      ? raw.evidence
          .map((item) => String(item || "").trim())
          .filter(Boolean)
      : [],
    materialCost,
    serviceCost,
    totalRecommendation,
    submittedAt: firstText(raw.submittedAt),
  };
}

export function buildStructuredServiceRequestFields(source: LooseRequest) {
  const parsed = parseLegacyRequestDescription(source.description);
  const report = readConsultancyReportSummary(source.consultancyReport);
  const rawCategory = firstText(source.category);
  const explicitCategoryLabel = firstText(source.categoryLabel);
  const inferredCategoryFromText = resolveServiceRequestCategory(
    "",
    [explicitCategoryLabel, parsed.issueType, source.description].filter(Boolean).join(" "),
  );
  const presentationCategoryKey =
    rawCategory && normalizeCategoryKey(rawCategory) !== "maintenance_repair"
      ? rawCategory
      : inferredCategoryFromText || rawCategory;

  const materialCost = toOptionalNumber(source.materialCost) ?? report?.materialCost ?? null;
  const serviceCost = toOptionalNumber(source.serviceCost) ?? report?.serviceCost ?? null;
  const consultancyFee = toOptionalNumber(source.consultancyFee);
  const requestedTotal =
    toOptionalNumber(source.requestedTotal) ??
    toOptionalNumber(source.billedAmount) ??
    report?.totalRecommendation ??
    ((materialCost ?? 0) + (serviceCost ?? 0) + (consultancyFee ?? 0));

  return {
    categoryLabel:
      explicitCategoryLabel ||
      humanizeCategoryKey(presentationCategoryKey || rawCategory || inferredCategoryFromText),
    issueType: firstText(source.issueType, parsed.issueType),
    areaAffected: firstText(source.areaAffected, parsed.areaAffected),
    quantityLabel: firstText(source.quantityLabel, parsed.quantityLabel),
    timeWindowLabel: firstText(source.timeWindowLabel, parsed.timeWindowLabel),
    photosCount:
      toOptionalInteger(source.photosCount) ??
      parsed.photosCount ??
      (source.attachmentsCount ? Number(source.attachmentsCount) : null),
    addressLine: firstText(source.addressLine, source.location, parsed.locationLabel),
    estateName: firstText(source.estateName),
    stateName: firstText(source.stateName),
    lgaName: firstText(source.lgaName),
    paymentPurpose:
      firstText(source.paymentPurpose) ||
      ((materialCost ?? 0) > 0 || (serviceCost ?? 0) > 0
        ? "Job execution payment"
        : "Consultancy / inspection"),
    consultancyFee,
    materialCost,
    serviceCost,
    requestedTotal: requestedTotal > 0 ? requestedTotal : null,
    assignedInspectorId: firstText(source.assignedInspectorId) || null,
    assignedJobProviderId: firstText(source.assignedJobProviderId) || null,
  };
}

export function buildServiceRequestDetailViewModel(
  request: LooseRequest,
  related: {
    resident?: RelatedParty | null;
    provider?: RelatedParty | null;
    inspector?: RelatedParty | null;
    jobProvider?: RelatedParty | null;
    estate?: { id?: string | null; name?: string | null } | null;
  },
) {
  const structured = buildStructuredServiceRequestFields(request);
  const parsed = parseLegacyRequestDescription(request.description);
  const report = readConsultancyReportSummary(request.consultancyReport);
  const status = normalizeCategoryKey(request.status || "pending");
  const paymentStatus = normalizeCategoryKey(request.paymentStatus || "pending");
  const isPaid = paymentStatus === "paid";
  const hasPaymentRequest = Boolean(request.paymentRequestedAt);
  const inspectorId =
    structured.assignedInspectorId ||
    (status === "assigned_for_inspection" ? firstText(request.providerId) : "");
  const jobProviderId =
    structured.assignedJobProviderId ||
    (
      [
        "assigned_for_job",
        "assigned_for_maintenance",
        "in_progress",
        "work_completed_pending_resident",
        "disputed",
        "rework_required",
        "completed",
      ].includes(status)
      ? firstText(request.providerId)
      : "");
  const ownerType = jobProviderId
    ? "job_provider"
    : inspectorId
      ? "inspector"
      : "unassigned";
  const owner =
    ownerType === "job_provider"
      ? related.jobProvider || related.provider || null
      : ownerType === "inspector"
        ? related.inspector || related.provider || null
        : null;
  const hasReport = Boolean(
    request.consultancyReportSubmittedAt ||
      report?.inspectionDate ||
      report?.actualIssue ||
      report?.preventiveRecommendation,
  );

  return {
    ...request,
    categoryLabel: structured.categoryLabel,
    title: `${structured.categoryLabel || "Service request"} Request`,
    resident: related.resident || null,
    provider: related.provider || null,
    inspector:
      related.inspector ||
      (ownerType === "inspector" ? related.provider || null : null) ||
      null,
    jobProvider:
      related.jobProvider ||
      (ownerType === "job_provider" ? related.provider || null : null) ||
      null,
    currentOwner: {
      type: ownerType,
      label:
        ownerType === "job_provider"
          ? "Job provider"
          : ownerType === "inspector"
            ? "Inspector"
            : "Unassigned",
      user: owner,
    },
    requestSummary: {
      issueType: structured.issueType || structured.categoryLabel,
      areaAffected: structured.areaAffected || "Not set",
      quantityLabel: structured.quantityLabel || "Not set",
      timeWindowLabel: structured.timeWindowLabel || "Not set",
      urgencyLabel: firstText(request.urgency, parsed.urgencyLabel) || "Not set",
      notes: firstText(request.specialInstructions, parsed.notes) || "",
      photosCount: structured.photosCount ?? 0,
    },
    locationSummary: {
      addressLine: structured.addressLine || "Not provided",
      estateName: structured.estateName || firstText(related.estate?.name) || "",
      stateName: structured.stateName || "",
      lgaName: structured.lgaName || "",
      display:
        [
          structured.addressLine,
          structured.estateName || firstText(related.estate?.name),
          structured.lgaName,
          structured.stateName,
        ]
          .filter(Boolean)
          .join(", ") || firstText(request.location, parsed.locationLabel) || "Not provided",
    },
    attachments: {
      count: structured.photosCount ?? 0,
    },
    providerReport: report,
    paymentSummary: {
      purpose: structured.paymentPurpose,
      consultancyFee: structured.consultancyFee,
      materialCost: structured.materialCost,
      serviceCost: structured.serviceCost,
      requestedTotal: structured.requestedTotal,
      billedAmount: toOptionalNumber(request.billedAmount) ?? 0,
      status: firstText(request.paymentStatus) || "not requested",
      requestedAt: request.paymentRequestedAt || null,
      approvedForJobAt: request.approvedForJobAt || null,
    },
    timeline: {
      createdAt: request.createdAt || null,
      assignedAt: request.assignedAt || null,
      paymentRequestedAt: request.paymentRequestedAt || null,
      consultancyReportSubmittedAt:
        request.consultancyReportSubmittedAt || report?.submittedAt || null,
      approvedForJobAt: request.approvedForJobAt || null,
      closedAt: request.closedAt || null,
    },
    nextActions: {
      canAssignProvider:
        !inspectorId &&
        !jobProviderId &&
        ["draft", "pending", "pending_inspection"].includes(status),
      canChangeInspector:
        Boolean(inspectorId) && ["pending_inspection", "assigned_for_inspection"].includes(status),
      canRequestPayment: hasReport && !hasPaymentRequest && !isPaid,
      canAssignForJob:
        isPaid &&
        !jobProviderId &&
        ["pending_inspection", "assigned_for_inspection", "assigned", "pending"].includes(status),
      canChangeProvider: isPaid && Boolean(jobProviderId),
    },
    rawAnswers: {
      description: firstText(request.description),
      parsed,
    },
  };
}
