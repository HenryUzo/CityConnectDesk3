import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getQueryFn } from "@/lib/queryClient";
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
  Eye,
  EyeOff,
  MoreVertical,
} from "lucide-react";
import { AreaChart, ResponsiveContainer, Area } from "recharts";
import { Link } from "wouter";
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

  const { data: companies = [], isLoading: companiesLoading } = useQuery<Company[]>({
    queryKey: ["/api/companies"],
    queryFn: getQueryFn<Company[]>({ on401: "throw" }),
  });

  const serviceCategoryOptions = useMemo(() => {
    return [...serviceCategories]
      .filter((category) => category.isActive !== false)
      .sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  }, [serviceCategories]);

  const companyOptions = useMemo(() => {
    return [...companies]
      .filter((company) => company.isActive !== false)
      .sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  }, [companies]);

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

  const firstCompanyName = companies[0]?.name ?? "Ray";
  const greetingName = firstCompanyName ? firstCompanyName.split(" ")[0] : "John";
  const marketplaceName = companies[0]?.name
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
      name: "",
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

  const [passwordVisible, setPasswordVisible] = useState(true);

  const { toast } = useToast();
  const onProviderSubmit = providerForm.handleSubmit(async (values) => {
    toast({
      title: "Provider request submitted",
      description:
        "An administrator will review and approve the service provider shortly.",
    });
    setShowProviderModal(false);
    providerForm.reset();
  });

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
      </main>

      <Dialog open={showProviderModal} onOpenChange={setShowProviderModal}>
        <DialogContent className="max-w-xl">
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
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Full Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Provider's name" {...field} />
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
                <FormField
                  control={providerForm.control}
                  name="company"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Company</FormLabel>
                      <FormControl>
                        <Input placeholder="Company name" {...field} />
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
                          <Select
                            onValueChange={field.onChange}
                            value={field.value || ""}
                            disabled={companiesLoading}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue
                                placeholder={
                                  companiesLoading
                                    ? "Loading companies..."
                                    : "Select company"
                                }
                              />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="independent">
                                Independent
                              </SelectItem>
                              {companyOptions.length === 0 ? (
                                <SelectItem value="" disabled>
                                  {companiesLoading
                                    ? "Loading companies..."
                                    : "No companies available"}
                                </SelectItem>
                              ) : (
                                companyOptions.map((company) => (
                                  <SelectItem
                                    key={company.id}
                                    value={company.name || company.id}
                                  >
                                    {company.name || company.id}
                                  </SelectItem>
                                ))
                              )}
                            </SelectContent>
                          </Select>
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
                  <Button type="submit">Create Provider</Button>
                </div>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
