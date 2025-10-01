import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { AdminAPI } from "@/lib/adminApi";

type RequestStatus = "pending" | "assigned" | "in_progress" | "completed" | "cancelled";

interface ServiceRequest {
  id: string;
  category: string;
  description: string;
  status: RequestStatus;
  providerId?: string;
  createdAt: string;
  billedAmount?: string | number;
}

export default function ArtisanRequestsPanel() {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<RequestStatus | "all">("pending");

  // SERVER accepts status/category/providerId/residentId; it doesn't support "q"
  // We'll do client-side text filtering for q.
  const {
    data,
    isLoading,
    isError,
    error,
    isFetching,
    refetch,
  } = useQuery<ServiceRequest[]>({
    queryKey: ["bridge-service-requests", status],
    queryFn: async () => {
      const params = status !== "all" ? { status } : undefined;
      // ✅ Uses AdminAPI, which adds Authorization + x-estate-id headers
      return AdminAPI.bridge.getServiceRequests(params);
    },
    refetchInterval: 5000,
  });

  const requests = useMemo(() => {
    const list = data ?? [];
    const ql = q.trim().toLowerCase();
    if (!ql) return list;
    return list.filter((r) =>
      (r.description || "").toLowerCase().includes(ql) ||
      (r.category || "").toLowerCase().includes(ql)
    );
  }, [data, q]);

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
              placeholder="Search description or category…"
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
              If this says <code>401</code> or <code>403</code>, make sure you’re logged in as a{' '}
              <b>SUPER_ADMIN / Estate Admin</b> and that an estate is selected (the page auto-selects your first estate).
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
