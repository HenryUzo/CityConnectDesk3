import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { useParams, Link } from "wouter";
import {
  ArrowLeft,
  Plus,
  Package,
  Edit,
  Trash2,
  DollarSign,
  Ruler
} from "lucide-react";

const UNIT_OPTIONS = [
  { value: "kg", label: "Kilogram (kg)" },
  { value: "g", label: "Gram (g)" },
  { value: "liter", label: "Liter (L)" },
  { value: "ml", label: "Milliliter (ml)" },
  { value: "piece", label: "Piece" },
  { value: "pack", label: "Pack" },
  { value: "dozen", label: "Dozen" },
  { value: "bag", label: "Bag" },
  { value: "box", label: "Box" },
  { value: "bundle", label: "Bundle" }
];

export default function ProviderStoreItems() {
  const { storeId } = useParams<{ storeId: string }>();
  const { user } = useAuth();
  const { toast } = useToast();
  const [isCreateItemDialogOpen, setIsCreateItemDialogOpen] = useState(false);
  const [isEditItemDialogOpen, setIsEditItemDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [itemFormData, setItemFormData] = useState({
    name: "",
    description: "",
    price: "",
    unitOfMeasure: "piece"
  });

  const { data: store, isLoading: isLoadingStore } = useQuery({
    queryKey: ["/api/provider/stores", storeId],
    queryFn: async () => {
      const stores = await apiRequest("GET", "/api/provider/stores");
      return stores.find((s: any) => s.id === storeId);
    },
    enabled: !!storeId
  });

  const { data: items = [], isLoading: isLoadingItems } = useQuery({
    queryKey: ["/api/provider/stores", storeId, "items"],
    queryFn: () => apiRequest("GET", `/api/provider/stores/${storeId}/items`),
    enabled: !!storeId
  });

  const createItemMutation = useMutation({
    mutationFn: async (itemData: typeof itemFormData) => {
      return await apiRequest("POST", `/api/provider/stores/${storeId}/items`, {
        ...itemData,
        price: parseFloat(itemData.price)
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/provider/stores", storeId, "items"] });
      setIsCreateItemDialogOpen(false);
      setItemFormData({ name: "", description: "", price: "", unitOfMeasure: "piece" });
      toast({
        title: "Item Created",
        description: "Your item has been added to the store!",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create item",
        variant: "destructive",
      });
    },
  });

  const updateItemMutation = useMutation({
    mutationFn: async ({ itemId, itemData }: { itemId: string; itemData: typeof itemFormData }) => {
      return await apiRequest("PATCH", `/api/provider/stores/${storeId}/items/${itemId}`, {
        ...itemData,
        price: itemData.price ? parseFloat(itemData.price) : undefined
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/provider/stores", storeId, "items"] });
      setIsEditItemDialogOpen(false);
      setEditingItem(null);
      toast({
        title: "Item Updated",
        description: "Item has been updated successfully!",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update item",
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
      toast({
        title: "Error",
        description: error.message || "Failed to delete item",
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
      toast({
        title: "Error",
        description: error.message || "Failed to update availability",
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
      unitOfMeasure: item.unitOfMeasure || "piece"
    });
    setIsEditItemDialogOpen(true);
  };

  const handleDelete = (itemId: string) => {
    if (confirm("Are you sure you want to delete this item?")) {
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
            <p className="text-muted-foreground">{store.location}</p>
          </div>
          <Dialog open={isCreateItemDialogOpen} onOpenChange={setIsCreateItemDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-add-item">
                <Plus className="w-4 h-4 mr-2" />
                Add Item
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Add New Item</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="item-name">Item Name *</Label>
                  <Input
                    id="item-name"
                    value={itemFormData.name}
                    onChange={(e) => setItemFormData({ ...itemFormData, name: e.target.value })}
                    placeholder="e.g., Tomatoes"
                    data-testid="input-item-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="item-description">Description</Label>
                  <Textarea
                    id="item-description"
                    value={itemFormData.description}
                    onChange={(e) => setItemFormData({ ...itemFormData, description: e.target.value })}
                    placeholder="Describe the item"
                    data-testid="input-item-description"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="item-price">Price (₦) *</Label>
                  <Input
                    id="item-price"
                    type="number"
                    step="0.01"
                    value={itemFormData.price}
                    onChange={(e) => setItemFormData({ ...itemFormData, price: e.target.value })}
                    placeholder="0.00"
                    data-testid="input-item-price"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="item-unit">Unit of Measure</Label>
                  <Select
                    value={itemFormData.unitOfMeasure}
                    onValueChange={(value) => setItemFormData({ ...itemFormData, unitOfMeasure: value })}
                  >
                    <SelectTrigger data-testid="select-item-unit">
                      <SelectValue />
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
              </div>
              <div className="flex justify-end space-x-2">
                <Button
                  variant="outline"
                  onClick={() => setIsCreateItemDialogOpen(false)}
                  data-testid="button-cancel-item"
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => createItemMutation.mutate(itemFormData)}
                  disabled={!itemFormData.name || !itemFormData.price || createItemMutation.isPending}
                  data-testid="button-submit-item"
                >
                  {createItemMutation.isPending ? "Adding..." : "Add Item"}
                </Button>
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
                    ₦{items.length > 0 ? (items.reduce((sum: number, item: any) => sum + item.price, 0) / items.length).toFixed(2) : "0.00"}
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

                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center text-lg font-bold text-primary">
                        <DollarSign className="w-4 h-4" />
                        <span>{item.price.toFixed(2)}</span>
                      </div>
                      <div className="flex items-center text-sm text-muted-foreground">
                        <Ruler className="w-4 h-4 mr-1" />
                        <span>per {item.unitOfMeasure}</span>
                      </div>
                    </div>

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
                          disabled={toggleAvailabilityMutation.isPending}
                          data-testid={`switch-availability-${item.id}`}
                        />
                      </div>
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
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Item</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-item-name">Item Name *</Label>
              <Input
                id="edit-item-name"
                value={itemFormData.name}
                onChange={(e) => setItemFormData({ ...itemFormData, name: e.target.value })}
                placeholder="e.g., Tomatoes"
                data-testid="input-edit-item-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-item-description">Description</Label>
              <Textarea
                id="edit-item-description"
                value={itemFormData.description}
                onChange={(e) => setItemFormData({ ...itemFormData, description: e.target.value })}
                placeholder="Describe the item"
                data-testid="input-edit-item-description"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-item-price">Price (₦) *</Label>
              <Input
                id="edit-item-price"
                type="number"
                step="0.01"
                value={itemFormData.price}
                onChange={(e) => setItemFormData({ ...itemFormData, price: e.target.value })}
                placeholder="0.00"
                data-testid="input-edit-item-price"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-item-unit">Unit of Measure</Label>
              <Select
                value={itemFormData.unitOfMeasure}
                onValueChange={(value) => setItemFormData({ ...itemFormData, unitOfMeasure: value })}
              >
                <SelectTrigger data-testid="select-edit-item-unit">
                  <SelectValue />
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
          </div>
          <div className="flex justify-end space-x-2">
            <Button
              variant="outline"
              onClick={() => {
                setIsEditItemDialogOpen(false);
                setEditingItem(null);
              }}
              data-testid="button-cancel-edit-item"
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (editingItem) {
                  updateItemMutation.mutate({ itemId: editingItem.id, itemData: itemFormData });
                }
              }}
              disabled={!itemFormData.name || !itemFormData.price || updateItemMutation.isPending}
              data-testid="button-submit-edit-item"
            >
              {updateItemMutation.isPending ? "Updating..." : "Update Item"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
