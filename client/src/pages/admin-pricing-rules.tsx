import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { adminApiRequest } from "@/lib/adminApi";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Plus, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type PricingRule = {
  id: string;
  name: string;
  category: string | null;
  scope: string | null;
  urgency: string | null;
  minPrice: string;
  maxPrice: string;
  isActive: boolean;
  updatedAt?: string | null;
};

export default function AdminPricingRulesPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    category: "",
    urgency: "",
    minPrice: "0",
    maxPrice: "0",
  });

  const { data, isLoading, error } = useQuery<PricingRule[]>({
    queryKey: ["/api/admin/pricing-rules"],
    queryFn: async () => await adminApiRequest("GET", "/api/admin/pricing-rules"),
    enabled: !!user && user.globalRole === "super_admin",
  });

  const createMutation = useMutation({
    mutationFn: (ruleData: any) =>
      adminApiRequest("POST", "/api/admin/pricing-rules", ruleData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/pricing-rules"] });
      setIsCreateDialogOpen(false);
      resetForm();
      toast({ title: "Pricing rule created successfully" });
    },
    onError: (error: any) => {
      toast({
        title: "Error creating pricing rule",
        description: error.response?.data?.error || "Failed to create pricing rule",
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setFormData({
      name: "",
      category: "",
      urgency: "",
      minPrice: "0",
      maxPrice: "0",
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast({
        title: "Validation Error",
        description: "Pricing rule name is required",
        variant: "destructive",
      });
      return;
    }
    createMutation.mutate(formData);
  };

  if (user?.globalRole !== "super_admin") {
    return (
      <AdminLayout title="Pricing Rules">
        <Card>
          <CardContent className="p-6">Unauthorized (SUPER_ADMIN only).</CardContent>
        </Card>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Pricing Rules">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Pricing Rules
            </h1>
            <p className="text-gray-600 dark:text-gray-300">
              Manage pricing rules for different service categories and urgency levels
            </p>
          </div>
          <Button
            onClick={() => setIsCreateDialogOpen(true)}
            className="mt-4 sm:mt-0"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Pricing Rule
          </Button>
        </div>

        {/* Pricing Rules Table */}
        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-6">Loading…</div>
            ) : error ? (
              <div className="p-6">Failed to load pricing rules.</div>
            ) : (data ?? []).length === 0 ? (
              <div className="p-12 text-center">
                <p className="text-gray-500 dark:text-gray-400 mb-4">
                  No pricing rules yet. Create one to get started.
                </p>
                <Button onClick={() => setIsCreateDialogOpen(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Create First Rule
                </Button>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Urgency</TableHead>
                    <TableHead>Min Price</TableHead>
                    <TableHead>Max Price</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Updated</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(data ?? []).map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.name}</TableCell>
                      <TableCell>{r.category ?? "—"}</TableCell>
                      <TableCell>{r.urgency ?? "—"}</TableCell>
                      <TableCell>₦{r.minPrice}</TableCell>
                      <TableCell>₦{r.maxPrice}</TableCell>
                      <TableCell>{r.isActive ? "Active" : "Inactive"}</TableCell>
                      <TableCell>{r.updatedAt ? new Date(r.updatedAt).toLocaleString() : "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Create Pricing Rule Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="w-[95vw] max-w-lg">
          <DialogHeader>
            <DialogTitle>Create New Pricing Rule</DialogTitle>
            <DialogDescription>
              Add a pricing rule for a service category with specific urgency level
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-sm font-medium">Rule Name *</label>
              <Input
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder="e.g., Plumbing - Standard"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Category</label>
                <Select
                  value={formData.category}
                  onValueChange={(value) =>
                    setFormData({ ...formData, category: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">None</SelectItem>
                    <SelectItem value="electrician">Electrician</SelectItem>
                    <SelectItem value="plumber">Plumber</SelectItem>
                    <SelectItem value="carpenter">Carpenter</SelectItem>
                    <SelectItem value="hvac_technician">HVAC Technician</SelectItem>
                    <SelectItem value="painter">Painter</SelectItem>
                    <SelectItem value="tiler">Tiler</SelectItem>
                    <SelectItem value="mason">Mason</SelectItem>
                    <SelectItem value="roofer">Roofer</SelectItem>
                    <SelectItem value="gardener">Gardener</SelectItem>
                    <SelectItem value="cleaner">Cleaner</SelectItem>
                    <SelectItem value="welder">Welder</SelectItem>
                    <SelectItem value="appliance_repair">Appliance Repair</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium">Urgency</label>
                <Select
                  value={formData.urgency}
                  onValueChange={(value) =>
                    setFormData({ ...formData, urgency: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select urgency" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">None</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="emergency">Emergency</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Min Price (₦)</label>
                <Input
                  type="number"
                  value={formData.minPrice}
                  onChange={(e) =>
                    setFormData({ ...formData, minPrice: e.target.value })
                  }
                  placeholder="0"
                  min="0"
                />
              </div>

              <div>
                <label className="text-sm font-medium">Max Price (₦)</label>
                <Input
                  type="number"
                  value={formData.maxPrice}
                  onChange={(e) =>
                    setFormData({ ...formData, maxPrice: e.target.value })
                  }
                  placeholder="0"
                  min="0"
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsCreateDialogOpen(false);
                  resetForm();
                }}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending}
              >
                {createMutation.isPending && (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                )}
                {createMutation.isPending ? "Creating..." : "Create Rule"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Floating create button (ensures visibility if header CTA is hidden) */}
      <div className="fixed right-6 bottom-6 z-50">
        <Button
          onClick={() => setIsCreateDialogOpen(true)}
          className="rounded-full h-12 w-12 p-0"
          aria-label="Add Pricing Rule"
        >
          <Plus className="w-5 h-5" />
        </Button>
      </div>

    </AdminLayout>
  );
}
