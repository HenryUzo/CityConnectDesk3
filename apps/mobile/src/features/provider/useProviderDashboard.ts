import { useQuery } from "@tanstack/react-query";
import { useSession } from "../auth/session";

export function useProviderDashboard() {
  const { services } = useSession();

  const assignedJobsQuery = useQuery({
    queryKey: ["provider", "assigned-jobs"],
    queryFn: () => services.requests.list(),
  });

  const availableJobsQuery = useQuery({
    queryKey: ["provider", "available-jobs"],
    queryFn: () => services.requests.list("available"),
  });

  const tasksQuery = useQuery({
    queryKey: ["provider", "tasks"],
    queryFn: () => services.provider.tasks(),
  });

  const companyQuery = useQuery({
    queryKey: ["provider", "company"],
    queryFn: () => services.provider.company(),
  });

  return {
    assignedJobsQuery,
    availableJobsQuery,
    tasksQuery,
    companyQuery,
  };
}
