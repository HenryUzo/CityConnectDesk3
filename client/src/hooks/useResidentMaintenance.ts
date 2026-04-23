import { useMutation, useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { residentFetch } from "@/lib/residentApi";

export type ResidentMaintenanceCategory = {
  id: string;
  name: string;
  slug: string;
  icon?: string | null;
  description?: string | null;
  isActive: boolean;
  createdAt?: string | null;
  itemCount?: number;
};

export type ResidentMaintenanceItem = {
  id: string;
  categoryId: string;
  name: string;
  slug: string;
  description?: string | null;
  defaultFrequency?: "monthly" | "quarterly_3m" | "halfyearly_6m" | "yearly" | null;
  recommendedTasks?: string[] | null;
  imageUrl?: string | null;
  isActive: boolean;
  createdAt?: string | null;
  category?: {
    id: string;
    name: string;
    icon?: string | null;
    description?: string | null;
  } | null;
};

export type ResidentMaintenancePlan = {
  id: string;
  name: string;
  description?: string | null;
  durationType: "monthly" | "quarterly_3m" | "halfyearly_6m" | "yearly";
  durationLabel: string;
  price: string;
  currency: string;
  visitsIncluded: number;
  includedTasks?: string[] | null;
  requestLeadDays?: number | null;
  isActive: boolean;
  item: {
    id: string;
    name: string;
    imageUrl?: string | null;
  };
  category: {
    id: string;
    name: string;
    icon?: string | null;
  };
  currentSubscription?: {
    id: string;
    status: string;
    startDate?: string | null;
    endDate?: string | null;
    nextScheduledDate?: string | null;
  } | null;
};

export type ResidentMaintenanceAsset = {
  id: string;
  displayName: string;
  customName?: string | null;
  locationLabel?: string | null;
  purchaseDate?: string | null;
  installedAt?: string | null;
  lastServiceDate?: string | null;
  condition: "new" | "good" | "fair" | "poor";
  notes?: string | null;
  metadata?: Record<string, unknown> | null;
  isActive: boolean;
  createdAt?: string | null;
  updatedAt?: string | null;
  item: ResidentMaintenanceItem;
  category: {
    id: string;
    name: string;
    icon?: string | null;
    description?: string | null;
    slug: string;
  };
};

export type ResidentMaintenanceSubscription = {
  id: string;
  status: string;
  autoRenew: boolean;
  startDate?: string | null;
  endDate?: string | null;
  activatedAt?: string | null;
  pausedAt?: string | null;
  expiredAt?: string | null;
  cancelledAt?: string | null;
  billingAmount: string;
  currency: string;
  nextScheduleAt?: string | null;
  asset: {
    id: string;
    displayName: string;
    customName?: string | null;
    locationLabel?: string | null;
    condition: "new" | "good" | "fair" | "poor";
  };
  plan: {
    id: string;
    name: string;
    description?: string | null;
    durationType: "monthly" | "quarterly_3m" | "halfyearly_6m" | "yearly";
    durationLabel: string;
    price: string;
    currency: string;
    visitsIncluded: number;
    includedTasks?: string[] | null;
  };
  item: {
    id: string;
    name: string;
    imageUrl?: string | null;
  };
  category: {
    id: string;
    name: string;
    icon?: string | null;
  };
  scheduleSummary: {
    total: number;
    next?: {
      id: string;
      scheduledDate?: string | null;
      status: string;
      sourceRequestId?: string | null;
    } | null;
    preview: Array<{
      id: string;
      scheduledDate?: string | null;
      status: string;
    }>;
  };
};

export type ResidentMaintenanceSchedule = {
  id: string;
  scheduledDate?: string | null;
  status: string;
  completedAt?: string | null;
  skippedAt?: string | null;
  rescheduledFrom?: string | null;
  notes?: string | null;
  asset: {
    id: string;
    displayName: string;
    itemType: string;
    locationLabel?: string | null;
    condition: "new" | "good" | "fair" | "poor";
    category: {
      id: string;
      name: string;
      icon?: string | null;
    };
  };
  subscription: {
    id: string;
    status: string;
    startDate?: string | null;
    endDate?: string | null;
  };
  plan: {
    id: string;
    name: string;
    durationType: "monthly" | "quarterly_3m" | "halfyearly_6m" | "yearly";
    durationLabel: string;
    price: string;
    currency: string;
    visitsIncluded: number;
  };
  request?: {
    id: string;
    status: string;
    providerId?: string | null;
    provider?: {
      id?: string | null;
      name: string;
      company?: string | null;
    } | null;
  } | null;
};

export type CreateResidentMaintenanceAssetInput = {
  categoryId: string;
  maintenanceItemId: string;
  customName?: string | null;
  locationLabel?: string | null;
  purchaseDate?: string | null;
  lastServiceDate?: string | null;
  condition: "new" | "good" | "fair" | "poor";
  notes?: string | null;
};

export type InitiateResidentMaintenanceSubscriptionInput = {
  residentAssetId: string;
  maintenancePlanId: string;
  startDate?: string | null;
};

export type InitiateResidentMaintenanceSubscriptionResult = {
  status: "pending_payment" | "active";
  reference?: string | null;
  amountKobo?: number | null;
  amountFormatted?: string | null;
  subscriptionId?: string | null;
  paystack?: {
    reference: string;
    amountInNaira: number;
    callbackUrl?: string | null;
  } | null;
  subscription?: ResidentMaintenanceSubscription | null;
};

export type VerifyResidentMaintenanceSubscriptionResult = {
  status: "success";
  reference: string;
  subscriptionId: string;
  subscription: ResidentMaintenanceSubscription;
};

async function fetchMaintenanceCategories() {
  return residentFetch<ResidentMaintenanceCategory[]>(
    "/api/app/maintenance/catalog/categories",
  );
}

async function fetchMaintenanceItems(categoryId?: string) {
  const qs = new URLSearchParams();
  if (categoryId) qs.set("categoryId", categoryId);
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return residentFetch<ResidentMaintenanceItem[]>(
    `/api/app/maintenance/catalog/items${suffix}`,
  );
}

async function fetchResidentAssets() {
  return residentFetch<ResidentMaintenanceAsset[]>(
    "/api/app/resident/maintenance/assets",
  );
}

async function fetchResidentAsset(assetId: string) {
  return residentFetch<ResidentMaintenanceAsset>(
    `/api/app/resident/maintenance/assets/${assetId}`,
  );
}

async function fetchResidentAssetPlans(assetId: string) {
  return residentFetch<{
    asset: ResidentMaintenanceAsset;
    plans: ResidentMaintenancePlan[];
  }>(`/api/app/resident/maintenance/assets/${assetId}/plans`);
}

async function fetchResidentSubscriptions() {
  return residentFetch<ResidentMaintenanceSubscription[]>(
    "/api/app/resident/maintenance/subscriptions",
  );
}

async function fetchResidentSchedules() {
  return residentFetch<ResidentMaintenanceSchedule[]>(
    "/api/app/resident/maintenance/schedules",
  );
}

async function fetchResidentSubscription(subscriptionId: string) {
  return residentFetch<ResidentMaintenanceSubscription>(
    `/api/app/resident/maintenance/subscriptions/${subscriptionId}`,
  );
}

export function useResidentMaintenanceCategories() {
  return useQuery({
    queryKey: ["resident-maintenance-categories"],
    queryFn: fetchMaintenanceCategories,
    staleTime: 60_000,
  });
}

export function useResidentMaintenanceItems(categoryId?: string) {
  return useQuery({
    queryKey: ["resident-maintenance-items", categoryId || "all"],
    queryFn: () => fetchMaintenanceItems(categoryId),
    enabled: Boolean(categoryId),
    staleTime: 60_000,
  });
}

export function useResidentAssets() {
  return useQuery({
    queryKey: ["resident-maintenance-assets"],
    queryFn: fetchResidentAssets,
    staleTime: 30_000,
  });
}

export function useResidentAsset(assetId?: string | null) {
  return useQuery({
    queryKey: ["resident-maintenance-asset", assetId || "none"],
    queryFn: () => fetchResidentAsset(String(assetId)),
    enabled: Boolean(assetId),
    staleTime: 30_000,
  });
}

export function useResidentAssetPlans(assetId?: string | null) {
  return useQuery({
    queryKey: ["resident-maintenance-asset-plans", assetId || "none"],
    queryFn: () => fetchResidentAssetPlans(String(assetId)),
    enabled: Boolean(assetId),
    staleTime: 30_000,
  });
}

export function useResidentSubscriptions() {
  return useQuery({
    queryKey: ["resident-maintenance-subscriptions"],
    queryFn: fetchResidentSubscriptions,
    staleTime: 30_000,
  });
}

export function useResidentSchedules() {
  return useQuery({
    queryKey: ["resident-maintenance-schedules"],
    queryFn: fetchResidentSchedules,
    staleTime: 30_000,
  });
}

export function useResidentSubscription(subscriptionId?: string | null) {
  return useQuery({
    queryKey: ["resident-maintenance-subscription", subscriptionId || "none"],
    queryFn: () => fetchResidentSubscription(String(subscriptionId)),
    enabled: Boolean(subscriptionId),
    staleTime: 30_000,
  });
}

export function useCreateResidentAsset() {
  return useMutation({
    mutationFn: async (payload: CreateResidentMaintenanceAssetInput) =>
      residentFetch<ResidentMaintenanceAsset>("/api/app/resident/maintenance/assets", {
        method: "POST",
        json: payload,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["resident-maintenance-assets"] });
    },
  });
}

export function useInitiateResidentMaintenanceSubscription() {
  return useMutation({
    mutationFn: async (payload: InitiateResidentMaintenanceSubscriptionInput) =>
      residentFetch<InitiateResidentMaintenanceSubscriptionResult>(
        "/api/app/resident/maintenance/subscriptions/initiate",
        {
          method: "POST",
          json: payload,
        },
      ),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["resident-maintenance-assets"] }),
        queryClient.invalidateQueries({ queryKey: ["resident-maintenance-subscriptions"] }),
        queryClient.invalidateQueries({ queryKey: ["resident-maintenance-asset-plans"] }),
        queryClient.invalidateQueries({ queryKey: ["resident-maintenance-schedules"] }),
      ]);
    },
  });
}

export function useVerifyResidentMaintenanceSubscription() {
  return useMutation({
    mutationFn: async (reference: string) =>
      residentFetch<VerifyResidentMaintenanceSubscriptionResult>(
        "/api/app/resident/maintenance/subscriptions/verify",
        {
          method: "POST",
          json: { reference },
        },
      ),
    onSuccess: async (result) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["resident-maintenance-assets"] }),
        queryClient.invalidateQueries({ queryKey: ["resident-maintenance-subscriptions"] }),
        queryClient.invalidateQueries({ queryKey: ["resident-maintenance-asset-plans"] }),
        queryClient.invalidateQueries({ queryKey: ["resident-maintenance-schedules"] }),
        queryClient.invalidateQueries({
          queryKey: ["resident-maintenance-subscription", result.subscriptionId],
        }),
      ]);
    },
  });
}

export function useRescheduleResidentMaintenanceSchedule() {
  return useMutation({
    mutationFn: async (payload: {
      scheduleId: string;
      scheduledDate: string;
      notes?: string | null;
    }) =>
      residentFetch<ResidentMaintenanceSchedule>(
        `/api/app/resident/maintenance/schedules/${payload.scheduleId}/reschedule`,
        {
          method: "POST",
          json: {
            scheduledDate: payload.scheduledDate,
            notes: payload.notes ?? null,
          },
        },
      ),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["resident-maintenance-schedules"] }),
        queryClient.invalidateQueries({ queryKey: ["resident-maintenance-subscriptions"] }),
        queryClient.invalidateQueries({ queryKey: ["resident-maintenance-assets"] }),
        queryClient.invalidateQueries({ queryKey: ["resident-maintenance-asset-plans"] }),
      ]);
    },
  });
}
