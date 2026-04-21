import { useState, useRef, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowLeft, Plus, Edit3, Trash2, Package } from "lucide-react";
import { EmptyState, InlineErrorState, PageSkeleton } from "@/components/shared/page-states";
import { DisabledActionHint } from "@/components/provider/DisabledActionHint";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

type CompanyStore = {
  id: string;
  name: string;
  description?: string;
  location: string;
  phone?: string;
  email?: string;
  approvalStatus?: string;
};

type InventoryItem = {
  id: string;
  name: string;
  description?: string;
  price?: number | string;
  category?: string;
  stock?: number;
};

type ItemCategory = {
  id: string;
  name?: string | null;
  emoji?: string | null;
  isActive?: boolean | null;
};

const inventoryFormSchema = z.object({
  name: z.string().min(1, "Item name is required"),
  category: z.string().min(1, "Category is required"),
  price: z.coerce.number().min(0, "Price must be positive"),
  stock: z.coerce.number().int().min(0, "Stock must be positive"),
  description: z.string().optional(),
});

type InventoryFormData = z.infer<typeof inventoryFormSchema>;

export default function CompanyInventory() {
  const { toast } = useToast();
  const [selectedStoreId, setSelectedStoreId] = useState("");
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [showDialog, setShowDialog] = useState(false);
  const inventoryImageInputRef = useRef<HTMLInputElement>(null);
  const [inventoryImages, setInventoryImages] = useState<string[]>([]);

  const inventoryForm = useForm<InventoryFormData>({
    resolver: zodResolver(inventoryFormSchema),
    defaultValues: {
      name: "",
      category: "",
      price: 0,
      stock: 0,
      description: "",
    },
  });

  const { data: stores = [] } = useQuery<CompanyStore[]>({
    queryKey: ["/api/company/stores"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/company/stores");
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: itemCategories = [] } = useQuery<ItemCategory[]>({
    queryKey: ["/api/categories/items"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/categories/items");
      if (!res.ok) return [];
      return res.json();
    },
  });

  const selectedStore = useMemo(
    () => stores.find((s) => s.id === selectedStoreId),
    [stores, selectedStoreId]
  );

  const selectedStoreApprovalStatus = String(selectedStore?.approvalStatus || "pending").toLowerCase();
  const isSelectedStoreApproved = selectedStoreApprovalStatus === "approved";
  const inventoryReadBlockedReason = !selectedStoreId
    ? null
    : selectedStoreApprovalStatus === "pending"
      ? "This store is awaiting admin approval. Inventory opens once approval is complete."
      : selectedStoreApprovalStatus === "rejected"
        ? "This store was rejected. Inventory actions are disabled until the store is reviewed."
        : null;
  const inventoryWriteBlockedReason = inventoryReadBlockedReason;

  const {
    data: inventoryItems = [],
    isLoading: inventoryLoading,
    error: inventoryError,
  } = useQuery<InventoryItem[]>({
    queryKey: ["/api/company/stores", selectedStoreId, "inventory"],
    queryFn: async () => {
      if (!selectedStoreId) return [];
      const res = await apiRequest(
        "GET",
        `/api/company/stores/${selectedStoreId}/inventory`
      );
      if (!res.ok) throw new Error("Unable to load inventory items");
      return res.json();
    },
    enabled: Boolean(selectedStoreId) && !inventoryReadBlockedReason,
  });

  const itemCategoryOptions = useMemo(() => {
    return [...itemCategories]
      .filter((category) => category.isActive !== false)
      .sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  }, [itemCategories]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: "NGN",
      minimumFractionDigits: 0,
    }).format(value);
  };

  const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
  const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

  const uploadCompanyInventoryImage = async (file: File): Promise<string> => {
    if (!selectedStoreId) {
      throw new Error("Select a store before uploading images.");
    }

    const headers: Record<string, string> = {
      "Content-Type": file.type,
      "x-file-name": encodeURIComponent(file.name),
    };

    const devEmail =
      sessionStorage.getItem("dev_user_email") ||
      localStorage.getItem("dev_user_email") ||
      sessionStorage.getItem("provider_email_dev") ||
      localStorage.getItem("provider_email_dev") ||
      "";
    if (devEmail) {
      headers["x-user-email"] = devEmail;
    }

    const res = await fetch(`/api/company/stores/${selectedStoreId}/inventory/images`, {
      method: "POST",
      credentials: "include",
      headers,
      body: file,
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.message || body.error || "Failed to upload image");
    }

    const payload = (await res.json()) as { url?: string };
    const url = String(payload.url || "").trim();
    if (!url) {
      throw new Error("Upload succeeded but no image URL was returned.");
    }

    return url;
  };

  const handleInventoryFiles = async (files: FileList | null) => {
    if (!files || !selectedStoreId) return;

    const remaining = Math.max(0, 6 - inventoryImages.length);
    const accepted: File[] = [];

    for (const file of Array.from(files)) {
      if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
        toast({
          title: "Unsupported image type",
          description: `${file.name} was skipped. Use JPG, PNG, or WEBP.`,
          variant: "destructive",
        });
        continue;
      }
      if (file.size > MAX_IMAGE_BYTES) {
        toast({
          title: "Image too large",
          description: `${file.name} exceeds 5MB.`,
          variant: "destructive",
        });
        continue;
      }
      accepted.push(file);
    }

    const queue = accepted.slice(0, remaining);
    if (!queue.length) {
      if (inventoryImageInputRef.current) inventoryImageInputRef.current.value = "";
      return;
    }

    try {
      const uploadedUrls: string[] = [];
      for (const file of queue) {
        uploadedUrls.push(await uploadCompanyInventoryImage(file));
      }
      setInventoryImages((prev) => [...prev, ...uploadedUrls].slice(0, 6));
    } catch (error: any) {
      toast({
        title: "Image upload failed",
        description: error?.message || "Unable to upload selected image(s).",
        variant: "destructive",
      });
    } finally {
      if (inventoryImageInputRef.current) inventoryImageInputRef.current.value = "";
    }
  };

  const createItemMutation = useMutation({
    mutationFn: async (data: InventoryFormData) => {
      const res = await apiRequest(
        "POST",
        `/api/company/stores/${selectedStoreId}/inventory`,
        {
          ...data,
          images: inventoryImages,
        }
      );
      if (!res.ok) throw new Error("Failed to create item");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/company/stores", selectedStoreId, "inventory"],
      });
      setShowDialog(false);
      inventoryForm.reset();
      setInventoryImages([]);
      toast({
        title: "Success",
        description: "Item created successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create item",
        variant: "destructive",
      });
    },
  });

  const updateItemMutation = useMutation({
    mutationFn: async (data: InventoryFormData) => {
      const res = await apiRequest(
        "PATCH",
        `/api/company/stores/${selectedStoreId}/inventory/${editingItem?.id}`,
        {
          ...data,
          images: inventoryImages,
        }
      );
      if (!res.ok) throw new Error("Failed to update item");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/company/stores", selectedStoreId, "inventory"],
      });
      setShowDialog(false);
      setEditingItem(null);
      inventoryForm.reset();
      setInventoryImages([]);
      toast({
        title: "Success",
        description: "Item updated successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update item",
        variant: "destructive",
      });
    },
  });

  const deleteItemMutation = useMutation({
    mutationFn: async (itemId: string) => {
      const res = await apiRequest(
        "DELETE",
        `/api/company/stores/${selectedStoreId}/inventory/${itemId}`
      );
      if (!res.ok) throw new Error("Failed to delete item");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/company/stores", selectedStoreId, "inventory"],
      });
      toast({
        title: "Success",
        description: "Item deleted successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete item",
        variant: "destructive",
      });
    },
  });

  const handleEditItem = (item: InventoryItem) => {
    setEditingItem(item);
    inventoryForm.reset({
      name: item.name,
      category: item.category || "",
      price: Number(item.price || 0),
      stock: item.stock || 0,
      description: item.description || "",
    });
    setShowDialog(true);
  };

  const handleDeleteItem = async (item: InventoryItem) => {
    if (inventoryWriteBlockedReason) {
      toast({
        title: "Action blocked",
        description: inventoryWriteBlockedReason,
        variant: "destructive",
      });
      return;
    }

    if (confirm(`Delete "${item.name}"?`)) {
      deleteItemMutation.mutate(item.id);
    }
  };

  const onSubmit = (data: InventoryFormData) => {
    if (inventoryWriteBlockedReason) {
      toast({
        title: "Action blocked",
        description: inventoryWriteBlockedReason,
        variant: "destructive",
      });
      return;
    }

    if (editingItem) {
      updateItemMutation.mutate(data);
    } else {
      createItemMutation.mutate(data);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Navigation */}
      <nav className="bg-white border-b border-slate-200 shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link href="/company-dashboard">
              <Button variant="ghost" size="icon" className="mr-2">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div className="flex flex-col">
              <span className="text-lg font-semibold">Inventory Management</span>
            </div>
            <div className="w-10" />
          </div>
        </div>
      </nav>

      {/* Breadcrumbs */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/company-dashboard">Dashboard</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Inventory</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900">Inventory Management</h1>
          <p className="text-slate-500 mt-2">
            Manage products and stock across all your stores
          </p>
        </div>

        {/* Store Selector */}
        <Card className="mb-8">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <label className="text-sm font-medium text-slate-700">
                Select Store:
              </label>
              <Select value={selectedStoreId} onValueChange={setSelectedStoreId}>
                <SelectTrigger className="w-64">
                  <SelectValue placeholder="Choose a store" />
                </SelectTrigger>
                <SelectContent>
                  {stores.map((store) => (
                    <SelectItem key={store.id} value={store.id}>
                      {store.name}{" "}
                      {store.approvalStatus !== "approved" && (
                        <span className="text-xs text-slate-500 ml-2">
                          ({store.approvalStatus})
                        </span>
                      )}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedStore && (
                <div className="ml-auto flex items-center gap-2">
                  <Badge
                    variant={
                      selectedStore.approvalStatus === "approved"
                        ? "default"
                        : "secondary"
                    }
                  >
                    {selectedStore.approvalStatus || "pending"}
                  </Badge>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {!selectedStoreId ? (
          <EmptyState
            icon={Package}
            title="No store selected"
            description="Select a store above to manage its inventory."
          />
        ) : (
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Items List */}
            <div className="lg:col-span-2">
              <Card>
                <CardHeader className="flex items-center justify-between">
                  <CardTitle>Items in {selectedStore?.name}</CardTitle>
                  <DisabledActionHint reason={inventoryWriteBlockedReason}>
                    <Button
                      onClick={() => {
                        setEditingItem(null);
                        inventoryForm.reset();
                        setInventoryImages([]);
                        setShowDialog(true);
                      }}
                      disabled={Boolean(inventoryWriteBlockedReason)}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add Item
                    </Button>
                  </DisabledActionHint>
                </CardHeader>
                <CardContent>
                  {inventoryReadBlockedReason && (
                    <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-700">
                      {inventoryReadBlockedReason}
                    </div>
                  )}
                  {inventoryError ? (
                    <InlineErrorState
                      description={inventoryError instanceof Error ? inventoryError.message : "Unable to load inventory items."}
                    />
                  ) : inventoryLoading ? (
                    <PageSkeleton withHeader={false} rows={3} />
                  ) : inventoryItems.length === 0 ? (
                    <EmptyState
                      icon={Package}
                      title="No items yet"
                      description="Add your first product to get started."
                      action={
                        <DisabledActionHint reason={inventoryWriteBlockedReason}>
                          <Button
                            onClick={() => {
                              setEditingItem(null);
                              inventoryForm.reset();
                              setInventoryImages([]);
                              setShowDialog(true);
                            }}
                            disabled={Boolean(inventoryWriteBlockedReason)}
                          >
                            <Plus className="h-4 w-4 mr-2" />
                            Add Item
                          </Button>
                        </DisabledActionHint>
                      }
                    />
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-slate-50 text-xs uppercase">
                          <tr>
                            <th className="px-4 py-3 text-left">Item</th>
                            <th className="px-4 py-3 text-left">Category</th>
                            <th className="px-4 py-3 text-right">Price</th>
                            <th className="px-4 py-3 text-right">Stock</th>
                            <th className="px-4 py-3 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {inventoryItems.map((item) => (
                            <tr
                              key={item.id}
                              className="border-t border-slate-100"
                            >
                              <td className="px-4 py-3">
                                <div>
                                  <p className="font-medium text-slate-900">
                                    {item.name}
                                  </p>
                                  {item.description && (
                                    <p className="text-xs text-slate-500">
                                      {item.description}
                                    </p>
                                  )}
                                </div>
                              </td>
                              <td className="px-4 py-3 text-slate-600">
                                {item.category || "—"}
                              </td>
                              <td className="px-4 py-3 text-right font-medium">
                                {formatCurrency(Number(item.price || 0))}
                              </td>
                              <td className="px-4 py-3 text-right text-slate-600">
                                {item.stock || 0}
                              </td>
                              <td className="px-4 py-3 text-right">
                                <div className="flex items-center justify-end gap-2">
                                  <DisabledActionHint reason={inventoryWriteBlockedReason}>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleEditItem(item)}
                                      disabled={Boolean(inventoryWriteBlockedReason)}
                                    >
                                      <Edit3 className="h-4 w-4" />
                                    </Button>
                                  </DisabledActionHint>
                                  <DisabledActionHint reason={inventoryWriteBlockedReason}>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleDeleteItem(item)}
                                      disabled={Boolean(inventoryWriteBlockedReason)}
                                    >
                                      <Trash2 className="h-4 w-4 text-rose-500" />
                                    </Button>
                                  </DisabledActionHint>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Item Form */}
            <div>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">
                    {editingItem ? "Edit Item" : "Add New Item"}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Form {...inventoryForm}>
                    <form
                      className="space-y-4"
                      onSubmit={inventoryForm.handleSubmit(onSubmit)}
                    >
                      <FormField
                        control={inventoryForm.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm">Item Name</FormLabel>
                            <FormControl>
                              <Input placeholder="Item name" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={inventoryForm.control}
                        name="category"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm">Category</FormLabel>
                            <FormControl>
                              <Select
                                value={field.value}
                                onValueChange={field.onChange}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Select category" />
                                </SelectTrigger>
                                <SelectContent>
                                  {itemCategoryOptions.map((cat) => (
                                    <SelectItem
                                      key={cat.id}
                                      value={cat.name || cat.id}
                                    >
                                      {cat.emoji ? `${cat.emoji} ` : ""}
                                      {cat.name || cat.id}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={inventoryForm.control}
                        name="price"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm">Price (₦)</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                placeholder="0.00"
                                step="0.01"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={inventoryForm.control}
                        name="stock"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm">Stock</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                placeholder="0"
                                step="1"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={inventoryForm.control}
                        name="description"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm">Description</FormLabel>
                            <FormControl>
                              <Textarea
                                placeholder="Item description"
                                className="resize-none"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      {inventoryWriteBlockedReason ? (
                        <p className="text-xs text-amber-700">{inventoryWriteBlockedReason}</p>
                      ) : null}
                      <div className="flex items-center justify-between gap-2 pt-4">
                        {editingItem && (
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => {
                              setEditingItem(null);
                              inventoryForm.reset();
                            }}
                          >
                            Cancel
                          </Button>
                        )}
                        <DisabledActionHint reason={inventoryWriteBlockedReason}>
                          <Button
                            type="submit"
                            disabled={
                              !selectedStoreId ||
                              Boolean(inventoryWriteBlockedReason) ||
                              createItemMutation.isPending ||
                              updateItemMutation.isPending
                            }
                            className="ml-auto"
                          >
                            {editingItem ? "Save Changes" : "Add Item"}
                          </Button>
                        </DisabledActionHint>
                      </div>
                    </form>
                  </Form>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
