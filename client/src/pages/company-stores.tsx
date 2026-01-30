import { useState } from "react";
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
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Plus,
  Users,
  Store,
  ArrowLeft,
  MapPin,
  Phone,
  Mail,
  Edit,
  Trash2,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
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
  isActive?: boolean;
  approvalStatus?: string;
  ownerId?: string | null;
};

type CompanyStaff = {
  id: string;
  name?: string;
  email?: string;
};

type StoreMember = {
  id: string;
  role: string;
  userId: string;
  isActive?: boolean;
  user?: {
    id: string;
    name?: string | null;
    email?: string | null;
  };
};

const storeFormSchema = z.object({
  name: z.string().min(1, "Store name is required"),
  location: z.string().min(1, "Location is required"),
  description: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
});

const assignMemberFormSchema = z.object({
  userId: z.string().min(1, "Staff member is required"),
  role: z.string(),
  canManageItems: z.boolean().default(true),
  canManageOrders: z.boolean().default(true),
});

type StoreFormData = z.infer<typeof storeFormSchema>;
type AssignFormData = z.infer<typeof assignMemberFormSchema>;

export default function CompanyStores() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [showStoreModal, setShowStoreModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [activeStore, setActiveStore] = useState<CompanyStore | null>(null);
  const [transferStore, setTransferStore] = useState<CompanyStore | null>(null);
  const [transferTargetId, setTransferTargetId] = useState("");

  const storeForm = useForm<StoreFormData>({
    resolver: zodResolver(storeFormSchema),
    defaultValues: {
      name: "",
      location: "",
      description: "",
      phone: "",
      email: "",
    },
  });

  const assignForm = useForm<AssignFormData>({
    resolver: zodResolver(assignMemberFormSchema),
    defaultValues: {
      userId: "",
      role: "member",
      canManageItems: true,
      canManageOrders: true,
    },
  });

  const { data: stores = [], isLoading: storesLoading } = useQuery<CompanyStore[]>({
    queryKey: ["/api/company/stores"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/company/stores");
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: staff = [] } = useQuery<CompanyStaff[]>({
    queryKey: ["/api/company/staff"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/company/staff");
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: storeMembers = [] } = useQuery<StoreMember[]>({
    queryKey: ["/api/stores", transferStore?.id, "members"],
    queryFn: async () => {
      if (!transferStore?.id) return [];
      const res = await apiRequest("GET", `/api/stores/${transferStore.id}/members`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!transferStore?.id && showTransferModal,
  });

  const createStoreMutation = useMutation({
    mutationFn: async (data: StoreFormData) => {
      const res = await apiRequest("POST", "/api/company/stores", data);
      if (!res.ok) throw new Error("Failed to create store");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/company/stores"] });
      setShowStoreModal(false);
      storeForm.reset();
      toast({
        title: "Success",
        description: "Store created successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create store",
        variant: "destructive",
      });
    },
  });

  const assignStaffMutation = useMutation({
    mutationFn: async (data: AssignFormData) => {
      if (!activeStore) throw new Error("No store selected");
      const res = await apiRequest(
        "POST",
        `/api/company/stores/${activeStore.id}/members`,
        data
      );
      if (!res.ok) throw new Error("Failed to assign staff");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/company/stores"] });
      setShowAssignModal(false);
      assignForm.reset();
      setActiveStore(null);
      toast({
        title: "Success",
        description: "Staff member assigned successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to assign staff",
        variant: "destructive",
      });
    },
  });

  const transferOwnershipMutation = useMutation({
    mutationFn: async (newOwnerId: string) => {
      if (!transferStore?.id) throw new Error("No store selected");
      const res = await apiRequest(
        "PATCH",
        `/api/stores/${transferStore.id}/transfer-ownership`,
        { newOwnerId },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.message || body?.error || "Failed to transfer ownership");
      }
      return res.json();
    },
    onSuccess: (_data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/company/stores"] });
      if (transferStore?.id) {
        queryClient.invalidateQueries({
          queryKey: ["/api/stores", transferStore.id, "members"],
        });
      }
      setShowTransferModal(false);
      setTransferStore(null);
      setTransferTargetId("");
      toast({
        title: "Ownership transferred",
        description: "The store owner has been updated successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Transfer failed",
        description: error.message || "Unable to transfer ownership right now.",
        variant: "destructive",
      });
    },
  });

  const getStatusBadgeVariant = (status?: string) => {
    switch (status) {
      case "approved":
        return "default";
      case "rejected":
        return "destructive";
      default:
        return "secondary";
    }
  };

  const managerOptions = storeMembers.filter(
    (member) => member.role === "manager" && member.isActive !== false,
  );

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
              <span className="text-lg font-semibold">Stores Management</span>
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
              <BreadcrumbPage>Stores</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Your Stores</h1>
            <p className="text-slate-500 mt-2">
              Manage your stores and assign staff members
            </p>
          </div>
          <Button onClick={() => setShowStoreModal(true)}>
            <Plus className="w-4 h-4 mr-2" />
            New Store
          </Button>
        </div>

        {/* Stores Grid */}
        {storesLoading ? (
          <div className="text-center py-12 text-slate-500">
            Loading stores...
          </div>
        ) : stores.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Store className="h-12 w-12 text-slate-300 mb-4" />
              <h3 className="text-lg font-semibold text-slate-900">
                No stores yet
              </h3>
              <p className="text-slate-500 mt-2">
                Create your first store to get started
              </p>
              <Button
                onClick={() => setShowStoreModal(true)}
                className="mt-4"
              >
                Create Store
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {stores.map((store) => (
              <Card key={store.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-lg">{store.name}</CardTitle>
                    <Badge variant={getStatusBadgeVariant(store.approvalStatus)}>
                      {store.approvalStatus || "pending"}
                    </Badge>
                  </div>
                  {store.description && (
                    <p className="text-sm text-slate-500 mt-2">
                      {store.description}
                    </p>
                  )}
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2 text-sm">
                    {store.location && (
                      <div className="flex items-center gap-2 text-slate-600">
                        <MapPin className="h-4 w-4" />
                        {store.location}
                      </div>
                    )}
                    {store.phone && (
                      <div className="flex items-center gap-2 text-slate-600">
                        <Phone className="h-4 w-4" />
                        {store.phone}
                      </div>
                    )}
                    {store.email && (
                      <div className="flex items-center gap-2 text-slate-600">
                        <Mail className="h-4 w-4" />
                        {store.email}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2 pt-4 border-t border-slate-100">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setActiveStore(store);
                        setShowAssignModal(true);
                      }}
                      className="flex-1"
                    >
                      <Users className="h-4 w-4 mr-2" />
                      Assign Staff
                    </Button>
                    {store.ownerId && user?.id === store.ownerId && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setTransferStore(store);
                          setTransferTargetId("");
                          setShowTransferModal(true);
                        }}
                        className="flex-1"
                      >
                        Transfer Ownership
                      </Button>
                    )}
                    <Button variant="outline" size="sm">
                      <Edit className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>

      {/* Create Store Dialog */}
      <Dialog open={showStoreModal} onOpenChange={setShowStoreModal}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Create New Store</DialogTitle>
            <DialogDescription>
              Add a new store to your company.
            </DialogDescription>
          </DialogHeader>
          <Form {...storeForm}>
            <form
              className="space-y-4"
              onSubmit={storeForm.handleSubmit((data) =>
                createStoreMutation.mutate(data)
              )}
            >
              <FormField
                control={storeForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Store Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Store name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={storeForm.control}
                name="location"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Location</FormLabel>
                    <FormControl>
                      <Input placeholder="Location" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={storeForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Describe your store" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={storeForm.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone</FormLabel>
                      <FormControl>
                        <Input placeholder="+234..." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={storeForm.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input placeholder="store@example.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => setShowStoreModal(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={createStoreMutation.isPending}>
                  {createStoreMutation.isPending ? "Creating..." : "Create Store"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Assign Staff Dialog */}
      <Dialog open={showAssignModal} onOpenChange={setShowAssignModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Assign Staff Member</DialogTitle>
            <DialogDescription>
              {activeStore ? `Assign a team member to ${activeStore.name}` : "Assign a team member"}
            </DialogDescription>
          </DialogHeader>
          <Form {...assignForm}>
            <form
              className="space-y-4"
              onSubmit={assignForm.handleSubmit((data) =>
                assignStaffMutation.mutate(data)
              )}
            >
              <FormField
                control={assignForm.control}
                name="userId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Staff Member</FormLabel>
                    <FormControl>
                      <select
                        className="flex h-9 rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                        {...field}
                      >
                        <option value="">Select staff member</option>
                        {staff.map((member) => (
                          <option key={member.id} value={member.id}>
                            {member.name || member.email || member.id}
                          </option>
                        ))}
                      </select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => setShowAssignModal(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={assignStaffMutation.isPending}>
                  {assignStaffMutation.isPending ? "Assigning..." : "Assign"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Transfer Ownership Dialog */}
      <Dialog
        open={showTransferModal}
        onOpenChange={(open) => {
          setShowTransferModal(open);
          if (!open) {
            setTransferStore(null);
            setTransferTargetId("");
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Transfer Ownership</DialogTitle>
            <DialogDescription>
              {transferStore?.name
                ? `Transfer ownership of ${transferStore.name} to a manager.`
                : "Transfer store ownership to a manager."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
              This action is permanent. The current owner will become a manager.
            </div>
            <div className="space-y-2">
              <FormLabel>New Owner (Manager)</FormLabel>
              <Select value={transferTargetId} onValueChange={setTransferTargetId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a manager" />
                </SelectTrigger>
                <SelectContent>
                  {managerOptions.length > 0 ? (
                    managerOptions.map((member) => (
                      <SelectItem key={member.userId} value={member.userId}>
                        {member.user?.name || member.user?.email || member.userId}
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value="__none" disabled>
                      No managers available
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setShowTransferModal(false)}
                disabled={transferOwnershipMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                onClick={() => transferOwnershipMutation.mutate(transferTargetId)}
                disabled={!transferTargetId || transferOwnershipMutation.isPending}
              >
                {transferOwnershipMutation.isPending ? "Transferring..." : "Transfer"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
