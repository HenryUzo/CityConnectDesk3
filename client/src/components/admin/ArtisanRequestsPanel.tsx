import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { getQueryFn } from "@/lib/queryClient";

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

  const search = encodeURIComponent(q.trim());
  const statusParam = status === "all" ? "" : status;

  const { data: requests = [], error } = useQuery<ServiceRequest[], Error>({
    // IMPORTANT: use the admin bridge route that exists in your server
    queryKey: [
      `/api/admin/bridge/service-requests?status=${statusParam}&q=${search}`,
    ],
    queryFn: getQueryFn<ServiceRequest[]>({ on401: "throw" }),
    refetchInterval: 5000,
  });

  if (error) {
    return (
      <Card>
        <CardHeader>
          <div className="text-lg font-semibold">Artisan Requests</div>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-red-600">
            Failed to load requests<br />
            {error.message}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-4">
          <div className="text-lg font-semibold">Artisan Requests</div>
          <div className="flex gap-2">
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
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {requests.map((r) => (
            <div key={r.id} className="border rounded-lg p-4 flex items-start justify-between">
              <div>
                <div className="font-semibold">
                  {r.category?.replaceAll("_", " ") || "Request"}
                </div>
                <div className="text-sm text-muted-foreground">{r.description}</div>
                <div className="mt-2 flex items-center gap-2">
                  <Badge variant="secondary">{r.status.replaceAll("_", " ")}</Badge>
                  {r.billedAmount && (
                    <Badge>₦ {Number(r.billedAmount).toLocaleString()}</Badge>
                  )}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {new Date(r.createdAt).toLocaleString()}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline">View</Button>
                {r.status === "pending" && <Button size="sm">Assign</Button>}
                {r.status === "in_progress" && <Button size="sm">Bill</Button>}
              </div>
            </div>
          ))}
          {requests.length === 0 && (
            <div className="text-sm text-muted-foreground">No requests.</div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
