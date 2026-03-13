import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Calendar,
  CheckCircle2,
  ClipboardList,
  Clock,
  Copy,
  Mail,
  MapPin,
  Phone,
  UserCheck,
  Users,
  Wrench,
} from "lucide-react";
import { adminApiRequest } from "@/lib/adminApi";
import { formatServiceRequestStatusLabel } from "@/lib/serviceRequestStatus";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface ServiceRequestDetailPageProps {
  requestId: string;
  onBack: () => void;
  onRequestPayment?: () => void;
  onAssignProvider?: () => void;
  onAssignForJob?: () => void;
  onChangeProvider?: () => void;
  onChangeInspector?: () => void;
}

type Party = {
  id?: string | null;
  name?: string | null;
  phone?: string | null;
  email?: string | null;
  location?: string | null;
  company?: string | null;
  rating?: string | number | null;
};

type RequestDetail = {
  id: string;
  category?: string;
  categoryLabel?: string;
  title?: string;
  status: string;
  urgency?: string | null;
  createdAt?: string | null;
  assignedAt?: string | null;
  paymentRequestedAt?: string | null;
  approvedForJobAt?: string | null;
  closedAt?: string | null;
  billedAmount?: string | number | null;
  paymentStatus?: string | null;
  resident?: Party | null;
  provider?: Party | null;
  inspector?: Party | null;
  jobProvider?: Party | null;
  currentOwner?: {
    type?: string;
    label?: string;
    user?: Party | null;
  } | null;
  requestSummary?: {
    issueType?: string;
    areaAffected?: string;
    quantityLabel?: string;
    timeWindowLabel?: string;
    urgencyLabel?: string;
    notes?: string;
    photosCount?: number;
  } | null;
  locationSummary?: {
    addressLine?: string;
    estateName?: string;
    stateName?: string;
    lgaName?: string;
    display?: string;
  } | null;
  attachments?: {
    count?: number;
  } | null;
  providerReport?: {
    inspectionDate?: string;
    actualIssue?: string;
    causeOfIssue?: string;
    preventiveRecommendation?: string;
    materialCost?: number;
    serviceCost?: number;
    totalRecommendation?: number;
    submittedAt?: string;
  } | null;
  paymentSummary?: {
    purpose?: string;
    consultancyFee?: number | null;
    materialCost?: number | null;
    serviceCost?: number | null;
    requestedTotal?: number | null;
    billedAmount?: number | null;
    status?: string;
    requestedAt?: string | null;
    approvedForJobAt?: string | null;
  } | null;
  timeline?: {
    createdAt?: string | null;
    assignedAt?: string | null;
    paymentRequestedAt?: string | null;
    consultancyReportSubmittedAt?: string | null;
    approvedForJobAt?: string | null;
    closedAt?: string | null;
  } | null;
  nextActions?: {
    canAssignProvider?: boolean;
    canChangeInspector?: boolean;
    canRequestPayment?: boolean;
    canAssignForJob?: boolean;
    canChangeProvider?: boolean;
  } | null;
  rawAnswers?: {
    description?: string;
  } | null;
};

const STATUS_COLORS: Record<string, string> = {
  draft: "border-slate-200 bg-slate-50 text-slate-700",
  pending: "border-slate-200 bg-slate-50 text-slate-700",
  pending_inspection: "border-amber-200 bg-amber-50 text-amber-700",
  assigned: "border-indigo-200 bg-indigo-50 text-indigo-700",
  assigned_for_inspection: "border-indigo-200 bg-indigo-50 text-indigo-700",
  assigned_for_job: "border-blue-200 bg-blue-50 text-blue-700",
  assigned_for_maintenance: "border-emerald-200 bg-emerald-50 text-emerald-700",
  in_progress: "border-blue-200 bg-blue-50 text-blue-700",
  completed: "border-emerald-200 bg-emerald-50 text-emerald-700",
  cancelled: "border-rose-200 bg-rose-50 text-rose-700",
};

const URGENCY_COLORS: Record<string, string> = {
  low: "border-emerald-200 bg-emerald-50 text-emerald-700",
  medium: "border-slate-200 bg-slate-50 text-slate-700",
  high: "border-amber-200 bg-amber-50 text-amber-700",
  emergency: "border-rose-200 bg-rose-50 text-rose-700",
};

function formatDate(value?: string | null) {
  if (!value) return "Not set";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not set";
  return date.toLocaleString();
}

function formatNgnAmount(value?: number | string | null) {
  const amount = Number(value || 0);
  if (!Number.isFinite(amount) || amount <= 0) return "Not set";
  return `NGN ${amount.toLocaleString()}`;
}

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-medium text-slate-900">{value && value.trim() ? value : "Not set"}</p>
    </div>
  );
}

export default function ServiceRequestDetailPage({
  requestId,
  onBack,
  onRequestPayment,
  onAssignProvider,
  onAssignForJob,
  onChangeProvider,
  onChangeInspector,
}: ServiceRequestDetailPageProps) {
  const { data, isLoading } = useQuery<RequestDetail>({
    queryKey: ["admin-service-request", requestId],
    queryFn: () => adminApiRequest("GET", `/api/service-requests/${requestId}`),
  });

  const statusTone = STATUS_COLORS[data?.status || ""] || "border-slate-200 bg-slate-50 text-slate-700";
  const urgencyTone = data?.urgency
    ? URGENCY_COLORS[String(data.urgency).toLowerCase()] || "border-slate-200 bg-slate-50 text-slate-700"
    : "";

  const ownerLabel = useMemo(() => {
    if (!data?.currentOwner?.label) return "Unassigned";
    const name = data.currentOwner.user?.name?.trim();
    return name ? `${data.currentOwner.label}: ${name}` : data.currentOwner.label;
  }, [data?.currentOwner]);

  if (isLoading) {
    return <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-sm text-slate-500">Loading request details...</div>;
  }

  if (!data) {
    return <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-sm text-slate-500">Request not found.</div>;
  }

  return (
    <div className="space-y-6">
      <div className="sticky top-0 z-10 rounded-2xl border border-slate-200 bg-white/95 p-5 shadow-sm backdrop-blur">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-semibold text-slate-950">{data.title || data.categoryLabel || "Service Request"}</h1>
              <Badge variant="outline" className={cn("capitalize", statusTone)}>
                {formatServiceRequestStatusLabel(data.status, data.category)}
              </Badge>
              {data.urgency ? (
                <Badge variant="outline" className={cn("capitalize", urgencyTone)}>
                  {data.urgency}
                </Badge>
              ) : null}
              <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-700 capitalize">
                {data.paymentSummary?.status || data.paymentStatus || "not requested"}
              </Badge>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600">
              <span>Request ID: {data.id}</span>
              <Button variant="ghost" size="sm" onClick={() => navigator.clipboard?.writeText(data.id)} className="h-7 px-2 text-xs">
                <Copy className="mr-1 h-3.5 w-3.5" />
                Copy ID
              </Button>
              <span>Resident: {data.resident?.name || "Not captured"}</span>
              <span>{ownerLabel}</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={onBack}>Back to requests</Button>
            {data.nextActions?.canAssignProvider ? (
              <Button size="sm" onClick={onAssignProvider}>Assign provider</Button>
            ) : null}
            {data.nextActions?.canChangeInspector ? (
              <Button variant="outline" size="sm" onClick={onChangeInspector}>Change inspector</Button>
            ) : null}
            {data.nextActions?.canRequestPayment ? (
              <Button size="sm" onClick={onRequestPayment}>Request payment</Button>
            ) : null}
            {data.nextActions?.canAssignForJob ? (
              <Button size="sm" onClick={onAssignForJob}>Assign for job</Button>
            ) : null}
            {data.nextActions?.canChangeProvider ? (
              <Button variant="outline" size="sm" onClick={onChangeProvider}>Change provider</Button>
            ) : null}
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(360px,1fr)]">
        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-2">
              <h2 className="text-base font-semibold text-slate-900">Resident</h2>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <InfoRow label="Name" value={data.resident?.name || "Not captured"} />
              <InfoRow label="Phone" value={data.resident?.phone || "Not provided"} />
              <InfoRow label="Email" value={data.resident?.email || "Not provided"} />
              <InfoRow label="Profile location" value={data.resident?.location || "Not provided"} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <h2 className="text-base font-semibold text-slate-900">Service request</h2>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <InfoRow label="Category" value={data.categoryLabel || data.category || "Not set"} />
              <InfoRow label="Issue type" value={data.requestSummary?.issueType || "Not set"} />
              <InfoRow label="Area / scope" value={data.requestSummary?.areaAffected || "Not set"} />
              <InfoRow label="Quantity" value={data.requestSummary?.quantityLabel || "Not set"} />
              <InfoRow label="Preferred time" value={data.requestSummary?.timeWindowLabel || "Not set"} />
              <InfoRow label="Urgency" value={data.requestSummary?.urgencyLabel || data.urgency || "Not set"} />
              <InfoRow label="Attachments" value={`${data.attachments?.count ?? 0} item(s)`} />
              <InfoRow label="Notes" value={data.requestSummary?.notes || "Not provided"} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <h2 className="text-base font-semibold text-slate-900">Location</h2>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2 flex items-start gap-2 text-sm text-slate-700">
                <MapPin className="mt-0.5 h-4 w-4 text-slate-400" />
                <span>{data.locationSummary?.display || "Not provided"}</span>
              </div>
              <InfoRow label="Address line" value={data.locationSummary?.addressLine || "Not provided"} />
              <InfoRow label="Estate" value={data.locationSummary?.estateName || "Not set"} />
              <InfoRow label="State" value={data.locationSummary?.stateName || "Not set"} />
              <InfoRow label="LGA" value={data.locationSummary?.lgaName || "Not set"} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-base font-semibold text-slate-900">Provider report</h2>
                {data.providerReport ? (
                  <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700">Submitted</Badge>
                ) : (
                  <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-600">Awaiting report</Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <InfoRow label="Inspection date" value={data.providerReport?.inspectionDate ? formatDate(data.providerReport.inspectionDate) : "Not set"} />
              <InfoRow label="Submitted" value={data.providerReport?.submittedAt ? formatDate(data.providerReport.submittedAt) : "Not set"} />
              <div className="sm:col-span-2"><InfoRow label="Actual issue" value={data.providerReport?.actualIssue || "Not provided"} /></div>
              <div className="sm:col-span-2"><InfoRow label="Cause of issue" value={data.providerReport?.causeOfIssue || "Not provided"} /></div>
              <InfoRow label="Material cost" value={formatNgnAmount(data.providerReport?.materialCost)} />
              <InfoRow label="Service cost" value={formatNgnAmount(data.providerReport?.serviceCost)} />
              <div className="sm:col-span-2"><InfoRow label="Preventive recommendation" value={data.providerReport?.preventiveRecommendation || "Not provided"} /></div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <h2 className="text-base font-semibold text-slate-900">Raw answers / conversation snapshot</h2>
            </CardHeader>
            <CardContent>
              <details className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                <summary className="cursor-pointer font-medium text-slate-900">Show raw captured answers</summary>
                <pre className="mt-3 whitespace-pre-wrap break-words font-sans text-sm text-slate-700">{data.rawAnswers?.description || "No raw answers captured."}</pre>
              </details>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-2">
              <h2 className="text-base font-semibold text-slate-900">Operations</h2>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-slate-700">
              <div className="flex items-center gap-2"><Users className="h-4 w-4 text-slate-400" />Resident: {data.resident?.name || "Not captured"}</div>
              <div className="flex items-center gap-2"><UserCheck className="h-4 w-4 text-slate-400" />Inspector: {data.inspector?.name || "Not assigned"}</div>
              <div className="flex items-center gap-2"><Wrench className="h-4 w-4 text-slate-400" />Job provider: {data.jobProvider?.name || "Not assigned"}</div>
              <div className="flex items-center gap-2"><ClipboardList className="h-4 w-4 text-slate-400" />Current owner: {ownerLabel}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <h2 className="text-base font-semibold text-slate-900">Timeline</h2>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-slate-700">
              <div className="flex items-center gap-2"><Calendar className="h-4 w-4 text-slate-400" />Created: {formatDate(data.timeline?.createdAt || data.createdAt)}</div>
              <div className="flex items-center gap-2"><UserCheck className="h-4 w-4 text-slate-400" />Assigned: {formatDate(data.timeline?.assignedAt || data.assignedAt)}</div>
              <div className="flex items-center gap-2"><Clock className="h-4 w-4 text-slate-400" />Payment requested: {formatDate(data.timeline?.paymentRequestedAt || data.paymentRequestedAt)}</div>
              <div className="flex items-center gap-2"><ClipboardList className="h-4 w-4 text-slate-400" />Report submitted: {formatDate(data.timeline?.consultancyReportSubmittedAt)}</div>
              <div className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-slate-400" />Approved for job: {formatDate(data.timeline?.approvedForJobAt || data.approvedForJobAt)}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <h2 className="text-base font-semibold text-slate-900">Payment</h2>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-slate-700">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Purpose</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">{data.paymentSummary?.purpose || "Not set"}</p>
              </div>
              <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-4">
                <div className="flex items-center justify-between"><span>Consultancy fee</span><span className="font-medium">{formatNgnAmount(data.paymentSummary?.consultancyFee)}</span></div>
                <div className="flex items-center justify-between"><span>Material cost</span><span className="font-medium">{formatNgnAmount(data.paymentSummary?.materialCost)}</span></div>
                <div className="flex items-center justify-between"><span>Service cost</span><span className="font-medium">{formatNgnAmount(data.paymentSummary?.serviceCost)}</span></div>
                <div className="flex items-center justify-between border-t border-slate-200 pt-2"><span className="font-medium text-slate-900">Requested total</span><span className="font-semibold text-slate-900">{formatNgnAmount(data.paymentSummary?.requestedTotal || data.paymentSummary?.billedAmount || data.billedAmount)}</span></div>
                <div className="flex items-center justify-between"><span>Status</span><span className="font-medium capitalize">{data.paymentSummary?.status || data.paymentStatus || "not requested"}</span></div>
                <div className="flex items-center justify-between"><span>Requested on</span><span className="font-medium">{formatDate(data.paymentSummary?.requestedAt || data.paymentRequestedAt)}</span></div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <h2 className="text-base font-semibold text-slate-900">Contact context</h2>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-slate-700">
              <div className="flex items-center gap-2"><Phone className="h-4 w-4 text-slate-400" />Resident phone: {data.resident?.phone || "Not provided"}</div>
              <div className="flex items-center gap-2"><Mail className="h-4 w-4 text-slate-400" />Resident email: {data.resident?.email || "Not provided"}</div>
              <div className="flex items-center gap-2"><Phone className="h-4 w-4 text-slate-400" />Provider phone: {data.currentOwner?.user?.phone || data.provider?.phone || "Not provided"}</div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
