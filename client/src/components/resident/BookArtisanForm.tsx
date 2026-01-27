import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
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
import { Label } from "@/components/ui/label";

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

const formSchema = z.object({
  category: z.string().min(1, "Select a category"),
  description: z.string().min(5, "Describe the issue (min 5 chars)"),
  urgency: z.enum(["low", "medium", "high"]).default("medium"),
  budget: z.union([z.string(), z.number()]).optional(),
  location: z.string().optional(),
  preferredTime: z.string().optional(), // "YYYY-MM-DDTHH:mm"
  specialInstructions: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

export default function BookArtisanForm() {
  const { toast } = useToast();
  const citybuddySessionId = (() => {
    if (typeof window === "undefined") return null;
    return new URLSearchParams(window.location.search).get("citybuddySessionId");
  })();
  const preselectedProviderId = (() => {
    if (typeof window === "undefined") return null;
    return new URLSearchParams(window.location.search).get("providerId");
  })();
  const preselectedProviderName = (() => {
    if (typeof window === "undefined") return null;
    return new URLSearchParams(window.location.search).get("providerName");
  })();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      category: "",
      description: "",
      urgency: "medium",
      budget: "",
      location: "",
      preferredTime: "",
      specialInstructions: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: FormValues) => {
      const payload = {
        category: data.category,
        description: data.description,
        urgency: data.urgency,
        budget:
          data.budget === "" || data.budget === undefined
            ? undefined
            : Number(data.budget),
        location: data.location || undefined,
        preferredTime: data.preferredTime
          ? new Date(data.preferredTime).toISOString()
          : undefined,
        providerId: preselectedProviderId ?? undefined,
        specialInstructions: data.specialInstructions || undefined,
      };
      const res = await apiRequest("POST", "/api/service-requests", payload);
      return await res.json();
    },
    onSuccess: (created: any) => {
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
        description: "Your service request was created successfully.",
      });
      // refresh any resident views of requests
      queryClient.invalidateQueries({ queryKey: ["/api/service-requests"] });
      queryClient.invalidateQueries({ queryKey: ["/api/service-requests?me=1"] });
      form.reset({
        category: "",
        description: "",
        urgency: "medium",
        budget: "",
        location: "",
        preferredTime: "",
        specialInstructions: "",
      });
    },
    onError: (err: any) => {
      toast({
        title: "Submit failed",
        description:
          (err?.message || "Unknown error").slice(0, 160),
        variant: "destructive",
      });
    },
  });

  const onSubmit = (values: FormValues) => createMutation.mutate(values);

  return (
    <Card>
      <CardHeader>
        <div className="text-lg font-semibold">Book an Artisan</div>
      </CardHeader>
      <CardContent>
        {preselectedProviderName ? (
          <div className="mb-4 rounded-md border bg-muted p-3">
            <div className="text-sm text-muted-foreground">Selected provider</div>
            <div className="font-medium text-foreground">{preselectedProviderName}</div>
            <div className="mt-1 text-xs text-muted-foreground">Pre-selected only — you still confirm when submitting.</div>
          </div>
        ) : null}
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="space-y-4"
          noValidate
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Category */}
            <div>
              <Label>Category</Label>
              <Select
                onValueChange={(v) => form.setValue("category", v)}
                value={form.watch("category")}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a category" />
                </SelectTrigger>
                <SelectContent>
                  {/* Keys should match your backend categories */}
                  <SelectItem value="surveillance_monitoring">Surveillance monitoring</SelectItem>
                  <SelectItem value="cleaning_janitorial">Cleaning & janitorial</SelectItem>
                  <SelectItem value="catering_services">Catering Services</SelectItem>
                  <SelectItem value="it_support">IT Support</SelectItem>
                  <SelectItem value="maintenance_repair">Maintenance & Repair</SelectItem>
                  <SelectItem value="marketing_advertising">Marketing & Advertising</SelectItem>
                  <SelectItem value="home_tutors">Home tutors</SelectItem>
                  <SelectItem value="furniture_making">Furniture making</SelectItem>
                </SelectContent>
              </Select>
              {form.formState.errors.category && (
                <p className="text-xs text-red-600 mt-1">
                  {form.formState.errors.category.message}
                </p>
              )}
            </div>

            {/* Urgency */}
            <div>
              <Label>Urgency</Label>
              <Select
                onValueChange={(v) => form.setValue("urgency", v as any)}
                value={form.watch("urgency")}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Budget */}
            <div>
              <Label>Budget (₦)</Label>
              <Input
                inputMode="numeric"
                placeholder="e.g. 60000"
                value={String(form.watch("budget") ?? "")}
                onChange={(e) => form.setValue("budget", e.target.value)}
              />
            </div>

            {/* Preferred Time */}
            <div>
              <Label>Preferred Time</Label>
              <Input
                type="datetime-local"
                value={form.watch("preferredTime") || ""}
                onChange={(e) => form.setValue("preferredTime", e.target.value)}
              />
            </div>

            {/* Location */}
            <div className="md:col-span-2">
              <Label>Location / Address</Label>
              <Input
                placeholder="Where should the artisan come?"
                value={form.watch("location") || ""}
                onChange={(e) => form.setValue("location", e.target.value)}
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <Label>Description</Label>
            <Textarea
              placeholder="Describe the issue..."
              rows={4}
              value={form.watch("description")}
              onChange={(e) => form.setValue("description", e.target.value)}
            />
            {form.formState.errors.description && (
              <p className="text-xs text-red-600 mt-1">
                {form.formState.errors.description.message}
              </p>
            )}
          </div>

          {/* Special Instructions */}
          <div>
            <Label>Special Instructions (optional)</Label>
            <Textarea
              rows={3}
              value={form.watch("specialInstructions") || ""}
              onChange={(e) =>
                form.setValue("specialInstructions", e.target.value)
              }
            />
          </div>

          <div className="flex gap-2">
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? "Submitting..." : "Submit"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => form.reset()}
              disabled={createMutation.isPending}
            >
              Reset
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
