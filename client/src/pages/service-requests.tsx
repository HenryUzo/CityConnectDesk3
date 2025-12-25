import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { ResidentLayout } from "@/components/resident/ResidentLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { residentFetch } from "@/lib/residentApi";
import { format } from "date-fns";

const statusStyles: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800",
  assigned: "bg-purple-100 text-purple-800",
  in_progress: "bg-sky-100 text-sky-800",
  completed: "bg-emerald-100 text-emerald-800",
  cancelled: "bg-rose-100 text-rose-800",
};

const statusLabels: Record<string, string> = {
  pending: "Pending",
  assigned: "Assigned",
  in_progress: "In Progress",
  completed: "Completed",
  cancelled: "Cancelled",
};

function StatusBadge({ status }: { status: string }) {
  const label = statusLabels[status] ?? status;
  const classes = statusStyles[status] ?? "bg-gray-100 text-gray-800";
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
  const { data, isLoading, error } = useQuery<
    { data: ServiceRequest[] },
    Error
  >({
    queryKey: ["/api/service-requests/my"],
    queryFn: () =>
      residentFetch<{ data: ServiceRequest[] }>("/api/service-requests/my"),
    staleTime: 30_000,
  });

  const requests = data?.data ?? [];

  return (
    <ResidentLayout title="Service Requests">
      <div className="space-y-6">
        <Card className="rounded-3xl">
          <CardHeader>
            <CardTitle>All your service requests</CardTitle>
            <p className="text-sm text-muted-foreground">
              Stay up to date with the status of every request you’ve submitted.
            </p>
          </CardHeader>
        </Card>

        {isLoading && (
          <CardContent className="bg-white border border-dashed border-gray-200 text-center text-sm text-gray-500">
            Loading your service requests…
          </CardContent>
        )}

        {error && (
          <Card className="rounded-2xl border border-rose-100 bg-rose-50/60">
            <CardContent>
              <p className="text-sm text-rose-700">
                Failed to load service requests. Please refresh the page.
              </p>
            </CardContent>
          </Card>
        )}

        {!isLoading && requests.length === 0 && (
          <Card className="rounded-2xl border border-dashed border-gray-200 bg-white/60">
            <CardContent className="text-center space-y-3">
              <p className="text-sm text-gray-600">
                You haven’t submitted any service requests yet.
              </p>
              <Link href="/book-artisan">
                <Button variant="default" className="rounded-full">
                  Book a Service
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}

        <div className="space-y-4">
          {requests.map((request) => (
            <Card
              key={request.id}
              className="rounded-3xl border border-gray-100 shadow-sm"
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
                  <StatusBadge status={request.status} />
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
                    Budget: <span className="font-medium">{request.budget ?? "N/A"}</span>
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </ResidentLayout>
  );
}
