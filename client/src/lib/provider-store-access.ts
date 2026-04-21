type StoreMembership = {
  role?: string | null;
  canManageItems?: boolean | null;
  canManageOrders?: boolean | null;
};

export type ProviderStoreAccessInput = {
  approvalStatus?: string | null;
  isActive?: boolean | null;
  estateId?: string | null;
  estateAllocationCount?: number | null;
  estateNames?: string[] | null;
  membership?: StoreMembership | null;
};

export type ProviderStoreAccessState = {
  approvalStatus: "approved" | "pending" | "rejected";
  isApproved: boolean;
  isPendingApproval: boolean;
  isRejected: boolean;
  isActive: boolean;
  hasEstateAllocation: boolean;
  estateAllocationCount: number;
  estateNames: string[];
  roleLabel: string;
  canManageItems: boolean;
  canManageOrders: boolean;
  operationsBlockedReason: string | null;
  inventoryPageBlockedReason: string | null;
  createItemBlockedReason: string | null;
  orderUpdateBlockedReason: string | null;
  inventoryUpdateBlockedReason: string | null;
};

const PENDING_APPROVAL_REASON =
  "This store is awaiting admin approval. You can review details but cannot perform store operations yet.";
const REJECTED_REASON =
  "This store was rejected by admin. Store operations are disabled until the store is reviewed.";
const INACTIVE_REASON =
  "This store is inactive. Contact admin to reactivate it before continuing.";
const ITEMS_PERMISSION_REASON =
  "Your role has read-only inventory access for this store.";
const ORDERS_PERMISSION_REASON =
  "Your role can view orders but cannot update order statuses for this store.";
const ESTATE_ALLOCATION_REASON =
  "No estate allocation yet. Ask admin to allocate at least one estate before adding inventory.";

const normalizeApproval = (value: string | null | undefined): "approved" | "pending" | "rejected" => {
  const key = String(value || "pending").toLowerCase();
  if (key === "approved") return "approved";
  if (key === "rejected") return "rejected";
  return "pending";
};

const getRoleLabel = (role: string | null | undefined) => {
  const key = String(role || "").toLowerCase();
  if (key === "owner") return "Owner";
  if (key === "manager") return "Manager";
  if (key === "staff") return "Staff";
  return "Member";
};

export const getProviderStoreAccessState = (
  store?: ProviderStoreAccessInput | null,
): ProviderStoreAccessState => {
  const approvalStatus = normalizeApproval(store?.approvalStatus);
  const isApproved = approvalStatus === "approved";
  const isPendingApproval = approvalStatus === "pending";
  const isRejected = approvalStatus === "rejected";
  const isActive = store?.isActive !== false;
  const estateNames = Array.isArray(store?.estateNames)
    ? store.estateNames.filter((name): name is string => typeof name === "string" && name.trim().length > 0)
    : [];
  const rawAllocationCount = Number(store?.estateAllocationCount || 0);
  const estateAllocationCount = Number.isFinite(rawAllocationCount) ? Math.max(0, rawAllocationCount) : 0;
  const hasEstateAllocation = estateAllocationCount > 0 || Boolean(store?.estateId);
  const normalizedEstateAllocationCount = hasEstateAllocation
    ? Math.max(estateAllocationCount, 1)
    : 0;
  const canManageItems = Boolean(store?.membership?.canManageItems);
  const canManageOrders = Boolean(store?.membership?.canManageOrders);

  let operationsBlockedReason: string | null = null;
  if (!isActive) {
    operationsBlockedReason = INACTIVE_REASON;
  } else if (isPendingApproval) {
    operationsBlockedReason = PENDING_APPROVAL_REASON;
  } else if (isRejected) {
    operationsBlockedReason = REJECTED_REASON;
  }

  const inventoryPageBlockedReason = operationsBlockedReason;
  const createItemBlockedReason =
    operationsBlockedReason ||
    (canManageItems ? null : ITEMS_PERMISSION_REASON) ||
    (hasEstateAllocation ? null : ESTATE_ALLOCATION_REASON);
  const orderUpdateBlockedReason =
    operationsBlockedReason || (canManageOrders ? null : ORDERS_PERMISSION_REASON);
  const inventoryUpdateBlockedReason =
    operationsBlockedReason || (canManageItems ? null : ITEMS_PERMISSION_REASON);

  return {
    approvalStatus,
    isApproved,
    isPendingApproval,
    isRejected,
    isActive,
    hasEstateAllocation,
    estateAllocationCount: normalizedEstateAllocationCount,
    estateNames,
    roleLabel: getRoleLabel(store?.membership?.role),
    canManageItems,
    canManageOrders,
    operationsBlockedReason,
    inventoryPageBlockedReason,
    createItemBlockedReason,
    orderUpdateBlockedReason,
    inventoryUpdateBlockedReason,
  };
};

export const getStoreApprovalBadgeLabel = (status: string | null | undefined) => {
  const normalized = normalizeApproval(status);
  if (normalized === "approved") return "Approved";
  if (normalized === "rejected") return "Rejected";
  return "Pending approval";
};

export const extractApiErrorMessage = (error: unknown, fallback: string) => {
  if (!(error instanceof Error)) return fallback;
  const message = error.message || "";
  const lines = message.split("\n").map((line) => line.trim()).filter(Boolean);
  const lastLine = lines.length > 0 ? lines[lines.length - 1] : "";
  if (lastLine.startsWith("{") && lastLine.endsWith("}")) {
    try {
      const parsed = JSON.parse(lastLine);
      return parsed.message || parsed.error || fallback;
    } catch {
      return message || fallback;
    }
  }
  return message || fallback;
};
