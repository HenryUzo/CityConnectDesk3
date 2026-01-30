import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useRef, useState } from "react";
import { useParams, Link } from "wouter";
import {
  ArrowLeft,
  Plus,
  Package,
  Edit,
  Trash2,
  DollarSign,
  X
} from "lucide-react";

type ProviderStore = {
  id: string;
  name: string;
  description?: string;
  location: string;
  phone?: string;
  email?: string;
  membership?: { role?: string; canManageItems?: boolean; canManageOrders?: boolean };
  isActive?: boolean;
  approvalStatus?: string;
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
  const { user } = useAuth();
  const { toast } = useToast();
  const [isCreateItemDialogOpen, setIsCreateItemDialogOpen] = useState(false);
  const [isEditItemDialogOpen, setIsEditItemDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<StoreItem | null>(null);
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

  const extractApiErrorMessage = (error: unknown, fallback: string) => {
    if (!(error instanceof Error)) return fallback;
    const message = error.message || "";
    const parts = message.split("\n");
    const tail = parts[parts.length - 1] || "";
    try {
      const parsed = JSON.parse(tail);
      return parsed.message || parsed.error || fallback;
    } catch {
      return message || fallback;
    }
  };

  const MAX_IMAGES = 6;

  const readFilesAsDataUrls = (files: File[]) =>
    Promise.all(
      files.map(
        (file) =>
          new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.readAsDataURL(file);
          }),
      ),
    );

  const handleImageUpload = async (
    files: File[],
    inputRef: { current: HTMLInputElement | null },
  ) => {
    if (files.length === 0) return;
    const results = await readFilesAsDataUrls(files);
    const combined = [...itemFormData.images, ...results];
    const trimmed = combined.slice(0, MAX_IMAGES);
    if (combined.length > MAX_IMAGES) {
      toast({
        title: "Image limit reached",
        description: "Only the first 6 images were kept.",
        variant: "destructive",
      });
    }
    setItemFormData((prev) => ({ ...prev, images: trimmed }));
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  };

  const handleRemoveImage = (index: number) => {
    setItemFormData((prev) => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index),
    }));
  };

  const handleCreateItem = () => {
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
    enabled: !!storeId
  });

  const { data: itemCategories = [] } = useQuery<ItemCategory[]>({
    queryKey: ["/api/item-categories"],
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
    enabled: !!storeId
  });

  const createItemMutation = useMutation({
    mutationFn: async (itemData: typeof itemFormData) => {
      return await apiRequest("POST", `/api/provider/stores/${storeId}/items`, {
        ...itemData,
        price: parseFloat(itemData.price),
        stock: itemData.stock ? Number(itemData.stock) : 0,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/provider/stores", storeId, "items"] });
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
      queryClient.invalidateQueries({ queryKey: ["/api/provider/stores", storeId, "items"] });
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
      queryClient.invalidateQueries({ queryKey: ["/api/provider/stores", storeId, "items"] });
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
      queryClient.invalidateQueries({ queryKey: ["/api/provider/stores", storeId, "items"] });
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

  const handleDelete = (itemId: string) => {
    if (confirm("Are you sure you want to delete this item")) {
      deleteItemMutation.mutate(itemId);
    }
  };

  if (isLoadingStore) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Loading store...</p>
      </div>
    );
  }

  if (!store) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">Store not found</p>
          <Link href="/provider">
            <Button variant="outline">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboard
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const approvalStatus = (store.approvalStatus || "pending").toLowerCase();
  const isApproved = approvalStatus === "approved";
  const canManageItems = Boolean(store.membership?.canManageItems);
  const inventoryLocked = !isApproved;
  const roleLabel =
    store.membership?.role === "owner"
      ? "Owner"
      : store.membership?.role === "manager"
        ? "Manager"
        : "Staff";

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="bg-card shadow-sm border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <Link href="/provider">
                <Button variant="ghost" size="sm" data-testid="button-back-to-dashboard">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Dashboard
                </Button>
              </Link>
            </div>
            <div className="flex items-center">
              <span className="text-sm text-muted-foreground">Managing: {store.name}</span>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8 flex justify-between items-start">
          <div>
            <h2 className="text-2xl font-bold text-foreground mb-2" data-testid="text-store-name">
              {store.name} - Inventory
            </h2>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-muted-foreground">{store.location}</p>
              <Badge variant={isApproved ? "default" : "secondary"}>
                {isApproved ? "Approved" : approvalStatus === "rejected" ? "Rejected" : "Pending Approval"}
              </Badge>
              <Badge variant="outline">{roleLabel}</Badge>
            </div>
            {(inventoryLocked || !canManageItems) && (
              <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-700">
                {inventoryLocked
                  ? "This store is awaiting approval. Inventory management is disabled until approval."
                  : "You have read-only access to this inventory."}
              </div>
            )}
            {itemsError && (
              <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700">
                {(itemsError as Error).message}
              </div>
            )}
          </div>
          <Dialog open={isCreateItemDialogOpen} onOpenChange={setIsCreateItemDialogOpen}>
            <DialogTrigger asChild>
              <Button
                data-testid="button-add-item"
                disabled={inventoryLocked || !canManageItems}
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Item
              </Button>
            </DialogTrigger>
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
                    <Label>Item Image</Label>
                    <p className="text-xs text-muted-foreground">
                      Upload 1-6 images. {Math.max(0, MAX_IMAGES - itemFormData.images.length)} remaining.
                    </p>
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
                              className="absolute right-1 top-1 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={() => handleRemoveImage(index)}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                    <Input
                      ref={itemImageInputRef}
                      type="file"
                      accept="image/*"
                      multiple
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
                      >
                        Upload more images
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
                      <SelectTrigger data-testid="select-item-unit">
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
                      <SelectTrigger data-testid="select-item-category">
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
                      createItemMutation.isPending
                    }
                    data-testid="button-submit-item"
                  >
                    {createItemMutation.isPending ? "Adding..." : "Add Item"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Stats */}
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Items</p>
                  <p className="text-2xl font-bold text-foreground" data-testid="text-total-items">
                    {items.length}
                  </p>
                </div>
                <div className="bg-primary/10 p-3 rounded-lg">
                  <Package className="w-6 h-6 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Available Items</p>
                  <p className="text-2xl font-bold text-foreground" data-testid="text-available-items">
                    {items.filter((item: any) => item.isAvailable !== false).length}
                  </p>
                </div>
                <div className="bg-green-100 p-3 rounded-lg">
                  <Package className="w-6 h-6 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Avg Price</p>
                  <p className="text-2xl font-bold text-foreground" data-testid="text-avg-price">
                    NGN {items.length > 0 ? (items.reduce((sum: number, item: any) => sum + item.price, 0) / items.length).toFixed(2) : "0.00"}
                  </p>
                </div>
                <div className="bg-accent/10 p-3 rounded-lg">
                  <DollarSign className="w-6 h-6 text-accent" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Items List */}
        <Card>
          <CardHeader>
            <CardTitle>Inventory Items</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoadingItems ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>Loading items...</p>
              </div>
            ) : items.length > 0 ? (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {items.map((item: any) => (
                  <div
                    key={item.id}
                    className="border border-border rounded-lg p-4 hover:shadow-md transition-shadow"
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

                    <div className="flex items-center justify-between pt-3 border-t border-border">
                      <div className="flex items-center space-x-2">
                        <Label htmlFor={`availability-${item.id}`} className="text-sm text-muted-foreground">
                          Available
                        </Label>
                        <Switch
                          id={`availability-${item.id}`}
                          checked={item.isAvailable !== false}
                          onCheckedChange={(checked) => 
                            toggleAvailabilityMutation.mutate({ itemId: item.id, isAvailable: checked })
                          }
                          disabled={toggleAvailabilityMutation.isPending || inventoryLocked || !canManageItems}
                          data-testid={`switch-availability-${item.id}`}
                        />
                      </div>
                      {canManageItems && !inventoryLocked && (
                        <div className="flex space-x-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEdit(item)}
                            data-testid={`button-edit-${item.id}`}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDelete(item.id)}
                            disabled={deleteItemMutation.isPending}
                            data-testid={`button-delete-${item.id}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <Package className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <h3 className="font-medium text-lg mb-2">No items yet</h3>
                <p className="text-sm mb-4">Add your first item to start building your inventory</p>
                <Button
                  onClick={() => setIsCreateItemDialogOpen(true)}
                  data-testid="button-add-first-item"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add First Item
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Edit Item Dialog */}
      <Dialog open={isEditItemDialogOpen} onOpenChange={setIsEditItemDialogOpen}>
        <DialogContent className="w-[60vw] max-w-4xl max-h-[90vh] overflow-y-auto" aria-describedby="edit-item-description">
        <DialogHeader>
          <DialogTitle>Edit Item</DialogTitle>
          <DialogDescription id="edit-item-description">
            Update the details of your item.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-6 md:grid-cols-[1.1fr_1.4fr] py-4">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Item Image</Label>
              <p className="text-xs text-muted-foreground">
                Upload 1-6 images. {Math.max(0, MAX_IMAGES - itemFormData.images.length)} remaining.
              </p>
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
                        className="absolute right-1 top-1 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => handleRemoveImage(index)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              <Input
                ref={editImageInputRef}
                type="file"
                accept="image/*"
                multiple
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
                >
                  Upload more images
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
                <SelectTrigger data-testid="select-edit-item-unit">
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
                <SelectTrigger data-testid="select-edit-item-category">
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
                updateItemMutation.isPending
              }
              data-testid="button-submit-edit-item"
            >
              {updateItemMutation.isPending ? "Updating..." : "Update Item"}
            </Button>
          </div>
        </div>
      </DialogContent>
      </Dialog>
    </div>
  );
}
