import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

type RequestStatus = "pending" | "assigned" | "in_progress" | "completed" | "cancelled";

interface ServiceRequest {
  id: string;
  category: string;
  description: string;
  status: RequestStatus;
  providerId?: string;
  createdAt: string;
  billedAmount?: string;
}

export default function ArtisanRequestsPanel() {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<RequestStatus | "all">("pending");

  // Build a PATH-ONLY url (let queryClient.ts add the base)
  const path = useMemo(() => {
    const sp = new URLSearchParams();
    if (status !== "all") sp.set("status", status);
    if (q.trim()) sp.set("q", q.trim());
    const qs = sp.toString();
    return `/api/super-admin/service-requests${qs ? `?${qs}` : ""}`;
  }, [status, q]);

  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useQuery<ServiceRequest[]>({
    queryKey: [path],            // IMPORTANT: path only; the queryClient resolver prefixes VITE_API_URL
    refetchInterval: 5000,
  });

  const requests = data ?? [];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-4">
          <div className="text-lg font-semibold">Artisan Requests</div>
          <div className="flex gap-2 items-center">
            <select
              className="px-3 py-2 border rounded-md bg-background"
              value={status}
              onChange={(e) => setStatus(e.target.value as any)}
            >
              <option value="pending">Pending</option>
              <option value="assigned">Assigned</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
              <option value="all">All</option>
            </select>
            <Input
              placeholder="Search description..."
              className="w-64"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
              {isFetching ? "Refreshing…" : "Refresh"}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Loading */}
        {isLoading && (
          <div className="text-sm text-muted-foreground">Loading requests…</div>
        )}

        {/* Error */}
        {isError && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm">
            <div className="font-medium text-red-700 mb-1">Failed to load requests</div>
            <div className="text-red-600">
              {(error as any)?.message || "Unknown error"}
            </div>
            <div className="text-xs text-red-600 mt-2">
              If you see <code>401</code> or <code>403</code>, make sure you’re logged in as <b>SUPER_ADMIN</b>
              and that your frontend can send cookies to the API (CORS with credentials).
            </div>
          </div>
        )}

        {/* Empty */}
        {!isLoading && !isError && requests.length === 0 && (
          <div className="text-sm text-muted-foreground">No requests.</div>
        )}

        {/* List */}
        {!isLoading && !isError && requests.length > 0 && (
          <div className="space-y-3">
            {requests.map((r) => (
              <div key={r.id} className="border rounded-lg p-4 flex items-start justify-between">
                <div>
                  <div className="font-semibold">
                    {r.category?.replace("_", " ") || "Request"}
                  </div>
                  <div className="text-sm text-muted-foreground">{r.description}</div>
                  <div className="mt-2 flex items-center gap-2">
                    <Badge variant="secondary">{r.status.replace("_", " ")}</Badge>
                    {r.billedAmount && (
                      <Badge>₦ {Number(r.billedAmount).toLocaleString()}</Badge>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline">View</Button>
                  {r.status === "pending" && <Button size="sm">Assign</Button>}
                  {r.status === "in_progress" && <Button size="sm">Bill</Button>}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
