import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getQueryFn } from "@/lib/queryClient";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  Briefcase,
  Activity,
  DollarSign,
  Dice4,
  Eye,
  EyeOff,
  Users,
} from "lucide-react";
import { Link } from "wouter";
import { ThemeToggle } from "@/components/theme-toggle";
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
};

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
    <div className="min-h-screen bg-white dark:bg-gradient-to-b dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 py-10">
      <div className="max-w-7xl mx-auto px-4 lg:px-6 space-y-10">
        <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between text-slate-900 dark:text-white">
          <div className="space-y-2">
            <p className="text-[0.7rem] tracking-[0.5em] uppercase text-slate-600 dark:text-white/60">
              CityConnect Business Suite
            </p>
            <h1 className="text-3xl sm:text-4xl font-semibold">
              Business partner overview
            </h1>
            <p className="text-sm text-slate-700 dark:text-white/70 max-w-xl">
              Track how the marketplace is performing today &mdash; providers in
              the network, open estate requests, and revenue flowing through the
              platform.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <ThemeToggle />
            <Link href="/company-registration">
              <Button
                variant="secondary"
                className="bg-white text-slate-900 hover:bg-slate-100 dark:bg-slate-800 dark:text-white dark:hover:bg-slate-700"
              >
                <Briefcase className="mr-2 h-4 w-4" />
                Register another business
              </Button>
            </Link>
            <Button
              variant="default"
              className="bg-slate-100 text-slate-900 hover:bg-slate-200 dark:bg-slate-800 dark:text-white dark:hover:bg-slate-700"
              onClick={() => setShowProviderModal(true)}
            >
              <Users className="mr-2 h-4 w-4" />
              Create service providers
            </Button>
            <Link href="/">
              <Button
                variant="outline"
                className="border-slate-300/30 text-slate-900 dark:border-white/30 dark:text-white"
              >
                Back to home
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </header>

        {error && (
          <div className="rounded-lg bg-red-900/40 border border-red-500/40 text-red-50 px-4 py-3 text-sm">
            Unable to load marketplace overview. Please try again shortly.
          </div>
        )}

        <section className="grid gap-6 md:grid-cols-3">
          <Card className="bg-white border-slate-200 text-slate-900 shadow-[0_20px_45px_rgba(34,197,94,0.25)] dark:bg-slate-900/80 dark:border-slate-800 dark:text-white">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-slate-600 dark:text-white/70">
                Providers in network
              </CardTitle>
              <Users className="h-4 w-4 text-emerald-400" />
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold">{stats.totalProviders}</p>
              <p className="text-xs text-slate-600 dark:text-white/60 mt-1">
                Verified providers across all estates
              </p>
            </CardContent>
          </Card>

          <Card className="bg-white border-slate-200 text-slate-900 shadow-[0_20px_45px_rgba(34,197,94,0.25)] dark:bg-slate-900/80 dark:border-slate-800 dark:text-white">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-slate-600 dark:text-white/70">
                Active estate requests
              </CardTitle>
              <Activity className="h-4 w-4 text-emerald-400" />
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold">{stats.activeRequests}</p>
              <p className="text-xs text-slate-600 dark:text-white/60 mt-1">
                Requests currently awaiting provider action
              </p>
            </CardContent>
          </Card>

          <Card className="bg-white border-slate-200 text-slate-900 shadow-[0_20px_45px_rgba(16,185,129,0.3)] dark:bg-slate-900/80 dark:border-slate-800 dark:text-white">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-slate-600 dark:text-white/70">
                Gross marketplace revenue
              </CardTitle>
              <DollarSign className="h-4 w-4 text-emerald-400" />
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold">
                ₦{stats.totalRevenue.toLocaleString("en-NG")}
              </p>
              <p className="text-xs text-slate-600 dark:text-white/60 mt-1">
                Aggregated from completed orders
              </p>
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.4fr,0.9fr]">
          <Card className="bg-white border-slate-200 text-slate-900 dark:bg-slate-900/80 dark:border-slate-800 dark:text-white">
            <CardHeader>
              <CardTitle className="text-base">
                Recent provider activity
              </CardTitle>
              <p className="text-xs text-slate-600 dark:text-white/60">
                A snapshot of the latest estate service requests flowing through
                the network.
              </p>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <p className="text-xs text-slate-600 dark:text-white/60">
                  Loading activity…
                </p>
              ) : stats.recentActivity.length === 0 ? (
                <p className="text-xs text-slate-600 dark:text-white/60">
                  No activity recorded yet. Once residents begin booking
                  services, requests will appear here.
                </p>
              ) : (
                <div className="space-y-3">
                  {stats.recentActivity.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between rounded-xl border border-slate-200/10 bg-white/50 dark:border-white/5 dark:bg-slate-950/60 px-3 py-2.5 text-xs"
                    >
                      <div>
                        <p className="font-medium text-slate-900 dark:text-white">
                          {item.category || "General request"}
                        </p>
                        <p className="text-[0.7rem] text-slate-600 dark:text-white/60">
                          Created{" "}
                          {item.createdAt
                            ? new Date(item.createdAt).toLocaleString()
                            : "unknown"}
                        </p>
                      </div>
                      <span
                        className={`inline-flex items-center rounded-full px-3 py-1 text-[0.7rem] font-medium ${
                          item.status === "completed"
                            ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/40"
                            : item.status === "pending"
                              ? "bg-amber-500/10 text-amber-300 border border-amber-500/40"
                              : "bg-slate-700/60 text-slate-100 border border-slate-500/40"
                        }`}
                      >
                        {item.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-white border-slate-200 text-slate-900 dark:bg-slate-900/80 dark:border-slate-800 dark:text-white">
            <CardHeader>
              <CardTitle className="text-base">
                Connect with the marketplace team
              </CardTitle>
              <p className="text-xs text-slate-600 dark:text-white/60">
                Use your preferred channels to coordinate onboarding, compliance
                checks, and upcoming campaigns. A richer, in-app chat can be
                plugged in here later.
              </p>
            </CardHeader>
            <CardContent className="space-y-3 text-xs text-slate-700 dark:text-white/70">
              <div className="rounded-lg border border-slate-200/20 bg-white/50 dark:border-white/10 dark:bg-slate-950/60 px-3 py-2.5">
                <p className="font-medium text-slate-900 dark:text-white mb-1">
                  Email
                </p>
                <p className="text-slate-700 dark:text-white">
                  business@cityconnect.ng
                </p>
              </div>
              <div className="rounded-lg border border-slate-200/20 bg-white/50 dark:border-white/10 dark:bg-slate-950/60 px-3 py-2.5">
                <p className="font-medium text-slate-900 dark:text-white mb-1">
                  WhatsApp
                </p>
                <p className="text-slate-700 dark:text-white">
                  +234 800 000 0000
                </p>
              </div>
              <div className="rounded-lg border border-dashed border-emerald-500/50 bg-emerald-500/5 dark:bg-emerald-500/10 px-3 py-2.5">
                <p className="font-medium text-emerald-700 dark:text-emerald-200 mb-1">
                  In-app chat coming soon
                </p>
                <p className="text-[0.7rem] text-emerald-700/80 dark:text-emerald-100/80">
                  This space is reserved for a live messaging panel between
                  admins and business partners.
                </p>
              </div>
            </CardContent>
          </Card>
        </section>
      </div>
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
