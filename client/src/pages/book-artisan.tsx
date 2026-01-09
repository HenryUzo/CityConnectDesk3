// client/src/pages/book-artisan.tsx
import { useEffect, useMemo, useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useMutation } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import {
  Wrench,
  ChevronLeft,
  Home,
  BarChart3,
  Layers,
  FileText,
  Flag,
  Users,
  Settings,
  HelpCircle,
  Upload,
  Bold,
  Italic,
  Link2,
  List,
  ListOrdered,
  Calendar,
  Clock,
  Shirt,
  ShoppingBag,
  MapPin,
  Bot,
  AlertTriangle,
  Sparkles,
  X,
} from "lucide-react";
import { residentFetch } from "@/lib/residentApi";
import { cn } from "@/lib/utils";

const artisanRequestSchema = z.object({
  title: z.string().min(1, "Title is required"),
  category: z.string().min(1, "Select a service category"),
  description: z.string().min(10, "Description must be at least 10 characters"),
  urgency: z.enum(["low", "medium", "high", "emergency"]),
  preferredDate: z.string().optional(),
  preferredTime: z.string().optional(),
  specialInstructions: z.string().optional(),
  professionalServicing: z.boolean().default(false),
  diagnosisType: z.enum(["regular", "professional"]).default("regular"),
});

const ACTIVE_SERVICE_CATEGORY_KEYS = [
  "surveillance_monitoring",
  "cleaning_janitorial",
  "catering_services",
  "it_support",
  "maintenance_repair",
  "marketing_advertising",
  "home_tutors",
  "furniture_making",
] as const;

const FALLBACK_SERVICE_CATEGORIES = [
  { value: "surveillance_monitoring", label: "Surveillance monitoring", emoji: "🎥" },
  { value: "cleaning_janitorial", label: "Cleaning & janitorial", emoji: "🧹" },
  { value: "catering_services", label: "Catering Services", emoji: "🍽️" },
  { value: "it_support", label: "IT Support", emoji: "💻" },
  { value: "maintenance_repair", label: "Maintenance & Repair", emoji: "🔧" },
  { value: "marketing_advertising", label: "Marketing & Advertising", emoji: "📊" },
  { value: "home_tutors", label: "Home tutors", emoji: "📚" },
  { value: "furniture_making", label: "Furniture making", emoji: "🪑" },
];

type ArtisanRequestFormData = z.infer<typeof artisanRequestSchema>;

type AiDiagnosis = {
  summary: string;
  probableCauses: { cause: string; likelihood: "low" | "medium" | "high" }[];
  severity: "low" | "medium" | "high" | "critical";
  shouldAvoidDIY: boolean;
  safetyNotes: string[];
  suggestedChecks: string[];
  whenToCallPro: string;
  suggestedCategory?: string;
};

type AiMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  variant?: "normal" | "warning";
};

const CITYBUDDY_BOOKING_EVENTS_KEY = "citybuddy_booking_events_v1";

function pushCityBuddyBookingEvent(evt: {
  citybuddySessionId?: string | null;
  serviceRequestId: string;
  title?: string | null;
  status?: string | null;
}) {
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(CITYBUDDY_BOOKING_EVENTS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    const list = Array.isArray(parsed) ? parsed : [];
    list.push({
      eventId: `${Date.now()}:${evt.serviceRequestId}`,
      createdAtIso: new Date().toISOString(),
      citybuddySessionId: evt.citybuddySessionId ?? null,
      serviceRequestId: evt.serviceRequestId,
      title: evt.title ?? null,
      status: evt.status ?? null,
    });
    window.localStorage.setItem(CITYBUDDY_BOOKING_EVENTS_KEY, JSON.stringify(list.slice(-30)));
  } catch {
    // ignore
  }
}

export default function BookArtisan() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const citybuddySessionId = useMemo(() => {
    if (typeof window === "undefined") return null;
    return new URLSearchParams(window.location.search).get("citybuddySessionId");
  }, []);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const preferredDateRef = useRef<HTMLInputElement | null>(null);
  const preferredTimeRef = useRef<HTMLInputElement | null>(null);
  const timeListRef = useRef<HTMLDivElement | null>(null);
  const [dateOpen, setDateOpen] = useState(false);
  const [timeOpen, setTimeOpen] = useState(false);
  const [calendarBase, setCalendarBase] = useState<Date>(new Date());
  const [isAiPanelOpen, setIsAiPanelOpen] = useState(false);
  const [aiMessages, setAiMessages] = useState<AiMessage[]>([]);
  const [aiResult, setAiResult] = useState<AiDiagnosis | null>(null);

  const getNextNDays = (n: number) => {
    const days: Date[] = [];
    const today = new Date();
    for (let i = 0; i < n; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      days.push(d);
    }
    return days;
  };

  const formatDateForInput = (d: Date) => d.toISOString().slice(0, 10); // YYYY-MM-DD
  const formatDisplayDate = (d: Date) => d.toLocaleDateString(undefined, { day: "2-digit", month: "short" });

  const generateTimeSlots = (startHour = 0, endHour = 24, stepMinutes = 30, includeEnd2359 = false) => {
    const slots: string[] = [];
    for (let h = startHour; h < endHour; h++) {
      for (let m = 0; m < 60; m += stepMinutes) {
        const hh = String(h).padStart(2, "0");
        const mm = String(m).padStart(2, "0");
        slots.push(`${hh}:${mm}`);
      }
    }
    if (includeEnd2359) {
      const last = "23:59";
      if (!slots.includes(last)) slots.push(last);
    }
    return slots;
  };

  // In dev (or when cookies aren't set yet), use the email header fallback automatically.
  useEffect(() => {
    if (user?.email) {
      localStorage.setItem("resident_email_dev", user.email);
    }
  }, [user?.email]);

  const form = useForm<ArtisanRequestFormData>({
    resolver: zodResolver(artisanRequestSchema),
    defaultValues: {
      title: "",
      category: "",
      description: "",
      urgency: "medium",
      preferredDate: "",
      preferredTime: "",
      specialInstructions: "",
      professionalServicing: false,
      diagnosisType: "regular",
    },
  });
  const watchedCategory = form.watch("category");
  const watchedDescription = form.watch("description");
  const buildUserMessageContent = () => {
    const values = form.getValues();
    const lines = [
      `Category: ${values.category}`,
      `Urgency: ${values.urgency}`,
      `Description: ${values.description}`,
    ];
    if (values.specialInstructions) {
      lines.push(`Special instructions: ${values.specialInstructions}`);
    }
    return lines.join("\n");
  };

  // Fetch service categories from server (global scope)
  const { data: categories = [], isLoading: isCategoriesLoading } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      try {
        const res = await fetch("/api/categories?scope=global");
        if (!res.ok) {
          console.warn("Failed to load categories from server, using fallback");
          return [];
        }
        const data = await res.json();
        console.log("Loaded categories from server:", data);
        return data;
      } catch (error) {
        console.warn("Error loading categories, using fallback:", error);
        return [];
      }
    },
    staleTime: 1000 * 60 * 5,
  });

  // When categories load, initialize the category field if it's unset
  const dynamicCategoryOptions = useMemo(() => {
    if (!Array.isArray(categories) || categories.length === 0) {
      console.log("No categories from server, using fallback");
      return [];
    }
    console.log("Processing categories:", categories);
    // small emoji lookup for known keys
    const EMOJI_MAP: Record<string, string> = {
      surveillance_monitoring: "🎥",
      cleaning_janitorial: "🧹",
      catering_services: "🍽️",
      it_support: "💻",
      maintenance_repair: "🔧",
      marketing_advertising: "📊",
      home_tutors: "📚",
      furniture_making: "🪑",
    };

    return categories
      .filter((category: any) => category?.isActive !== false)
      .filter((category: any) => {
        const rawKey = String(category.key ?? category.name ?? category.id ?? category);
        return (ACTIVE_SERVICE_CATEGORY_KEYS as readonly string[]).includes(rawKey);
      })
      .map((category: any) => {
      const label =
        category.name ??
        String(category.key ?? category.id ?? category).replace(/_/g, " ");
      const rawKey = String(category.key ?? category.name ?? category.id ?? category);
      const value = rawKey;
      const emoji = (category.emoji as string) || EMOJI_MAP[rawKey] || "🛠️";
      console.log(`Category: ${label} -> ${value} [emoji=${emoji}]`);
      return { label, value, emoji };
    });
  }, [categories]);

  const categoryOptions =
    dynamicCategoryOptions.length > 0
      ? dynamicCategoryOptions
      : FALLBACK_SERVICE_CATEGORIES;

  console.log("Using category options:", categoryOptions);

  useEffect(() => {
    if (categoryOptions.length === 0) return;
    const current = form.getValues("category");
    const isValid = categoryOptions.some(
      (option) => option.value === current,
    );
    if (!isValid || !current) {
      console.log("Setting category to:", categoryOptions[0].value);
      form.setValue("category", categoryOptions[0].value);
    }
  }, [categoryOptions, form]);

  const diagnoseMutation = useMutation<AiDiagnosis, Error, void>({
    mutationFn: async () => {
      const values = form.getValues();
      const payload = {
        category: values.category,
        description: values.description,
        urgency: values.urgency,
        specialInstructions: values.specialInstructions,
      };
      return await residentFetch<AiDiagnosis>("/api/ai/diagnose", {
        method: "POST",
        json: payload,
      });
    },
    onMutate: () => {
      setIsAiPanelOpen(true);
      setAiResult(null);
      setAiMessages([
        {
          id: "user-issue",
          role: "user",
          content: buildUserMessageContent(),
        },
      ]);
    },
    onSuccess: (data) => {
      setAiResult(data);
      const userMessage = {
        id: "user-issue",
        role: "user" as const,
        content: buildUserMessageContent(),
      };

      const assistantMessages: AiMessage[] = [];

      assistantMessages.push({
        id: "assistant-summary",
        role: "assistant",
        content: data.summary,
      });

      if (data.probableCauses?.length) {
        assistantMessages.push({
          id: "assistant-causes",
          role: "assistant",
          content: data.probableCauses
            .map((cause) => `${cause.cause} (${cause.likelihood} likelihood)`)
            .join("\n"),
        });
      }

      if (data.suggestedChecks?.length) {
        assistantMessages.push({
          id: "assistant-steps",
          role: "assistant",
          content: ["Steps you can try now:", ...data.suggestedChecks].join("\n"),
        });
      }

      if (data.safetyNotes?.length) {
        assistantMessages.push({
          id: "assistant-safety",
          role: "assistant",
          variant: "warning",
          content: ["Safety notes:", ...data.safetyNotes].join("\n"),
        });
      }

      assistantMessages.push({
        id: "assistant-severity",
        role: "assistant",
        variant:
          data.shouldAvoidDIY || data.severity === "high" || data.severity === "critical"
            ? "warning"
            : "normal",
        content: `Rating: ${data.severity.toUpperCase()}. When to call a professional: ${data.whenToCallPro}`,
      });

      setAiMessages([userMessage, ...assistantMessages]);

      toast({
        title: "AI diagnosis ready",
        description: "Review the suggestions before you confirm your booking.",
      });
    },
    onError: (error) => {
      toast({
        title: "AI diagnosis failed",
        description:
          "We couldn't analyze this issue right now. Please try again or submit your request.",
        variant: "destructive",
      });
      console.error("AI diagnosis error:", error);
      setAiMessages((prev) => [
        ...prev,
        {
          id: `assistant-error-${Date.now()}`,
          role: "assistant",
          variant: "warning",
          content:
            "CityBuddy couldn't analyze this issue right now. Please try again or submit your request.",
        },
      ]);
    },
  });
  const canRequestDiagnosis =
    Boolean(watchedCategory?.trim()) &&
    Boolean(watchedDescription?.trim());

  const submitRequestMutation = useMutation({
    mutationFn: async (data: ArtisanRequestFormData) => {
      // shape for server
      const payload = {
        title: data.title,
        category: data.category,
        description: data.description,
        urgency: data.urgency,
        preferredTime: data.preferredDate && data.preferredTime
          ? new Date(`${data.preferredDate}T${data.preferredTime}`).toISOString()
          : null,
        specialInstructions: data.specialInstructions || null,
        professionalServicing: data.professionalServicing,
        diagnosisType: data.diagnosisType,
      };

      // Ensure server receives identity: cookies + email header
      const headers: Record<string, string> = {};
      if (user?.email) headers["x-user-email"] = user.email;

      // POST to resident app endpoint
      return await residentFetch("/api/app/service-requests", {
        method: "POST",
        json: payload,
        headers,
      });
    },
    onSuccess: async (created: any) => {
      // refresh the resident's list view
      queryClient.invalidateQueries({ queryKey: ["my-requests"] });
      queryClient.invalidateQueries({
        queryKey: ["/api/app/service-requests/mine"],
      });

      if (created?.id) {
        pushCityBuddyBookingEvent({
          citybuddySessionId,
          serviceRequestId: String(created.id),
          title: created?.title ?? null,
          status: String(created?.status ?? "pending"),
        });
      }

      toast({
        title: "Request submitted",
        description: "Your artisan repair request has been submitted.",
      });
      setAiResult(null);
      setLocation("/resident");
    },
    onError: (error: Error) => {
      toast({
        title: "Submission failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: ArtisanRequestFormData) => {
    submitRequestMutation.mutate(data);
  };

  const handleCityBuddyDiagnosis = form.handleSubmit(async () => {
    form.setValue("diagnosisType", "regular");
    try {
      await diagnoseMutation.mutateAsync();
    } catch {
      // allow user to continue even when AI preview fails
    }
  });

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setUploadedImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Primary Left Sidebar - Collapsible */}
      <div className={`${sidebarCollapsed ? 'w-16' : 'w-16'} bg-emerald-700 flex flex-col items-center py-6 space-y-6 transition-all duration-300`}>
        <div className="w-10 h-10 bg-yellow-400 rounded-lg flex items-center justify-center">
          <MapPin className="w-6 h-6 text-emerald-800" />
        </div>
        
        <nav className="flex-1 flex flex-col items-center space-y-4">
          <Link href="/resident">
            <button className="w-10 h-10 rounded-lg hover:bg-emerald-600 flex items-center justify-center transition-colors">
              <Home className="w-5 h-5 text-white" />
            </button>
          </Link>
          <button className="w-10 h-10 rounded-lg hover:bg-emerald-600 flex items-center justify-center transition-colors">
            <BarChart3 className="w-5 h-5 text-white" />
          </button>
          <button className="w-10 h-10 rounded-lg hover:bg-emerald-600 flex items-center justify-center transition-colors">
            <Layers className="w-5 h-5 text-white" />
          </button>
          <button className="w-10 h-10 rounded-lg hover:bg-emerald-600 flex items-center justify-center transition-colors">
            <FileText className="w-5 h-5 text-white" />
          </button>
          <button className="w-10 h-10 rounded-lg hover:bg-emerald-600 flex items-center justify-center transition-colors">
            <Flag className="w-5 h-5 text-white" />
          </button>
          <button className="w-10 h-10 rounded-lg hover:bg-emerald-600 flex items-center justify-center transition-colors">
            <Users className="w-5 h-5 text-white" />
          </button>
        </nav>

        <div className="flex flex-col items-center space-y-4">
          <button className="w-10 h-10 rounded-lg hover:bg-emerald-600 flex items-center justify-center transition-colors">
            <Settings className="w-5 h-5 text-white" />
          </button>
          <button className="w-10 h-10 rounded-lg hover:bg-emerald-600 flex items-center justify-center transition-colors">
            <HelpCircle className="w-5 h-5 text-white" />
          </button>
          <div className="w-10 h-10 rounded-full bg-emerald-600 flex items-center justify-center">
            <span className="text-white text-sm font-semibold">OR</span>
          </div>
        </div>
      </div>

      {/* Secondary Left Navigation */}
      <div className="w-60 bg-emerald-800 text-white flex flex-col">
        <div className="p-4 border-b border-emerald-700">
          <Link href="/resident">
            <button className="flex items-center text-white/80 hover:text-white transition-colors">
              <ChevronLeft className="w-5 h-5 mr-1" />
              <span className="text-sm">Book a Service</span>
            </button>
          </Link>
        </div>

        <nav className="flex-1 py-4">
          <Link href="/service-categories">
            <button className="w-full px-4 py-3 flex items-center space-x-3 text-white hover:bg-emerald-700 transition-colors">
              <Wrench className="w-5 h-5" />
              <span>Service Categories</span>
              <Badge className="ml-auto bg-white text-emerald-800 text-xs">40</Badge>
            </button>
          </Link>
          
          <Link href="/book-artisan">
            <button className="w-full px-4 py-3 flex items-center space-x-3 bg-emerald-700 text-white">
              <Wrench className="w-5 h-5" />
              <span>Book Repairs</span>
            </button>
          </Link>

          <button className="w-full px-4 py-3 flex items-center space-x-3 text-white hover:bg-emerald-700 transition-colors">
            <Clock className="w-5 h-5" />
            <span>Schedule Maintenance</span>
          </button>

          <button className="w-full px-4 py-3 flex items-center space-x-3 text-white hover:bg-emerald-700 transition-colors">
            <Shirt className="w-5 h-5" />
            <span>Do your Laundry</span>
          </button>
        </nav>

        <div className="p-4 border-t border-emerald-700">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-full bg-emerald-600 flex items-center justify-center">
              <span className="text-white text-sm font-semibold">
                {user?.name?.charAt(0) || 'O'}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user?.name || 'Olivia Rhye'}</p>
              <p className="text-xs text-white/60 truncate">{user?.email || 'olivia@untitledui.com'}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto p-8">
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Book for Repairs</h1>
            <p className="text-gray-600">Find the right professional for your repair needs</p>
          </div>

          <Card className="border-0 shadow-sm">
            <CardContent className="p-8">
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  {/* Title and Service Category Row */}
                  <div className="grid grid-cols-2 gap-6">
                    <FormField
                      control={form.control}
                      name="title"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm font-medium text-gray-700">Title</FormLabel>
                          <FormControl>
                            <Input 
                              placeholder="Enter request title" 
                              className="bg-gray-50 border-gray-200"
                              {...field} 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="category"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm font-medium text-gray-700">Service Categories</FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            value={field.value}
                            disabled={isCategoriesLoading}
                          >
                            <FormControl>
                              <SelectTrigger className="bg-gray-50 border-gray-200">
                                <SelectValue placeholder="Select a service category" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {categoryOptions.map((category: any) => (
                                <SelectItem key={category.value} value={category.value}>
                                  <span className="mr-2">{category.emoji}</span>
                                  {category.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Urgency Level */}
                  <FormField
                    control={form.control}
                    name="urgency"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-medium text-gray-700">Urgency Level</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          value={field.value}
                        >
                          <FormControl>
                            <SelectTrigger className="bg-gray-50 border-gray-200">
                              <SelectValue placeholder="Select urgency level" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="low">
                              <div className="flex flex-col">
                                <span>🟢 Low</span>
                                <span className="text-xs text-muted-foreground">Resolve in a week or more</span>
                              </div>
                            </SelectItem>
                            <SelectItem value="medium">
                              <div className="flex flex-col">
                                <span>🟡 Medium</span>
                                <span className="text-xs text-muted-foreground">Resolve in 3–5 days</span>
                              </div>
                            </SelectItem>
                            <SelectItem value="high">
                              <div className="flex flex-col">
                                <span>🟠 High</span>
                                <span className="text-xs text-muted-foreground">Resolve in 1–2 days</span>
                              </div>
                            </SelectItem>
                            <SelectItem value="emergency">
                              <div className="flex flex-col">
                                <span>🔴 Emergency</span>
                                <span className="text-xs text-muted-foreground">Resolve within 12–24 hours</span>
                              </div>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Image Upload */}
                  <div>
                    <FormLabel className="text-sm font-medium text-gray-700 mb-2 block">
                      Upload Image
                    </FormLabel>
                    <div className="border-2 border-dashed border-gray-200 rounded-lg p-8 text-center bg-gray-50">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageUpload}
                        className="hidden"
                        id="image-upload"
                      />
                      <label htmlFor="image-upload" className="cursor-pointer">
                        <Upload className="w-10 h-10 text-gray-400 mx-auto mb-3" />
                        <p className="text-sm text-gray-600 mb-1">
                          <span className="text-emerald-600 font-medium">Click to upload</span> or drag and drop
                        </p>
                        <p className="text-xs text-gray-500">
                          SVG, PNG, JPG or GIF (max. 800x400px)
                        </p>
                      </label>
                      {uploadedImage && (
                        <div className="mt-4">
                          <img src={uploadedImage} alt="Uploaded" className="max-h-40 mx-auto rounded" />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Description with Toolbar */}
                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-medium text-gray-700">
                          Description of Issues
                        </FormLabel>
                        <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
                          <div className="flex items-center gap-1 px-3 py-2 border-b border-gray-200 bg-gray-50">
                            <button type="button" className="p-1.5 hover:bg-gray-200 rounded">
                              <Bold className="w-4 h-4 text-gray-600" />
                            </button>
                            <button type="button" className="p-1.5 hover:bg-gray-200 rounded">
                              <Italic className="w-4 h-4 text-gray-600" />
                            </button>
                            <button type="button" className="p-1.5 hover:bg-gray-200 rounded">
                              <Link2 className="w-4 h-4 text-gray-600" />
                            </button>
                            <button type="button" className="p-1.5 hover:bg-gray-200 rounded">
                              <List className="w-4 h-4 text-gray-600" />
                            </button>
                            <button type="button" className="p-1.5 hover:bg-gray-200 rounded">
                              <ListOrdered className="w-4 h-4 text-gray-600" />
                            </button>
                          </div>
                          <FormControl>
                            <Textarea
                              placeholder="Describe the issue and what needs fixing"
                              className="resize-none border-0 focus-visible:ring-0 min-h-[120px]"
                              {...field}
                            />
                          </FormControl>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">Provide a clear description of the problem</p>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Preferred Date and Time */}
                  <div className="grid grid-cols-2 gap-6">
                    <FormField
                      control={form.control}
                      name="preferredDate"
                      render={({ field }) => {
                        const renderCalendarGrid = () => {
                          const base = calendarBase || (field.value ? new Date(field.value) : new Date());
                          const year = base.getFullYear();
                          const month = base.getMonth();
                          const firstDay = new Date(year, month, 1);
                          const startOffset = firstDay.getDay();
                          const daysInMonth = new Date(year, month + 1, 0).getDate();
                          const cells: Array<null | number> = [];
                          for (let i = 0; i < startOffset; i++) cells.push(null);
                          for (let d = 1; d <= daysInMonth; d++) cells.push(d);

                          return (
                            <div className="grid grid-cols-7 gap-1">
                              {cells.map((day, idx) => {
                                const isEmpty = day === null;
                                const cellDate = isEmpty ? null : new Date(year, month, day as number);
                                const cellVal = cellDate ? formatDateForInput(cellDate) : '';
                                const isSelected = field.value === cellVal;
                                const isToday = cellDate && formatDateForInput(cellDate) === formatDateForInput(new Date());
                                return (
                                  <button
                                    key={idx}
                                    onClick={() => {
                                      if (!cellDate) return;
                                      // debug: log value being passed
                                      field.onChange(cellVal);
                                      // debug logging removed
                                      // ensure react-hook-form internal state is also set on the form instance
                                      try {
                                        form.setValue("preferredDate", cellVal);
                                      } catch (e) {}
                                      setCalendarBase(new Date(year, month, 1));
                                      setDateOpen(false);
                                      // log DOM input value shortly after change
                                      setTimeout(() => {
                                        try {
                                            // debug logging removed
                                        } catch (e) {
                                          // ignore
                                        }
                                      }, 50);
                                    }}
                                    className={`h-8 flex items-center justify-center rounded ${isEmpty ? 'opacity-30 pointer-events-none' : 'hover:bg-gray-100'} ${isSelected ? 'bg-primary text-primary-foreground' : ''} ${isToday && !isSelected ? 'border border-muted' : ''}`}
                                  >
                                    {cellDate ? <span className="text-sm">{cellDate.getDate()}</span> : null}
                                  </button>
                                );
                              })}
                            </div>
                          );
                        };

                        return (
                          <FormItem>
                            <FormLabel className="text-sm font-medium text-gray-700">Preferred Date</FormLabel>
                            <FormControl>
                              <div className="relative">
                                <Input
                                  type="date"
                                  className="bg-gray-50 border-gray-200 pr-10 date-time-input"
                                  {...field}
                                  ref={preferredDateRef}
                                  placeholder="Select preferred date"
                                />
                                <Popover open={dateOpen} onOpenChange={(open) => {
                                  setDateOpen(open);
                                  if (open) setCalendarBase(field.value ? new Date(field.value) : new Date());
                                }}>
                                  <PopoverTrigger asChild>
                                    <button className="absolute right-3 top-1/2 -translate-y-1/2">
                                      <Calendar className="w-4 h-4 text-gray-400 cursor-pointer" />
                                    </button>
                                  </PopoverTrigger>
                                  <PopoverContent className="w-80 p-3">
                                    <div className="flex items-center gap-2 mb-2">
                                      <Select value={String(calendarBase.getMonth())} onValueChange={(v) => {
                                        const m = Number(v);
                                        setCalendarBase((prev) => new Date(prev.getFullYear(), m, 1));
                                      }}>
                                        <SelectTrigger className="w-36">
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {Array.from({ length: 12 }).map((_, i) => (
                                            <SelectItem key={i} value={String(i)}>{new Date(0, i).toLocaleString(undefined, { month: 'long' })}</SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                      <Select value={String(calendarBase.getFullYear())} onValueChange={(v) => {
                                        const y = Number(v);
                                        setCalendarBase((prev) => new Date(y, prev.getMonth(), 1));
                                      }}>
                                        <SelectTrigger className="w-28">
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {Array.from({ length: 11 }).map((_, i) => {
                                            const y = new Date().getFullYear() - 5 + i;
                                            return <SelectItem key={y} value={String(y)}>{String(y)}</SelectItem>;
                                          })}
                                        </SelectContent>
                                      </Select>
                                      <Button size="sm" variant="outline" onClick={() => {
                                        const today = new Date();
                                        field.onChange(formatDateForInput(today));
                                        // debug logging removed
                                        try { form.setValue("preferredDate", formatDateForInput(today)); } catch (e) {}
                                        setCalendarBase(new Date(today.getFullYear(), today.getMonth(), 1));
                                        setDateOpen(false);
                                        setTimeout(() => {
                                          try {
                                            // debug logging removed
                                          } catch (e) {}
                                        }, 50);
                                      }}>Today</Button>
                                    </div>

                                    {/* Weekday headers */}
                                    <div className="grid grid-cols-7 gap-1 text-xs text-muted-foreground mb-1">
                                      {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => (
                                        <div key={d} className="text-center">{d}</div>
                                      ))}
                                    </div>

                                    {/* Calendar grid for current month */}
                                    {renderCalendarGrid()}
                                  </PopoverContent>
                                </Popover>
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        );
                      }}
                    />

                    <FormField
                      control={form.control}
                      name="preferredTime"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm font-medium text-gray-700">Preferred Time</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Input
                                type="time"
                                className="bg-gray-50 border-gray-200 pr-10 date-time-input"
                                {...field}
                                ref={preferredTimeRef}
                                  placeholder="Select preferred time"
                              />
                              <Popover open={timeOpen} onOpenChange={(open) => {
                                setTimeOpen(open);
                                if (open) {
                                  // scroll to selected time after opening
                                  setTimeout(() => {
                                    try {
                                      const container = timeListRef.current;
                                      if (!container) return;
                                      const sel = container.querySelector('[data-selected="true"]') as HTMLElement | null;
                                      if (sel) {
                                        container.scrollTop = sel.offsetTop - container.clientHeight / 2 + sel.clientHeight / 2;
                                      } else {
                                        // scroll to current time slot if available
                                        const now = preferredTimeRef.current?.value;
                                        const fallback = now ? container.querySelector(`[data-value="${now}"]`) as HTMLElement | null : null;
                                        if (fallback) container.scrollTop = fallback.offsetTop - container.clientHeight / 2 + fallback.clientHeight / 2;
                                      }
                                    } catch (e) {
                                      // ignore
                                    }
                                  }, 50);
                                }
                              }}>
                                <PopoverTrigger asChild>
                                  <button className="absolute right-3 top-1/2 -translate-y-1/2">
                                    <Clock className="w-4 h-4 text-gray-400 cursor-pointer" />
                                  </button>
                                </PopoverTrigger>
                                <PopoverContent className="w-48 p-1">
                                  <div ref={timeListRef} className="max-h-48 overflow-y-auto p-2 space-y-2">
                                      {(() => {
                                      const slots = generateTimeSlots(0, 24, 30, true);
                                      const grouped: Record<string, string[]> = {};
                                      slots.forEach(s => {
                                        const hour = s.split(':')[0];
                                        if (!grouped[hour]) grouped[hour] = [];
                                        grouped[hour].push(s);
                                      });
                                      return Object.keys(grouped).map(hour => (
                                        <div key={hour} className="space-y-1">
                                          <div className="text-xs text-muted-foreground px-2">{`${hour}:00`}</div>
                                          <div className="grid grid-cols-2 gap-2 px-1">
                                            {grouped[hour].map(t => {
                                              const selected = field.value === t;
                                              return (
                                                <button
                                                  key={t}
                                                  data-value={t}
                                                  data-selected={selected}
                                                  onClick={() => {
                                                      // debug: log value being passed
                                                      field.onChange(t);
                                                      // debug logging removed
                                                      try { form.setValue("preferredTime", t); } catch (e) {}
                                                      setTimeOpen(false);
                                                      preferredTimeRef.current?.focus();
                                                      setTimeout(() => {
                                                        try {
                                                          // debug logging removed
                                                        } catch (e) {}
                                                      }, 50);
                                                    }}
                                                  className={`text-left p-2 rounded ${selected ? 'bg-primary text-primary-foreground' : 'hover:bg-gray-100'}`}
                                                >
                                                  {t}
                                                </button>
                                              );
                                            })}
                                          </div>
                                        </div>
                                      ));
                                    })()}
                                  </div>
                                </PopoverContent>
                              </Popover>
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Special Instructions */}
                  <FormField
                    control={form.control}
                    name="specialInstructions"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-medium text-gray-700">
                          Special Instructions (Optional)
                        </FormLabel>
                        <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
                          <div className="flex items-center gap-1 px-3 py-2 border-b border-gray-200 bg-gray-50">
                            <button type="button" className="p-1.5 hover:bg-gray-200 rounded">
                              <Bold className="w-4 h-4 text-gray-600" />
                            </button>
                            <button type="button" className="p-1.5 hover:bg-gray-200 rounded">
                              <Italic className="w-4 h-4 text-gray-600" />
                            </button>
                            <button type="button" className="p-1.5 hover:bg-gray-200 rounded">
                              <Link2 className="w-4 h-4 text-gray-600" />
                            </button>
                            <button type="button" className="p-1.5 hover:bg-gray-200 rounded">
                              <List className="w-4 h-4 text-gray-600" />
                            </button>
                            <button type="button" className="p-1.5 hover:bg-gray-200 rounded">
                              <ListOrdered className="w-4 h-4 text-gray-600" />
                            </button>
                          </div>
                          <FormControl>
                            <Textarea
                                  placeholder="Add any special instructions for the artisan"
                              className="resize-none border-0 focus-visible:ring-0 min-h-[120px]"
                              {...field}
                            />
                          </FormControl>
                        </div>
                            <p className="text-xs text-gray-500 mt-1">Optional: share preferences or access details</p>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Professional Servicing Toggle */}
                  <FormField
                    control={form.control}
                    name="professionalServicing"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between border border-gray-200 rounded-lg p-4 bg-gray-50">
                        <div>
                          <FormLabel className="text-sm font-medium text-gray-900 cursor-pointer">
                            Professional Servicing
                          </FormLabel>
                          <p className="text-xs text-gray-500 mt-1">
                            Enable professional servicing for this request
                          </p>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  {/* Action Buttons */}
                  <div className="flex gap-4 pt-4">
                    <Button
                      type="button"
                      variant="outline"
                      className="flex-1 border-gray-300 text-gray-700"
                      onClick={() => setLocation("/resident")}
                    >
                      Cancel
                    </Button>

                    {/* CityBuddy Diagnosis (uses diagnosisType = "regular" under the hood) */}
                    <Button
                      type="button"
                      variant="outline"
                      className="flex-1 border-emerald-600 text-emerald-600 hover:bg-emerald-50"
                      disabled={
                        submitRequestMutation.isPending ||
                        diagnoseMutation.isPending ||
                        !canRequestDiagnosis
                      }
                      onClick={handleCityBuddyDiagnosis}
                    >
                      <div className="flex flex-col items-center">
                        <span className="font-medium">CityBuddy Diagnosis (Free)</span>
                        <span className="text-xs opacity-75">
                          ? AI-powered prediction & repair guidance
                        </span>
                      </div>
                    </Button>

                    {/* Professional Diagnosis (paid) */}
                    <Button
                      type="button"
                      className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                      onClick={() => setLocation("/checkout-diagnosis")}
                    >
                      <div className="flex flex-col items-center">
                        <span className="font-medium">Request Professional Diagnosis (?6,000)</span>
                        <span className="text-xs opacity-90">
                          ? 100% Certainty, Shorter repair duration
                        </span>
                      </div>
                    </Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>
          {isAiPanelOpen && (
            <>
              <div
                className="fixed inset-0 bg-black/30 z-40"
                onClick={() => {
                  if (!diagnoseMutation.isPending) {
                    setIsAiPanelOpen(false);
                  }
                }}
              />
              <div
                className={cn(
                  "fixed inset-y-0 right-0 z-50 w-full max-w-md bg-white shadow-xl border-l border-gray-200 transform transition-transform duration-300",
                  isAiPanelOpen ? "translate-x-0" : "translate-x-full"
                )}
              >
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-emerald-500" />
                    <div>
                      <p className="text-sm font-semibold text-gray-900">CityBuddy Diagnosis</p>
                      <p className="text-xs text-gray-500">Early insight into what might be wrong and what to do next.</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">
                      CityBuddy • AI
                    </span>
                    <button
                      type="button"
                      onClick={() => !diagnoseMutation.isPending && setIsAiPanelOpen(false)}
                      className="rounded-full p-1 hover:bg-gray-100"
                    >
                      <X className="w-4 h-4 text-gray-500" />
                    </button>
                  </div>
                </div>

                <div className="flex flex-col h-full">
                  <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 text-sm">
                    {aiMessages.map((message) => {
                      const isAssistant = message.role === "assistant";
                      const alignment = isAssistant ? "justify-start" : "justify-end";
                      const bubbleClass = isAssistant
                        ? message.variant === "warning"
                          ? "bg-rose-50 border border-rose-100 text-rose-800"
                          : "bg-emerald-50 border border-emerald-100 text-gray-800"
                        : "bg-white border border-gray-200 text-gray-800";

                      return (
                        <div key={message.id} className={`flex ${alignment}`}>
                          {isAssistant ? (
                            <div className="flex items-start gap-2">
                              <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center">
                                <Bot className="w-4 h-4 text-emerald-700" />
                              </div>
                              <div className={`rounded-2xl px-4 py-3 text-xs whitespace-pre-line ${bubbleClass}`}>
                                {message.variant === "warning" && (
                                  <div className="flex items-center gap-1 mb-1 text-[11px] font-semibold">
                                    <AlertTriangle className="w-3 h-3 text-rose-500" />
                                    CityBuddy caution
                                  </div>
                                )}
                                <p className="whitespace-pre-line">{message.content}</p>
                              </div>
                            </div>
                          ) : (
                            <div className="flex flex-row-reverse items-start gap-2">
                              <div className="w-8 h-8 rounded-full bg-gray-200" />
                              <div className={`rounded-2xl px-4 py-3 text-xs whitespace-pre-line ${bubbleClass}`}>
                                <p className="whitespace-pre-line">{message.content}</p>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {diagnoseMutation.isPending && (
                      <div className="flex items-start gap-2">
                        <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center">
                          <Bot className="w-4 h-4 text-emerald-700" />
                        </div>
                        <div className="bg-emerald-50 border border-emerald-100 rounded-2xl px-4 py-3">
                          <div className="flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-bounce" />
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-bounce delay-150" />
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-bounce delay-300" />
                          </div>
                          <p className="text-xs text-emerald-800 mt-2">
                            CityBuddy is analyzing your issue…
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="border-t border-gray-200 px-5 py-3 space-y-2">
                    {aiResult &&
                    (aiResult.shouldAvoidDIY ||
                      aiResult.severity === "high" ||
                      aiResult.severity === "critical") ? (
                      <div className="flex items-center gap-3 rounded-xl bg-rose-50 border border-rose-200 px-3 py-2">
                        <div className="flex-1">
                          <p className="text-xs font-semibold text-rose-700">This issue looks sensitive.</p>
                          <p className="text-[11px] text-rose-600">
                            CityBuddy recommends a professional diagnosis to avoid further damage or safety risk.
                          </p>
                        </div>
                        <Button
                          size="sm"
                          className="bg-emerald-600 hover:bg-emerald-700 text-white whitespace-nowrap"
                          onClick={() => setLocation("/checkout-diagnosis")}
                        >
                          Request Professional Diagnosis
                        </Button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="text-[11px] text-emerald-700 hover:underline"
                        onClick={() => setLocation("/checkout-diagnosis")}
                      >
                        Still not sure? Request professional diagnosis
                      </button>
                    )}
                    <p className="text-[10px] text-gray-500">
                      CityBuddy is an AI assistant for guidance only. For electrical, gas, structural, or major water leak issues,
                      always use a verified professional and follow estate safety rules.
                    </p>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
