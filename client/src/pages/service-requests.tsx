import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { residentFetch } from "@/lib/residentApi";
import { formatServiceRequestStatusLabel, normalizeServiceRequestStatus } from "@/lib/serviceRequestStatus";
import { format } from "date-fns";
import Nav from "@/components/layout/Nav";
import MobileNavDrawer from "@/components/layout/MobileNavDrawer";

const statusStyles: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800",
  pending_inspection: "bg-amber-100 text-amber-800",
  assigned: "bg-purple-100 text-purple-800",
  assigned_for_job: "bg-indigo-100 text-indigo-800",
  in_progress: "bg-sky-100 text-sky-800",
  completed: "bg-emerald-100 text-emerald-800",
  cancelled: "bg-rose-100 text-rose-800",
};

function StatusBadge({ status, category }: { status: string; category?: string }) {
  const normalizedStatus = normalizeServiceRequestStatus(status);
  const label = formatServiceRequestStatusLabel(normalizedStatus, category);
  const classes = statusStyles[normalizedStatus] ?? "bg-gray-100 text-gray-800";
  return (
    <Badge className={`text-xs rounded-full px-3 py-1 ${classes}`}>
      {label}
    </Badge>
  );
}

type ServiceRequest = {
  id: string;
  description?: string;
  category?: string;
  status: string;
  paymentStatus?: string | null;
  urgency?: string;
  createdAt?: string;
  budget?: string;
};

export default function ServiceRequestsPage() {
  const [location, navigate] = useLocation();
  const selectedRequestId = (() => {
    if (typeof window === "undefined") return null;
    return new URLSearchParams(window.location.search).get("id");
  })();

  const { data, isLoading, error } = useQuery<
    { data: ServiceRequest[] },
    Error
  >({
    queryKey: ["/api/service-requests/my"],
    queryFn: () =>
      residentFetch<{ data: ServiceRequest[] }>("/api/service-requests/my"),
    staleTime: 30_000,
  });

  const {
    data: selectedRequest,
    isLoading: selectedIsLoading,
    error: selectedError,
  } = useQuery<ServiceRequest, Error>({
    queryKey: ["/api/service-requests", selectedRequestId],
    queryFn: () => residentFetch<ServiceRequest>(`/api/service-requests/${selectedRequestId}`),
    enabled: Boolean(selectedRequestId),
    staleTime: 30_000,
  });

  const requests = data?.data ?? [];

  const handleNavigateToHomepage = () => navigate("/resident");
  const handleNavigateToMarketplace = () => navigate("/resident/citymart");
  const handleNavigateToSettings = () => navigate("/resident/settings");
  const handleNavigateToChat = () => navigate("/resident/requests/new");

  return (
    <div className="flex h-screen overflow-hidden bg-[#054f31]" data-name="Service requests">
      <MobileNavDrawer
        onNavigateToHomepage={handleNavigateToHomepage}
        onNavigateToMarketplace={handleNavigateToMarketplace}
        onNavigateToSettings={handleNavigateToSettings}
        onBookServiceClick={handleNavigateToChat}
        onNavigateToServiceRequests={() => navigate("/service-requests")}
        onNavigateToOrdinaryFlow={() => navigate("/resident/requests/ordinary")}
        currentPage="requests"
      />

      <div className="hidden lg:block h-full">
        <Nav
          onNavigateToHomepage={handleNavigateToHomepage}
          onNavigateToMarketplace={handleNavigateToMarketplace}
          onNavigateToSettings={handleNavigateToSettings}
          onBookServiceClick={handleNavigateToChat}
          onNavigateToServiceRequests={() => navigate("/service-requests")}
          onNavigateToOrdinaryFlow={() => navigate("/resident/requests/ordinary")}
          currentPage="requests"
        />
      </div>

      <div className="flex-1 min-w-0 h-full bg-white rounded-bl-[40px] rounded-tl-[40px] lg:ml-[14px] lg:mt-[12px] overflow-y-auto">
        <div className="max-w-5xl mx-auto p-[32px] space-y-[16px]">
          <div className="flex items-start justify-between gap-[12px]">
            <div className="min-w-0">
              <p className="font-['General_Sans:Semibold',sans-serif] text-[20px] leading-[28px] text-[#101828]">
                Service requests
              </p>
              <p className="font-['General_Sans:Regular',sans-serif] text-[14px] leading-[20px] text-[#475467]">
                Track the status of every request you’ve submitted.
              </p>
            </div>
            <div className="shrink-0">
              <Button
                variant="outline"
                className="rounded-full"
                onClick={handleNavigateToChat}
              >
                Book a service
              </Button>
            </div>
          </div>

          {selectedRequestId ? (
            <Card className="rounded-3xl border border-gray-100 shadow-sm">
              <CardHeader className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <CardTitle>Request details</CardTitle>
                  <Link href="/service-requests">
                    <Button variant="ghost" className="rounded-full">
                      View all
                    </Button>
                  </Link>
                </div>

                {selectedIsLoading ? (
                  <p className="text-sm text-[#475467]">Loading request…</p>
                ) : selectedError ? (
                  <p className="text-sm text-rose-700">Couldn’t load this request. Try refreshing.</p>
                ) : selectedRequest ? (
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge status={selectedRequest.status} category={selectedRequest.category} />
                      {selectedRequest.paymentStatus ? (
                        <span className="px-2 py-1 bg-emerald-50 text-emerald-700 rounded-full text-[11px]">
                          Payment: {selectedRequest.paymentStatus}
                        </span>
                      ) : null}
                      {selectedRequest.urgency ? (
                        <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded-full text-[11px]">
                          {selectedRequest.urgency.replace("_", " ")}
                        </span>
                      ) : null}
                    </div>
                    <p className="text-sm text-[#475467] break-words">
                      {selectedRequest.description || "Service request"}
                    </p>
                    <p className="text-xs text-[#667085]">
                      Submitted{" "}
                      {selectedRequest.createdAt
                        ? format(new Date(selectedRequest.createdAt), "PPP p")
                        : "just now"}
                      {selectedRequest.budget ? ` • Budget: ${selectedRequest.budget}` : ""}
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-[#475467]">No request found.</p>
                )}
              </CardHeader>
            </Card>
          ) : null}

          {isLoading && (
            <Card className="rounded-3xl border border-dashed border-gray-200 bg-white/60">
              <CardContent className="py-6 text-center text-sm text-gray-500">
                Loading your service requests…
              </CardContent>
            </Card>
          )}

          {error && (
            <Card className="rounded-2xl border border-rose-100 bg-rose-50/60">
              <CardContent className="py-6">
                <p className="text-sm text-rose-700">
                  Failed to load service requests. Please refresh the page.
                </p>
              </CardContent>
            </Card>
          )}

          {!isLoading && requests.length === 0 && (
            <Card className="rounded-2xl border border-dashed border-gray-200 bg-white/60">
              <CardContent className="text-center space-y-3 py-8">
                <p className="text-sm text-gray-600">
                  You haven’t submitted any service requests yet.
                </p>
                <Button
                  variant="default"
                  className="rounded-full"
                  onClick={handleNavigateToChat}
                >
                  Book a service
                </Button>
              </CardContent>
            </Card>
          )}

          <div className="space-y-4">
            {requests.map((request) => {
              const isSelected = Boolean(selectedRequestId) && request.id === selectedRequestId;
              const href = `/service-requests?id=${encodeURIComponent(request.id)}`;

              return (
                <Link key={request.id} href={href}>
                      <Card
                      className={`rounded-3xl border shadow-sm transition-colors ${
                        isSelected ? "border-emerald-200 bg-emerald-50/30" : "border-gray-100"
                      }`}
                    >
                      <CardHeader className="flex flex-col space-y-2 gap-2">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm text-muted-foreground uppercase tracking-wider">
                              {request.category?.replace("_", " ") ?? "Service"}
                            </p>
                            <h3 className="text-lg font-semibold text-gray-900">
                              {request.description ?? "Pending service request"}
                            </h3>
                          </div>
                          <StatusBadge status={request.status} category={request.category} />
                        </div>
                        <div className="flex flex-wrap gap-2 text-xs text-gray-500">
                          <span>
                            Submitted{" "}
                            {request.createdAt
                              ? format(new Date(request.createdAt), "PPP p")
                              : "just now"}
                          </span>
                          {request.urgency && (
                            <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded-full">
                              {request.urgency.replace("_", " ")}
                            </span>
                          )}
                          {request.paymentStatus && (
                            <span className="px-2 py-1 bg-emerald-50 text-emerald-700 rounded-full text-[11px]">
                              Payment: {request.paymentStatus}
                            </span>
                          )}
                        </div>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <div className="flex flex-col gap-2 text-sm text-gray-600">
                          <p>
                            Budget:{" "}
                            <span className="font-medium">{request.budget ?? "N/A"}</span>
                          </p>
                        </div>
                      </CardContent>
                    </Card>
              </Link>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
