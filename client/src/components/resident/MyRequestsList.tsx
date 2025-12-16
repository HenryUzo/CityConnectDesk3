import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useMyEstates } from "@/hooks/useMyEstates";
import { useServiceRequests } from "@/hooks/useServiceRequests";

export default function MyRequestsList() {
  const {
    data: estates = [],
    loading: estatesLoading,
    error: estatesError,
  } = useMyEstates();
  const estate = estates[0];
  const {
    data: requests = [],
    loading: requestsLoading,
    error: requestsError,
  } = useServiceRequests(estate?.id ?? null);

  const isLoading = estatesLoading || requestsLoading;
  const hasError = !!estatesError || !!requestsError;

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <div className="text-lg font-semibold">My Requests</div>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">Loading requests…</div>
        </CardContent>
      </Card>
    );
  }

  if (hasError) {
    return (
      <Card>
        <CardHeader>
          <div className="text-lg font-semibold">My Requests</div>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-red-600">
            Failed to load requests. Please try again later.
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!estate) {
    return (
      <Card>
        <CardHeader>
          <div className="text-lg font-semibold">My Requests</div>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">
            No estates available for your account yet.
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!requests.length) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-lg font-semibold">My Requests</div>
              <p className="text-xs text-muted-foreground">{estate.name}</p>
            </div>
            {/* Role not present on Estate; show estate name instead */}
            <Badge variant="outline">{estate.name}</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">
            No service requests yet.
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-lg font-semibold">My Requests</div>
            <p className="text-xs text-muted-foreground">{estate.name}</p>
          </div>
          {/* Role not present on Estate; show estate name instead */}
          <Badge variant="outline">{estate.name}</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {requests.map((request) => (
            <div key={request.id} className="border rounded-xl p-4 bg-white shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-base">
                    {request.title || "Untitled request"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(request.createdAt).toLocaleString()}
                  </p>
                </div>
                <Badge variant="secondary">{request.status}</Badge>
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                {request.description || "No additional details provided."}
              </p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
