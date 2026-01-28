import { useMemo, useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest, getQueryFn, queryClient } from "@/lib/queryClient";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Bell,
  ChevronDown,
  ChevronRight,
  Dice4,
  Edit3,
  Eye,
  EyeOff,
  MoreVertical,
  Trash2,
} from "lucide-react";
import { AreaChart, ResponsiveContainer, Area } from "recharts";
import { Link, useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  createProviderSchema,
  type CreateProviderInput,
} from "@shared/admin-schema";
import type { Category, Company } from "@shared/schema";

type LatestTransaction = {
  id: string;
  amount: number;
  status: string | null;
  description: string | null;
  category: string | null;
  requestId: string | null;
  providerName: string | null;
  createdAt: string | null;
};

type BusinessOverview = {
  totalProviders: number;
  activeRequests: number;
  totalRevenue: number;
  recentActivity: {
    id: string;
    status: string;
    category: string | null;
    createdAt: string | null;
  }[];
  latestTransactions: LatestTransaction[];
};

type RecentTransaction = {
  title: string;
  amount: number;
  status: string;
  month: string;
};

type CompanyStaff = {
  id: string;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  isApproved?: boolean | null;
  isActive?: boolean | null;
  company?: string | null;
};

type CompanyStore = {
  id: string;
  name: string;
  location: string;
  description?: string | null;
  ownerId?: string | null;
  companyId?: string | null;
  createdAt?: string | null;
};

type InventoryItem = {
  id: string;
  name: string;
  description?: string | null;
  category?: string | null;
  price?: number | string | null;
  stock?: number | null;
  images?: string[] | null;
  isActive?: boolean | null;
  createdAt?: string | null;
};

const FALLBACK_TRANSACTIONS: RecentTransaction[] = [
  {
    title: "Jollof Rice and 1 other",
    amount: 100650,
    status: "success",
    month: "06/2024",
  },
  {
    title: "Agbada and 2 others",
    amount: 100000,
    status: "success",
    month: "06/2024",
  },
  {
    title: "Pounded yam bundle",
    amount: 95500,
    status: "pending",
    month: "05/2024",
  },
];

const DATE_RANGE_OPTIONS = [
  { value: "last-7", label: "Last 7 days" },
  { value: "last-30", label: "Last 30 days" },
  { value: "this-month", label: "This month" },
];

const formatStatusLabel = (status?: string) =>
  status
    ? status
        .replace(/_/g, " ")
        .replace(/\b\w/g, (letter) => letter.toUpperCase())
    : "Unknown";

const getTransactionBadgeVariant = (
  status: string,
): "default" | "secondary" | "outline" => {
  const normalized = status.toLowerCase();
  if (["success", "completed", "approved"].includes(normalized)) {
    return "default";
  }
  if (normalized === "pending") {
    return "secondary";
  }
  return "outline";
};

const currencyFormatter = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  maximumFractionDigits: 0,
});

const formatCurrency = (value?: number | string) => {
  const amount = typeof value === "string" ? Number(value) : value ?? 0;
  if (!Number.isFinite(amount)) {
    return currencyFormatter.format(0);
  }
  return currencyFormatter.format(amount);
};

const REVENUE_TREND = [35, 42, 38, 48, 55, 62, 75];
const REQUEST_TREND = [25, 22, 26, 24, 21, 19, 16];
const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul"];

const REVENUE_CHART_DATA = MONTH_LABELS.map((label, index) => ({
  month: label,
  value: REVENUE_TREND[index] ?? REVENUE_TREND[REVENUE_TREND.length - 1],
}));

const REQUEST_CHART_DATA = MONTH_LABELS.map((label, index) => ({
  month: label,
  value: REQUEST_TREND[index] ?? REQUEST_TREND[REQUEST_TREND.length - 1],
}));

const PASSWORD_LENGTH = 12;

const generatePassword = () => {
  const charset =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()";
  return Array.from(
    { length: PASSWORD_LENGTH },
    () => charset[Math.floor(Math.random() * charset.length)],
  ).join("");
};

export default function CompanyDashboard() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { data: providerCompany, isLoading: isLoadingCompany } = useQuery({
    queryKey: ["/api/provider/company"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/provider/company");
      if (!res.ok) return null;
      return res.json();
    },
    staleTime: 30_000,
  });

  useEffect(() => {
    if (isLoadingCompany) return;
    if (providerCompany && providerCompany.isActive === false) {
      toast({
        title: "Company pending approval",
        description: "Your company is awaiting verification by an admin.",
      });
      setLocation("/provider");
    }
  }, [providerCompany, isLoadingCompany, setLocation, toast]);

  if (providerCompany && providerCompany.isActive === false) {
    return null;
  }

  const { data, isLoading, error } = useQuery<BusinessOverview>({
    queryKey: ["/api/business/overview"],
    queryFn: getQueryFn<BusinessOverview>({ on401: "returnNull" }),
  });

  const stats = data ?? {
    totalProviders: 0,
    activeRequests: 0,
    totalRevenue: 0,
    recentActivity: [],
    latestTransactions: [],
  };

  const {
    data: serviceCategories = [],
    isLoading: serviceCategoriesLoading,
  } = useQuery<Category[]>({
    queryKey: ["/api/categories?scope=global"],
    queryFn: getQueryFn<Category[]>({ on401: "throw" }),
  });

  const { data: companies = [] } = useQuery<Company[]>({
    queryKey: ["/api/companies"],
    queryFn: getQueryFn<Company[]>({ on401: "throw" }),
  });

  const { data: companyStaff = [], isLoading: companyStaffLoading } = useQuery<CompanyStaff[]>({
    queryKey: ["/api/company/staff"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/company/staff");
      if (!res.ok) return [];
      return res.json();
    },
    enabled: Boolean(providerCompany?.id),
  });

  const [showStoreModal, setShowStoreModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [activeStore, setActiveStore] = useState<CompanyStore | null>(null);
  const [selectedStoreId, setSelectedStoreId] = useState("");
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);

  const { data: companyStores = [], isLoading: companyStoresLoading } = useQuery<CompanyStore[]>({
    queryKey: ["/api/company/stores"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/company/stores");
      if (!res.ok) return [];
      return res.json();
    },
    enabled: Boolean(providerCompany?.id),
  });

  const { data: inventoryItems = [], isLoading: inventoryLoading } = useQuery<InventoryItem[]>({
    queryKey: ["/api/company/stores", selectedStoreId, "inventory"],
    queryFn: async () => {
      if (!selectedStoreId) return [];
      const res = await apiRequest("GET", `/api/company/stores/${selectedStoreId}/inventory`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: Boolean(selectedStoreId),
  });

  const serviceCategoryOptions = useMemo(() => {
    return [...serviceCategories]
      .filter((category) => category.isActive !== false)
      .sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  }, [serviceCategories]);

  const staffById = useMemo(() => {
    const map = new Map<string, CompanyStaff>();
    companyStaff.forEach((staff) => {
      if (staff?.id) map.set(staff.id, staff);
    });
    return map;
  }, [companyStaff]);

  const categoryNameMap = useMemo(() => {
    const map = new Map<string, string>();
    serviceCategoryOptions.forEach((category) => {
      if (category.key) {
        map.set(category.key, category.name || category.key);
      }
    });
    return map;
  }, [serviceCategoryOptions]);

  const [dateRange, setDateRange] = useState("last-30");
  const [searchTerm, setSearchTerm] = useState("");
  const [exportAll, setExportAll] = useState(false);

  const companyDisplayName = providerCompany?.name || companies[0]?.name || "Ray";
  const firstCompanyName = companyDisplayName ?? "Ray";
  const greetingName = firstCompanyName ? firstCompanyName.split(" ")[0] : "John";
  const marketplaceName = companyDisplayName
    ? `${firstCompanyName}'s Marketplace`
    : "Ray's Marketplace";

  const customersCount = companies.length;
  const providersCount = stats.totalProviders;
  const revenueTrendPositive = true;
  const requestTrendPositive = false;
  const userTrendPositive = true;
  const latestTransactions = stats.latestTransactions ?? [];

  const recentTransactions = useMemo(() => {
    if (stats.recentActivity.length === 0) {
      return FALLBACK_TRANSACTIONS;
    }
    return stats.recentActivity.slice(0, 4).map((item, index) => {
      const label = item.category
        ? item.category.replace(/_/g, " ")
        : "General request";
      const capitalizedLabel =
        label.charAt(0).toUpperCase() + label.slice(1).toLowerCase();
      return {
        title: `${capitalizedLabel}`,
        amount: 100000 + index * 4500,
        status: item.status,
        month: item.createdAt
          ? new Date(item.createdAt).toLocaleDateString("en-US", {
              month: "2-digit",
              year: "numeric",
            })
          : "—",
      };
    });
  }, [stats.recentActivity]);

  const filteredActivity = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) {
      return stats.recentActivity;
    }
    return stats.recentActivity.filter((item) => {
      const category = item.category
        ? item.category.replace(/_/g, " ").toLowerCase()
        : "";
      const status = item.status?.toLowerCase() ?? "";
      const id = item.id?.toLowerCase() ?? "";
      return (
        category.includes(query) || status.includes(query) || id.includes(query)
      );
    });
  }, [searchTerm, stats.recentActivity]);

  const [showProviderModal, setShowProviderModal] = useState(false);
  const providerForm = useForm<CreateProviderInput>({
    resolver: zodResolver(createProviderSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      password: generatePassword(),
      company: "",
      categories: [],
      experience: 0,
      description: "",
      isApproved: false,
    },
  });

  const storeFormSchema = z.object({
    name: z.string().min(1, "Store name is required"),
    location: z.string().min(1, "Location is required"),
    description: z.string().optional().default(""),
    ownerId: z.string().min(1, "Owner is required"),
    phone: z.string().optional().default(""),
    email: z.string().optional().default(""),
  });

  const storeForm = useForm<z.infer<typeof storeFormSchema>>({
    resolver: zodResolver(storeFormSchema),
    defaultValues: {
      name: "",
      location: "",
      description: "",
      ownerId: "",
      phone: "",
      email: "",
    },
  });

  const assignMemberSchema = z.object({
    userId: z.string().min(1, "Select a staff member"),
    role: z.enum(["owner", "manager", "member"]).default("member"),
    canManageItems: z.boolean().default(true),
    canManageOrders: z.boolean().default(true),
  });

  const assignMemberForm = useForm<z.infer<typeof assignMemberSchema>>({
    resolver: zodResolver(assignMemberSchema),
    defaultValues: {
      userId: "",
      role: "member",
      canManageItems: true,
      canManageOrders: true,
    },
  });

  const [passwordVisible, setPasswordVisible] = useState(true);

  const inventoryFormSchema = z.object({
    name: z.string().min(1, "Item name is required"),
    category: z.string().min(1, "Category is required"),
    price: z.preprocess((value) => Number(value), z.number().nonnegative()),
    stock: z.preprocess((value) => Number(value), z.number().int().nonnegative()),
    description: z.string().optional().default(""),
    images: z.string().optional().default(""),
  });

  const inventoryForm = useForm<z.infer<typeof inventoryFormSchema>>({
    resolver: zodResolver(inventoryFormSchema),
    defaultValues: {
      name: "",
      category: "",
      price: 0,
      stock: 0,
      description: "",
      images: "",
    },
  });

  useEffect(() => {
    if (providerCompany?.id) {
      providerForm.setValue("company", providerCompany.id);
    }
  }, [providerCompany, providerForm]);

  useEffect(() => {
    if (!selectedStoreId && companyStores.length > 0) {
      setSelectedStoreId(companyStores[0]?.id || "");
    }
  }, [companyStores, selectedStoreId]);

  const onProviderSubmit = providerForm.handleSubmit(async (values) => {
    if (!providerCompany?.id) {
      toast({
        title: "Company required",
        description: "Create or join a company before inviting staff.",
        variant: "destructive",
      });
      return;
    }

    try {
      const payload = {
        ...values,
        company: providerCompany.id,
        isApproved: false,
      };
      const res = await apiRequest("POST", "/api/admin/providers", payload);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.message || body?.error || "Unable to invite provider");
      }

      toast({
        title: "Invite sent",
        description: "The provider has been added and is awaiting approval.",
      });
      setShowProviderModal(false);
      providerForm.reset({
        firstName: "",
        lastName: "",
        email: "",
        phone: "",
        password: generatePassword(),
        company: providerCompany.id,
        categories: [],
        experience: 0,
        description: "",
        isApproved: false,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/company/staff"] });
    } catch (error: any) {
      toast({
        title: "Invite failed",
        description: error?.message || "Unable to invite the provider right now.",
        variant: "destructive",
      });
    }
  });

  const onStoreSubmit = storeForm.handleSubmit(async (values) => {
    try {
      const res = await apiRequest("POST", "/api/company/stores", values);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.message || body?.error || "Unable to create store");
      }
      toast({
        title: "Store created",
        description: "Your store is ready to start listing inventory.",
      });
      setShowStoreModal(false);
      storeForm.reset();
      queryClient.invalidateQueries({ queryKey: ["/api/company/stores"] });
    } catch (error: any) {
      toast({
        title: "Store creation failed",
        description: error?.message || "Unable to create store right now.",
        variant: "destructive",
      });
    }
  });

  const onAssignSubmit = assignMemberForm.handleSubmit(async (values) => {
    if (!activeStore?.id) return;
    try {
      const res = await apiRequest(
        "POST",
        `/api/company/stores/${activeStore.id}/members`,
        values,
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.message || body?.error || "Unable to assign staff");
      }
      toast({
        title: "Staff assigned",
        description: "The team member can now manage this store.",
      });
      setShowAssignModal(false);
      assignMemberForm.reset();
    } catch (error: any) {
      toast({
        title: "Assignment failed",
        description: error?.message || "Unable to assign staff right now.",
        variant: "destructive",
      });
    }
  });

  const onInventorySubmit = inventoryForm.handleSubmit(async (values) => {
    if (!selectedStoreId) {
      toast({
        title: "Select a store",
        description: "Choose a store before adding inventory.",
        variant: "destructive",
      });
      return;
    }

    const images = values.images
      ? values.images
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean)
      : [];

    try {
      if (editingItem?.id) {
        const res = await apiRequest(
          "PATCH",
          `/api/company/stores/${selectedStoreId}/inventory/${editingItem.id}`,
          {
            name: values.name,
            category: values.category,
            price: values.price,
            stock: values.stock,
            description: values.description,
            images,
          },
        );
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body?.message || body?.error || "Unable to update item");
        }
        toast({
          title: "Item updated",
          description: "Inventory item updated successfully.",
        });
      } else {
        const res = await apiRequest(
          "POST",
          `/api/company/stores/${selectedStoreId}/inventory`,
          {
            name: values.name,
            category: values.category,
            price: values.price,
            stock: values.stock,
            description: values.description,
            images,
          },
        );
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body?.message || body?.error || "Unable to add item");
        }
        toast({
          title: "Item added",
          description: "Inventory item added to your store.",
        });
      }

      setEditingItem(null);
      inventoryForm.reset({
        name: "",
        category: "",
        price: 0,
        stock: 0,
        description: "",
        images: "",
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/company/stores", selectedStoreId, "inventory"],
      });
    } catch (error: any) {
      toast({
        title: "Inventory update failed",
        description: error?.message || "Unable to save this item right now.",
        variant: "destructive",
      });
    }
  });

  const handleEditItem = (item: InventoryItem) => {
    setEditingItem(item);
    inventoryForm.reset({
      name: item.name || "",
      category: item.category || "",
      price: Number(item.price || 0),
      stock: Number(item.stock || 0),
      description: item.description || "",
      images: Array.isArray(item.images) ? item.images.join(", ") : "",
    });
  };

  const handleDeleteItem = async (item: InventoryItem) => {
    if (!selectedStoreId || !item.id) return;
    try {
      const res = await apiRequest(
        "DELETE",
        `/api/company/stores/${selectedStoreId}/inventory/${item.id}`,
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.message || body?.error || "Unable to delete item");
      }
      toast({
        title: "Item removed",
        description: "The item has been removed from inventory.",
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/company/stores", selectedStoreId, "inventory"],
      });
    } catch (error: any) {
      toast({
        title: "Delete failed",
        description: error?.message || "Unable to delete item right now.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <nav className="bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex flex-col">
              <span className="text-lg font-semibold tracking-tight text-foreground">
                CityConnect
              </span>
              <span className="text-xs uppercase tracking-[0.5em] text-slate-400">
                Business suite
              </span>
            </div>
            <div className="flex items-center gap-3">
              <Button variant="ghost" className="p-2">
                <Bell className="h-4 w-4 text-slate-500" />
              </Button>
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-cyan-500 text-white font-semibold flex items-center justify-center text-sm">
                  {greetingName.charAt(0)}
                </div>
                <div className="text-sm font-semibold text-foreground">
                  {greetingName}
                </div>
              </div>
              <Link href="/">
                <Button variant="destructive" size="sm">
                  Logout
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
        <section className="space-y-1">
          <p className="text-lg font-semibold text-slate-900">Hi {greetingName}</p>
          <p className="text-sm text-slate-500">
            Here is a brief overview of the activities on {marketplaceName}
          </p>
        </section>

        {error && (
          <div className="rounded-2xl border border-rose-100 bg-rose-50/70 px-4 py-3 text-sm text-rose-600">
            Unable to load marketplace overview. Please try again shortly.
          </div>
        )}

        <section className="grid gap-4 md:grid-cols-3">
          <Card className="relative overflow-hidden shadow-xl border border-slate-100/80 rounded-[20px] flex flex-col">
            <Button
              variant="ghost"
              className="absolute top-3 right-3 rounded-full p-2 text-slate-400 hover:text-slate-700"
            >
              <MoreVertical className="h-4 w-4" />
            </Button>
            <CardHeader className="flex items-start justify-between pb-2">
              <div className="space-y-1">
                <CardTitle className="text-sm font-medium text-slate-500">
                  Total Revenue
                </CardTitle>
                <div className="flex items-center gap-1 text-[0.65rem] font-semibold">
                  {revenueTrendPositive ? (
                    <ArrowUp className="h-4 w-4 text-emerald-500" />
                  ) : (
                    <ArrowDown className="h-4 w-4 text-rose-500" />
                  )}
                  <span
                    className={
                      revenueTrendPositive ? "text-emerald-500" : "text-rose-500"
                    }
                  >
                    {revenueTrendPositive ? "+40%" : "-8%"} vs last month
                  </span>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0 mt-auto">
              <div className="flex items-center justify-between gap-6">
                <div className="space-y-1">
                  <p className="text-3xl font-semibold text-slate-900">
                    ₦{stats.totalRevenue.toLocaleString("en-NG")}
                  </p>
                  <p className="text-xs text-slate-500">
                    Verified providers across all estates
                  </p>
                </div>
                <div className="w-28 h-16">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={REVENUE_CHART_DATA}>
                      <defs>
                        <linearGradient id="revenueChartGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#22c55e" stopOpacity={0.4} />
                          <stop offset="95%" stopColor="#22c55e" stopOpacity={0.05} />
                        </linearGradient>
                      </defs>
                      <Area
                        type="monotone"
                        dataKey="value"
                        stroke="#16a34a"
                        strokeWidth={2}
                        fill="url(#revenueChartGradient)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden shadow-xl border border-slate-100/80 rounded-[20px] flex flex-col">
            <Button
              variant="ghost"
              className="absolute top-3 right-3 rounded-full p-2 text-slate-400 hover:text-slate-700"
            >
              <MoreVertical className="h-4 w-4" />
            </Button>
            <CardHeader className="flex items-start justify-between pb-2">
              <div className="space-y-1">
                <CardTitle className="text-sm font-medium text-slate-500">
                  Active Requests
                </CardTitle>
                <div className="flex items-center gap-1 text-[0.65rem] font-semibold">
                  <ArrowDown className="h-4 w-4 text-rose-500" />
                  <span className="text-rose-500">-10% vs last month</span>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0 mt-auto">
              <div className="flex items-center justify-between gap-6">
                <div className="space-y-1">
                  <p className="text-3xl font-semibold text-slate-900">
                    {stats.activeRequests}
                  </p>
                  <p className="text-xs text-slate-500">
                    Requests currently awaiting provider action
                  </p>
                </div>
                <div className="w-28 h-16">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={REQUEST_CHART_DATA}>
                      <defs>
                        <linearGradient id="requestChartGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#ef4444" stopOpacity={0.4} />
                          <stop offset="95%" stopColor="#ef4444" stopOpacity={0.05} />
                        </linearGradient>
                      </defs>
                      <Area
                        type="monotone"
                        dataKey="value"
                        stroke="#dc2626"
                        strokeWidth={2}
                        fill="url(#requestChartGradient)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-md border border-slate-100">
            <CardHeader className="pb-1">
              <CardTitle className="text-sm font-semibold text-slate-900">
                Total Users
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-1">
              <div className="grid grid-cols-2 gap-6">
                {[
                  { label: "Providers", value: providersCount },
                  { label: "Customers", value: customersCount || 0 },
                ].map((item) => (
                  <div key={item.label} className="space-y-2">
                    <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                      {item.label}
                    </span>
                    <p className="text-3xl font-semibold text-slate-900">
                      {item.value}
                    </p>
                    <div className="flex items-center gap-1 text-sm font-semibold text-emerald-500">
                      <ArrowUp className="h-4 w-4" />
                      <span>+20%</span>
                    </div>
                    <p className="text-xs font-medium text-slate-400">
                      vs last month
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.6fr,1fr]">
          <Card className="shadow-lg border border-slate-100">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base text-slate-900">
                    Recent activity
                  </CardTitle>
                  <p className="text-xs text-slate-500">
                    Track the latest servings flowing through the marketplace.
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Select value={dateRange} onValueChange={setDateRange}>
                    <SelectTrigger className="min-w-[180px]">
                      <SelectValue placeholder="Select date range" />
                    </SelectTrigger>
                    <SelectContent>
                      {DATE_RANGE_OPTIONS.map((range) => (
                        <SelectItem key={range.value} value={range.value}>
                          {range.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    placeholder="Search for Users"
                    className="w-full max-w-xs"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 pt-0">
              <div className="flex flex-wrap items-center gap-4 justify-between">
                <label className="flex items-center gap-2 text-sm text-slate-500">
                  <Checkbox
                    checked={exportAll}
                    onCheckedChange={(value) => setExportAll(Boolean(value))}
                  />
                  Export all
                </label>
                <Button variant="destructive" size="sm">
                  Export all
                </Button>
              </div>
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                    <tr>
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3">Activity</th>
                      <th className="px-4 py-3">Request ID</th>
                      <th className="px-4 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {!filteredActivity.length ? (
                      <tr>
                        <td
                          colSpan={4}
                          className="px-4 py-6 text-center text-xs uppercase text-slate-400"
                        >
                          No activity recorded yet
                        </td>
                      </tr>
                    ) : (
                      filteredActivity.map((activity) => (
                        <tr
                          key={activity.id}
                          className="border-t border-slate-100 text-slate-600"
                        >
                          <td className="px-4 py-4">
                            {activity.createdAt
                              ? new Date(activity.createdAt).toLocaleDateString()
                              : "—"}
                          </td>
                          <td className="px-4 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-xs font-semibold text-slate-500">
                                {activity.category
                                  ? activity.category.charAt(0).toUpperCase()
                                  : "G"}
                              </div>
                              <div>
                                <p className="font-semibold text-slate-900">
                                  {activity.category
                                    ? activity.category.replace(/_/g, " ")
                                    : "General request"}
                                </p>
                                <p className="text-[0.65rem] text-slate-400">
                                  {formatStatusLabel(activity.status)}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-4 font-mono text-[0.8rem] text-slate-500">
                            #{activity.id.slice(0, 8)}
                          </td>
                          <td className="px-4 py-4">
                            <Badge
                              variant={getTransactionBadgeVariant(activity.status)}
                            >
                              {formatStatusLabel(activity.status)}
                            </Badge>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-lg border border-slate-100">
            <CardHeader className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white">
                    Latest Transactions
                  </span>
                  <span className="text-xs font-semibold text-slate-500">Chat</span>
                </div>
                <Button variant="ghost" className="p-2">
                  <ChevronRight className="h-4 w-4 text-slate-400" />
                </Button>
              </div>
              <p className="text-xs text-slate-500">
                Review what residents are ordering across Ray's marketplace.
              </p>
            </CardHeader>
            <CardContent className="space-y-3 pt-0">
              {latestTransactions.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-white/80 px-4 py-6 text-center text-xs uppercase text-slate-400">
                  No transactions recorded yet
                </div>
              ) : (
                latestTransactions.map((transaction) => {
                  const displayTitle = transaction.description
                    ? transaction.description
                    : transaction.category
                    ? transaction.category.replace(/_/g, " ")
                    : "Service transaction";
                  const dateLabel = transaction.createdAt
                    ? new Date(transaction.createdAt).toLocaleDateString("en-US", {
                        month: "2-digit",
                        year: "numeric",
                      })
                    : "—";
                  const initial = displayTitle.charAt(0).toUpperCase();
                  return (
                    <div
                      key={transaction.id}
                      className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-sm font-semibold text-slate-500">
                            {initial}
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-slate-900">
                              {displayTitle}
                            </p>
                            <p className="text-[0.7rem] text-slate-400">
                              {dateLabel}
                            </p>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1 text-right">
                          <p className="text-lg font-semibold text-slate-900">
                            {formatCurrency(transaction.amount)}
                          </p>
                          <div className="flex items-center gap-2">
                            <Badge
                              variant={getTransactionBadgeVariant(transaction.status ?? "")}
                              className="py-1 px-3 text-xs"
                            >
                              {formatStatusLabel(transaction.status ?? "")}
                            </Badge>
                            <ChevronDown className="h-4 w-4 text-slate-400" />
                          </div>
                        </div>
                      </div>
                      {transaction.providerName && (
                        <div className="mt-2 pt-2 border-t border-slate-100">
                          <p className="text-xs text-slate-400">
                            Provider: {transaction.providerName}
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
          </section>
          <section className="grid gap-6 lg:grid-cols-[1.6fr,1fr]">
            <Card className="shadow-lg border border-slate-100">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-base text-slate-900">Stores</CardTitle>
                  <p className="text-xs text-slate-500">
                    Create stores, assign owners, and jump into inventory.
                  </p>
                </div>
                <Button onClick={() => setShowStoreModal(true)} size="sm">
                  Create Store
                </Button>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                      <tr>
                        <th className="px-4 py-3">Store</th>
                        <th className="px-4 py-3">Location</th>
                        <th className="px-4 py-3">Owner</th>
                        <th className="px-4 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {companyStoresLoading ? (
                        <tr>
                          <td colSpan={4} className="px-4 py-6 text-center text-xs text-slate-400">
                            Loading stores...
                          </td>
                        </tr>
                      ) : companyStores.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-4 py-6 text-center text-xs text-slate-400">
                            No stores yet. Create your first store to get started.
                          </td>
                        </tr>
                      ) : (
                        companyStores.map((store) => {
                          const ownerName = store.ownerId
                            ? staffById.get(store.ownerId)?.name ||
                              staffById.get(store.ownerId)?.email ||
                              "Assigned"
                            : "Unassigned";
                          return (
                            <tr key={store.id} className="border-t border-slate-100 text-slate-600">
                              <td className="px-4 py-4">
                                <div>
                                  <p className="font-semibold text-slate-900">{store.name}</p>
                                  <p className="text-[0.7rem] text-slate-400">
                                    {store.description || "No description"}
                                  </p>
                                </div>
                              </td>
                              <td className="px-4 py-4">{store.location}</td>
                              <td className="px-4 py-4">{ownerName}</td>
                              <td className="px-4 py-4">
                                <div className="flex items-center justify-end gap-2">
                                  <Link href={`/provider/stores/${store.id}/items`}>
                                    <Button variant="outline" size="sm">
                                      Inventory
                                    </Button>
                                  </Link>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      setActiveStore(store);
                                      setShowAssignModal(true);
                                    }}
                                  >
                                    Assign Staff
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-lg border border-slate-100">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-base text-slate-900">Team Members</CardTitle>
                  <p className="text-xs text-slate-500">
                    Manage staff and invite new providers to your company.
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={() => setShowProviderModal(true)}>
                  Invite Staff
                </Button>
              </CardHeader>
              <CardContent className="pt-0 space-y-3">
                {companyStaffLoading ? (
                  <p className="text-sm text-slate-500">Loading team...</p>
                ) : companyStaff.length === 0 ? (
                  <p className="text-sm text-slate-500">
                    No staff members yet. Invite providers to build your team.
                  </p>
                ) : (
                  companyStaff.slice(0, 6).map((staff) => (
                    <div
                      key={staff.id}
                      className="flex items-center justify-between rounded-xl border border-slate-100 bg-white px-4 py-3"
                    >
                      <div>
                        <p className="text-sm font-semibold text-slate-900">
                          {staff.name || staff.email || "Unnamed provider"}
                        </p>
                        <p className="text-[0.7rem] text-slate-400">{staff.email || staff.phone}</p>
                      </div>
                      <Badge variant={staff.isApproved ? "default" : "secondary"}>
                        {staff.isApproved ? "Approved" : "Pending"}
                      </Badge>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </section>
          <section className="grid gap-6 lg:grid-cols-[1.6fr,1fr]">
            <Card className="shadow-lg border border-slate-100">
              <CardHeader className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base text-slate-900">Inventory</CardTitle>
                    <p className="text-xs text-slate-500">
                      Review items for the selected store and update details.
                    </p>
                  </div>
                  <Select value={selectedStoreId} onValueChange={setSelectedStoreId}>
                    <SelectTrigger className="min-w-[200px]">
                      <SelectValue placeholder="Select store" />
                    </SelectTrigger>
                    <SelectContent>
                      {companyStores.map((store) => (
                        <SelectItem key={store.id} value={store.id}>
                          {store.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                      <tr>
                        <th className="px-4 py-3">Item</th>
                        <th className="px-4 py-3">Category</th>
                        <th className="px-4 py-3">Price</th>
                        <th className="px-4 py-3">Stock</th>
                        <th className="px-4 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {inventoryLoading ? (
                        <tr>
                          <td colSpan={5} className="px-4 py-6 text-center text-xs text-slate-400">
                            Loading inventory...
                          </td>
                        </tr>
                      ) : !selectedStoreId ? (
                        <tr>
                          <td colSpan={5} className="px-4 py-6 text-center text-xs text-slate-400">
                            Select a store to view its inventory.
                          </td>
                        </tr>
                      ) : inventoryItems.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-4 py-6 text-center text-xs text-slate-400">
                            No items yet. Add your first product on the right.
                          </td>
                        </tr>
                      ) : (
                        inventoryItems.map((item) => (
                          <tr key={item.id} className="border-t border-slate-100 text-slate-600">
                            <td className="px-4 py-4">
                              <div>
                                <p className="font-semibold text-slate-900">{item.name}</p>
                                <p className="text-[0.7rem] text-slate-400">
                                  {item.description || "No description"}
                                </p>
                              </div>
                            </td>
                            <td className="px-4 py-4">{item.category || "Uncategorized"}</td>
                            <td className="px-4 py-4">{formatCurrency(Number(item.price || 0))}</td>
                            <td className="px-4 py-4">{item.stock ?? 0}</td>
                            <td className="px-4 py-4">
                              <div className="flex items-center justify-end gap-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleEditItem(item)}
                                >
                                  <Edit3 className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDeleteItem(item)}
                                >
                                  <Trash2 className="h-4 w-4 text-rose-500" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-lg border border-slate-100">
              <CardHeader>
                <CardTitle className="text-base text-slate-900">
                  {editingItem ? "Update inventory item" : "Add inventory item"}
                </CardTitle>
                <p className="text-xs text-slate-500">
                  Keep pricing and stock updated for residents.
                </p>
              </CardHeader>
              <CardContent className="pt-0">
                <Form {...inventoryForm}>
                  <form className="space-y-4" onSubmit={onInventorySubmit}>
                    <FormField
                      control={inventoryForm.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Item name</FormLabel>
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
                          <FormLabel>Category</FormLabel>
                          <FormControl>
                            <Input placeholder="Category" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="grid gap-4 sm:grid-cols-2">
                      <FormField
                        control={inventoryForm.control}
                        name="price"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Price (NGN)</FormLabel>
                            <FormControl>
                              <Input type="number" min="0" step="0.01" {...field} />
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
                            <FormLabel>Stock</FormLabel>
                            <FormControl>
                              <Input type="number" min="0" step="1" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <FormField
                      control={inventoryForm.control}
                      name="images"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Images (comma separated URLs)</FormLabel>
                          <FormControl>
                            <Input placeholder="https://..., https://..." {...field} />
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
                          <FormLabel>Description</FormLabel>
                          <FormControl>
                            <Textarea placeholder="Short description" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="flex items-center justify-between">
                      {editingItem ? (
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            setEditingItem(null);
                            inventoryForm.reset({
                              name: "",
                              category: "",
                              price: 0,
                              stock: 0,
                              description: "",
                              images: "",
                            });
                          }}
                        >
                          Cancel edit
                        </Button>
                      ) : (
                        <span className="text-xs text-slate-400">
                          Add at least one item to publish your catalog.
                        </span>
                      )}
                      <Button type="submit" disabled={!selectedStoreId}>
                        {editingItem ? "Save changes" : "Add item"}
                      </Button>
                    </div>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </section>
        </main>

      <Dialog open={showStoreModal} onOpenChange={setShowStoreModal}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Create store</DialogTitle>
            <DialogDescription>
              Add a new store under {providerCompany?.name || "your company"}.
            </DialogDescription>
          </DialogHeader>
          <Form {...storeForm}>
            <form className="space-y-4" onSubmit={onStoreSubmit}>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={storeForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Store name</FormLabel>
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
              </div>
              <FormField
                control={storeForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Describe this store" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={storeForm.control}
                  name="ownerId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Store owner</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select owner" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {companyStaff.map((staff) => (
                            <SelectItem key={staff.id} value={staff.id}>
                              {staff.name || staff.email || staff.id}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
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
              </div>
              <FormField
                control={storeForm.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input placeholder="store@email.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowStoreModal(false)}>
                  Cancel
                </Button>
                <Button type="submit">Create Store</Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={showAssignModal} onOpenChange={setShowAssignModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Assign staff</DialogTitle>
            <DialogDescription>
              {activeStore?.name ? `Assign team members to ${activeStore.name}.` : "Assign team members."}
            </DialogDescription>
          </DialogHeader>
          <Form {...assignMemberForm}>
            <form className="space-y-4" onSubmit={onAssignSubmit}>
              <FormField
                control={assignMemberForm.control}
                name="userId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Staff member</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select staff" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {companyStaff.map((staff) => (
                          <SelectItem key={staff.id} value={staff.id}>
                            {staff.name || staff.email || staff.id}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={assignMemberForm.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Role</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select role" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="owner">Owner</SelectItem>
                        <SelectItem value="manager">Manager</SelectItem>
                        <SelectItem value="member">Member</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <FormField
                  control={assignMemberForm.control}
                  name="canManageItems"
                  render={({ field }) => (
                    <FormItem className="flex items-center gap-2">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={(value) => field.onChange(Boolean(value))}
                        />
                      </FormControl>
                      <FormLabel className="text-sm">Manage inventory</FormLabel>
                    </FormItem>
                  )}
                />
                <FormField
                  control={assignMemberForm.control}
                  name="canManageOrders"
                  render={({ field }) => (
                    <FormItem className="flex items-center gap-2">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={(value) => field.onChange(Boolean(value))}
                        />
                      </FormControl>
                      <FormLabel className="text-sm">Manage orders</FormLabel>
                    </FormItem>
                  )}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowAssignModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={!activeStore}>
                  Assign
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={showProviderModal} onOpenChange={setShowProviderModal}>
        <DialogContent className="w-[60vw] max-w-[95vw]">
          <DialogHeader>
            <DialogTitle>Create a service provider</DialogTitle>
            <DialogDescription>
              Fill in the details below and we will notify the admin to create
              the provider on your behalf.
            </DialogDescription>
          </DialogHeader>
          <Form {...providerForm}>
            <form className="space-y-4" onSubmit={onProviderSubmit}>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={providerForm.control}
                  name="firstName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>First Name</FormLabel>
                      <FormControl>
                        <Input placeholder="First name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={providerForm.control}
                  name="lastName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Last Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Last name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={providerForm.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input placeholder="email@example.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField
                    control={providerForm.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Phone number</FormLabel>
                        <FormControl>
                          <Input placeholder="+234 ..." {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              <FormField
                control={providerForm.control}
                name="categories"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Categories (comma separated)</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="plumbing, electrical"
                        onChange={(e) =>
                          field.onChange(
                            e.target.value
                              .split(",")
                              .map((value) => value.trim())
                              .filter(Boolean),
                          )
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={providerForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Tell us about your provider"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid gap-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField
                    control={providerForm.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Password *</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Input
                              type={passwordVisible ? "text" : "password"}
                              placeholder="Enter password"
                              value={field.value}
                              onChange={(event) =>
                                field.onChange(event.target.value)
                              }
                              className="pr-20"
                            />
                            <button
                              type="button"
                              onClick={() => setPasswordVisible((prev) => !prev)}
                              className="absolute inset-y-0 right-10 flex items-center rounded-full border border-slate-200 bg-white px-2 shadow hover:border-slate-300 dark:border-gray-700 dark:bg-gray-900"
                              aria-label="Toggle password visibility"
                            >
                              {passwordVisible ? (
                                <EyeOff className="h-4 w-4 text-slate-600 dark:text-gray-200" />
                              ) : (
                                <Eye className="h-4 w-4 text-slate-600 dark:text-gray-200" />
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() => field.onChange(generatePassword())}
                              className="absolute inset-y-0 right-1 flex items-center rounded-full border border-slate-200 bg-white px-2 shadow hover:border-slate-300 dark:border-gray-700 dark:bg-gray-900"
                              aria-label="Generate random password"
                            >
                              <Dice4 className="h-4 w-4 text-slate-600 dark:text-gray-200" />
                            </button>
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                    <FormField
                      control={providerForm.control}
                      name="company"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Company</FormLabel>
                          <FormControl>
                            <div className="space-y-2">
                              <Input
                                placeholder="Company name"
                                value={providerCompany?.name || ""}
                                readOnly
                              />
                              <Input type="hidden" {...field} />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField
                    control={providerForm.control}
                    name="experience"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Years of experience</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            placeholder="0"
                            {...field}
                            onChange={(e) =>
                              field.onChange(Number(e.target.value) || 0)
                            }
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={providerForm.control}
                    name="categories"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Service Categories</FormLabel>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              className="w-full justify-between"
                            >
                              {field.value?.length
                                ? `${field.value.length} selected`
                                : "Select categories"}
                              <ArrowRight className="ml-2 h-3 w-3 rotate-90" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-[260px] sm:w-[320px]">
                            <ScrollArea className="max-h-48 p-2">
                              <div className="space-y-2">
                                {serviceCategoriesLoading ? (
                                  <p className="px-3 py-2 text-sm text-slate-500">
                                    Loading categories...
                                  </p>
                                ) : serviceCategoryOptions.length > 0 ? (
                                  serviceCategoryOptions.map((option) => {
                                    const optionValue = option.key || option.id;
                                    const isChecked = field.value?.includes(
                                      optionValue,
                                    );
                                    return (
                                      <label
                                        key={optionValue}
                                        className="flex items-center gap-2"
                                      >
                                        <Checkbox
                                          checked={isChecked}
                                          onCheckedChange={(value) => {
                                            const next = value
                                              ? [
                                                  ...new Set([
                                                    ...(field.value || []),
                                                    optionValue,
                                                  ]),
                                                ]
                                              : (field.value || []).filter(
                                                  (c) => c !== optionValue,
                                                );
                                            field.onChange(next);
                                          }}
                                        />
                                        <span>{option.name || optionValue}</span>
                                      </label>
                                    );
                                  })
                                ) : (
                                  <p className="px-3 py-2 text-sm text-slate-500">
                                    No categories available.
                                  </p>
                                )}
                              </div>
                            </ScrollArea>
                          </PopoverContent>
                        </Popover>
                        {field.value?.length && (
                          <div className="flex flex-wrap gap-2 mt-2">
                            {field.value.map((value: string) => {
                              const label =
                                categoryNameMap.get(value) || value;
                              return (
                                <Badge key={value} variant="outline">
                                  {label}
                                </Badge>
                              );
                            })}
                          </div>
                        )}
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div>
                  <FormField
                    control={providerForm.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Brief description of services offered"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setShowProviderModal(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={!providerCompany?.id}>
                    Create Provider
                  </Button>
                </div>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
