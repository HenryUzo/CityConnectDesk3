import { useQuery } from "@tanstack/react-query";
import { useSession } from "../auth/session";

export function useResidentDashboard() {
  const { services } = useSession();

  const categoriesQuery = useQuery({
    queryKey: ["resident", "categories"],
    queryFn: () => services.resident.categories(),
  });

  const requestsQuery = useQuery({
    queryKey: ["resident", "request-list"],
    queryFn: () => services.resident.requestList(),
  });

  const statsQuery = useQuery({
    queryKey: ["resident", "dashboard-stats"],
    queryFn: () => services.resident.dashboardStats(),
  });

  const marketTrendsQuery = useQuery({
    queryKey: ["resident", "market-trends"],
    queryFn: () => services.resident.marketTrends(),
  });

  return {
    categoriesQuery,
    requestsQuery,
    statsQuery,
    marketTrendsQuery,
  };
}
