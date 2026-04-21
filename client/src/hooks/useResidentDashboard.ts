// client/src/hooks/useResidentDashboard.ts
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

export type DashboardStats = {
  maintenanceScheduleCount: number;
  nextMaintenance: string | null;
  nextMaintenanceCost: number | null;
  activeContractsCount: number;
  contractsChangePercent: number;
  completedRequestsCount: number;
  completedChangePercent: number;
  pendingRequestsCount: number;
  totalRequestsCount: number;
};

export type ServiceRequestSummary = {
  id: string;
  title: string | null;
  status: string;
  category: string | null;
  urgency: string | null;
  createdAt: string;
};

async function fetchResidentDashboardStats(): Promise<DashboardStats> {
  try {
    const res = await apiRequest("GET", "/api/app/dashboard/stats");
    return await res.json();
  } catch {
    // Return empty stats if endpoint doesn't exist yet
    return {
      maintenanceScheduleCount: 0,
      nextMaintenance: null,
      nextMaintenanceCost: null,
      activeContractsCount: 0,
      contractsChangePercent: 0,
      completedRequestsCount: 0,
      completedChangePercent: 0,
      pendingRequestsCount: 0,
      totalRequestsCount: 0,
    };
  }
}

async function fetchMyServiceRequests(): Promise<ServiceRequestSummary[]> {
  try {
    const res = await apiRequest("GET", "/api/service-requests/my");
    const data = await res.json();
    return data?.data || [];
  } catch {
    return [];
  }
}

export function useResidentDashboard() {
  const statsQuery = useQuery({
    queryKey: ["/api/app/dashboard/stats"],
    queryFn: fetchResidentDashboardStats,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  const requestsQuery = useQuery({
    queryKey: ["/api/service-requests/my"],
    queryFn: fetchMyServiceRequests,
    staleTime: 30_000,
    refetchInterval: 30_000,
  });

  // Compute stats from requests if backend endpoint not available
  const computedStats: DashboardStats = {
    maintenanceScheduleCount: statsQuery.data?.maintenanceScheduleCount ?? 0,
    nextMaintenance: statsQuery.data?.nextMaintenance ?? "No scheduled maintenance",
    nextMaintenanceCost: statsQuery.data?.nextMaintenanceCost ?? null,
    activeContractsCount: statsQuery.data?.activeContractsCount ?? 
      (
        requestsQuery.data?.filter((r) =>
          ["in_progress", "assigned", "assigned_for_job"].includes(String(r.status || "").toLowerCase()),
        ).length ?? 0
      ),
    contractsChangePercent: statsQuery.data?.contractsChangePercent ?? 0,
    completedRequestsCount: statsQuery.data?.completedRequestsCount ?? 
      (requestsQuery.data?.filter(r => r.status === "completed").length ?? 0),
    completedChangePercent: statsQuery.data?.completedChangePercent ?? 0,
    pendingRequestsCount: requestsQuery.data?.filter(r => r.status === "pending").length ?? 0,
    totalRequestsCount: requestsQuery.data?.length ?? 0,
  };

  return {
    stats: computedStats,
    requests: requestsQuery.data ?? [],
    isLoading: statsQuery.isLoading || requestsQuery.isLoading,
    error: statsQuery.error || requestsQuery.error,
    refetch: () => {
      statsQuery.refetch();
      requestsQuery.refetch();
    },
  };
}

export function useResidentNotifications() {
  return useQuery({
    queryKey: ["/api/notifications"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/notifications");
      return await res.json();
    },
    staleTime: 15_000,
    refetchInterval: 30_000,
  });
}
