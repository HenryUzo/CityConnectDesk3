import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { CalendarClock, Loader2, Pencil, Plus, RefreshCw, UserCheck, Wrench } from "lucide-react";
import { AdminAPI } from "@/lib/adminApi";
import { useToast } from "@/hooks/use-toast";
import EmojiCombobox from "@/components/admin/EmojiCombobox";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLocation } from "wouter";

type MaintenanceStatusFilter = "all" | "active" | "inactive";
type MaintenanceDuration = "monthly" | "quarterly_3m" | "halfyearly_6m" | "yearly";
type MaintenanceScheduleStatus =
  | "upcoming"
  | "due"
  | "assigned"
  | "in_progress"
  | "completed"
  | "missed"
  | "rescheduled"
  | "cancelled";

type MaintenanceCategoryRow = {
  id: string;
  name: string;
  slug: string;
  icon?: string | null;
  description?: string | null;
  isActive: boolean;
  createdAt?: string | null;
};

type MaintenanceItemRow = {
  id: string;
  categoryId: string;
  name: string;
  slug: string;
  description?: string | null;
  defaultFrequency?: MaintenanceDuration | null;
  recommendedTasks?: string[] | null;
  imageUrl?: string | null;
  isActive: boolean;
  category?: MaintenanceCategoryRow | null;
};

type MaintenancePlanRow = {
  id: string;
  maintenanceItemId: string;
  name: string;
  description?: string | null;
  durationType: MaintenanceDuration;
  price: string;
  currency?: string | null;
  visitsIncluded: number;
  includedTasks?: string[] | null;
  isActive: boolean;
  item?: MaintenanceItemRow | null;
};

type MaintenanceProviderRow = {
  id: string;
  name?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  company?: string | null;
  isApproved?: boolean | null;
};

type MaintenanceScheduleRow = {
  id: string;
  status: MaintenanceScheduleStatus;
  scheduledDate: string;
  createdAt?: string | null;
  updatedAt?: string | null;
  completedAt?: string | null;
  skippedAt?: string | null;
  sourceRequestId?: string | null;
  notes?: string | null;
  subscription: {
    id: string;
    status: string;
    startDate?: string | null;
    endDate?: string | null;
  };
  asset: {
    id: string;
    userId: string;
    name: string;
    customName?: string | null;
    locationLabel?: string | null;
    condition?: string | null;
  };
  item: {
    id: string;
    name: string;
    slug: string;
  };
  category: {
    id: string;
    name: string;
    icon?: string | null;
  };
  plan: {
    id: string;
    name: string;
    durationType: MaintenanceDuration;
    price: string;
    currency?: string | null;
    visitsIncluded: number;
  };
  request?: {
    id: string;
    status: string;
    providerId?: string | null;
  } | null;
  provider?: {
    id: string;
    name?: string | null;
    email?: string | null;
  } | null;
};

const DURATION_OPTIONS: Array<{ value: MaintenanceDuration; label: string }> = [
  { value: "monthly", label: "Monthly" },
  { value: "quarterly_3m", label: "Quarterly (3 months)" },
  { value: "halfyearly_6m", label: "Half-yearly (6 months)" },
  { value: "yearly", label: "Yearly" },
];

const categoryFormSchema = z.object({
  name: z.string().trim().min(1, "Category name is required").max(120),
  icon: z.string().trim().max(64).optional().nullable(),
  description: z.string().trim().max(1000).optional().nullable(),
  isActive: z.boolean().default(true),
});

const itemFormSchema = z.object({
  categoryId: z.string().trim().min(1, "Category is required"),
  name: z.string().trim().min(1, "Item name is required").max(120),
  description: z.string().trim().max(1000).optional().nullable(),
  defaultFrequency: z
    .union([
      z.enum(["monthly", "quarterly_3m", "halfyearly_6m", "yearly"]),
      z.literal(""),
    ])
    .default(""),
  recommendedTasksText: z.string().optional().default(""),
  imageUrl: z.string().trim().max(10_000_000).optional().default(""),
  isActive: z.boolean().default(true),
});

const planFormSchema = z.object({
  maintenanceItemId: z.string().trim().min(1, "Item is required"),
  durationType: z.enum(["monthly", "quarterly_3m", "halfyearly_6m", "yearly"], {
    required_error: "Duration is required",
  }),
  price: z
    .string()
    .trim()
    .min(1, "Price is required")
    .refine((value) => Number.isFinite(Number(value)) && Number(value) >= 0, {
      message: "Price must be zero or greater",
    }),
  currency: z.string().trim().min(1, "Currency is required").max(8).default("NGN"),
  visitsIncluded: z.preprocess(
    (value) => Number(value),
    z.number().int().min(1, "Visits included must be at least 1").max(365),
  ),
  description: z.string().trim().max(1000).optional().nullable(),
  includedTasksText: z.string().optional().default(""),
  isActive: z.boolean().default(true),
});

type CategoryFormValues = z.infer<typeof categoryFormSchema>;
type ItemFormValues = z.infer<typeof itemFormSchema>;
type PlanFormValues = z.infer<typeof planFormSchema>;

function toActiveFilter(status: MaintenanceStatusFilter) {
  if (status === "active") return true;
  if (status === "inactive") return false;
  return undefined;
}

function parseTaskLines(value: string | null | undefined) {
  return String(value || "")
    .split(/\r?\n|,/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function formatTaskLines(value: string[] | null | undefined) {
  return Array.isArray(value) ? value.join("\n") : "";
}

function formatDurationLabel(value?: MaintenanceDuration | null) {
  return DURATION_OPTIONS.find((option) => option.value === value)?.label || "Not set";
}

function formatCurrency(amount?: string | null, currency?: string | null) {
  const numeric = Number(amount || 0);
  if (!Number.isFinite(numeric)) return `${currency || "NGN"} ${amount || "0"}`;

  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: currency || "NGN",
    maximumFractionDigits: 0,
  }).format(numeric);
}

function formatDate(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString();
}

function formatDateTime(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString();
}

function formatScheduleStatusLabel(value?: string | null) {
  return String(value || "unknown")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function resolveProviderDisplayName(provider?: MaintenanceProviderRow | null) {
  const fullName = [provider?.firstName, provider?.lastName]
    .filter(Boolean)
    .join(" ")
    .trim();
  return fullName || provider?.name || provider?.email || "Unnamed provider";
}

function derivePlanName(itemName: string | undefined, durationType: MaintenanceDuration | undefined) {
  const normalizedItemName = String(itemName || "").trim();
  if (!normalizedItemName || !durationType) return "Maintenance Plan";
  return `${normalizedItemName} ${formatDurationLabel(durationType)}`;
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Unable to read image file."));
    reader.readAsDataURL(file);
  });
}

function QueryState(props: {
  title: string;
  isLoading: boolean;
  error: Error | null;
  onRetry: () => void;
  colSpan: number;
}) {
  if (props.isLoading) {
    return (
      <TableRow>
        <TableCell colSpan={props.colSpan} className="py-8 text-center text-sm text-muted-foreground">
          <div className="inline-flex items-center">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            {props.title}
          </div>
        </TableCell>
      </TableRow>
    );
  }

  if (props.error) {
    return (
      <TableRow>
        <TableCell colSpan={props.colSpan} className="py-8 text-center">
          <div className="space-y-3">
            <div className="text-sm text-destructive">
              {props.error.message || "Something went wrong."}
            </div>
            <Button variant="outline" size="sm" onClick={props.onRetry}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Retry
            </Button>
          </div>
        </TableCell>
      </TableRow>
    );
  }

  return null;
}

type CategoryDialogProps = {
  open: boolean;
  entity: MaintenanceCategoryRow | null;
  isPending: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: CategoryFormValues) => void;
};

function CategoryDialog(props: CategoryDialogProps) {
  const form = useForm<CategoryFormValues>({
    resolver: zodResolver(categoryFormSchema),
    defaultValues: {
      name: "",
      icon: "",
      description: "",
      isActive: true,
    },
  });

  useEffect(() => {
    form.reset({
      name: props.entity?.name || "",
      icon: props.entity?.icon || "",
      description: props.entity?.description || "",
      isActive: props.entity?.isActive ?? true,
    });
  }, [form, props.entity, props.open]);

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="w-[96vw] sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{props.entity ? "Edit category" : "Create category"}</DialogTitle>
          <DialogDescription>
            Define the top-level maintenance groups residents and admins will work with.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form className="space-y-4" onSubmit={form.handleSubmit(props.onSubmit)}>
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Appliances" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="icon"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Icon</FormLabel>
                  <EmojiCombobox
                    value={field.value || ""}
                    onChange={(value) => field.onChange(value)}
                    placeholder="Choose an icon"
                  />
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea rows={3} placeholder="Short admin-facing description" {...field} value={field.value ?? ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="isActive"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border px-4 py-3">
                  <div className="space-y-1">
                    <FormLabel className="mb-0">Active status</FormLabel>
                    <div className="text-sm text-muted-foreground">
                      Inactive categories stay editable but should not appear in resident setup.
                    </div>
                  </div>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => props.onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={props.isPending}>
                {props.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : props.entity ? (
                  "Save category"
                ) : (
                  "Create category"
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

type ItemDialogProps = {
  open: boolean;
  entity: MaintenanceItemRow | null;
  categories: MaintenanceCategoryRow[];
  isPending: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: ItemFormValues) => void;
};

function ItemDialog(props: ItemDialogProps) {
  const [isReadingImage, setIsReadingImage] = useState(false);
  const form = useForm<ItemFormValues>({
    resolver: zodResolver(itemFormSchema),
    defaultValues: {
      categoryId: "",
      name: "",
      description: "",
      defaultFrequency: "",
      recommendedTasksText: "",
      imageUrl: "",
      isActive: true,
    },
  });

  useEffect(() => {
    form.reset({
      categoryId: props.entity?.categoryId || "",
      name: props.entity?.name || "",
      description: props.entity?.description || "",
      defaultFrequency: props.entity?.defaultFrequency || "",
      recommendedTasksText: formatTaskLines(props.entity?.recommendedTasks),
      imageUrl: props.entity?.imageUrl || "",
      isActive: props.entity?.isActive ?? true,
    });
    setIsReadingImage(false);
  }, [form, props.entity, props.open]);

  const previewUrl = form.watch("imageUrl");

  const handleImageSelection = async (file?: File | null) => {
    if (!file) return;
    setIsReadingImage(true);
    try {
      const dataUrl = await readFileAsDataUrl(file);
      form.setValue("imageUrl", dataUrl, {
        shouldDirty: true,
        shouldValidate: true,
      });
    } finally {
      setIsReadingImage(false);
    }
  };

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="flex max-h-[80vh] w-[96vw] flex-col overflow-hidden sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>{props.entity ? "Edit item" : "Create item"}</DialogTitle>
          <DialogDescription>
            Link each maintenance item to a category and define its default servicing rhythm.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form className="flex min-h-0 flex-1 flex-col" onSubmit={form.handleSubmit(props.onSubmit)}>
            <div className="space-y-4 overflow-y-auto pr-1">
              <div className="grid gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(300px,0.9fr)]">
                <div className="space-y-4">
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
                                <SelectValue placeholder="Select category" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {props.categories.map((category) => (
                                <SelectItem key={category.id} value={category.id}>
                                  {category.name}
                                  {category.isActive ? "" : " (Inactive)"}
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
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Item name</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g. Split AC" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description</FormLabel>
                        <FormControl>
                          <Textarea rows={4} placeholder="Short maintenance context for this item" {...field} value={field.value ?? ""} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="recommendedTasksText"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Recommended tasks</FormLabel>
                        <FormControl>
                          <Textarea
                            rows={5}
                            placeholder={`One task per line\nInspect filters\nClean coils`}
                            {...field}
                          />
                        </FormControl>
                        <div className="text-xs text-muted-foreground">
                          One task per line. The UI will normalize this into a clean list.
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="space-y-4">
                  <FormField
                    control={form.control}
                    name="defaultFrequency"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Default frequency</FormLabel>
                        <Select
                          value={field.value || "none"}
                          onValueChange={(value) => field.onChange(value === "none" ? "" : value)}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select frequency" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="none">No default</SelectItem>
                            {DURATION_OPTIONS.map((option) => (
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

                  <FormField
                    control={form.control}
                    name="isActive"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between rounded-lg border px-4 py-3">
                        <div className="space-y-1 pr-4">
                          <FormLabel className="mb-0">Active status</FormLabel>
                          <div className="text-sm text-muted-foreground">
                            Disable items that should no longer be offered for new asset setup.
                          </div>
                        </div>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="imageUrl"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Item image</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Paste an image URL or upload a file below"
                            {...field}
                            value={field.value || ""}
                          />
                        </FormControl>
                        <div className="flex flex-col gap-3 rounded-lg border border-dashed p-4">
                          <div className="flex flex-col gap-3">
                            <div className="text-sm text-muted-foreground">
                              Upload a single reference image. A file selection will be converted to a data URL before submit.
                            </div>
                            <Input
                              type="file"
                              accept="image/*"
                              className="w-full"
                              onChange={(event) => void handleImageSelection(event.target.files?.[0] || null)}
                            />
                          </div>
                          {isReadingImage ? (
                            <div className="flex items-center text-sm text-muted-foreground">
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Reading image...
                            </div>
                          ) : null}
                          {previewUrl ? (
                            <div className="flex flex-col gap-3">
                              <img
                                src={previewUrl}
                                alt="Maintenance item preview"
                                className="max-h-48 w-full rounded-lg border object-contain bg-slate-50"
                              />
                              <div>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() =>
                                    form.setValue("imageUrl", "", {
                                      shouldDirty: true,
                                      shouldValidate: true,
                                    })
                                  }
                                >
                                  Remove image
                                </Button>
                              </div>
                            </div>
                          ) : null}
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
            </div>

            <DialogFooter className="mt-4 border-t pt-4">
              <Button type="button" variant="outline" onClick={() => props.onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={props.isPending || isReadingImage}>
                {props.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : props.entity ? (
                  "Save item"
                ) : (
                  "Create item"
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

type PlanDialogProps = {
  open: boolean;
  entity: MaintenancePlanRow | null;
  items: MaintenanceItemRow[];
  isPending: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: PlanFormValues) => void;
};

function PlanDialog(props: PlanDialogProps) {
  const form = useForm<PlanFormValues>({
    resolver: zodResolver(planFormSchema),
    defaultValues: {
      maintenanceItemId: "",
      durationType: "monthly",
      price: "",
      currency: "NGN",
      visitsIncluded: 1,
      description: "",
      includedTasksText: "",
      isActive: true,
    },
  });

  useEffect(() => {
    form.reset({
      maintenanceItemId: props.entity?.maintenanceItemId || "",
      durationType: props.entity?.durationType || "monthly",
      price: props.entity?.price || "",
      currency: props.entity?.currency || "NGN",
      visitsIncluded: props.entity?.visitsIncluded ?? 1,
      description: props.entity?.description || "",
      includedTasksText: formatTaskLines(props.entity?.includedTasks),
      isActive: props.entity?.isActive ?? true,
    });
  }, [form, props.entity, props.open]);

  const selectedItemId = form.watch("maintenanceItemId");
  const durationType = form.watch("durationType");
  const selectedItem = useMemo(
    () => props.items.find((item) => item.id === selectedItemId),
    [props.items, selectedItemId],
  );
  const derivedName = derivePlanName(selectedItem?.name, durationType);

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="w-[96vw] sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{props.entity ? "Edit plan" : "Create plan"}</DialogTitle>
          <DialogDescription>
            Create the pricing and visit structure admins will sell for each maintenance item.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form className="space-y-4" onSubmit={form.handleSubmit(props.onSubmit)}>
            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="maintenanceItemId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Item</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select item" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {props.items.map((item) => (
                          <SelectItem key={item.id} value={item.id}>
                            {item.name}
                            {item.isActive ? "" : " (Inactive)"}
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
                name="durationType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Duration</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select duration" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {DURATION_OPTIONS.map((option) => (
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
            </div>

            <div className="rounded-lg border bg-slate-50 px-4 py-3 text-sm">
              <div className="font-medium text-slate-900">Plan name</div>
              <div className="text-muted-foreground">{derivedName}</div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <FormField
                control={form.control}
                name="price"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Price</FormLabel>
                    <FormControl>
                      <Input placeholder="0" inputMode="decimal" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="currency"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Currency</FormLabel>
                    <FormControl>
                      <Input placeholder="NGN" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="visitsIncluded"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Visits included</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="1"
                        value={String(field.value ?? "")}
                        onChange={(event) => field.onChange(event.target.value)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea rows={3} placeholder="How this plan should be positioned internally" {...field} value={field.value ?? ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="includedTasksText"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Included tasks</FormLabel>
                  <FormControl>
                    <Textarea
                      rows={4}
                      placeholder={`One task per line\nInspect refrigerant\nClean condenser`}
                      {...field}
                    />
                  </FormControl>
                  <div className="text-xs text-muted-foreground">
                    One task per line. The backend will store this as a list.
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="isActive"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border px-4 py-3">
                  <div className="space-y-1">
                    <FormLabel className="mb-0">Active status</FormLabel>
                    <div className="text-sm text-muted-foreground">
                      Only active plans can be subscribed to by residents.
                    </div>
                  </div>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => props.onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={props.isPending}>
                {props.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : props.entity ? (
                  "Save plan"
                ) : (
                  "Create plan"
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

type ScheduleAssignDialogProps = {
  open: boolean;
  schedule: MaintenanceScheduleRow | null;
  providers: MaintenanceProviderRow[];
  isPending: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (providerId: string) => void;
};

function ScheduleAssignDialog(props: ScheduleAssignDialogProps) {
  const [providerId, setProviderId] = useState("");

  useEffect(() => {
    setProviderId(props.schedule?.provider?.id || props.schedule?.request?.providerId || "");
  }, [props.schedule, props.open]);

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="w-[96vw] sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {props.schedule?.provider?.id ? "Reassign provider" : "Assign provider"}
          </DialogTitle>
          <DialogDescription>
            Send this scheduled maintenance visit directly into the provider task manager.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg border bg-slate-50 px-4 py-3 text-sm">
            <div className="font-medium text-slate-900">{props.schedule?.asset.name || "Maintenance visit"}</div>
            <div className="text-muted-foreground">
              {props.schedule?.item.name || "Item"}
              {props.schedule?.asset.locationLabel ? ` in ${props.schedule.asset.locationLabel}` : ""}
            </div>
            <div className="mt-2 text-muted-foreground">
              {props.schedule?.plan.name || "Plan"} on {formatDateTime(props.schedule?.scheduledDate)}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Provider</Label>
            <Select value={providerId} onValueChange={setProviderId}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a provider" />
              </SelectTrigger>
              <SelectContent>
                {props.providers.length === 0 ? (
                  <SelectItem value="__no-provider" disabled>
                    No approved providers available
                  </SelectItem>
                ) : (
                  props.providers.map((provider) => (
                    <SelectItem key={provider.id} value={provider.id}>
                      {resolveProviderDisplayName(provider)}
                      {provider.company ? ` • ${provider.company}` : ""}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => props.onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={props.isPending || !providerId || providerId === "__no-provider"}
            onClick={() => props.onSubmit(providerId)}
          >
            {props.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Assigning...
              </>
            ) : (
              <>
                <UserCheck className="mr-2 h-4 w-4" />
                Assign provider
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function MaintenanceSetupPanel() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState("categories");
  const [categoryStatus, setCategoryStatus] = useState<MaintenanceStatusFilter>("all");
  const [categorySearch, setCategorySearch] = useState("");
  const [itemStatus, setItemStatus] = useState<MaintenanceStatusFilter>("all");
  const [itemSearch, setItemSearch] = useState("");
  const [itemCategoryId, setItemCategoryId] = useState("all");
  const [planStatus, setPlanStatus] = useState<MaintenanceStatusFilter>("all");
  const [planSearch, setPlanSearch] = useState("");
  const [planItemId, setPlanItemId] = useState("all");
  const [planDuration, setPlanDuration] = useState<MaintenanceDuration | "all">("all");
  const [scheduleStatus, setScheduleStatus] = useState<MaintenanceScheduleStatus | "all">("all");
  const [categoryDialog, setCategoryDialog] = useState<MaintenanceCategoryRow | null>(null);
  const [itemDialog, setItemDialog] = useState<MaintenanceItemRow | null>(null);
  const [planDialog, setPlanDialog] = useState<MaintenancePlanRow | null>(null);
  const [scheduleAssignDialog, setScheduleAssignDialog] = useState<MaintenanceScheduleRow | null>(null);

  const categoryOptionsQuery = useQuery<MaintenanceCategoryRow[], Error>({
    queryKey: ["admin-maintenance-categories", "options"],
    queryFn: () => AdminAPI.maintenance.categories.getAll(),
  });

  const itemOptionsQuery = useQuery<MaintenanceItemRow[], Error>({
    queryKey: ["admin-maintenance-items", "options"],
    queryFn: () => AdminAPI.maintenance.items.getAll(),
  });

  const providerOptionsQuery = useQuery<MaintenanceProviderRow[], Error>({
    queryKey: ["admin-maintenance-providers", "options"],
    queryFn: () => AdminAPI.providers.getAll(),
  });

  const categoriesQuery = useQuery<MaintenanceCategoryRow[], Error>({
    queryKey: [
      "admin-maintenance-categories",
      { q: categorySearch, isActive: toActiveFilter(categoryStatus) },
    ],
    queryFn: () =>
      AdminAPI.maintenance.categories.getAll({
        q: categorySearch || undefined,
        isActive: toActiveFilter(categoryStatus),
      }),
  });

  const itemsQuery = useQuery<MaintenanceItemRow[], Error>({
    queryKey: [
      "admin-maintenance-items",
      {
        q: itemSearch,
        isActive: toActiveFilter(itemStatus),
        categoryId: itemCategoryId === "all" ? undefined : itemCategoryId,
      },
    ],
    queryFn: () =>
      AdminAPI.maintenance.items.getAll({
        q: itemSearch || undefined,
        isActive: toActiveFilter(itemStatus),
        categoryId: itemCategoryId === "all" ? undefined : itemCategoryId,
      }),
  });

  const plansQuery = useQuery<MaintenancePlanRow[], Error>({
    queryKey: [
      "admin-maintenance-plans",
      {
        q: planSearch,
        isActive: toActiveFilter(planStatus),
        maintenanceItemId: planItemId === "all" ? undefined : planItemId,
        durationType: planDuration === "all" ? undefined : planDuration,
      },
    ],
    queryFn: () =>
      AdminAPI.maintenance.plans.getAll({
        q: planSearch || undefined,
        isActive: toActiveFilter(planStatus),
        maintenanceItemId: planItemId === "all" ? undefined : planItemId,
        durationType: planDuration === "all" ? undefined : planDuration,
      }),
  });

  const schedulesQuery = useQuery<MaintenanceScheduleRow[], Error>({
    queryKey: [
      "admin-maintenance-schedules",
      {
        status: scheduleStatus === "all" ? undefined : scheduleStatus,
      },
    ],
    queryFn: () =>
      AdminAPI.maintenance.schedules.getAll({
        status: scheduleStatus === "all" ? undefined : scheduleStatus,
      }),
  });

  const invalidateCategoryQueries = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["admin-maintenance-categories"] }),
      queryClient.invalidateQueries({ queryKey: ["admin-maintenance-items"] }),
      queryClient.invalidateQueries({ queryKey: ["admin-maintenance-plans"] }),
    ]);
  };

  const invalidateItemQueries = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["admin-maintenance-items"] }),
      queryClient.invalidateQueries({ queryKey: ["admin-maintenance-plans"] }),
    ]);
  };

  const invalidatePlanQueries = async () => {
    await queryClient.invalidateQueries({ queryKey: ["admin-maintenance-plans"] });
  };

  const invalidateScheduleQueries = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["admin-maintenance-schedules"] }),
      queryClient.invalidateQueries({ queryKey: ["/api/admin/bridge/service-requests"] }),
    ]);
  };

  const saveCategoryMutation = useMutation({
    mutationFn: (payload: { id?: string; data: Record<string, unknown> }) =>
      payload.id
        ? AdminAPI.maintenance.categories.update(payload.id, payload.data)
        : AdminAPI.maintenance.categories.create(payload.data),
    onSuccess: async () => {
      await invalidateCategoryQueries();
      setCategoryDialog(null);
      toast({ title: categoryDialog ? "Category updated" : "Category created" });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to save category",
        description: error?.message || "Please try again.",
        variant: "destructive",
      });
    },
  });

  const toggleCategoryMutation = useMutation({
    mutationFn: (payload: { id: string; isActive: boolean }) =>
      AdminAPI.maintenance.categories.update(payload.id, { isActive: payload.isActive }),
    onSuccess: async (_, variables) => {
      await invalidateCategoryQueries();
      toast({
        title: variables.isActive ? "Category activated" : "Category deactivated",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to update category status",
        description: error?.message || "Please try again.",
        variant: "destructive",
      });
    },
  });

  const saveItemMutation = useMutation({
    mutationFn: (payload: { id?: string; data: Record<string, unknown> }) =>
      payload.id
        ? AdminAPI.maintenance.items.update(payload.id, payload.data)
        : AdminAPI.maintenance.items.create(payload.data),
    onSuccess: async () => {
      await invalidateItemQueries();
      setItemDialog(null);
      toast({ title: itemDialog ? "Item updated" : "Item created" });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to save item",
        description: error?.message || "Please try again.",
        variant: "destructive",
      });
    },
  });

  const toggleItemMutation = useMutation({
    mutationFn: (payload: { id: string; isActive: boolean }) =>
      AdminAPI.maintenance.items.update(payload.id, { isActive: payload.isActive }),
    onSuccess: async (_, variables) => {
      await invalidateItemQueries();
      toast({
        title: variables.isActive ? "Item activated" : "Item deactivated",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to update item status",
        description: error?.message || "Please try again.",
        variant: "destructive",
      });
    },
  });

  const savePlanMutation = useMutation({
    mutationFn: (payload: { id?: string; data: Record<string, unknown> }) =>
      payload.id
        ? AdminAPI.maintenance.plans.update(payload.id, payload.data)
        : AdminAPI.maintenance.plans.create(payload.data),
    onSuccess: async () => {
      await invalidatePlanQueries();
      setPlanDialog(null);
      toast({ title: planDialog ? "Plan updated" : "Plan created" });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to save plan",
        description: error?.message || "Please try again.",
        variant: "destructive",
      });
    },
  });

  const togglePlanMutation = useMutation({
    mutationFn: (payload: { id: string; isActive: boolean }) =>
      AdminAPI.maintenance.plans.update(payload.id, { isActive: payload.isActive }),
    onSuccess: async (_, variables) => {
      await invalidatePlanQueries();
      toast({
        title: variables.isActive ? "Plan activated" : "Plan deactivated",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to update plan status",
        description: error?.message || "Please try again.",
        variant: "destructive",
      });
    },
  });

  const createScheduleRequestMutation = useMutation({
    mutationFn: (scheduleId: string) => AdminAPI.maintenance.schedules.createRequest(scheduleId),
    onSuccess: async () => {
      await invalidateScheduleQueries();
      toast({ title: "Maintenance request created" });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to create request",
        description: error?.message || "Please try again.",
        variant: "destructive",
      });
    },
  });

  const assignScheduleProviderMutation = useMutation({
    mutationFn: (payload: { scheduleId: string; providerId: string }) =>
      AdminAPI.maintenance.schedules.assignProvider(payload.scheduleId, {
        providerId: payload.providerId,
      }),
    onSuccess: async () => {
      await invalidateScheduleQueries();
      setScheduleAssignDialog(null);
      toast({ title: "Provider assigned to maintenance visit" });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to assign provider",
        description: error?.message || "Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleCategorySubmit = (values: CategoryFormValues) => {
    saveCategoryMutation.mutate({
      id: categoryDialog?.id,
      data: {
        name: values.name,
        icon: values.icon || null,
        description: values.description || null,
        isActive: values.isActive,
      },
    });
  };

  const handleItemSubmit = (values: ItemFormValues) => {
    saveItemMutation.mutate({
      id: itemDialog?.id,
      data: {
        categoryId: values.categoryId,
        name: values.name,
        description: values.description || null,
        defaultFrequency: values.defaultFrequency || null,
        recommendedTasks: parseTaskLines(values.recommendedTasksText),
        imageUrl: values.imageUrl || null,
        isActive: values.isActive,
      },
    });
  };

  const handlePlanSubmit = (values: PlanFormValues) => {
    const selectedItem = itemOptionsQuery.data?.find(
      (item) => item.id === values.maintenanceItemId,
    );

    savePlanMutation.mutate({
      id: planDialog?.id,
      data: {
        maintenanceItemId: values.maintenanceItemId,
        name: derivePlanName(selectedItem?.name, values.durationType),
        durationType: values.durationType,
        price: values.price,
        currency: values.currency,
        visitsIncluded: values.visitsIncluded,
        description: values.description || null,
        includedTasks: parseTaskLines(values.includedTasksText),
        isActive: values.isActive,
      },
    });
  };

  const categories = categoriesQuery.data || [];
  const items = itemsQuery.data || [];
  const plans = plansQuery.data || [];
  const schedules = schedulesQuery.data || [];
  const categoryOptions = categoryOptionsQuery.data || [];
  const itemOptions = itemOptionsQuery.data || [];
  const providerOptions = (providerOptionsQuery.data || []).filter(
    (provider) => provider.isApproved !== false,
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wrench className="h-5 w-5" />
            Maintenance Setup
          </CardTitle>
          <CardDescription>
            Configure preventive maintenance categories, items, and pricing plans from one place.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-4 md:w-auto">
              <TabsTrigger value="categories">Categories</TabsTrigger>
              <TabsTrigger value="items">Items</TabsTrigger>
              <TabsTrigger value="plans">Plans</TabsTrigger>
              <TabsTrigger value="schedules">Schedules</TabsTrigger>
            </TabsList>

            <TabsContent value="categories" className="space-y-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex flex-col gap-3 md:flex-row md:items-center">
                  <Input
                    placeholder="Search categories"
                    value={categorySearch}
                    onChange={(event) => setCategorySearch(event.target.value)}
                    className="w-full md:w-72"
                  />
                  <Select value={categoryStatus} onValueChange={(value) => setCategoryStatus(value as MaintenanceStatusFilter)}>
                    <SelectTrigger className="w-full md:w-44">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All statuses</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={() => setCategoryDialog({} as MaintenanceCategoryRow)}>
                  <Plus className="mr-2 h-4 w-4" />
                  New category
                </Button>
              </div>

              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Icon</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <QueryState
                        title="Loading maintenance categories..."
                        isLoading={categoriesQuery.isLoading}
                        error={categoriesQuery.error || null}
                        onRetry={() => void categoriesQuery.refetch()}
                        colSpan={6}
                      />
                      {!categoriesQuery.isLoading && !categoriesQuery.error && categories.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="py-12 text-center">
                            <div className="space-y-3">
                              <div className="text-sm text-muted-foreground">
                                No maintenance categories yet. Create the first one to start structuring the catalog.
                              </div>
                              <Button onClick={() => setCategoryDialog({} as MaintenanceCategoryRow)}>
                                <Plus className="mr-2 h-4 w-4" />
                                Create first category
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : null}
                      {!categoriesQuery.isLoading &&
                        !categoriesQuery.error &&
                        categories.map((category) => (
                          <TableRow key={category.id}>
                            <TableCell className="font-medium">{category.name}</TableCell>
                            <TableCell>{category.icon || "-"}</TableCell>
                            <TableCell className="max-w-md text-sm text-muted-foreground">
                              {category.description || "No description"}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-3">
                                <Badge variant={category.isActive ? "default" : "secondary"}>
                                  {category.isActive ? "Active" : "Inactive"}
                                </Badge>
                                <Switch
                                  checked={category.isActive}
                                  onCheckedChange={(checked) =>
                                    toggleCategoryMutation.mutate({
                                      id: category.id,
                                      isActive: checked,
                                    })
                                  }
                                  disabled={toggleCategoryMutation.isPending}
                                />
                              </div>
                            </TableCell>
                            <TableCell>{formatDate(category.createdAt)}</TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setCategoryDialog(category)}
                              >
                                <Pencil className="mr-2 h-4 w-4" />
                                Edit
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="items" className="space-y-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex flex-col gap-3 md:flex-row md:items-center">
                  <Input
                    placeholder="Search items"
                    value={itemSearch}
                    onChange={(event) => setItemSearch(event.target.value)}
                    className="w-full md:w-72"
                  />
                  <Select value={itemCategoryId} onValueChange={setItemCategoryId}>
                    <SelectTrigger className="w-full md:w-52">
                      <SelectValue placeholder="Category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All categories</SelectItem>
                      {categoryOptions.map((category) => (
                        <SelectItem key={category.id} value={category.id}>
                          {category.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={itemStatus} onValueChange={(value) => setItemStatus(value as MaintenanceStatusFilter)}>
                    <SelectTrigger className="w-full md:w-44">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All statuses</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={() => setItemDialog({} as MaintenanceItemRow)}>
                  <Plus className="mr-2 h-4 w-4" />
                  New item
                </Button>
              </div>

              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Item name</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Default frequency</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <QueryState
                        title="Loading maintenance items..."
                        isLoading={itemsQuery.isLoading}
                        error={itemsQuery.error || null}
                        onRetry={() => void itemsQuery.refetch()}
                        colSpan={5}
                      />
                      {!itemsQuery.isLoading && !itemsQuery.error && items.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="py-12 text-center">
                            <div className="space-y-3">
                              <div className="text-sm text-muted-foreground">
                                No maintenance items match the current filters.
                              </div>
                              <Button onClick={() => setItemDialog({} as MaintenanceItemRow)}>
                                <Plus className="mr-2 h-4 w-4" />
                                Create first item
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : null}
                      {!itemsQuery.isLoading &&
                        !itemsQuery.error &&
                        items.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell>
                              <div className="flex items-center gap-3">
                                {item.imageUrl ? (
                                  <img
                                    src={item.imageUrl}
                                    alt={item.name}
                                    className="h-10 w-10 rounded-lg border object-cover"
                                  />
                                ) : null}
                                <div>
                                  <div className="font-medium">{item.name}</div>
                                  <div className="text-xs text-muted-foreground">
                                    {item.description || "No description"}
                                  </div>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>{item.category?.name || "-"}</TableCell>
                            <TableCell>{formatDurationLabel(item.defaultFrequency)}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-3">
                                <Badge variant={item.isActive ? "default" : "secondary"}>
                                  {item.isActive ? "Active" : "Inactive"}
                                </Badge>
                                <Switch
                                  checked={item.isActive}
                                  onCheckedChange={(checked) =>
                                    toggleItemMutation.mutate({ id: item.id, isActive: checked })
                                  }
                                  disabled={toggleItemMutation.isPending}
                                />
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              <Button variant="outline" size="sm" onClick={() => setItemDialog(item)}>
                                <Pencil className="mr-2 h-4 w-4" />
                                Edit
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="plans" className="space-y-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex flex-col gap-3 md:flex-row md:items-center">
                  <Input
                    placeholder="Search plans"
                    value={planSearch}
                    onChange={(event) => setPlanSearch(event.target.value)}
                    className="w-full md:w-72"
                  />
                  <Select value={planItemId} onValueChange={setPlanItemId}>
                    <SelectTrigger className="w-full md:w-56">
                      <SelectValue placeholder="Item" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All items</SelectItem>
                      {itemOptions.map((item) => (
                        <SelectItem key={item.id} value={item.id}>
                          {item.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={planDuration} onValueChange={(value) => setPlanDuration(value as MaintenanceDuration | "all")}>
                    <SelectTrigger className="w-full md:w-56">
                      <SelectValue placeholder="Duration" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All durations</SelectItem>
                      {DURATION_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={planStatus} onValueChange={(value) => setPlanStatus(value as MaintenanceStatusFilter)}>
                    <SelectTrigger className="w-full md:w-44">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All statuses</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={() => setPlanDialog({} as MaintenancePlanRow)}>
                  <Plus className="mr-2 h-4 w-4" />
                  New plan
                </Button>
              </div>

              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Item name</TableHead>
                        <TableHead>Duration</TableHead>
                        <TableHead>Price</TableHead>
                        <TableHead>Visits included</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <QueryState
                        title="Loading maintenance plans..."
                        isLoading={plansQuery.isLoading}
                        error={plansQuery.error || null}
                        onRetry={() => void plansQuery.refetch()}
                        colSpan={6}
                      />
                      {!plansQuery.isLoading && !plansQuery.error && plans.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="py-12 text-center">
                            <div className="space-y-3">
                              <div className="text-sm text-muted-foreground">
                                No maintenance plans match the current filters.
                              </div>
                              <Button onClick={() => setPlanDialog({} as MaintenancePlanRow)}>
                                <Plus className="mr-2 h-4 w-4" />
                                Create first plan
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : null}
                      {!plansQuery.isLoading &&
                        !plansQuery.error &&
                        plans.map((plan) => (
                          <TableRow key={plan.id}>
                            <TableCell>
                              <div className="font-medium">{plan.item?.name || plan.name}</div>
                              <div className="text-xs text-muted-foreground">
                                {plan.description || plan.name}
                              </div>
                            </TableCell>
                            <TableCell>{formatDurationLabel(plan.durationType)}</TableCell>
                            <TableCell>{formatCurrency(plan.price, plan.currency)}</TableCell>
                            <TableCell>{plan.visitsIncluded}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-3">
                                <Badge variant={plan.isActive ? "default" : "secondary"}>
                                  {plan.isActive ? "Active" : "Inactive"}
                                </Badge>
                                <Switch
                                  checked={plan.isActive}
                                  onCheckedChange={(checked) =>
                                    togglePlanMutation.mutate({ id: plan.id, isActive: checked })
                                  }
                                  disabled={togglePlanMutation.isPending}
                                />
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              <Button variant="outline" size="sm" onClick={() => setPlanDialog(plan)}>
                                <Pencil className="mr-2 h-4 w-4" />
                                Edit
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="schedules" className="space-y-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex flex-col gap-3 md:flex-row md:items-center">
                  <Select
                    value={scheduleStatus}
                    onValueChange={(value) =>
                      setScheduleStatus(value as MaintenanceScheduleStatus | "all")
                    }
                  >
                    <SelectTrigger className="w-full md:w-52">
                      <SelectValue placeholder="Schedule status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All statuses</SelectItem>
                      <SelectItem value="upcoming">Upcoming</SelectItem>
                      <SelectItem value="due">Due</SelectItem>
                      <SelectItem value="assigned">Assigned</SelectItem>
                      <SelectItem value="in_progress">In progress</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="missed">Missed</SelectItem>
                      <SelectItem value="rescheduled">Rescheduled</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button variant="outline" onClick={() => void schedulesQuery.refetch()}>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Refresh schedules
                </Button>
              </div>

              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Asset</TableHead>
                        <TableHead>Plan</TableHead>
                        <TableHead>Scheduled date</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Provider</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <QueryState
                        title="Loading maintenance schedules..."
                        isLoading={schedulesQuery.isLoading}
                        error={schedulesQuery.error || null}
                        onRetry={() => void schedulesQuery.refetch()}
                        colSpan={6}
                      />
                      {!schedulesQuery.isLoading && !schedulesQuery.error && schedules.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="py-12 text-center">
                            <div className="space-y-3">
                              <div className="text-sm text-muted-foreground">
                                No maintenance schedules match the current filter.
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : null}
                      {!schedulesQuery.isLoading &&
                        !schedulesQuery.error &&
                        schedules.map((schedule) => (
                          <TableRow key={schedule.id}>
                            <TableCell>
                              <div className="flex items-start gap-3">
                                <div className="mt-0.5 rounded-full bg-slate-100 p-2 text-slate-600">
                                  <CalendarClock className="h-4 w-4" />
                                </div>
                                <div>
                                  <div className="font-medium">{schedule.asset.name}</div>
                                  <div className="text-xs text-muted-foreground">
                                    {schedule.item.name}
                                    {schedule.asset.locationLabel
                                      ? ` • ${schedule.asset.locationLabel}`
                                      : ""}
                                  </div>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="font-medium">{schedule.plan.name}</div>
                              <div className="text-xs text-muted-foreground">
                                {formatDurationLabel(schedule.plan.durationType)} •{" "}
                                {formatCurrency(schedule.plan.price, schedule.plan.currency)}
                              </div>
                            </TableCell>
                            <TableCell>{formatDateTime(schedule.scheduledDate)}</TableCell>
                            <TableCell>
                              <Badge variant={schedule.status === "completed" ? "secondary" : "default"}>
                                {formatScheduleStatusLabel(schedule.status)}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {schedule.provider?.name ? (
                                <div>
                                  <div className="font-medium">{schedule.provider.name}</div>
                                  <div className="text-xs text-muted-foreground">
                                    {schedule.provider.email || "Assigned provider"}
                                  </div>
                                </div>
                              ) : (
                                <span className="text-sm text-muted-foreground">Not assigned</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex flex-wrap justify-end gap-2">
                                {!schedule.sourceRequestId ? (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => createScheduleRequestMutation.mutate(schedule.id)}
                                    disabled={createScheduleRequestMutation.isPending}
                                  >
                                    Create request
                                  </Button>
                                ) : null}
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setScheduleAssignDialog(schedule)}
                                  disabled={
                                    assignScheduleProviderMutation.isPending ||
                                    ["completed", "cancelled"].includes(schedule.status)
                                  }
                                >
                                  <UserCheck className="mr-2 h-4 w-4" />
                                  {schedule.provider?.id ? "Reassign provider" : "Assign provider"}
                                </Button>
                                {schedule.request?.id ? (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setLocation(`/admin-dashboard/requests/${schedule.request?.id}`)}
                                  >
                                    Open request
                                  </Button>
                                ) : null}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <CategoryDialog
        open={categoryDialog !== null}
        entity={categoryDialog && categoryDialog.id ? categoryDialog : null}
        isPending={saveCategoryMutation.isPending}
        onOpenChange={(open) => {
          if (!open) setCategoryDialog(null);
        }}
        onSubmit={handleCategorySubmit}
      />
      <ItemDialog
        open={itemDialog !== null}
        entity={itemDialog && itemDialog.id ? itemDialog : null}
        categories={categoryOptions}
        isPending={saveItemMutation.isPending}
        onOpenChange={(open) => {
          if (!open) setItemDialog(null);
        }}
        onSubmit={handleItemSubmit}
      />
      <PlanDialog
        open={planDialog !== null}
        entity={planDialog && planDialog.id ? planDialog : null}
        items={itemOptions}
        isPending={savePlanMutation.isPending}
        onOpenChange={(open) => {
          if (!open) setPlanDialog(null);
        }}
        onSubmit={handlePlanSubmit}
      />
      <ScheduleAssignDialog
        open={scheduleAssignDialog !== null}
        schedule={scheduleAssignDialog}
        providers={providerOptions}
        isPending={assignScheduleProviderMutation.isPending}
        onOpenChange={(open) => {
          if (!open) setScheduleAssignDialog(null);
        }}
        onSubmit={(providerId) => {
          if (!scheduleAssignDialog?.id) return;
          assignScheduleProviderMutation.mutate({
            scheduleId: scheduleAssignDialog.id,
            providerId,
          });
        }}
      />
    </div>
  );
}
