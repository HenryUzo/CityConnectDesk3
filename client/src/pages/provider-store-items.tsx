import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useMemo, useRef, useState } from "react";
import { EmptyState, InlineErrorState, PageSkeleton } from "@/components/shared/page-states";
import { ProviderMetricCard } from "@/components/provider/provider-primitives";
import { PROVIDER_ANALYTICS_EVENTS, trackEvent } from "@/lib/analytics";
import { useParams, Link } from "wouter";
import { ProviderShell } from "@/components/provider/ProviderShell";
import { DisabledActionHint } from "@/components/provider/DisabledActionHint";
import {
  extractApiErrorMessage,
  getProviderStoreAccessState,
  getStoreApprovalBadgeLabel,
  type ProviderStoreAccessInput,
} from "@/lib/provider-store-access";
import {
  ArrowLeft,
  Plus,
  Package,
  Edit,
  Trash2,
  DollarSign,
  X,
  Loader2
} from "lucide-react";

type ProviderStore = ProviderStoreAccessInput & {
  id: string;
  name: string;
  description?: string;
  location: string;
  phone?: string;
  email?: string;
  hasEstateAllocation?: boolean;
};

type StoreItem = {
  id: string;
  name: string;
  description?: string;
  price: number;
  isAvailable?: boolean;
  stock?: number;
  category?: string;
  images?: string[];
  unitOfMeasure?: string;
};

type ItemFormData = {
  name: string;
  description: string;
  price: string;
  stock: string;
  category: string;
  images: string[];
  unitOfMeasure: string;
};
type ItemCategory = {
  id: string;
  name: string;
  emoji?: string | null;
  isActive?: boolean;
};

const UNIT_OPTIONS = [
  { value: "kg", label: "Kilogram (kg)" },
  { value: "g", label: "Gram (g)" },
  { value: "liter", label: "Liter (L)" },
  { value: "ml", label: "Milliliter (ml)" },
  { value: "piece", label: "Piece" },
  { value: "bunch", label: "Bunch" },
  { value: "pack", label: "Pack" },
  { value: "bag", label: "Bag" },
  { value: "bottle", label: "Bottle" },
  { value: "box", label: "Box" },
  { value: "dozen", label: "Dozen" },
  { value: "meter", label: "Meter" },
];

export default function ProviderStoreItems() {
  const { storeId } = useParams<{ storeId: string }>();
  const { toast } = useToast();
  const [isCreateItemDialogOpen, setIsCreateItemDialogOpen] = useState(false);
  const [isEditItemDialogOpen, setIsEditItemDialogOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<StoreItem | null>(null);
  const [deleteCandidate, setDeleteCandidate] = useState<StoreItem | null>(null);
  const [itemFormData, setItemFormData] = useState<ItemFormData>({
    name: "",
    description: "",
    price: "",
    stock: "",
    category: "",
    images: [],
    unitOfMeasure: "piece",
  });
  const itemImageInputRef = useRef<HTMLInputElement | null>(null);
  const editImageInputRef = useRef<HTMLInputElement | null>(null);

  const MAX_IMAGES = 6;
  const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
  const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
  const [isUploadingImages, setIsUploadingImages] = useState(false);

  const getDevEmailHeader = () =>
    sessionStorage.getItem("dev_user_email") ||
    localStorage.getItem("dev_user_email") ||
    sessionStorage.getItem("provider_email_dev") ||
    localStorage.getItem("provider_email_dev") ||
    "";

  const uploadStoreImage = async (file: File): Promise<string> => {
    if (!storeId) {
      throw new Error("Store context is missing.");
    }

    const headers: Record<string, string> = {
      "Content-Type": file.type,
      "x-file-name": encodeURIComponent(file.name),
    };

    const devEmail = getDevEmailHeader();
    if (devEmail) {
      headers["x-user-email"] = devEmail;
    }

    const response = await fetch(`/api/provider/stores/${storeId}/items/images`, {
      method: "POST",
      credentials: "include",
      headers,
      body: file,
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.error || body.message || "Failed to upload image");
    }

    const payload = (await response.json()) as { url?: string };
    const uploadedUrl = String(payload.url || "").trim();
    if (!uploadedUrl) {
      throw new Error("Upload completed without an image URL.");
    }

    return uploadedUrl;
  };

  const handleImageUpload = async (
    files: File[],
    inputRef: { current: HTMLInputElement | null },
  ) => {
    if (files.length === 0) return;

    const remainingSlots = Math.max(0, MAX_IMAGES - itemFormData.images.length);
    if (remainingSlots <= 0) {
      toast({
        title: "Image limit reached",
        description: `You can upload up to ${MAX_IMAGES} images per item.`,
        variant: "destructive",
      });
      if (inputRef.current) {
        inputRef.current.value = "";
      }
      return;
    }

    const rejectedTypeNames: string[] = [];
    const rejectedSizeNames: string[] = [];
    const acceptedFiles: File[] = [];

    for (const file of files) {
      if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
        rejectedTypeNames.push(file.name);
        continue;
      }
      if (file.size > MAX_IMAGE_BYTES) {
        rejectedSizeNames.push(file.name);
        continue;
      }
      acceptedFiles.push(file);
    }

    const uploadQueue = acceptedFiles.slice(0, remainingSlots);
    if (acceptedFiles.length > remainingSlots) {
      toast({
        title: "Image limit reached",
        description: `Only ${remainingSlots} additional image${remainingSlots === 1 ? "" : "s"} were queued.`,
      });
    }

    if (rejectedTypeNames.length > 0) {
      toast({
        title: "Unsupported image type",
        description: `Only JPG, PNG, and WEBP are allowed. Skipped: ${rejectedTypeNames.join(", ")}.`,
        variant: "destructive",
      });
    }

    if (rejectedSizeNames.length > 0) {
      toast({
        title: "Image too large",
        description: `Each image must be 5MB or less. Skipped: ${rejectedSizeNames.join(", ")}.`,
        variant: "destructive",
      });
    }

    if (!uploadQueue.length) {
      if (inputRef.current) {
        inputRef.current.value = "";
      }
      return;
    }

    setIsUploadingImages(true);
    try {
      const uploadedUrls: string[] = [];
      for (const file of uploadQueue) {
        const url = await uploadStoreImage(file);
        uploadedUrls.push(url);
      }

      if (uploadedUrls.length > 0) {
        setItemFormData((prev) => ({
          ...prev,
          images: [...prev.images, ...uploadedUrls].slice(0, MAX_IMAGES),
        }));
      }
    } catch (error: any) {
      toast({
        title: "Image upload failed",
        description: error?.message || "Unable to upload selected image(s).",
        variant: "destructive",
      });
    } finally {
      setIsUploadingImages(false);
      if (inputRef.current) {
        inputRef.current.value = "";
      }
    }
  };

  const handleRemoveImage = (index: number) => {
    setItemFormData((prev) => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index),
    }));
  };

  const handleCreateItem = () => {
    const blockedReason = storeAccess.createItemBlockedReason;
    if (blockedReason) {
      trackEvent(PROVIDER_ANALYTICS_EVENTS.BLOCKED_ACTION, {
        action: "inventory_create_item",
        store_id: storeId || "unknown",
        section: "store_inventory",
      });
      toast({
        title: "Action blocked",
        description: blockedReason,
        variant: "destructive",
      });
      return;
    }
    if (isUploadingImages) {
      toast({
        title: "Upload in progress",
        description: "Please wait for image upload to complete before submitting.",
      });
      return;
    }
    if (itemFormData.images.length === 0) {
      toast({
        title: "Add at least one image",
        description: "Upload 1-6 images before adding the item.",
        variant: "destructive",
      });
      return;
    }
    if (!itemFormData.category) {
      toast({
        title: "Select a category",
        description: "Choose a category for this item.",
        variant: "destructive",
      });
      return;
    }
    createItemMutation.mutate(itemFormData);
  };

  const handleUpdateItem = () => {
    if (!editingItem) return;
    const blockedReason = storeAccess.inventoryUpdateBlockedReason;
    if (blockedReason) {
      trackEvent(PROVIDER_ANALYTICS_EVENTS.BLOCKED_ACTION, {
        action: "inventory_update_item",
        store_id: storeId || "unknown",
        section: "store_inventory",
      });
      toast({
        title: "Action blocked",
        description: blockedReason,
        variant: "destructive",
      });
      return;
    }
    if (isUploadingImages) {
      toast({
        title: "Upload in progress",
        description: "Please wait for image upload to complete before submitting.",
      });
      return;
    }
    if (!itemFormData.category) {
      toast({
        title: "Select a category",
        description: "Choose a category for this item.",
        variant: "destructive",
      });
      return;
    }
    updateItemMutation.mutate({ itemId: editingItem.id, itemData: itemFormData });
  };

  const { data: store, isLoading: isLoadingStore } = useQuery<ProviderStore | null>({
    queryKey: ["/api/provider/stores", storeId],
    queryFn: async () => {
      const stores = await apiRequest("GET", "/api/provider/stores").then(
        (res) => res.json() as Promise<ProviderStore[]>,
      );
      return stores.find((s: ProviderStore) => s.id === storeId) || null;
    },
    enabled: !!storeId,
    staleTime: 60_000,
  });

  const storeAccess = useMemo(() => getProviderStoreAccessState(store), [store]);
  const canQueryInventory = Boolean(storeId) && Boolean(store) && !storeAccess.inventoryPageBlockedReason;

  const { data: itemCategories = [] } = useQuery<ItemCategory[]>({
    queryKey: ["/api/item-categories"],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/item-categories");
      if (!res.ok) {
        return [];
      }
      return res.json() as Promise<ItemCategory[]>;
    },
  });

  const {
    data: items = [],
    isLoading: isLoadingItems,
    error: itemsError,
  } = useQuery<StoreItem[]>({
    queryKey: ["/api/provider/stores", storeId, "items"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/provider/stores/${storeId}/items`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || body.error || "Unable to load inventory");
      }
      return res.json() as Promise<StoreItem[]>;
    },
    enabled: canQueryInventory,
    staleTime: 15_000,
    refetchInterval: canQueryInventory ? 45_000 : false,
  });

  const invalidateInventoryQueries = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["/api/provider/stores", storeId, "items"] }),
      queryClient.invalidateQueries({ queryKey: ["provider-marketplace-items"] }),
      queryClient.invalidateQueries({ queryKey: ["/api/marketplace/store", storeId, "inventory"] }),
      queryClient.invalidateQueries({ queryKey: ["/api/provider/stores"] }),
      queryClient.invalidateQueries({ queryKey: ["provider-stores"] }),
    ]);
  };

  const createItemMutation = useMutation({
    mutationFn: async (itemData: typeof itemFormData) => {
      return await apiRequest("POST", `/api/provider/stores/${storeId}/items`, {
        ...itemData,
        price: parseFloat(itemData.price),
        stock: itemData.stock ? Number(itemData.stock) : 0,
      });
    },
    onSuccess: () => {
      void invalidateInventoryQueries();
      trackEvent(PROVIDER_ANALYTICS_EVENTS.INVENTORY_ITEM_CREATED, {
        store_id: storeId || "unknown",
        has_images: itemFormData.images.length > 0,
        category: itemFormData.category || "unknown",
      });
      setIsCreateItemDialogOpen(false);
      setItemFormData({ name: "", description: "", price: "", stock: "", category: "", images: [], unitOfMeasure: "piece" });
      if (itemImageInputRef.current) {
        itemImageInputRef.current.value = "";
      }
      toast({
        title: "Item Created",
        description: "Your item has been added to the store!",
      });
    },
    onError: (error: any) => {
      const message = extractApiErrorMessage(error, "Failed to create item");
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    },
  });

  const updateItemMutation = useMutation({
    mutationFn: async ({ itemId, itemData }: { itemId: string; itemData: typeof itemFormData }) => {
      return await apiRequest("PATCH", `/api/provider/stores/${storeId}/items/${itemId}`, {
        ...itemData,
        price: itemData.price ? parseFloat(itemData.price) : undefined,
        stock: itemData.stock ? Number(itemData.stock) : undefined,
      });
    },
    onSuccess: () => {
      void invalidateInventoryQueries();
      setIsEditItemDialogOpen(false);
      setEditingItem(null);
      setItemFormData({ name: "", description: "", price: "", stock: "", category: "", images: [], unitOfMeasure: "piece" });
      toast({
        title: "Item Updated",
        description: "Item has been updated successfully!",
      });
    },
    onError: (error: any) => {
      const message = extractApiErrorMessage(error, "Failed to update item");
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    },
  });

  const deleteItemMutation = useMutation({
    mutationFn: async (itemId: string) => {
      return await apiRequest("DELETE", `/api/provider/stores/${storeId}/items/${itemId}`);
    },
    onSuccess: () => {
      void invalidateInventoryQueries();
      setIsDeleteConfirmOpen(false);
      setDeleteCandidate(null);
      toast({
        title: "Item Deleted",
        description: "Item has been removed from the store.",
      });
    },
    onError: (error: any) => {
      const message = extractApiErrorMessage(error, "Failed to delete item");
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    },
  });

  const toggleAvailabilityMutation = useMutation({
    mutationFn: async ({ itemId, isAvailable }: { itemId: string; isAvailable: boolean }) => {
      return await apiRequest("PATCH", `/api/provider/stores/${storeId}/items/${itemId}`, {
        isAvailable
      });
    },
    onSuccess: () => {
      void invalidateInventoryQueries();
      toast({
        title: "Availability Updated",
        description: "Item availability has been updated.",
      });
    },
    onError: (error: any) => {
      const message = extractApiErrorMessage(error, "Failed to update availability");
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    },
  });

  const handleEdit = (item: any) => {
    if (storeAccess.inventoryUpdateBlockedReason) {
      trackEvent(PROVIDER_ANALYTICS_EVENTS.BLOCKED_ACTION, {
        action: "inventory_edit_open",
        store_id: storeId || "unknown",
        section: "store_inventory",
      });
      toast({
        title: "Action blocked",
        description: storeAccess.inventoryUpdateBlockedReason,
        variant: "destructive",
      });
      return;
    }
    setEditingItem(item);
    setItemFormData({
      name: item.name,
      description: item.description || "",
      price: item.price.toString(),
      stock: item.stock?.toString?.() || "",
      category: item.category || "",
      images: Array.isArray(item.images) ? item.images : [],
      unitOfMeasure: item.unitOfMeasure || "piece",
    });
    setIsEditItemDialogOpen(true);
  };

  const handleDeleteRequest = (item: StoreItem) => {
    if (storeAccess.inventoryUpdateBlockedReason) {
      trackEvent(PROVIDER_ANALYTICS_EVENTS.BLOCKED_ACTION, {
        action: "inventory_delete_open",
        store_id: storeId || "unknown",
        section: "store_inventory",
      });
      toast({
        title: "Action blocked",
        description: storeAccess.inventoryUpdateBlockedReason,
        variant: "destructive",
      });
      return;
    }
    setDeleteCandidate(item);
    setIsDeleteConfirmOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (!deleteCandidate) return;
    if (storeAccess.inventoryUpdateBlockedReason) {
      trackEvent(PROVIDER_ANALYTICS_EVENTS.BLOCKED_ACTION, {
        action: "inventory_delete_confirm",
        store_id: storeId || "unknown",
        section: "store_inventory",
      });
      toast({
        title: "Action blocked",
        description: storeAccess.inventoryUpdateBlockedReason,
        variant: "destructive",
      });
      return;
    }
    deleteItemMutation.mutate(deleteCandidate.id);
  };

  if (isLoadingStore) {
    return (
      <ProviderShell title="Store inventory" subtitle="Loading store details.">
        <PageSkeleton rows={2} />
      </ProviderShell>
    );
  }

  if (!store) {
    return (
      <ProviderShell
        title="Store inventory"
        subtitle="We could not find this store."
        actions={
          <Button asChild variant="outline">
            <Link href="/provider/stores">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to stores
            </Link>
          </Button>
        }
      >
        <EmptyState
          icon={Package}
          title="Store not found"
          description="We could not find this store. It may have been removed or you no longer have access."
        />
      </ProviderShell>
    );
  }

  const approvalLabel = getStoreApprovalBadgeLabel(store.approvalStatus);
  const createItemBlockedReason = storeAccess.createItemBlockedReason;
  const inventoryUpdateBlockedReason = storeAccess.inventoryUpdateBlockedReason;

  return (
    <ProviderShell
      title={`${store.name} Inventory`}
      subtitle={`${store.location} - ${storeAccess.roleLabel}`}
      actions={
        <Button asChild variant="outline" data-testid="button-back-to-dashboard">
          <Link href="/provider/stores">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to stores
          </Link>
        </Button>
      }
    >
      <div className="space-y-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={storeAccess.isApproved ? "default" : "secondary"}>{approvalLabel}</Badge>
              <Badge variant="outline">{storeAccess.roleLabel}</Badge>
              <Badge variant={storeAccess.hasEstateAllocation ? "secondary" : "outline"}>
                {storeAccess.hasEstateAllocation
                  ? `${storeAccess.estateAllocationCount} estate allocation${storeAccess.estateAllocationCount === 1 ? "" : "s"}`
                  : "No estate allocation"}
              </Badge>
            </div>
            {storeAccess.operationsBlockedReason && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-700">
                {storeAccess.operationsBlockedReason}
              </div>
            )}
            {!storeAccess.operationsBlockedReason && !storeAccess.canManageItems && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-700">
                You can view inventory but cannot add, edit, or remove items for this store.
              </div>
            )}
            {!storeAccess.operationsBlockedReason && !storeAccess.hasEstateAllocation && (
              <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-sm text-blue-700">
                No estate is allocated yet. You can review inventory, but adding new products is disabled.
              </div>
            )}
            {itemsError ? (
              <InlineErrorState
                description={extractApiErrorMessage(itemsError, "Unable to load inventory")}
              />
            ) : null}
          </div>
          <Dialog open={isCreateItemDialogOpen} onOpenChange={setIsCreateItemDialogOpen}>
            {createItemBlockedReason ? (
              <DisabledActionHint reason={createItemBlockedReason} actionName="inventory_create_blocked" metadata={{ store_id: storeId || "unknown", section: "store_inventory" }}>
                <Button data-testid="button-add-item" disabled>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Item
                </Button>
              </DisabledActionHint>
            ) : (
              <DialogTrigger asChild>
                <Button data-testid="button-add-item">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Item
                </Button>
              </DialogTrigger>
            )}
            <DialogContent className="w-[60vw] max-w-4xl max-h-[90vh] overflow-y-auto" aria-describedby="add-item-description">
              <DialogHeader>
                <DialogTitle>Add New Item</DialogTitle>
                <DialogDescription id="add-item-description">
                  Add a new item to your store inventory.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-6 md:grid-cols-[1.1fr_1.4fr] py-4">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="item-images-upload">Item Image</Label>
                    <p className="text-xs text-muted-foreground">
                      Upload 1-6 images (JPG, PNG, WEBP, max 5MB each). {Math.max(0, MAX_IMAGES - itemFormData.images.length)} remaining.
                    </p>
                    {isUploadingImages ? (
                      <p className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <Loader2 className="h-3 w-3 animate-spin" /> Uploading images...
                      </p>
                    ) : null}
                    {itemFormData.images.length > 0 && (
                      <div className="grid grid-cols-2 gap-2">
                        {itemFormData.images.map((src, index) => (
                          <div key={`${src}-${index}`} className="relative group">
                            <img
                              src={src}
                              alt={`Preview ${index + 1}`}
                              className="h-28 w-full rounded border object-cover"
                            />
                            <Button
                              type="button"
                              size="icon"
                              variant="destructive"
                              className="absolute right-1 top-1 h-7 w-7 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
                              onClick={() => handleRemoveImage(index)}
                              aria-label={`Remove image ${index + 1}`}
                              title="Remove image"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                    <Input
                      id="item-images-upload"
                      ref={itemImageInputRef}
                      type="file"
                      accept="image/*"
                      multiple
                      aria-label="Upload item images"
                      disabled={isUploadingImages}
                      onChange={(e) =>
                        handleImageUpload(Array.from(e.target.files || []), itemImageInputRef)
                      }
                    />
                    {itemFormData.images.length > 0 && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => itemImageInputRef.current?.click()}
                        disabled={isUploadingImages}
                      >
                        {isUploadingImages ? "Uploading..." : "Upload more images"}
                      </Button>
                    )}
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="item-name">Name</Label>
                    <Input
                      id="item-name"
                      value={itemFormData.name}
                      onChange={(e) => setItemFormData({ ...itemFormData, name: e.target.value })}
                      placeholder="Item name"
                      data-testid="input-item-name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="item-description">Description</Label>
                    <Textarea
                      id="item-description"
                      value={itemFormData.description}
                      onChange={(e) => setItemFormData({ ...itemFormData, description: e.target.value })}
                      placeholder="What is this item?"
                      rows={4}
                      data-testid="input-item-description"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="item-price">Price (NGN)</Label>
                      <Input
                        id="item-price"
                        type="number"
                        min="0"
                        step="0.01"
                        value={itemFormData.price}
                        onChange={(e) => setItemFormData({ ...itemFormData, price: e.target.value })}
                        data-testid="input-item-price"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="item-stock">Stock</Label>
                      <Input
                        id="item-stock"
                        type="number"
                        min="0"
                        value={itemFormData.stock}
                        onChange={(e) => setItemFormData({ ...itemFormData, stock: e.target.value })}
                        data-testid="input-item-stock"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Unit of Measure</Label>
                    <Select
                      value={itemFormData.unitOfMeasure}
                      onValueChange={(value) =>
                        setItemFormData({ ...itemFormData, unitOfMeasure: value })
                      }
                    >
                      <SelectTrigger data-testid="select-item-unit" aria-label="Select unit of measure">
                        <SelectValue placeholder="Select unit" />
                      </SelectTrigger>
                      <SelectContent>
                        {UNIT_OPTIONS.map((unit) => (
                          <SelectItem key={unit.value} value={unit.value}>
                            {unit.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Category</Label>
                    <Select
                      value={itemFormData.category}
                      onValueChange={(value) => setItemFormData({ ...itemFormData, category: value })}
                    >
                      <SelectTrigger data-testid="select-item-category" aria-label="Select item category">
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        {itemCategories.length > 0 ? (
                          itemCategories
                            .filter((cat) => cat.isActive !== false)
                            .map((cat) => (
                              <SelectItem key={cat.id} value={cat.name}>
                                {cat.emoji ? `${cat.emoji} ` : ""}{cat.name}
                              </SelectItem>
                            ))
                        ) : (
                          <SelectItem value="__none" disabled>
                            No categories available
                          </SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="md:col-span-2 flex gap-2 pt-2">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => setIsCreateItemDialogOpen(false)}
                    data-testid="button-cancel-item"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleCreateItem}
                    className="flex-1"
                    disabled={
                      !itemFormData.name ||
                      !itemFormData.price ||
                      !itemFormData.category ||
                      Boolean(createItemBlockedReason) ||
                      createItemMutation.isPending ||
                      isUploadingImages
                    }
                    data-testid="button-submit-item"
                  >
                    {isUploadingImages
                      ? "Uploading images..."
                      : createItemMutation.isPending
                        ? "Adding..."
                        : "Add Item"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="mb-8 grid gap-6 md:grid-cols-3">
          <ProviderMetricCard
            title="Total items"
            value={items.length}
            hint="All inventory records"
            icon={Package}
            tone="default"
            dataTestId="text-total-items"
          />
          <ProviderMetricCard
            title="Available"
            value={items.filter((item: any) => item.isAvailable !== false).length}
            hint="Visible to residents"
            icon={Package}
            tone="success"
            dataTestId="text-available-items"
          />
          <ProviderMetricCard
            title="Average price"
            value={`NGN ${items.length > 0 ? (items.reduce((sum: number, item: any) => sum + item.price, 0) / items.length).toFixed(2) : "0.00"}`}
            hint="Across listed inventory"
            icon={DollarSign}
            tone="accent"
            dataTestId="text-avg-price"
          />
        </div>

        {/* Items List */}
        <Card>
          <CardHeader>
            <CardTitle>Inventory Items</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoadingItems ? (
              <PageSkeleton withHeader={false} rows={3} />
            ) : items.length > 0 ? (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {items.map((item: any) => (
                  <div
                    key={item.id}
                    className="border border-border rounded-lg p-4 transition-shadow hover:shadow-md"
                    data-testid={`item-${item.id}`}
                  >
                    {item.images?.[0] && (
                      <div className="mb-3 overflow-hidden rounded-lg border">
                        <img
                          src={item.images[0]}
                          alt={item.name}
                          className="h-32 w-full object-cover"
                        />
                      </div>
                    )}
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex-1">
                        <h3 className="font-semibold text-foreground mb-1">{item.name}</h3>
                        {item.description && (
                          <p className="text-sm text-muted-foreground mb-2 line-clamp-2">{item.description}</p>
                        )}
                      </div>
                      {item.isAvailable !== false ? (
                        <Badge className="bg-green-100 text-green-800">Available</Badge>
                      ) : (
                        <Badge variant="outline">Unavailable</Badge>
                      )}
                    </div>

                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center text-lg font-bold text-primary">
                        <DollarSign className="w-4 h-4" />
                        <span>NGN {Number(item.price || 0).toFixed(2)}</span>
                      </div>
                      <span className="text-sm text-muted-foreground">
                        Stock: {item.stock ?? 0}
                      </span>
                    </div>
                    {item.category && (
                      <div className="mb-3 text-sm text-muted-foreground">
                        Category: {item.category}
                      </div>
                    )}

                    <div className="flex items-center justify-between border-t border-border pt-3">
                      <div className="flex items-center space-x-2">
                        <Label htmlFor={`availability-${item.id}`} className="text-sm text-muted-foreground">
                          Available
                        </Label>
                        <DisabledActionHint reason={inventoryUpdateBlockedReason} actionName="inventory_update_blocked" metadata={{ store_id: storeId || "unknown", section: "store_inventory" }}>
                          <span>
                            <Switch
                              id={`availability-${item.id}`}
                              checked={item.isAvailable !== false}
                              onCheckedChange={(checked) => {
                                if (inventoryUpdateBlockedReason) {
                                  toast({
                                    title: "Action blocked",
                                    description: inventoryUpdateBlockedReason,
                                    variant: "destructive",
                                  });
                                  return;
                                }
                                toggleAvailabilityMutation.mutate({ itemId: item.id, isAvailable: checked });
                              }}
                              disabled={toggleAvailabilityMutation.isPending || Boolean(inventoryUpdateBlockedReason)}
                              data-testid={`switch-availability-${item.id}`}
                            />
                          </span>
                        </DisabledActionHint>
                      </div>
                      <div className="flex space-x-2">
                        <DisabledActionHint reason={inventoryUpdateBlockedReason} actionName="inventory_update_blocked" metadata={{ store_id: storeId || "unknown", section: "store_inventory" }}>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEdit(item)}
                            disabled={Boolean(inventoryUpdateBlockedReason)}
                            data-testid={`button-edit-${item.id}`}
                            aria-label={`Edit ${item.name}`}
                            title={`Edit ${item.name}`}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                        </DisabledActionHint>
                        <DisabledActionHint reason={inventoryUpdateBlockedReason} actionName="inventory_update_blocked" metadata={{ store_id: storeId || "unknown", section: "store_inventory" }}>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDeleteRequest(item)}
                            disabled={deleteItemMutation.isPending || Boolean(inventoryUpdateBlockedReason)}
                            data-testid={`button-delete-${item.id}`}
                            aria-label={`Delete ${item.name}`}
                            title={`Delete ${item.name}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </DisabledActionHint>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                icon={Package}
                title="No items yet"
                description="Add your first item to start building your inventory."
                action={
                  <DisabledActionHint reason={createItemBlockedReason} actionName="inventory_create_blocked" metadata={{ store_id: storeId || "unknown", section: "store_inventory" }}>
                    <Button
                      onClick={() => {
                        if (!createItemBlockedReason) {
                          setIsCreateItemDialogOpen(true);
                        }
                      }}
                      disabled={Boolean(createItemBlockedReason)}
                      data-testid="button-add-first-item"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Add First Item
                    </Button>
                  </DisabledActionHint>
                }
              />
            )}
          </CardContent>
        </Card>
      </div>

      <AlertDialog
        open={isDeleteConfirmOpen}
        onOpenChange={(open) => {
          setIsDeleteConfirmOpen(open);
          if (!open) {
            setDeleteCandidate(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this inventory item?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteCandidate
                ? `You are about to permanently remove "${deleteCandidate.name}" from your store inventory. This action cannot be undone.`
                : "This will permanently remove the selected inventory item. This action cannot be undone."}
            </AlertDialogDescription>
            {inventoryUpdateBlockedReason ? (
              <p className="text-xs text-amber-700">{inventoryUpdateBlockedReason}</p>
            ) : null}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={deleteItemMutation.isPending}
              onClick={() => {
                setDeleteCandidate(null);
              }}
            >
              Keep item
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              disabled={deleteItemMutation.isPending || Boolean(inventoryUpdateBlockedReason)}
              onClick={handleDeleteConfirm}
            >
              {deleteItemMutation.isPending ? "Deleting..." : "Delete item"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit Item Dialog */}
      <Dialog open={isEditItemDialogOpen} onOpenChange={setIsEditItemDialogOpen}>
        <DialogContent className="w-[60vw] max-w-4xl max-h-[90vh] overflow-y-auto" aria-describedby="edit-item-dialog-description">
        <DialogHeader>
          <DialogTitle>Edit Item</DialogTitle>
          <DialogDescription id="edit-item-dialog-description">
            Update the details of your item.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-6 md:grid-cols-[1.1fr_1.4fr] py-4">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-item-images-upload">Item Image</Label>
              <p className="text-xs text-muted-foreground">
                Upload 1-6 images (JPG, PNG, WEBP, max 5MB each). {Math.max(0, MAX_IMAGES - itemFormData.images.length)} remaining.
              </p>
              {isUploadingImages ? (
                <p className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" /> Uploading images...
                </p>
              ) : null}
              {itemFormData.images.length > 0 && (
                <div className="grid grid-cols-2 gap-2">
                  {itemFormData.images.map((src, index) => (
                    <div key={`${src}-${index}`} className="relative group">
                      <img
                        src={src}
                        alt={`Preview ${index + 1}`}
                        className="h-28 w-full rounded border object-cover"
                      />
                      <Button
                        type="button"
                        size="icon"
                        variant="destructive"
                        className="absolute right-1 top-1 h-7 w-7 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
                        onClick={() => handleRemoveImage(index)}
                        aria-label={`Remove image ${index + 1}`}
                        title="Remove image"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              <Input
                id="edit-item-images-upload"
                ref={editImageInputRef}
                type="file"
                accept="image/*"
                multiple
                aria-label="Upload item images"
                disabled={isUploadingImages}
                onChange={(e) =>
                  handleImageUpload(Array.from(e.target.files || []), editImageInputRef)
                }
              />
              {itemFormData.images.length > 0 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => editImageInputRef.current?.click()}
                  disabled={isUploadingImages}
                >
                  {isUploadingImages ? "Uploading..." : "Upload more images"}
                </Button>
              )}
            </div>
          </div>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-item-name">Name</Label>
              <Input
                id="edit-item-name"
                value={itemFormData.name}
                onChange={(e) => setItemFormData({ ...itemFormData, name: e.target.value })}
                placeholder="Item name"
                data-testid="input-edit-item-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-item-description">Description</Label>
              <Textarea
                id="edit-item-description"
                value={itemFormData.description}
                onChange={(e) => setItemFormData({ ...itemFormData, description: e.target.value })}
                placeholder="What is this item?"
                rows={4}
                data-testid="input-edit-item-description"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="edit-item-price">Price (NGN)</Label>
                <Input
                  id="edit-item-price"
                  type="number"
                  min="0"
                  step="0.01"
                  value={itemFormData.price}
                  onChange={(e) => setItemFormData({ ...itemFormData, price: e.target.value })}
                  data-testid="input-edit-item-price"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-item-stock">Stock</Label>
                <Input
                  id="edit-item-stock"
                  type="number"
                  min="0"
                  value={itemFormData.stock}
                  onChange={(e) => setItemFormData({ ...itemFormData, stock: e.target.value })}
                  data-testid="input-edit-item-stock"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Unit of Measure</Label>
              <Select
                value={itemFormData.unitOfMeasure}
                onValueChange={(value) =>
                  setItemFormData({ ...itemFormData, unitOfMeasure: value })
                }
              >
                <SelectTrigger data-testid="select-edit-item-unit" aria-label="Select unit of measure">
                  <SelectValue placeholder="Select unit" />
                </SelectTrigger>
                <SelectContent>
                  {UNIT_OPTIONS.map((unit) => (
                    <SelectItem key={unit.value} value={unit.value}>
                      {unit.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <Select
                value={itemFormData.category}
                onValueChange={(value) => setItemFormData({ ...itemFormData, category: value })}
              >
                <SelectTrigger data-testid="select-edit-item-category" aria-label="Select item category">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {itemCategories.length > 0 ? (
                    itemCategories
                      .filter((cat) => cat.isActive !== false)
                      .map((cat) => (
                        <SelectItem key={cat.id} value={cat.name}>
                          {cat.emoji ? `${cat.emoji} ` : ""}{cat.name}
                        </SelectItem>
                      ))
                  ) : (
                    <SelectItem value="__none" disabled>
                      No categories available
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="md:col-span-2 flex gap-2 pt-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setIsEditItemDialogOpen(false)}
              data-testid="button-cancel-edit-item"
            >
              Cancel
            </Button>
            <Button
              onClick={handleUpdateItem}
              className="flex-1"
              disabled={
                !itemFormData.name ||
                !itemFormData.price ||
                !itemFormData.category ||
                Boolean(inventoryUpdateBlockedReason) ||
                updateItemMutation.isPending ||
                isUploadingImages
              }
              data-testid="button-submit-edit-item"
            >
              {isUploadingImages
                ? "Uploading images..."
                : updateItemMutation.isPending
                  ? "Updating..."
                  : "Update Item"}
            </Button>
          </div>
        </div>
      </DialogContent>
      </Dialog>
    </ProviderShell>
  );
}


