import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

export type CityMartBanner = {
  id: string;
  type: string; // hero, horizontal, aside-long, aside-small, full-width
  title: string;
  description?: string;
  heading?: string;
  buttonText?: string;
  buttonUrl?: string;
  secondaryButtonText?: string;
  secondaryButtonUrl?: string;
  imageUrl?: string;
  backgroundImageUrl?: string;
  badgeText?: string;
  badgeColor?: string;
  discountText?: string;
  discountValue?: number;
  priceValue?: number;
  position: number;
  status: "active" | "inactive";
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
};

export type InsertCityMartBanner = Omit<CityMartBanner, "id" | "createdAt" | "updatedAt" | "createdBy">;

/** Fetch all active banners for public display */
export function usePublicBanners() {
  return useQuery<CityMartBanner[]>({
    queryKey: ["citymart_banners_public"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/citymart/banners");
      return res.json();
    },
    staleTime: 60_000,
  });
}

/** Fetch all banners (admin only) */
export function useAdminBanners() {
  return useQuery<CityMartBanner[]>({
    queryKey: ["citymart_banners_admin"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/citymart/banners");
      return res.json();
    },
    staleTime: 30_000,
  });
}

/** Create a new banner */
export function useCreateBanner() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: InsertCityMartBanner) => {
      const res = await apiRequest("POST", "/api/admin/citymart/banners", data);
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["citymart_banners_admin"] });
      qc.invalidateQueries({ queryKey: ["citymart_banners_public"] });
    },
  });
}

/** Update an existing banner */
export function useUpdateBanner() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<CityMartBanner> & { id: string }) => {
      const res = await apiRequest("PATCH", `/api/admin/citymart/banners/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["citymart_banners_admin"] });
      qc.invalidateQueries({ queryKey: ["citymart_banners_public"] });
    },
  });
}

/** Delete a banner */
export function useDeleteBanner() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/admin/citymart/banners/${id}`);
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["citymart_banners_admin"] });
      qc.invalidateQueries({ queryKey: ["citymart_banners_public"] });
    },
  });
}
