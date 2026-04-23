import { useEffect, useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useLocation } from "wouter";
import { z } from "zod";
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock3,
  History,
  Loader2,
  MapPin,
  PackagePlus,
  Receipt,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  UserRound,
  Wrench,
} from "lucide-react";
import ResidentShell from "@/components/layout/ResidentShell";
import {
  useCreateResidentAsset,
  useInitiateResidentMaintenanceSubscription,
  useResidentAsset,
  useResidentAssetPlans,
  useResidentAssets,
  useResidentMaintenanceCategories,
  useResidentMaintenanceItems,
  useResidentSchedules,
  useResidentSubscription,
  useResidentSubscriptions,
  useRescheduleResidentMaintenanceSchedule,
  type ResidentMaintenanceAsset,
  type ResidentMaintenancePlan,
  type ResidentMaintenanceSchedule,
  type ResidentMaintenanceSubscription,
} from "@/hooks/useResidentMaintenance";
import { useToast } from "@/hooks/use-toast";
import { residentFetch } from "@/lib/residentApi";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState, InlineErrorState, PageSkeleton } from "@/components/shared/page-states";
import PaystackRedirectDialog from "@/components/resident/PaystackRedirectDialog";

const assetFormSchema = z.object({
  categoryId: z.string().min(1, "Choose a category"),
  maintenanceItemId: z.string().min(1, "Choose what you want us to care for"),
  customName: z.string().trim().max(120).optional().or(z.literal("")),
  locationLabel: z.string().trim().max(160).optional().or(z.literal("")),
  purchaseDate: z.string().optional().or(z.literal("")),
  lastServiceDate: z.string().optional().or(z.literal("")),
  condition: z.enum(["new", "good", "fair", "poor"]),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
});

type AssetFormValues = z.infer<typeof assetFormSchema>;

const CONDITION_OPTIONS = [
  { value: "new", label: "New" },
  { value: "good", label: "Good" },
  { value: "fair", label: "Fair" },
  { value: "poor", label: "Needs attention" },
] as const;

function formatDateLabel(value?: string | null) {
  if (!value) return "Not set";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not set";
  return date.toLocaleDateString("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatFrequencyLabel(value?: string | null) {
  switch (value) {
    case "monthly":
      return "Monthly";
    case "quarterly_3m":
      return "Every 3 months";
    case "halfyearly_6m":
      return "Every 6 months";
    case "yearly":
      return "Yearly";
    default:
      return "Custom";
  }
}

function formatMoney(amount?: string | null, currency = "NGN") {
  const numeric = Number(amount || 0);
  if (!Number.isFinite(numeric)) return `${currency} 0`;
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(numeric);
}

function getConditionBadgeClass(condition?: string | null) {
  switch (condition) {
    case "new":
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case "good":
      return "bg-green-50 text-green-700 border-green-200";
    case "fair":
      return "bg-amber-50 text-amber-700 border-amber-200";
    case "poor":
      return "bg-rose-50 text-rose-700 border-rose-200";
    default:
      return "bg-slate-50 text-slate-700 border-slate-200";
  }
}

function getSubscriptionStatusBadgeClass(status?: string | null) {
  switch (String(status || "").toLowerCase()) {
    case "active":
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case "pending_payment":
      return "bg-amber-50 text-amber-700 border-amber-200";
    case "paused":
      return "bg-slate-100 text-slate-700 border-slate-200";
    case "expired":
      return "bg-rose-50 text-rose-700 border-rose-200";
    case "cancelled":
      return "bg-gray-100 text-gray-700 border-gray-200";
    default:
      return "bg-slate-50 text-slate-700 border-slate-200";
  }
}

function getScheduleStatusBadgeClass(status?: string | null) {
  switch (String(status || "").toLowerCase()) {
    case "upcoming":
      return "bg-sky-50 text-sky-700 border-sky-200";
    case "due":
      return "bg-amber-50 text-amber-700 border-amber-200";
    case "assigned":
      return "bg-violet-50 text-violet-700 border-violet-200";
    case "in_progress":
      return "bg-indigo-50 text-indigo-700 border-indigo-200";
    case "completed":
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case "rescheduled":
      return "bg-slate-100 text-slate-700 border-slate-200";
    default:
      return "bg-slate-50 text-slate-700 border-slate-200";
  }
}

function humanizeStatus(value?: string | null) {
  return String(value || "").replace(/_/g, " ").trim() || "unknown";
}

type CheckoutState = {
  redirectUrl: string;
  subscriptionId?: string | null;
} | null;

function AssetCard({
  asset,
  activeSubscription,
  onOpen,
}: {
  asset: ResidentMaintenanceAsset;
  activeSubscription?: ResidentMaintenanceSubscription | null;
  onOpen: () => void;
}) {
  return (
    <Card className="overflow-hidden border-[#e4e7ec] shadow-sm">
      <CardContent className="p-0">
        <button
          type="button"
          onClick={onOpen}
          className="flex w-full flex-col gap-4 p-5 text-left transition hover:bg-[#f8fafc]"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-lg font-semibold text-[#101828]">{asset.displayName}</p>
              <p className="mt-1 text-sm text-[#475467]">
                {asset.item.name} in {asset.locationLabel || "your home"}
              </p>
            </div>
            <Badge variant="outline" className={cn("capitalize", getConditionBadgeClass(asset.condition))}>
              {asset.condition}
            </Badge>
          </div>

          <div className="flex flex-wrap gap-2 text-xs text-[#667085]">
            <span className="rounded-full bg-[#f2f4f7] px-2.5 py-1">{asset.category.name}</span>
            {asset.locationLabel ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-[#f2f4f7] px-2.5 py-1">
                <MapPin className="h-3 w-3" />
                {asset.locationLabel}
              </span>
            ) : null}
            {activeSubscription ? (
              <span className="rounded-full bg-[#ecfdf3] px-2.5 py-1 text-[#027a48]">
                {activeSubscription.plan.durationLabel} active
              </span>
            ) : (
              <span className="rounded-full bg-[#fef3f2] px-2.5 py-1 text-[#b42318]">No active plan</span>
            )}
          </div>

          <div className="flex items-center justify-between border-t border-[#eaecf0] pt-3 text-sm">
            <span className="text-[#667085]">
              {activeSubscription?.scheduleSummary.next?.scheduledDate || activeSubscription?.nextScheduleAt
                ? `Next: ${formatDateLabel(
                    activeSubscription.scheduleSummary.next?.scheduledDate ?? activeSubscription.nextScheduleAt,
                  )}`
                : `Registered ${formatDateLabel(asset.createdAt)}`}
            </span>
            <span className="inline-flex items-center gap-1 font-medium text-[#039855]">
              View plans
              <ArrowRight className="h-4 w-4" />
            </span>
          </div>
        </button>
      </CardContent>
    </Card>
  );
}

function SubscriptionCard({ subscription }: { subscription: ResidentMaintenanceSubscription }) {
  return (
    <Card className="border-[#e4e7ec] shadow-sm">
      <CardContent className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate font-semibold text-[#101828]">{subscription.asset.displayName}</p>
            <p className="text-sm text-[#475467]">{subscription.plan.durationLabel} care plan</p>
          </div>
          <Badge
            variant="outline"
            className={cn("capitalize", getSubscriptionStatusBadgeClass(subscription.status))}
          >
            {subscription.status.replace(/_/g, " ")}
          </Badge>
        </div>
        <div className="space-y-1 text-sm text-[#475467]">
          <p>{formatMoney(subscription.billingAmount, subscription.currency)}</p>
          <p>Started {formatDateLabel(subscription.startDate)}</p>
          <p>Ends {formatDateLabel(subscription.endDate)}</p>
          <p>
            Next visit:{" "}
            <span className="font-medium text-[#101828]">
              {formatDateLabel(subscription.scheduleSummary.next?.scheduledDate ?? subscription.nextScheduleAt)}
            </span>
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function ScheduleCard({
  schedule,
  onReschedule,
  onViewRequest,
}: {
  schedule: ResidentMaintenanceSchedule;
  onReschedule?: (schedule: ResidentMaintenanceSchedule) => void;
  onViewRequest?: (schedule: ResidentMaintenanceSchedule) => void;
}) {
  return (
    <Card className="border-[#e4e7ec] shadow-sm">
      <CardContent className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate font-semibold text-[#101828]">{schedule.asset.displayName}</p>
            <p className="text-sm text-[#475467]">
              {schedule.asset.itemType}
              {schedule.asset.locationLabel ? ` • ${schedule.asset.locationLabel}` : ""}
            </p>
          </div>
          <Badge
            variant="outline"
            className={cn("capitalize", getScheduleStatusBadgeClass(schedule.status))}
          >
            {humanizeStatus(schedule.status)}
          </Badge>
        </div>

        <div className="grid gap-2 text-sm text-[#475467] md:grid-cols-2">
          <p>
            <span className="font-medium text-[#101828]">Date:</span> {formatDateLabel(schedule.scheduledDate)}
          </p>
          <p>
            <span className="font-medium text-[#101828]">Plan:</span> {schedule.plan.durationLabel}
          </p>
          <p className="md:col-span-2">
            <span className="font-medium text-[#101828]">Provider:</span>{" "}
            {schedule.request?.provider?.name || "Not assigned yet"}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {schedule.request?.id ? (
            <Button type="button" variant="outline" onClick={() => onViewRequest?.(schedule)}>
              View request
            </Button>
          ) : null}
          {onReschedule ? (
            <Button type="button" variant="ghost" className="text-[#027a48]" onClick={() => onReschedule(schedule)}>
              <RotateCcw className="mr-2 h-4 w-4" />
              Reschedule
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

function RescheduleMaintenanceDialog({
  schedule,
  open,
  onOpenChange,
}: {
  schedule: ResidentMaintenanceSchedule | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { toast } = useToast();
  const rescheduleMutation = useRescheduleResidentMaintenanceSchedule();
  const [scheduledDate, setScheduledDate] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!schedule) return;
    setScheduledDate(
      schedule.scheduledDate ? new Date(schedule.scheduledDate).toISOString().slice(0, 10) : "",
    );
    setNotes(schedule.notes || "");
  }, [schedule]);

  const handleSubmit = async () => {
    if (!schedule || !scheduledDate) return;
    try {
      await rescheduleMutation.mutateAsync({
        scheduleId: schedule.id,
        scheduledDate: scheduledDate,
        notes: notes || null,
      });
      toast({
        title: "Maintenance rescheduled",
        description: "Your upcoming maintenance date has been updated.",
      });
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: "Could not reschedule",
        description: error?.message || "Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Reschedule maintenance</DialogTitle>
          <DialogDescription>
            Move this visit to a better day. CityConnect will keep the rest of your plan intact.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <FormLabel>New date</FormLabel>
            <Input type="date" value={scheduledDate} onChange={(event) => setScheduledDate(event.target.value)} />
          </div>
          <div className="space-y-2">
            <FormLabel>Note</FormLabel>
            <Textarea
              rows={3}
              placeholder="Optional context for the new date"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            className="bg-[#039855] hover:bg-[#027a48]"
            disabled={rescheduleMutation.isPending || !scheduledDate}
            onClick={handleSubmit}
          >
            {rescheduleMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Save new date
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AssetRegistrationDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (assetId: string) => void;
}) {
  const { toast } = useToast();
  const categoriesQuery = useResidentMaintenanceCategories();
  const createAsset = useCreateResidentAsset();

  const form = useForm<AssetFormValues>({
    resolver: zodResolver(assetFormSchema),
    defaultValues: {
      categoryId: "",
      maintenanceItemId: "",
      customName: "",
      locationLabel: "",
      purchaseDate: "",
      lastServiceDate: "",
      condition: "good",
      notes: "",
    },
  });

  const selectedCategoryId = form.watch("categoryId");
  const itemsQuery = useResidentMaintenanceItems(selectedCategoryId || undefined);

  useEffect(() => {
    form.setValue("maintenanceItemId", "");
  }, [selectedCategoryId, form]);

  const handleSubmit = form.handleSubmit(async (values) => {
    try {
      const created = await createAsset.mutateAsync({
        categoryId: values.categoryId,
        maintenanceItemId: values.maintenanceItemId,
        customName: values.customName || null,
        locationLabel: values.locationLabel || null,
        purchaseDate: values.purchaseDate || null,
        lastServiceDate: values.lastServiceDate || null,
        condition: values.condition,
        notes: values.notes || null,
      });

      toast({
        title: "Belonging registered",
        description: "You can now review maintenance plans for it.",
      });
      form.reset();
      onOpenChange(false);
      onCreated(created.id);
    } catch (error: any) {
      toast({
        title: "Could not save asset",
        description: error?.message || "Please check the form and try again.",
        variant: "destructive",
      });
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Register a belonging for care</DialogTitle>
          <DialogDescription>
            Add the essentials now so future maintenance plans feel tailored, not generic.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form className="space-y-5" onSubmit={handleSubmit}>
            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="categoryId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Choose a care category" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {(categoriesQuery.data || []).map((category) => (
                          <SelectItem key={category.id} value={category.id}>
                            {category.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="maintenanceItemId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Item</FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                      disabled={!selectedCategoryId || itemsQuery.isLoading}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue
                            placeholder={
                              !selectedCategoryId ? "Choose a category first" : "Choose the item"
                            }
                          />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {(itemsQuery.data || []).map((item) => (
                          <SelectItem key={item.id} value={item.id}>
                            {item.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="customName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Custom name</FormLabel>
                    <FormControl>
                      <Input placeholder="Kitchen freezer, Living room AC..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="locationLabel"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Location</FormLabel>
                    <FormControl>
                      <Input placeholder="Kitchen, bedroom, generator house..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="purchaseDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Purchase date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="lastServiceDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Last serviced</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="condition"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Condition</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Current condition" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {CONDITION_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="md:col-span-2">
                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notes</FormLabel>
                      <FormControl>
                        <Textarea
                          rows={4}
                          placeholder="Anything helpful for future maintenance visits."
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" className="bg-[#039855] hover:bg-[#027a48]" disabled={createAsset.isPending}>
                {createAsset.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Save asset
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function AssetDetailsDialog({
  assetId,
  open,
  onOpenChange,
  onActivated,
  onCheckoutReady,
}: {
  assetId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onActivated: (subscriptionId: string) => void;
  onCheckoutReady: (checkout: CheckoutState) => void;
}) {
  const { toast } = useToast();
  const assetQuery = useResidentAsset(assetId);
  const plansQuery = useResidentAssetPlans(assetId);
  const initiateSubscription = useInitiateResidentMaintenanceSubscription();
  const [busyPlanId, setBusyPlanId] = useState<string | null>(null);

  const asset = assetQuery.data || plansQuery.data?.asset || null;
  const plans = plansQuery.data?.plans || [];

  const handleSubscribe = async (plan: ResidentMaintenancePlan) => {
    if (!assetId) return;
    setBusyPlanId(plan.id);
    try {
      const result = await initiateSubscription.mutateAsync({
        residentAssetId: assetId,
        maintenancePlanId: plan.id,
      });

      if (result.status === "active" && result.subscriptionId) {
        toast({
          title: "Plan activated",
          description: "Your maintenance cover is active and the first visits are ready.",
        });
        onOpenChange(false);
        onActivated(result.subscriptionId);
        return;
      }

      const paystackConfig = result.paystack;
      if (!paystackConfig?.reference || !paystackConfig.amountInNaira) {
        throw new Error("Missing payment session details.");
      }

      const init = await residentFetch<{
        authorization_url?: string;
        authorizationUrl?: string;
        reference: string;
      }>("/api/paystack/init", {
        method: "POST",
        json: {
          amountInNaira: paystackConfig.amountInNaira,
          reference: paystackConfig.reference,
          callbackUrl:
            paystackConfig.callbackUrl ||
            `${window.location.origin}/payment-confirmation?source=maintenance_subscription`,
          metadata: {
            source: "maintenance_subscription",
            subscriptionId: result.subscriptionId,
            residentAssetId: assetId,
            maintenancePlanId: plan.id,
          },
        },
      });

      const redirectUrl = init.authorization_url || init.authorizationUrl;
      if (!redirectUrl) {
        throw new Error("Unable to start payment checkout.");
      }

      onCheckoutReady({
        redirectUrl,
        subscriptionId: result.subscriptionId,
      });
    } catch (error: any) {
      toast({
        title: "Could not start subscription",
        description: error?.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setBusyPlanId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Maintenance plans for this asset</DialogTitle>
          <DialogDescription>
            Compare what is covered, how often visits happen, and pick the plan that fits how you use this item.
          </DialogDescription>
        </DialogHeader>

        {assetQuery.isLoading || plansQuery.isLoading ? (
          <PageSkeleton withHeader={false} rows={3} />
        ) : assetQuery.error || plansQuery.error ? (
          <InlineErrorState
            description="We could not load this asset right now."
            onRetry={() => {
              assetQuery.refetch();
              plansQuery.refetch();
            }}
          />
        ) : !asset ? (
          <InlineErrorState description="This asset is no longer available." />
        ) : (
          <div className="space-y-6">
            <Card className="border-[#d1fadf] bg-[#f6fef9]">
              <CardContent className="grid gap-3 p-5 md:grid-cols-[1.4fr_1fr]">
                <div>
                  <p className="text-xl font-semibold text-[#101828]">{asset.displayName}</p>
                  <p className="mt-1 text-sm text-[#475467]">
                    {asset.item.name} under {asset.category.name}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Badge variant="outline" className={cn("capitalize", getConditionBadgeClass(asset.condition))}>
                      {asset.condition}
                    </Badge>
                    {asset.locationLabel ? (
                      <Badge variant="outline" className="border-[#d0d5dd] text-[#475467]">
                        <MapPin className="mr-1 h-3 w-3" />
                        {asset.locationLabel}
                      </Badge>
                    ) : null}
                  </div>
                </div>
                <div className="space-y-2 rounded-2xl bg-white p-4">
                  <p className="text-sm font-medium text-[#344054]">Care snapshot</p>
                  <p className="text-sm text-[#475467]">
                    Registered: <span className="font-medium text-[#101828]">{formatDateLabel(asset.createdAt)}</span>
                  </p>
                  <p className="text-sm text-[#475467]">
                    Last serviced: <span className="font-medium text-[#101828]">{formatDateLabel(asset.lastServiceDate)}</span>
                  </p>
                  <p className="text-sm text-[#475467]">
                    Usual cadence:{" "}
                    <span className="font-medium text-[#101828]">
                      {formatFrequencyLabel(asset.item.defaultFrequency)}
                    </span>
                  </p>
                </div>
              </CardContent>
            </Card>

            {plans.length === 0 ? (
              <EmptyState
                icon={Wrench}
                title="No plans are available yet"
                description="This item is registered, but the care plans for it have not been published yet."
              />
            ) : (
              <div className="grid gap-4 lg:grid-cols-2">
                {plans.map((plan) => {
                  const currentSubscription = plan.currentSubscription;
                  const isOpenSubscription = Boolean(
                    currentSubscription &&
                      ["draft", "pending_payment", "active", "paused"].includes(
                        String(currentSubscription.status || "").toLowerCase(),
                      ),
                  );

                  return (
                    <Card key={plan.id} className="border-[#e4e7ec] shadow-sm">
                      <CardHeader className="space-y-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <CardTitle className="text-xl">{plan.durationLabel}</CardTitle>
                            <CardDescription className="mt-1">{plan.description || "Preventive care plan"}</CardDescription>
                          </div>
                          <Badge variant="outline" className="border-[#d1fadf] bg-[#ecfdf3] text-[#027a48]">
                            {plan.visitsIncluded} visit{plan.visitsIncluded === 1 ? "" : "s"}
                          </Badge>
                        </div>
                        <div className="flex items-end justify-between gap-3">
                          <div>
                            <p className="text-2xl font-semibold text-[#101828]">
                              {formatMoney(plan.price, plan.currency)}
                            </p>
                            <p className="text-sm text-[#667085]">Per {plan.durationLabel.toLowerCase()} plan</p>
                          </div>
                          {currentSubscription ? (
                            <Badge
                              variant="outline"
                              className={cn(
                                "capitalize",
                                getSubscriptionStatusBadgeClass(currentSubscription.status),
                              )}
                            >
                              {currentSubscription.status.replace(/_/g, " ")}
                            </Badge>
                          ) : null}
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="rounded-2xl bg-[#f8fafc] p-4 text-sm text-[#475467]">
                          <p className="font-medium text-[#101828]">What is covered</p>
                          <ul className="mt-2 space-y-2">
                            {(plan.includedTasks || []).length > 0 ? (
                              (plan.includedTasks || []).map((task) => (
                                <li key={task} className="flex items-start gap-2">
                                  <CheckCircle2 className="mt-0.5 h-4 w-4 text-[#039855]" />
                                  <span>{task}</span>
                                </li>
                              ))
                            ) : (
                              <li className="text-[#667085]">Plan details will be tailored during service.</li>
                            )}
                          </ul>
                        </div>

                        {currentSubscription?.nextScheduledDate ? (
                          <div className="rounded-2xl border border-[#d1fadf] bg-[#f6fef9] px-4 py-3 text-sm text-[#027a48]">
                            Next scheduled maintenance:{" "}
                            <span className="font-semibold">
                              {formatDateLabel(currentSubscription.nextScheduledDate)}
                            </span>
                          </div>
                        ) : null}

                        <Button
                          type="button"
                          className="w-full bg-[#039855] hover:bg-[#027a48]"
                          disabled={busyPlanId === plan.id || isOpenSubscription}
                          onClick={() => handleSubscribe(plan)}
                        >
                          {busyPlanId === plan.id ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Preparing checkout
                            </>
                          ) : isOpenSubscription ? (
                            "Already subscribed"
                          ) : (
                            "Choose this plan"
                          )}
                        </Button>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default function MaintenanceAssetsPage() {
  const { toast } = useToast();
  const [location, navigate] = useLocation();
  const assetsQuery = useResidentAssets();
  const subscriptionsQuery = useResidentSubscriptions();
  const schedulesQuery = useResidentSchedules();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [scheduleToReschedule, setScheduleToReschedule] = useState<ResidentMaintenanceSchedule | null>(null);
  const [checkoutState, setCheckoutState] = useState<CheckoutState>(null);

  const searchParams = useMemo(
    () => new URLSearchParams(typeof window !== "undefined" ? window.location.search : ""),
    [location],
  );
  const paid = searchParams.get("paid") === "1";
  const paidSubscriptionId = searchParams.get("subscriptionId");
  const successSubscriptionQuery = useResidentSubscription(paid ? paidSubscriptionId : null);

  useEffect(() => {
    if (paid && successSubscriptionQuery.data) {
      toast({
        title: "Subscription active",
        description: "Your maintenance plan is live and your schedule preview is ready.",
      });
    }
  }, [paid, successSubscriptionQuery.data, toast]);

  const assets = assetsQuery.data || [];
  const subscriptions = subscriptionsQuery.data || [];
  const schedules = schedulesQuery.data || [];
  const activeSubscriptionCount = subscriptions.filter(
    (subscription) => String(subscription.status || "").toLowerCase() === "active",
  ).length;
  const assetSubscriptionMap = new Map(
    subscriptions
      .filter((subscription) =>
        ["active", "paused", "pending_payment"].includes(String(subscription.status || "").toLowerCase()),
      )
      .map((subscription) => [subscription.asset.id, subscription] as const),
  );
  const upcomingSchedules = schedules.filter((schedule) =>
    ["upcoming", "due", "assigned", "in_progress"].includes(String(schedule.status || "").toLowerCase()),
  );
  const completedSchedules = schedules
    .filter((schedule) => String(schedule.status || "").toLowerCase() === "completed")
    .sort(
      (left, right) =>
        new Date(right.completedAt || right.scheduledDate || 0).getTime() -
        new Date(left.completedAt || left.scheduledDate || 0).getTime(),
    );
  const activePlanSpend = subscriptions
    .filter((subscription) => String(subscription.status || "").toLowerCase() === "active")
    .reduce((total, subscription) => total + Number(subscription.billingAmount || 0), 0);

  const openAssetDetails = (assetId: string) => {
    setSelectedAssetId(assetId);
    setIsDetailsOpen(true);
  };

  const handleActivated = (subscriptionId: string) => {
    setCheckoutState(null);
    navigate(`/resident/maintenance?paid=1&subscriptionId=${encodeURIComponent(subscriptionId)}`);
  };

  return (
    <ResidentShell currentPage="maintenance">
      <PaystackRedirectDialog
        open={Boolean(checkoutState?.redirectUrl)}
        redirectUrl={checkoutState?.redirectUrl || null}
        onOpenChange={(open) => {
          if (!open) {
            setCheckoutState(null);
          }
        }}
        message="You are being redirected to Paystack to activate your maintenance plan."
      />

      <AssetRegistrationDialog
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        onCreated={(assetId) => {
          openAssetDetails(assetId);
        }}
      />

      <AssetDetailsDialog
        assetId={selectedAssetId}
        open={isDetailsOpen}
        onOpenChange={(open) => {
          setIsDetailsOpen(open);
          if (!open) {
            setSelectedAssetId(null);
          }
        }}
        onActivated={handleActivated}
        onCheckoutReady={setCheckoutState}
      />

      <RescheduleMaintenanceDialog
        schedule={scheduleToReschedule}
        open={Boolean(scheduleToReschedule)}
        onOpenChange={(open) => {
          if (!open) setScheduleToReschedule(null);
        }}
      />

      <div className="mx-auto max-w-7xl px-4 py-8 md:px-8">
        <div className="rounded-[28px] bg-[linear-gradient(135deg,#054f31_0%,#0b6b45_55%,#17b26a_140%)] p-6 text-white shadow-[0px_24px_54px_rgba(5,79,49,0.2)] md:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/12 px-3 py-1 text-sm font-medium text-white/90">
                <ShieldCheck className="h-4 w-4" />
                Preventive maintenance
              </div>
              <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
                Register your home essentials for ongoing care
              </h1>
              <p className="mt-3 max-w-xl text-sm leading-6 text-white/85 md:text-base">
                Tell CityConnect what matters in your home, compare care plans, and keep future maintenance predictable.
              </p>
            </div>
            <Button
              type="button"
              className="h-12 rounded-2xl bg-white px-5 text-[#054f31] hover:bg-[#f2f4f7]"
              onClick={() => setIsCreateOpen(true)}
            >
              <PackagePlus className="mr-2 h-4 w-4" />
              Add an asset
            </Button>
          </div>
        </div>

        {paid && successSubscriptionQuery.data ? (
          <Card className="mt-6 border-[#d1fadf] bg-[#f6fef9]">
            <CardContent className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 rounded-full bg-[#ecfdf3] p-2 text-[#039855]">
                  <CheckCircle2 className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-lg font-semibold text-[#101828]">
                    {successSubscriptionQuery.data.asset.displayName} is now covered
                  </p>
                  <p className="mt-1 text-sm text-[#475467]">
                    {successSubscriptionQuery.data.plan.durationLabel} plan activated. Next scheduled visit:{" "}
                    <span className="font-medium text-[#101828]">
                      {formatDateLabel(
                        successSubscriptionQuery.data.scheduleSummary.next?.scheduledDate ??
                          successSubscriptionQuery.data.nextScheduleAt,
                      )}
                    </span>
                  </p>
                  {successSubscriptionQuery.data.scheduleSummary.preview.length > 0 ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {successSubscriptionQuery.data.scheduleSummary.preview.map((schedule) => (
                        <Badge
                          key={schedule.id}
                          variant="outline"
                          className="border-[#d1fadf] bg-white text-[#027a48]"
                        >
                          {formatDateLabel(schedule.scheduledDate)}
                        </Badge>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
              <Button variant="outline" onClick={() => navigate("/resident/maintenance")}>
                Dismiss
              </Button>
            </CardContent>
          </Card>
        ) : null}

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <Card className="border-[#e4e7ec] shadow-sm">
            <CardContent className="flex items-center gap-4 p-5">
              <span className="rounded-2xl bg-[#ecfdf3] p-3 text-[#039855]">
                <Wrench className="h-5 w-5" />
              </span>
              <div>
                <p className="text-sm text-[#667085]">Registered assets</p>
                <p className="text-2xl font-semibold text-[#101828]">{assets.length}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-[#e4e7ec] shadow-sm">
            <CardContent className="flex items-center gap-4 p-5">
              <span className="rounded-2xl bg-[#fef3f2] p-3 text-[#d92d20]">
                <Sparkles className="h-5 w-5" />
              </span>
              <div>
                <p className="text-sm text-[#667085]">Active plans</p>
                <p className="text-2xl font-semibold text-[#101828]">{activeSubscriptionCount}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-[#e4e7ec] shadow-sm">
            <CardContent className="flex items-center gap-4 p-5">
              <span className="rounded-2xl bg-[#eff8ff] p-3 text-[#175cd3]">
                <CalendarDays className="h-5 w-5" />
              </span>
              <div>
                <p className="text-sm text-[#667085]">Upcoming visits</p>
                <p className="text-2xl font-semibold text-[#101828]">{upcomingSchedules.length}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="mt-8 grid gap-6 xl:grid-cols-[1.3fr_1.1fr]">
          <div className="space-y-4">
            <div>
              <h2 className="text-2xl font-semibold text-[#101828]">My Assets</h2>
              <p className="mt-1 text-sm text-[#667085]">
                Everything you have registered for care, with live plan coverage and the next due visit.
              </p>
            </div>

            {assetsQuery.isLoading ? (
              <PageSkeleton rows={3} />
            ) : assetsQuery.error ? (
              <InlineErrorState
                description="We could not load your maintenance assets."
                onRetry={() => assetsQuery.refetch()}
              />
            ) : assets.length === 0 ? (
              <EmptyState
                icon={PackagePlus}
                title="No belongings registered yet"
                description="Start with the items you rely on most, like your freezer, generator, AC, or water pump."
                action={
                  <Button className="bg-[#039855] hover:bg-[#027a48]" onClick={() => setIsCreateOpen(true)}>
                    Add your first asset
                  </Button>
                }
              />
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {assets.map((asset) => (
                  <AssetCard
                    key={asset.id}
                    asset={asset}
                    activeSubscription={assetSubscriptionMap.get(asset.id) || null}
                    onOpen={() => openAssetDetails(asset.id)}
                  />
                ))}
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div>
              <h2 className="text-2xl font-semibold text-[#101828]">Active Plans</h2>
              <p className="mt-1 text-sm text-[#667085]">
                A quick summary of what is covered right now and when each plan runs out.
              </p>
            </div>

            <Card className="border-[#e4e7ec] shadow-sm">
              <CardContent className="grid gap-4 p-5 sm:grid-cols-2">
                <div className="rounded-2xl bg-[#f8fafc] p-4">
                  <div className="flex items-center gap-2 text-sm text-[#667085]">
                    <Receipt className="h-4 w-4" />
                    Subscription summary
                  </div>
                  <p className="mt-2 text-2xl font-semibold text-[#101828]">
                    {formatMoney(String(activePlanSpend), "NGN")}
                  </p>
                  <p className="mt-1 text-sm text-[#667085]">Total active plan value</p>
                </div>
                <div className="rounded-2xl bg-[#f8fafc] p-4">
                  <div className="flex items-center gap-2 text-sm text-[#667085]">
                    <Clock3 className="h-4 w-4" />
                    Next maintenance
                  </div>
                  <p className="mt-2 text-lg font-semibold text-[#101828]">
                    {upcomingSchedules[0] ? formatDateLabel(upcomingSchedules[0].scheduledDate) : "Nothing scheduled"}
                  </p>
                  <p className="mt-1 text-sm text-[#667085]">
                    {upcomingSchedules[0]?.asset.displayName || "Choose a plan to start scheduling care"}
                  </p>
                </div>
              </CardContent>
            </Card>

            {subscriptionsQuery.isLoading ? (
              <PageSkeleton rows={2} withHeader={false} />
            ) : subscriptionsQuery.error ? (
              <InlineErrorState
                description="We could not load your subscriptions."
                onRetry={() => subscriptionsQuery.refetch()}
              />
            ) : subscriptions.length === 0 ? (
              <EmptyState
                icon={Sparkles}
                title="No subscriptions yet"
                description="Once you subscribe to a plan, your upcoming maintenance visits will show up here."
              />
            ) : (
              subscriptions.slice(0, 4).map((subscription) => (
                <SubscriptionCard key={subscription.id} subscription={subscription} />
              ))
            )}
          </div>
        </div>

        <div className="mt-8 grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="space-y-4">
            <div>
              <h2 className="text-2xl font-semibold text-[#101828]">Upcoming Maintenance</h2>
              <p className="mt-1 text-sm text-[#667085]">
                Your next care visits, with provider visibility once CityConnect turns them into live service requests.
              </p>
            </div>

            {schedulesQuery.isLoading ? (
              <PageSkeleton rows={3} withHeader={false} />
            ) : schedulesQuery.error ? (
              <InlineErrorState
                description="We could not load your maintenance schedule."
                onRetry={() => schedulesQuery.refetch()}
              />
            ) : upcomingSchedules.length === 0 ? (
              <EmptyState
                icon={CalendarDays}
                title="No upcoming maintenance yet"
                description="As soon as you activate a plan, your scheduled visits will appear here."
              />
            ) : (
              upcomingSchedules.slice(0, 5).map((schedule) => (
                <ScheduleCard
                  key={schedule.id}
                  schedule={schedule}
                  onReschedule={(selected) => setScheduleToReschedule(selected)}
                  onViewRequest={(selected) => {
                    if (!selected.request?.id) return;
                    navigate(
                      `/resident/requests/ordinary?requestId=${encodeURIComponent(
                        selected.request.id,
                      )}&serviceRequestId=${encodeURIComponent(selected.request.id)}`,
                    );
                  }}
                />
              ))
            )}
          </div>

          <div className="space-y-4">
            <div>
              <h2 className="text-2xl font-semibold text-[#101828]">Service History</h2>
              <p className="mt-1 text-sm text-[#667085]">
                A short history of recent completed maintenance on your protected assets.
              </p>
            </div>

            {schedulesQuery.isLoading ? (
              <PageSkeleton rows={2} withHeader={false} />
            ) : schedulesQuery.error ? (
              <InlineErrorState
                description="We could not load your completed maintenance history."
                onRetry={() => schedulesQuery.refetch()}
              />
            ) : completedSchedules.length === 0 ? (
              <EmptyState
                icon={History}
                title="No completed maintenance yet"
                description="Completed visits will build your service history here."
              />
            ) : (
              completedSchedules.slice(0, 4).map((schedule) => (
                <Card key={schedule.id} className="border-[#e4e7ec] shadow-sm">
                  <CardContent className="space-y-2 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-[#101828]">{schedule.asset.displayName}</p>
                        <p className="text-sm text-[#475467]">{schedule.asset.itemType}</p>
                      </div>
                      <Badge
                        variant="outline"
                        className={cn("capitalize", getScheduleStatusBadgeClass(schedule.status))}
                      >
                        {humanizeStatus(schedule.status)}
                      </Badge>
                    </div>
                    <p className="text-sm text-[#475467]">
                      Completed on{" "}
                      <span className="font-medium text-[#101828]">
                        {formatDateLabel(schedule.completedAt || schedule.scheduledDate)}
                      </span>
                    </p>
                    <p className="flex items-center gap-2 text-sm text-[#475467]">
                      <UserRound className="h-4 w-4" />
                      {schedule.request?.provider?.name || "CityConnect provider"}
                    </p>
                    {schedule.request?.id ? (
                      <Button
                        type="button"
                        variant="ghost"
                        className="px-0 text-[#027a48]"
                        onClick={() =>
                          navigate(
                            `/resident/requests/ordinary?requestId=${encodeURIComponent(
                              schedule.request!.id,
                            )}&serviceRequestId=${encodeURIComponent(schedule.request!.id)}`,
                          )
                        }
                      >
                        View service thread
                      </Button>
                    ) : null}
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </div>
      </div>
    </ResidentShell>
  );
}
