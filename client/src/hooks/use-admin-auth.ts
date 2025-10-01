import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";

export function useAdminAuth() {
  const { data: admin, isLoading, isError, error } = useQuery({
    queryKey: ["/api/admin/me"],
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      // If you have a server logout, call it:
      // await apiRequest("POST", "/api/admin/auth/logout");
      sessionStorage.removeItem("admin_access_token");
      localStorage.removeItem("admin_jwt");
      await queryClient.invalidateQueries();
    },
  });

  return { admin, isLoading, isError, error, logoutMutation };
}
