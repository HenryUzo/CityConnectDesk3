// client/src/pages/book-artisan.tsx
import { useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
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
import { ArrowLeft, Wrench, LogOut } from "lucide-react";
// 👇 uses the resident API wrapper that sends cookies & supports x-user-email
import { residentFetch, ResidentAPI } from "@/lib/residentApi";

const artisanRequestSchema = z.object({
  category: z.enum([
    "electrician",
    "plumber",
    "carpenter",
    "hvac_technician",
    "painter",
    "tiler",
    "mason",
    "roofer",
    "gardener",
    "cleaner",
    "security_guard",
    "cook",
    "laundry_service",
    "pest_control",
    "welder",
    "mechanic",
    "phone_repair",
    "appliance_repair",
    "tailor",
    "market_runner",
  ]),
  description: z.string().min(10, "Description must be at least 10 characters"),
  urgency: z.enum(["low", "medium", "high", "emergency"]),
  budget: z.string().min(1, "Budget range is required"),
  location: z.object({
    address: z.string().min(1, "Location is required"),
    latitude: z.number().optional(),
    longitude: z.number().optional(),
  }),
  preferredTime: z.string().optional(),
  specialInstructions: z.string().optional(),
});

type ArtisanRequestFormData = z.infer<typeof artisanRequestSchema>;

export default function BookArtisan() {
  const { user, logoutMutation } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  // In dev (or when cookies aren't set yet), use the email header fallback automatically.
  useEffect(() => {
    if (user?.email) {
      localStorage.setItem("resident_email_dev", user.email);
    }
  }, [user?.email]);

  const form = useForm<ArtisanRequestFormData>({
    resolver: zodResolver(artisanRequestSchema),
    defaultValues: {
      category: "electrician",
      description: "",
      urgency: "medium",
      budget: "",
      location: {
        address: "",
        latitude: undefined,
        longitude: undefined,
      },
      preferredTime: "",
      specialInstructions: "",
    },
  });

  const submitRequestMutation = useMutation({
    mutationFn: async (data: ArtisanRequestFormData) => {
      // shape for server
      const payload = {
        category: data.category,
        description: data.description,
        urgency: data.urgency,
        budget: data.budget,
        location: data.location.address,
        latitude: data.location.latitude ?? null,
        longitude: data.location.longitude ?? null,
        preferredTime: data.preferredTime
          ? new Date(data.preferredTime).toISOString()
          : null,
        specialInstructions: data.specialInstructions || null,
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

  const handleLogout = async () => {
    await logoutMutation.mutateAsync();
    // clear dev header fallback
    localStorage.removeItem("resident_email_dev");
    setLocation("/");
  };

  const onSubmit = (data: ArtisanRequestFormData) => {
    submitRequestMutation.mutate(data);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="bg-card shadow-sm border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-bold text-primary">CityConnect</h1>
              <span className="ml-2 sm:ml-3 text-xs sm:text-sm text-muted-foreground truncate">
                Book Artisan
              </span>
            </div>
            <div className="flex items-center space-x-2 sm:space-x-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLogout}
                className="h-9 w-9 p-0"
                data-testid="button-logout"
              >
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
        <div className="mb-4 sm:mb-6">
          <Button
            variant="ghost"
            onClick={() => setLocation("/resident")}
            className="mb-4 h-11 min-h-[44px] px-4"
            data-testid="button-back-dashboard"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
          <div className="flex flex-col sm:flex-row sm:items-center mb-4 space-y-3 sm:space-y-0">
            <Wrench className="w-8 h-8 text-primary mr-0 sm:mr-3" />
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
                Book Artisan Repair
              </h1>
              <p className="text-sm sm:text-base text-muted-foreground mt-1 sm:mt-2">
                Find the right professional for your repair needs
              </p>
            </div>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Service Request Details</CardTitle>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 sm:space-y-6">
                <FormField
                  control={form.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Service Category</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger
                            data-testid="select-service-category"
                            className="h-12 min-h-[44px] text-base"
                          >
                            <SelectValue placeholder="Select a category" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
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
                          <SelectItem value="security_guard">Security Guard</SelectItem>
                          <SelectItem value="cook">Cook</SelectItem>
                          <SelectItem value="laundry_service">Laundry Service</SelectItem>
                          <SelectItem value="pest_control">Pest Control</SelectItem>
                          <SelectItem value="welder">Welder</SelectItem>
                          <SelectItem value="mechanic">Mechanic</SelectItem>
                          <SelectItem value="phone_repair">Phone Repair</SelectItem>
                          <SelectItem value="appliance_repair">Appliance Repair</SelectItem>
                          <SelectItem value="tailor">Tailor</SelectItem>
                          <SelectItem value="market_runner">Market Runner</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description of Work Needed</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Describe the repair or service you need in detail..."
                          className="min-h-[100px] text-base"
                          data-testid="textarea-description"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                  <FormField
                    control={form.control}
                    name="urgency"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Urgency Level</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger
                              data-testid="select-urgency"
                              className="h-12 min-h-[44px] text-base"
                            >
                              <SelectValue placeholder="Select urgency" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="low">Low - Within a week</SelectItem>
                            <SelectItem value="medium">Medium - Within 2-3 days</SelectItem>
                            <SelectItem value="high">High - Within 24 hours</SelectItem>
                            <SelectItem value="emergency">Emergency - ASAP</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="budget"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Budget Range (₦)</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="e.g., 5,000 - 10,000"
                            className="h-12 min-h-[44px] text-base"
                            data-testid="input-budget"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="location"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Location (Block/Flat)</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g., Block 5, Flat 3B"
                          value={field.value.address}
                          onChange={(e) =>
                            field.onChange({
                              address: e.target.value,
                              latitude: undefined,
                              longitude: undefined,
                            })
                          }
                          className="h-12 min-h-[44px] text-base"
                          data-testid="input-location"
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
                      <FormLabel>Preferred Date & Time (Optional)</FormLabel>
                      <FormControl>
                        <Input
                          type="datetime-local"
                          className="h-12 min-h-[44px] text-base"
                          data-testid="input-preferred-time"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="specialInstructions"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Special Instructions (Optional)</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Any additional notes, access instructions, or specific requirements..."
                          className="min-h-[80px] text-base"
                          data-testid="textarea-special-instructions"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setLocation("/resident")}
                    className="flex-1 h-12 min-h-[44px] text-base"
                    data-testid="button-cancel"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={submitRequestMutation.isPending}
                    className="flex-1 h-12 min-h-[44px] text-base"
                    data-testid="button-submit-request"
                  >
                    {submitRequestMutation.isPending ? "Submitting..." : "Submit Request"}
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
