import { useAuth } from "@/hooks/use-auth";
import { useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { ArrowLeft, ShoppingBag, LogOut, Wallet } from "lucide-react";
import { LocationPicker } from "@/components/LocationPicker";

const marketRunRequestSchema = z.object({
  description: z.string().min(10, "Description must be at least 10 characters"),
  urgency: z.enum(["low", "medium", "high", "emergency"]),
  budget: z.string().min(1, "Budget range is required"),
  location: z.object({
    address: z.string().min(1, "Delivery address is required"),
    latitude: z.number().optional(),
    longitude: z.number().optional(),
  }),
  specialInstructions: z.string().optional(),
});

type MarketRunRequestFormData = z.infer<typeof marketRunRequestSchema>;

export default function BookMarketRun() {
  const { user, logoutMutation } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const form = useForm<MarketRunRequestFormData>({
    resolver: zodResolver(marketRunRequestSchema),
    defaultValues: {
      description: "",
      urgency: "medium",
      budget: "",
      location: {
        address: "",
        latitude: undefined,
        longitude: undefined,
      },
      specialInstructions: "",
    },
  });

  const submitRequestMutation = useMutation({
    mutationFn: async (data: MarketRunRequestFormData) => {
      // Transform location data for submission
      const submitData = {
        ...data,
        location: data.location.address,
        latitude: data.location.latitude,
        longitude: data.location.longitude,
        category: "market_runner",
      };
      return await apiRequest("POST", "/api/service-requests", submitData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/service-requests"] });
      toast({
        title: "Request Submitted",
        description: "Your market run request has been submitted successfully!",
      });
      setLocation("/resident");
    },
    onError: (error: Error) => {
      toast({
        title: "Submission Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleLogout = async () => {
    await logoutMutation.mutateAsync();
    setLocation("/");
  };

  const onSubmit = (data: MarketRunRequestFormData) => {
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
              <span className="ml-2 sm:ml-3 text-xs sm:text-sm text-muted-foreground truncate">Market Run</span>
            </div>
            <div className="flex items-center space-x-2 sm:space-x-4">
              <div className="hidden sm:flex items-center bg-muted rounded-lg px-3 py-1">
                <Wallet className="w-4 h-4 mr-2 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Wallet:</span>
                <span className="ml-2 font-semibold text-foreground">₦25,000</span>
              </div>
              <div className="flex sm:hidden items-center bg-muted rounded-lg px-2 py-1">
                <Wallet className="w-4 h-4 mr-1 text-muted-foreground" />
                <span className="text-xs font-semibold text-foreground">₦25k</span>
              </div>
              <Button variant="ghost" size="sm" onClick={handleLogout} className="h-9 w-9 p-0" data-testid="button-logout">
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
            <ShoppingBag className="w-8 h-8 text-secondary mr-0 sm:mr-3" />
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Request Market Run</h1>
              <p className="text-sm sm:text-base text-muted-foreground mt-1 sm:mt-2">Get your errands and shopping done with ease</p>
            </div>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Errand Request Details</CardTitle>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 sm:space-y-6">
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Detailed Request</FormLabel>
                      <FormControl>
                        <Textarea 
                          {...field} 
                          rows={3}
                          className="min-h-[88px] text-base resize-none"
                          placeholder="List items to buy, pickup/delivery addresses, or describe the errand in detail..."
                          data-testid="textarea-description"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="urgency"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>When do you need this?</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-urgency" className="h-12 min-h-[44px] text-base">
                              <SelectValue placeholder="Select timeframe" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="emergency">Today (ASAP)</SelectItem>
                            <SelectItem value="high">Tomorrow</SelectItem>
                            <SelectItem value="medium">This Week</SelectItem>
                            <SelectItem value="low">I'm Flexible</SelectItem>
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
                        <FormLabel>Estimated Budget</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-budget" className="h-12 min-h-[44px] text-base">
                              <SelectValue placeholder="Select budget" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="₦0 - ₦2,000">₦0 - ₦2,000</SelectItem>
                            <SelectItem value="₦2,000 - ₦5,000">₦2,000 - ₦5,000</SelectItem>
                            <SelectItem value="₦5,000 - ₦10,000">₦5,000 - ₦10,000</SelectItem>
                            <SelectItem value="₦10,000+">₦10,000+</SelectItem>
                          </SelectContent>
                        </Select>
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
                      <FormLabel>Delivery Address</FormLabel>
                      <FormControl>
                        <LocationPicker
                          value={field.value}
                          onChange={field.onChange}
                          placeholder="Your address for delivery (e.g., Block 3, Flat 2A) or search area"
                          className="w-full"
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
                          {...field} 
                          rows={2}
                          className="min-h-[66px] text-base resize-none"
                          placeholder="Any special requirements, preferences, or notes for the runner..."
                          data-testid="textarea-special-instructions"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="bg-muted p-3 sm:p-4 rounded-lg">
                  <h4 className="font-medium text-foreground mb-2 text-sm sm:text-base">What can our runners help with?</h4>
                  <ul className="text-xs sm:text-sm text-muted-foreground space-y-1">
                    <li>• Grocery shopping from local markets</li>
                    <li>• Pharmacy runs for medications</li>
                    <li>• Package pickup and delivery</li>
                    <li>• Document delivery to offices</li>
                    <li>• Small item purchases</li>
                  </ul>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 pt-2">
                  <Button 
                    type="button" 
                    variant="outline" 
                    className="h-12 min-h-[44px] text-base font-medium flex-1 order-2 sm:order-1"
                    onClick={() => setLocation("/resident")}
                    data-testid="button-cancel"
                  >
                    Cancel
                  </Button>
                  <Button 
                    type="submit" 
                    variant="secondary"
                    className="h-12 min-h-[44px] text-base font-medium flex-1 order-1 sm:order-2"
                    disabled={submitRequestMutation.isPending}
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
