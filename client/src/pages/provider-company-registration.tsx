import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { Briefcase, CreditCard, MapPin, Shield, Eye, ArrowRight } from "lucide-react";
import { z } from "zod";

const businessTypes = [
  "Sole Proprietorship",
  "Limited Liability Company (LLC)",
  "Partnership",
  "Cooperative",
  "Social Enterprise",
  "Freelance / Personal Brand",
  "Holding Company",
  "Other",
];

const industries = [
  "Facilities Management",
  "Cleaning Services",
  "Construction",
  "Logistics & Delivery",
  "Security",
  "Hospitality",
  "Information Technology",
  "Real Estate",
  "Healthcare",
  "Manufacturing",
  "Retail",
  "Energy",
  "Agriculture",
  "Education",
];

const banks = [
  "Access Bank",
  "Zenith Bank",
  "Guaranty Trust Bank",
  "First Bank of Nigeria",
  "United Bank for Africa",
  "Fidelity Bank",
  "Stanbic IBTC Bank",
  "Union Bank",
  "FCMB",
  "Polaris Bank",
  "Ecobank",
  "Sterling Bank",
  "Keystone Bank",
  "Jaiz Bank",
  "Wema Bank",
];

const countries = [
  "Nigeria",
  "Ghana",
  "Kenya",
  "South Africa",
  "United States",
  "United Kingdom",
  "Canada",
  "United Arab Emirates",
  "Egypt",
  "India",
  "Germany",
  "France",
  "Brazil",
  "Australia",
  "Mexico",
  "Spain",
  "Italy",
  "Japan",
  "China",
  "Singapore",
  "Switzerland",
  "Netherlands",
  "Belgium",
  "Morocco",
  "Portugal",
];

const nigeriaStates = {
  Lagos: ["Ikeja", "Lekki", "Yaba", "Surulere"],
  Rivers: ["Port Harcourt", "Obio-Akpor", "Okrika", "Eleme"],
  Abuja: ["Abaji", "Bwari", "Gwagwalada", "Kuje", "Kwali"],
  Ogun: ["Abeokuta North", "Remo North", "Sagamu", "Ifo"],
};

const countryStateMap: Record<string, string[]> = {
  Nigeria: Object.keys(nigeriaStates),
};

const companySchema = z.object({
  name: z.string().min(2, "Business name is required"),
  description: z.string().max(1000).optional(),
  contactEmail: z.string().email("Provide a valid contact email"),
  phone: z.string().min(6, "Business phone is required").max(20),
  businessDetails: z.object({
    registrationNumber: z.string().min(1, "Registration number is required"),
    taxId: z.string().min(1, "Tax/TIN is required"),
    businessType: z.string().min(1, "Select a business type"),
    industry: z.string().min(1, "Select an industry"),
    yearEstablished: z
      .preprocess((value) => {
        if (value === "" || value === null || value === undefined) return undefined;
        if (typeof value === "string") {
          const parsed = Number(value);
          return Number.isNaN(parsed) ? undefined : parsed;
        }
        return value;
      }, z.number().int().min(1900).max(new Date().getFullYear()))
      .optional(),
    website: z.string().url().optional(),
  }),
  bankDetails: z.object({
    bankName: z.string().min(1, "Select a bank"),
    accountName: z.string().min(1, "Account name is required"),
    accountNumber: z.string().min(1, "Account number is required"),
    routingNumber: z.string().optional(),
    swiftCode: z.string().optional(),
    notes: z.string().optional(),
  }),
  locationDetails: z.object({
    addressLine1: z.string().min(1, "Address line 1 is required"),
    addressLine2: z.string().optional(),
    city: z.string().min(1, "City is required"),
    state: z.string().min(1, "State is required"),
    lga: z.string().min(1, "LGA is required"),
    country: z.string().min(1, "Country is required"),
    coordinates: z
      .object({
        latitude: z
          .preprocess((value) => {
            if (value === "" || value === null || value === undefined) return undefined;
            if (typeof value === "string") {
              const parsed = Number(value);
              return Number.isNaN(parsed) ? undefined : parsed;
            }
            return value;
          }, z.number())
          .optional(),
        longitude: z
          .preprocess((value) => {
            if (value === "" || value === null || value === undefined) return undefined;
            if (typeof value === "string") {
              const parsed = Number(value);
              return Number.isNaN(parsed) ? undefined : parsed;
            }
            return value;
          }, z.number())
          .optional(),
      })
      .optional(),
  }),
});

type CompanyForm = z.infer<typeof companySchema>;

const defaultValues: CompanyForm = {
  name: "",
  description: "",
  contactEmail: "",
  phone: "",
  businessDetails: {
    registrationNumber: "",
    taxId: "",
    businessType: "",
    industry: "",
    yearEstablished: new Date().getFullYear(),
    website: "",
  },
  bankDetails: {
    bankName: "",
    accountName: "",
    accountNumber: "",
    routingNumber: "",
    swiftCode: "",
    notes: "",
  },
  locationDetails: {
    addressLine1: "",
    addressLine2: "",
    city: "",
    state: "",
    lga: "",
    country: "",
    coordinates: {
      latitude: undefined,
      longitude: undefined,
    },
  },
};

export default function ProviderCompanyRegistration() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [openSections, setOpenSections] = useState({
    business: true,
    bank: false,
    location: false,
  });

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<CompanyForm>({
    resolver: zodResolver(companySchema),
    defaultValues,
  });

  const watchAll = watch();
  const selectedCountry = watch("locationDetails.country") || "";
  const selectedState = watch("locationDetails.state") || "";
  const stateOptions = countryStateMap[selectedCountry] ?? [];
  const lgaOptions = selectedCountry === "Nigeria" ? nigeriaStates[selectedState] ?? [] : [];
  const showStateSelect = stateOptions.length > 0;
  const showLgaSelect = lgaOptions.length > 0;

  const registerCompanyMutation = useMutation({
    mutationFn: (payload: CompanyForm) =>
      apiRequest("POST", "/api/provider/company-registration", payload).then((res) => res.json()),
    onSuccess: () => {
      toast({
        title: "Registration submitted",
        description: "Your company details are securely stored and pending review",
      });
      setLocation("/provider");
    },
    onError: (error: Error) => {
      toast({
        title: "Unable to submit",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const toggleSection = (key: keyof typeof openSections) => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handlePreviewEdit = (key: keyof typeof openSections) => {
    setOpenSections((prev) => ({ ...prev, [key]: true }));
  };

  const onSubmit = async (values: CompanyForm) => {
    if (registerCompanyMutation.isLoading) return;
    await registerCompanyMutation.mutateAsync(values);
  };

  const { businessDetails, bankDetails, locationDetails } = watchAll;

  return (
    <div className="min-h-screen bg-background py-10">
      <div className="max-w-6xl mx-auto px-4 space-y-8 lg:space-y-0 lg:grid lg:grid-cols-[1.4fr,0.9fr] gap-8">
        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-muted-foreground">
                Tiered registration · Provider identity
              </p>
              <h1 className="text-3xl font-semibold">Register as a Company</h1>
              <p className="text-sm text-muted-foreground">
                Collect business, bank, and location facts in a guided experience that keeps everything in one place.
              </p>
            </div>
            <Button variant="outline" onClick={() => setLocation("/provider")}>
              Back to dashboard
            </Button>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <Collapsible open={openSections.business} onOpenChange={(isOpen) => setOpenSections((prev) => ({ ...prev, business: isOpen }))}>
              <div className="rounded-2xl border border-border bg-card shadow-sm">
                <div className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    <Briefcase className="w-5 h-5" />
                    <div>
                      <p className="text-base font-semibold">Business Details</p>
                      <p className="text-xs text-muted-foreground">Tell us about the company's identity and purpose</p>
                    </div>
                  </div>
                  <CollapsibleTrigger asChild>
                    <Button size="sm" variant="ghost">
                      {openSections.business ? "Collapse" : "Expand"}
                    </Button>
                  </CollapsibleTrigger>
                </div>
                <CollapsibleContent className="px-4 pb-4 space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <Label htmlFor="name">Business Name</Label>
                      <Input id="name" {...register("name")} placeholder="e.g. Lekki Facilities" />
                      {errors.name && <p className="text-xs text-destructive mt-1">{errors.name.message}</p>}
                    </div>
                    <div>
                      <Label htmlFor="contactEmail">Primary Contact Email</Label>
                      <Input id="contactEmail" {...register("contactEmail")} placeholder="contact@business.com" />
                      {errors.contactEmail && <p className="text-xs text-destructive mt-1">{errors.contactEmail.message}</p>}
                    </div>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <Label htmlFor="phone">Business Phone</Label>
                      <Input id="phone" {...register("phone")} placeholder="+234 809 000 1234" />
                      {errors.phone && <p className="text-xs text-destructive mt-1">{errors.phone.message}</p>}
                    </div>
                    <div>
                      <Label htmlFor="description">Describe your services</Label>
                      <Textarea id="description" {...register("description")} rows={2} placeholder="Summarize how your company operates" />
                    </div>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <Label htmlFor="state">State</Label>
                      {showStateSelect ? (
                        <select
                          id="state"
                          {...register("locationDetails.state")}
                          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                        >
                          <option value="">Select state</option>
                          {stateOptions.map((state) => (
                            <option key={state} value={state}>
                              {state}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <Input id="state" {...register("locationDetails.state")} placeholder="Type your state" />
                      )}
                      {errors.locationDetails?.state && (
                        <p className="text-xs text-destructive mt-1">{errors.locationDetails.state.message}</p>
                      )}
                    </div>
                    <div>
                      <Label htmlFor="lga">LGA</Label>
                      {showLgaSelect ? (
                        <select
                          id="lga"
                          {...register("locationDetails.lga")}
                          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                        >
                          <option value="">Select LGA</option>
                          {lgaOptions.map((lga) => (
                            <option key={lga} value={lga}>
                              {lga}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <Input id="lga" {...register("locationDetails.lga")} placeholder="Type your LGA" />
                      )}
                      {errors.locationDetails?.lga && (
                        <p className="text-xs text-destructive mt-1">{errors.locationDetails.lga.message}</p>
                      )}
                    </div>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <Label htmlFor="country">Country</Label>
                      <Input
                        id="country"
                        list="country-list"
                        {...register("locationDetails.country")}
                        placeholder="Search countries"
                      />
                      <datalist id="country-list">
                        {countries.map((country) => (
                          <option key={country} value={country} />
                        ))}
                      </datalist>
                      {errors.locationDetails?.country && (
                        <p className="text-xs text-destructive mt-1">{errors.locationDetails.country.message}</p>
                      )}
                    </div>
                    <div>
                      <Label htmlFor="latitude">Latitude</Label>
                      <Input
                        id="latitude"
                        type="number"
                        step="any"
                        {...register("locationDetails.coordinates.latitude", { valueAsNumber: true })}
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="longitude">Longitude</Label>
                    <Input
                      id="longitude"
                      type="number"
                      step="any"
                      {...register("locationDetails.coordinates.longitude", { valueAsNumber: true })}
                    />
                  </div>
                </CollapsibleContent>
              </div>
            </Collapsible>

            <div className="flex justify-end">
              <Button type="submit" size="lg" className="w-full lg:w-auto" disabled={isSubmitting}>
                {registerCompanyMutation.isLoading ? "Saving..." : "Submit for review"}
              </Button>
            </div>
          </form>
        </section>

        <section className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Preview & Confirm</CardTitle>
              <p className="text-xs text-muted-foreground">
                The right-hand column keeps tabs on everything you typed so you can open the section again and tweak it instantly.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold">Business snapshot</p>
                  <p className="text-xs text-muted-foreground">Includes contact, identity, and focus areas</p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => handlePreviewEdit("business")}>
                  <Eye className="mr-2 w-4 h-4" />Edit
                </Button>
              </div>
              <div className="space-y-2 text-sm">
                <p><span className="font-semibold">Name:</span> {watchAll.name || "Not set"}</p>
                <p><span className="font-semibold">Email:</span> {watchAll.contactEmail || "Not set"}</p>
                <p><span className="font-semibold">Registered:</span> {businessDetails?.registrationNumber || "—"}</p>
                <p><span className="font-semibold">Industry:</span> {businessDetails?.industry || "—"}</p>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold">Banking truth</p>
                  <p className="text-xs text-muted-foreground">This is where payouts will land</p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => handlePreviewEdit("bank")}>
                  <Shield className="mr-2 w-4 h-4" />Secure
                </Button>
              </div>
              <div className="space-y-2 text-sm">
                <p><span className="font-semibold">Bank:</span> {bankDetails?.bankName || "Not provided"}</p>
                <p><span className="font-semibold">Account:</span> {bankDetails?.accountNumber || "Not provided"}</p>
                <p><span className="font-semibold">Routing:</span> {bankDetails?.routingNumber || "—"}</p>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold">Location</p>
                  <p className="text-xs text-muted-foreground">Match your estate service zone</p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => handlePreviewEdit("location")}>
                  <ArrowRight className="mr-2 w-4 h-4" />Refine
                </Button>
              </div>
              <div className="space-y-2 text-sm">
                <p><span className="font-semibold">Address:</span> {locationDetails?.addressLine1 || "Not provided"}</p>
                <p><span className="font-semibold">City:</span> {locationDetails?.city || "—"}</p>
                <p><span className="font-semibold">Country:</span> {locationDetails?.country || "—"}</p>
                <p><span className="font-semibold">Coordinates:</span>{locationDetails?.coordinates?.latitude ? `${Number(locationDetails.coordinates.latitude).toFixed(4)}, ${locationDetails.coordinates.longitude ? Number(locationDetails.coordinates.longitude).toFixed(4) : "—"}` : " Not set"}</p>
              </div>
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  );
}