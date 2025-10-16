import { useQuery } from "@tanstack/react-query";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getQueryFn } from "@/lib/queryClient";

type Status = "pending" | "assigned" | "in_progress" | "completed" | "cancelled";

type ServiceRequest = {
  id: string;
  category: string;
  description: string;
  status: Status;
  createdAt: string;
  billedAmount?: number | string | null;
};

function statusClass(s: Status) {
  switch (s) {
    case "pending": return "bg-gray-100 text-gray-800";
    case "assigned": return "bg-blue-100 text-blue-800";
    case "in_progress": return "bg-yellow-100 text-yellow-800";
    case "completed": return "bg-green-100 text-green-800";
    case "cancelled": return "bg-red-100 text-red-800";
    default: return "bg-gray-100 text-gray-800";
  }
}

export default function MyRequestsList() {
  const { data = [], error } = useQuery<ServiceRequest[], Error>({
    // Your resident GET should return only the current user's requests.
    // If your API needs an explicit filter, change to `/api/service-requests?me=1`.
    queryKey: ["/api/service-requests"],
    queryFn: getQueryFn<ServiceRequest[]>({ on401: "returnNull" }),
    refetchInterval: 5000,
  });

  if (error) {
    return (
      <Card>
        <CardHeader>
          <div className="text-lg font-semibold">My Requests</div>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-red-600">
            Failed to load: {error.message}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data || data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <div className="text-lg font-semibold">My Requests</div>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">No requests yet.</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="text-lg font-semibold">My Requests</div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {data.map((r) => (
            <div key={r.id} className="border rounded-lg p-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-semibold">
                    {r.category?.replaceAll("_", " ")} •{" "}
                    <span className="text-xs text-muted-foreground">
                      {new Date(r.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {r.description}
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <Badge className={statusClass(r.status)}>
                      {r.status.replaceAll("_", " ")}
                    </Badge>
                    {r.billedAmount ? (
                      <Badge>₦ {Number(r.billedAmount).toLocaleString()}</Badge>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
