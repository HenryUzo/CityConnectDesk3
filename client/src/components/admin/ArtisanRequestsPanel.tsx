import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AdminAPI } from "@/lib/adminApi";

type RequestStatus =
  | "pending"
  | "assigned"
  | "in_progress"
  | "completed"
  | "cancelled";

interface ServiceRequest {
  id: string;
  category: string;
  description: string;
  status: RequestStatus;
  providerId?: string;
  createdAt: string;
  billedAmount?: string | number;
}

interface ArtisanRequestsPanelProps {
  selectedEstateId: string | null;
  estates: any[];
  onSelectEstate: (estateId: string | null) => void;
}

export default function ArtisanRequestsPanel({
  selectedEstateId,
  estates,
  onSelectEstate,
}: ArtisanRequestsPanelProps) {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<RequestStatus | "all">("pending");
  const enabled = Boolean(selectedEstateId);

  const estateOptions = (Array.isArray(estates) ? estates : [])
    .map((estate, idx) => {
      const id = estate?._id || estate?.id || estate?.slug || `estate-${idx}`;
      return id ? { value: String(id), label: estate.name || estate.slug || id } : null;
    })
    .filter(Boolean) as { value: string; label: string }[];

  const { data, isLoading, error } = useQuery<ServiceRequest[], Error>({
    queryKey: [
      "admin.bridge.service-requests",
      { status, q, estateId: selectedEstateId },
    ],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (status !== "all") params.status = status;
      if (q.trim()) params.q = q.trim();
      // Use the typed AdminAPI wrapper: returns JSON directly
      return await AdminAPI.bridge.getServiceRequests(params);
    },
    enabled,
    refetchInterval: enabled ? 5000 : false,
    placeholderData: (prev) => prev,
  });

  const requests = useMemo<ServiceRequest[]>(() => {
    const list = data ?? [];
    const needle = q.trim().toLowerCase();
    if (!needle) return list;
    return list.filter(
      (r) =>
        r.description?.toLowerCase().includes(needle) ||
        r.category?.toLowerCase().includes(needle) ||
        r.id?.toLowerCase().includes(needle)
    );
  }, [data, q]);

  return (
    <Card className="p-0">
      <div
        className="relative h-32 w-full overflow-hidden rounded-t-xl"
        style={{
          backgroundImage:
            "linear-gradient(90deg, rgba(15,23,42,0.95), rgba(15,23,42,0.4)), url('https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&w=1600&q=80')",
        }}
      >
        <div className="absolute inset-0" />
        <div className="relative h-full flex items-center px-6">
          <h2 className="text-white font-semibold text-xl">Artisan Requests</h2>
        </div>
      </div>
      <CardHeader className="pt-6">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <span className="text-xs text-muted-foreground">Estate</span>
            <div className="w-full sm:w-64">
              <Select
                value={selectedEstateId ?? ""}
                onValueChange={(value) => onSelectEstate(value || null)}
              >
                <SelectTrigger data-testid="select-requests-estate">
                  <SelectValue placeholder="Select an estate" />
                </SelectTrigger>
                <SelectContent>
                  {estateOptions.length > 0 ? (
                    estateOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                  ))
                ) : (
                  <SelectItem value="none" disabled>
                    {enabled ? "No estates available" : "Loading estates..."}
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
            </div>
          </div>
          <Badge variant="outline" className="text-xs text-muted-foreground">
            {selectedEstateId
              ? estateOptions.find((option) => option.value === selectedEstateId)?.label ||
                "Selected estate"
              : "No estate selected"}
          </Badge>
        </div>
      </CardHeader>
      <div className="px-4 sm:px-6 pb-3 space-y-3">
        <div className="flex flex-col sm:flex-row gap-2">
          <select
            className="px-3 py-2 border rounded-md bg-background w-full sm:w-48"
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
            className="w-full sm:w-64"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
      </div>
      <CardContent>
        {error ? (
          <div className="text-sm text-red-600 whitespace-pre-wrap">
            Failed to load requests{"\n"}
            {error.message}
            {"\n\n"}
            <span className="text-xs text-muted-foreground">
              Tip: log in as an Admin and select an estate so we can show its
              artisan requests.
            </span>
          </div>
        ) : !enabled ? (
          <div className="text-sm text-muted-foreground">
            Select an estate to view artisan service requests.
          </div>
        ) : isLoading ? (
          <div className="text-sm text-muted-foreground">Loading...</div>
        ) : requests.length === 0 ? (
          <div className="text-sm text-muted-foreground">No requests.</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
            {requests.map((r: ServiceRequest) => (
              <div
                key={r.id}
                className="border border-border rounded-xl p-4 flex flex-col gap-3 bg-white dark:bg-gray-900 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="font-semibold text-base capitalize">
                    {r.category?.replaceAll("_", " ") || "Request"}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="default"
                      className="bg-emerald-50 text-emerald-600 border-0 px-2 py-1 text-xs"
                    >
                      {r.status.replaceAll("_", " ")}
                    </Badge>
                    {r.billedAmount && (
                      <Badge
                        variant="secondary"
                        className="px-2 py-1 text-xs"
                      >
                        ₦ {Number(r.billedAmount).toLocaleString()}
                      </Badge>
                    )}
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">
                  {r.description}
                </p>
                <p className="text-xs text-muted-foreground">
                  {new Date(r.createdAt).toLocaleString()}
                </p>
                <div className="flex items-center gap-2 justify-end">
                  <Button size="sm" variant="outline">
                    View
                  </Button>
                  {r.status === "pending" && <Button size="sm">Assign</Button>}
                  {r.status === "in_progress" && (
                    <Button size="sm">Bill</Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
