// client/src/pages/book-artisan.tsx
import { useEffect, useMemo, useState } from "react";
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
  MapPin
} from "lucide-react";
import { residentFetch } from "@/lib/residentApi";

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

const FALLBACK_SERVICE_CATEGORIES = [
  { value: "electrician", label: "Electrician", emoji: "🔌" },
  { value: "plumber", label: "Plumber", emoji: "🔧" },
  { value: "carpenter", label: "Carpenter", emoji: "🪚" },
  { value: "hvac_technician", label: "HVAC Technician", emoji: "❄️" },
  { value: "painter", label: "Painter", emoji: "🎨" },
  { value: "tiler", label: "Tiler", emoji: "🧱" },
  { value: "mason", label: "Mason", emoji: "🧱" },
  { value: "roofer", label: "Roofer", emoji: "🏠" },
  { value: "gardener", label: "Gardener", emoji: "🌿" },
  { value: "cleaner", label: "Cleaner", emoji: "🧼" },
  { value: "security_guard", label: "Security Guard", emoji: "🛡️" },
  { value: "cook", label: "Cook", emoji: "🍳" },
  { value: "laundry_service", label: "Laundry Service", emoji: "🧺" },
  { value: "pest_control", label: "Pest Control", emoji: "🐜" },
  { value: "welder", label: "Welder", emoji: "⚙️" },
  { value: "mechanic", label: "Mechanic", emoji: "🔩" },
  { value: "phone_repair", label: "Phone Repair", emoji: "📱" },
  { value: "appliance_repair", label: "Appliance Repair", emoji: "🔌" },
  { value: "tailor", label: "Tailor", emoji: "🧵" },
  { value: "market_runner", label: "Market Runner", emoji: "🛒" },
];

type ArtisanRequestFormData = z.infer<typeof artisanRequestSchema>;

export default function BookArtisan() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);

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
      electrician: "🔌",
      plumber: "🔧",
      carpenter: "🪚",
      hvac_technician: "❄️",
      painter: "🎨",
      tiler: "🧱",
      mason: "🧱",
      roofer: "🏠",
      gardener: "🌿",
      cleaner: "🧼",
      security_guard: "🛡️",
      cook: "🍳",
      laundry_service: "🧺",
      pest_control: "🐜",
      welder: "⚙️",
      mechanic: "🔩",
      phone_repair: "📱",
      appliance_repair: "🔌",
      tailor: "🧵",
      market_runner: "🛒",
    };

    return categories.map((category: any) => {
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
    onSuccess: async () => {
      // refresh the resident's list view
      queryClient.invalidateQueries({ queryKey: ["my-requests"] });
      queryClient.invalidateQueries({
        queryKey: ["/api/app/service-requests/mine"],
      });

      toast({
        title: "Request submitted",
        description: "Your artisan repair request has been submitted.",
      });
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
                              placeholder="Artisan Bookings" 
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
                                <SelectValue placeholder="Store Owner" />
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
                              <SelectValue placeholder="Medium" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="low">🟢 Low</SelectItem>
                            <SelectItem value="medium">🟡 Medium</SelectItem>
                            <SelectItem value="high">🟠 High</SelectItem>
                            <SelectItem value="emergency">🔴 Emergency</SelectItem>
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
                              placeholder="I'm a Product Designer based in Melbourne, Australia. I specialise in UX/UI design, brand strategy, and Webflow development."
                              className="resize-none border-0 focus-visible:ring-0 min-h-[120px]"
                              {...field}
                            />
                          </FormControl>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">275 characters left</p>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Preferred Date and Time */}
                  <div className="grid grid-cols-2 gap-6">
                    <FormField
                      control={form.control}
                      name="preferredDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm font-medium text-gray-700">Preferred Date</FormLabel>
                          <FormControl>
                            <Input 
                              type="date" 
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
                      name="preferredTime"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm font-medium text-gray-700">Preferred Date</FormLabel>
                          <FormControl>
                            <Input 
                              type="time" 
                              className="bg-gray-50 border-gray-200"
                              {...field} 
                            />
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
                              placeholder="I'm a Product Designer based in Melbourne, Australia. I specialise in UX/UI design, brand strategy, and Webflow development."
                              className="resize-none border-0 focus-visible:ring-0 min-h-[120px]"
                              {...field}
                            />
                          </FormControl>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">275 characters left</p>
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
                            I'm open and available for freelance work.
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
                    <Button
                      type="submit"
                      variant="outline"
                      className="flex-1 border-emerald-600 text-emerald-600 hover:bg-emerald-50"
                      disabled={submitRequestMutation.isPending}
                      onClick={() => form.setValue('diagnosisType', 'regular')}
                    >
                      <div className="flex flex-col items-center">
                        <span className="font-medium">Regular Diagnosis (Free)</span>
                        <span className="text-xs opacity-75">⚡ 50% Certainty</span>
                      </div>
                    </Button>
                    <Button
                      type="button"
                      className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                      onClick={() => setLocation("/checkout-diagnosis")}
                    >
                      <div className="flex flex-col items-center">
                        <span className="font-medium">Request Professional Diagnosis (₦6,000)</span>
                        <span className="text-xs opacity-90">✓ 100% Certainty, Shorter repair duration</span>
                      </div>
                    </Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
