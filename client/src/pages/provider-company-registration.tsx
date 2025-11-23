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
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible";
import { Briefcase, CreditCard, MapPin, Shield, Eye } from "lucide-react";
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
        if (value === "" || value === null || value === undefined)
          return undefined;
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
            if (value === "" || value === null || value === undefined)
              return undefined;
            if (typeof value === "string") {
              const parsed = Number(value);
              return Number.isNaN(parsed) ? undefined : parsed;
            }
            return value;
          }, z.number())
          .optional(),
        longitude: z
          .preprocess((value) => {
            if (value === "" || value === null || value === undefined)
              return undefined;
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
  const lgaOptions =
    selectedCountry === "Nigeria" ? (nigeriaStates[selectedState] ?? []) : [];
  const showStateSelect = stateOptions.length > 0;
  const showLgaSelect = lgaOptions.length > 0;

  const registerCompanyMutation = useMutation({
    mutationFn: (payload: CompanyForm) =>
      apiRequest("POST", "/api/provider/company-registration", payload).then(
        (res) => res.json(),
      ),
    onSuccess: () => {
      toast({
        title: "Registration submitted",
        description:
          "Your company details are securely stored and pending review",
      });
      setLocation("/company-dashboard");
    },
    onError: (error: Error) => {
      toast({
        title: "Unable to submit",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handlePreviewEdit = (key: keyof typeof openSections) => {
    setOpenSections((prev) => ({ ...prev, [key]: true }));
  };

  const onSubmit = async (values: CompanyForm) => {
    if (registerCompanyMutation.isLoading) return;
    await registerCompanyMutation.mutateAsync(values);
  };

  const { businessDetails, bankDetails, locationDetails } = watchAll;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 py-12">
      <div className="max-w-7xl mx-auto px-4 lg:px-6 space-y-10">
        <div className="text-center text-white space-y-3">
          <p className="text-[0.7rem] tracking-[0.5em] text-primary-foreground uppercase">
            CityConnect Business Suite
          </p>
          <h1 className="text-4xl sm:text-5xl font-semibold">
            Register as an estate-ready partner
          </h1>
          <p className="text-base text-muted-foreground max-w-3xl mx-auto">
            Submit verified business, banking, and location details once to
            unlock prioritized estate requests, secure payouts, and
            compliance-ready workflows.
          </p>
        </div>
        <div className="grid gap-10 lg:grid-cols-[1.4fr,0.95fr]">
          <section className="space-y-6">
            <div className="rounded-[32px] border border-white/10 bg-slate-900/70 p-6 shadow-[0_25px_65px_rgba(2,6,23,0.85)]">
              <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.3em] text-white/60">
                    Verified business intake
                  </p>
                  <p className="text-sm text-white/70">
                    Share your identity, banking, and location intelligence in a
                    single guided workflow so estates can verify you faster.
                  </p>
                </div>
                <Button
                  variant="outline"
                  onClick={() => setLocation("/provider")}
                >
                  Back to dashboard
                </Button>
              </div>

              <form
                onSubmit={handleSubmit(onSubmit)}
                className="space-y-6 mt-6"
              >
                <Collapsible
                  open={openSections.business}
                  onOpenChange={(isOpen) =>
                    setOpenSections((prev) => ({ ...prev, business: isOpen }))
                  }
                >
                  <div className="rounded-2xl border border-border bg-card shadow-sm">
                    <div className="flex items-center justify-between p-4">
                      <div className="flex items-center gap-3">
                        <Briefcase className="w-5 h-5" />
                        <div>
                          <p className="text-base font-semibold">
                            Business Details
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Tell us about the company's identity and purpose
                          </p>
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
                          <Input
                            id="name"
                            {...register("name")}
                            placeholder="e.g. Lekki Facilities"
                          />
                          {errors.name && (
                            <p className="text-xs text-destructive mt-1">
                              {errors.name.message}
                            </p>
                          )}
                        </div>
                        <div>
                          <Label htmlFor="contactEmail">
                            Primary Contact Email
                          </Label>
                          <Input
                            id="contactEmail"
                            {...register("contactEmail")}
                            placeholder="contact@business.com"
                          />
                          {errors.contactEmail && (
                            <p className="text-xs text-destructive mt-1">
                              {errors.contactEmail.message}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="grid gap-4 md:grid-cols-2">
                        <div>
                          <Label htmlFor="phone">Business Phone</Label>
                          <Input
                            id="phone"
                            {...register("phone")}
                            placeholder="+234 809 000 1234"
                          />
                          {errors.phone && (
                            <p className="text-xs text-destructive mt-1">
                              {errors.phone.message}
                            </p>
                          )}
                        </div>
                        <div>
                          <Label htmlFor="description">
                            Describe your services
                          </Label>
                          <Textarea
                            id="description"
                            {...register("description")}
                            rows={2}
                            placeholder="Summarize how your company operates"
                          />
                        </div>
                      </div>
                      <div className="grid gap-4 md:grid-cols-2">
                        <div>
                          <Label htmlFor="registrationNumber">
                            Business registration number
                          </Label>
                          <Input
                            id="registrationNumber"
                            {...register("businessDetails.registrationNumber")}
                          />
                          {errors.businessDetails?.registrationNumber && (
                            <p className="text-xs text-destructive mt-1">
                              {
                                errors.businessDetails.registrationNumber
                                  .message
                              }
                            </p>
                          )}
                        </div>
                        <div>
                          <Label htmlFor="taxId">Tax / TIN</Label>
                          <Input
                            id="taxId"
                            {...register("businessDetails.taxId")}
                          />
                          {errors.businessDetails?.taxId && (
                            <p className="text-xs text-destructive mt-1">
                              {errors.businessDetails.taxId.message}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="grid gap-4 md:grid-cols-2">
                        <div>
                          <Label htmlFor="businessType">Business Type</Label>
                          <select
                            id="businessType"
                            {...register("businessDetails.businessType")}
                            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                          >
                            <option value="">Select business type</option>
                            {businessTypes.map((type) => (
                              <option key={type} value={type}>
                                {type}
                              </option>
                            ))}
                          </select>
                          {errors.businessDetails?.businessType && (
                            <p className="text-xs text-destructive mt-1">
                              {errors.businessDetails.businessType.message}
                            </p>
                          )}
                        </div>
                        <div>
                          <Label htmlFor="industry">Industry</Label>
                          <select
                            id="industry"
                            {...register("businessDetails.industry")}
                            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                          >
                            <option value="">Select industry</option>
                            {industries.map((industry) => (
                              <option key={industry} value={industry}>
                                {industry}
                              </option>
                            ))}
                          </select>
                          {errors.businessDetails?.industry && (
                            <p className="text-xs text-destructive mt-1">
                              {errors.businessDetails.industry.message}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="grid gap-4 md:grid-cols-2">
                        <div>
                          <Label htmlFor="yearEstablished">
                            Year established
                          </Label>
                          <Input
                            id="yearEstablished"
                            type="number"
                            {...register("businessDetails.yearEstablished", {
                              valueAsNumber: true,
                            })}
                            min={1900}
                            max={new Date().getFullYear()}
                          />
                          {errors.businessDetails?.yearEstablished && (
                            <p className="text-xs text-destructive mt-1">
                              {errors.businessDetails.yearEstablished.message}
                            </p>
                          )}
                        </div>
                        <div>
                          <Label htmlFor="website">Website (optional)</Label>
                          <Input
                            id="website"
                            {...register("businessDetails.website")}
                            placeholder="https://example.com"
                          />
                          {errors.businessDetails?.website && (
                            <p className="text-xs text-destructive mt-1">
                              {errors.businessDetails.website.message}
                            </p>
                          )}
                        </div>
                      </div>
                    </CollapsibleContent>
                  </div>
                </Collapsible>

                <Collapsible
                  open={openSections.bank}
                  onOpenChange={(isOpen) =>
                    setOpenSections((prev) => ({ ...prev, bank: isOpen }))
                  }
                >
                  <div className="rounded-2xl border border-border bg-card shadow-sm">
                    <div className="flex items-center justify-between p-4">
                      <div className="flex items-center gap-3">
                        <CreditCard className="w-5 h-5" />
                        <div>
                          <p className="text-base font-semibold">
                            Bank & payouts
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Where should we disburse your earnings?
                          </p>
                        </div>
                      </div>
                      <CollapsibleTrigger asChild>
                        <Button size="sm" variant="ghost">
                          {openSections.bank ? "Collapse" : "Expand"}
                        </Button>
                      </CollapsibleTrigger>
                    </div>
                    <CollapsibleContent className="px-4 pb-4 space-y-4">
                      <div className="grid gap-4 md:grid-cols-2">
                        <div>
                          <Label htmlFor="bankName">Bank Name</Label>
                          <select
                            id="bankName"
                            {...register("bankDetails.bankName")}
                            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                          >
                            <option value="">Select bank</option>
                            {banks.map((bank) => (
                              <option key={bank} value={bank}>
                                {bank}
                              </option>
                            ))}
                          </select>
                          {errors.bankDetails?.bankName && (
                            <p className="text-xs text-destructive mt-1">
                              {errors.bankDetails.bankName.message}
                            </p>
                          )}
                        </div>
                        <div>
                          <Label htmlFor="accountName">Account Name</Label>
                          <Input
                            id="accountName"
                            {...register("bankDetails.accountName")}
                          />
                          {errors.bankDetails?.accountName && (
                            <p className="text-xs text-destructive mt-1">
                              {errors.bankDetails.accountName.message}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="grid gap-4 md:grid-cols-2">
                        <div>
                          <Label htmlFor="accountNumber">Account Number</Label>
                          <Input
                            id="accountNumber"
                            {...register("bankDetails.accountNumber")}
                          />
                          {errors.bankDetails?.accountNumber && (
                            <p className="text-xs text-destructive mt-1">
                              {errors.bankDetails.accountNumber.message}
                            </p>
                          )}
                        </div>
                        <div>
                          <Label htmlFor="routingNumber">
                            Routing / Sort Code
                          </Label>
                          <Input
                            id="routingNumber"
                            {...register("bankDetails.routingNumber")}
                          />
                        </div>
                      </div>
                      <div className="grid gap-4 md:grid-cols-2">
                        <div>
                          <Label htmlFor="swiftCode">SWIFT / IBAN</Label>
                          <Input
                            id="swiftCode"
                            {...register("bankDetails.swiftCode")}
                          />
                        </div>
                        <div>
                          <Label htmlFor="bankNotes">Instructions</Label>
                          <Textarea
                            id="bankNotes"
                            {...register("bankDetails.notes")}
                            rows={2}
                            placeholder="e.g. Payment memo or preferred payout cadence"
                          />
                        </div>
                      </div>
                    </CollapsibleContent>
                  </div>
                </Collapsible>

                <Collapsible
                  open={openSections.location}
                  onOpenChange={(isOpen) =>
                    setOpenSections((prev) => ({ ...prev, location: isOpen }))
                  }
                >
                  <div className="rounded-2xl border border-border bg-card shadow-sm">
                    <div className="flex items-center justify-between p-4">
                      <div className="flex items-center gap-3">
                        <MapPin className="w-5 h-5" />
                        <div>
                          <p className="text-base font-semibold">
                            Business Location
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Where your company is registered
                          </p>
                        </div>
                      </div>
                      <CollapsibleTrigger asChild>
                        <Button size="sm" variant="ghost">
                          {openSections.location ? "Collapse" : "Expand"}
                        </Button>
                      </CollapsibleTrigger>
                    </div>
                    <CollapsibleContent className="px-4 pb-4 space-y-4">
                      <div className="grid gap-4 md:grid-cols-2">
                        <div>
                          <Label htmlFor="addressLine1">Address Line 1</Label>
                          <Input
                            id="addressLine1"
                            {...register("locationDetails.addressLine1")}
                          />
                          {errors.locationDetails?.addressLine1 && (
                            <p className="text-xs text-destructive mt-1">
                              {errors.locationDetails.addressLine1.message}
                            </p>
                          )}
                        </div>
                        <div>
                          <Label htmlFor="addressLine2">Address Line 2</Label>
                          <Input
                            id="addressLine2"
                            {...register("locationDetails.addressLine2")}
                          />
                        </div>
                      </div>
                      <div className="grid gap-4 md:grid-cols-2">
                        <div>
                          <Label htmlFor="city">City</Label>
                          <Input
                            id="city"
                            {...register("locationDetails.city")}
                          />
                          {errors.locationDetails?.city && (
                            <p className="text-xs text-destructive mt-1">
                              {errors.locationDetails.city.message}
                            </p>
                          )}
                        </div>
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
                            <p className="text-xs text-destructive mt-1">
                              {errors.locationDetails.country.message}
                            </p>
                          )}
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
                            <Input
                              id="state"
                              {...register("locationDetails.state")}
                              placeholder="Type your state"
                            />
                          )}
                          {errors.locationDetails?.state && (
                            <p className="text-xs text-destructive mt-1">
                              {errors.locationDetails.state.message}
                            </p>
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
                            <Input
                              id="lga"
                              {...register("locationDetails.lga")}
                              placeholder="Type your LGA"
                            />
                          )}
                          {errors.locationDetails?.lga && (
                            <p className="text-xs text-destructive mt-1">
                              {errors.locationDetails.lga.message}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="grid gap-4 md:grid-cols-2">
                        <div>
                          <Label htmlFor="latitude">Latitude</Label>
                          <Input
                            id="latitude"
                            type="number"
                            step="any"
                            {...register(
                              "locationDetails.coordinates.latitude",
                              { valueAsNumber: true },
                            )}
                          />
                        </div>
                        <div>
                          <Label htmlFor="longitude">Longitude</Label>
                          <Input
                            id="longitude"
                            type="number"
                            step="any"
                            {...register(
                              "locationDetails.coordinates.longitude",
                              { valueAsNumber: true },
                            )}
                          />
                        </div>
                      </div>
                    </CollapsibleContent>
                  </div>
                </Collapsible>

                <div className="flex justify-end">
                  <Button
                    type="submit"
                    size="lg"
                    className="w-full lg:w-auto"
                    disabled={isSubmitting}
                  >
                    {registerCompanyMutation.isLoading
                      ? "Saving..."
                      : "Submit for review"}
                  </Button>
                </div>
              </form>
            </div>
          </section>

          <div className="space-y-6">
            <div className="rounded-[32px] border border-white/10 bg-gradient-to-br from-slate-900 via-emerald-900 to-green-900 p-6 text-white shadow-[0_30px_60px_rgba(16,185,129,0.25)] space-y-4">
              <p className="text-[0.65rem] uppercase tracking-[0.55em] text-white/70">
                CityConnect Verified
              </p>
              <h3 className="text-2xl font-semibold leading-tight">
                Designed for estate-ready companies
              </h3>
              <p className="text-sm text-white/70 leading-relaxed">
                A refined onboarding path built on our system palette: deep
                gradients, elevated cards, and concise trust signals that prep
                you for the estate marketplace.
              </p>
              <div className="space-y-3 text-sm">
                {[
                  {
                    label: "Verified compliance",
                    desc: "Share official registration and tax details once across all estates.",
                  },
                  {
                    label: "Priority estates",
                    desc: "Approved partners get immediate access to high-priority requests.",
                  },
                  {
                    label: "Clear payouts",
                    desc: "Structured bank details ensure on-time payment without follow ups.",
                  },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="flex items-start gap-3 text-white/85"
                  >
                    <div className="mt-1 h-2 w-2 rounded-full bg-white" />
                    <div>
                      <p className="font-semibold">{item.label}</p>
                      <p className="text-xs text-white/70">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <Card className="overflow-hidden rounded-[32px] border border-white/5 bg-slate-950/70 text-white shadow-[0_30px_50px_rgba(34,197,94,0.35)]">
              <div className="h-1 w-full bg-gradient-to-r from-sky-400 via-indigo-500 to-violet-500" />
              <CardHeader className="space-y-2 pt-4 text-white">
                <CardTitle className="text-lg text-white">
                  Preview & confirm
                </CardTitle>
                <p className="text-xs uppercase tracking-[0.3em] text-white/60">
                  Live snapshot of your submission
                </p>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs text-white/60 uppercase tracking-[0.45em]">
                        Business
                      </p>
                      <p className="text-lg font-semibold">
                        {watchAll.name || "Not set"}
                      </p>
                      <p className="text-xs text-white/70">
                        {watchAll.contactEmail || "No contact email yet"}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handlePreviewEdit("business")}
                    >
                      <Eye className="mr-2 w-4 h-4" />
                      Edit
                    </Button>
                  </div>
                  <div className="grid gap-3 text-xs text-white/70 md:grid-cols-2">
                    <p>
                      <span className="font-semibold text-white/90">
                        Registration:
                      </span>{" "}
                      {businessDetails?.registrationNumber || "Pending"}
                    </p>
                    <p>
                      <span className="font-semibold text-white/90">
                        Industry:
                      </span>{" "}
                      {businessDetails?.industry || "Pending"}
                    </p>
                    <p>
                      <span className="font-semibold text-white/90">
                        Year established:
                      </span>{" "}
                      {businessDetails?.yearEstablished || "Pending"}
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs text-white/60 uppercase tracking-[0.45em]">
                        Banking
                      </p>
                      <p className="text-lg font-semibold">
                        {bankDetails?.bankName || "Not provided"}
                      </p>
                      <p className="text-xs text-white/70">
                        {bankDetails?.accountNumber
                          ? `Acct: ${bankDetails.accountNumber}`
                          : "Add account number"}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handlePreviewEdit("bank")}
                    >
                      <Shield className="mr-2 w-4 h-4" />
                      Secure
                    </Button>
                  </div>
                  <div className="grid gap-3 text-xs text-white/70 md:grid-cols-2">
                    <p>
                      <span className="font-semibold text-white/90">
                        Routing:
                      </span>{" "}
                      {bankDetails?.routingNumber || "Missing"}
                    </p>
                    <p>
                      <span className="font-semibold text-white/90">
                        SWIFT / IBAN:
                      </span>{" "}
                      {bankDetails?.swiftCode || "Optional"}
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs text-white/60 uppercase tracking-[0.45em]">
                        Location
                      </p>
                      <p className="text-lg font-semibold">
                        {locationDetails?.city || "Not set"}
                      </p>
                      <p className="text-xs text-white/70">
                        {locationDetails?.country || "Country"}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handlePreviewEdit("location")}
                    >
                      <MapPin className="mr-2 w-4 h-4" />
                      Refine
                    </Button>
                  </div>
                  <div className="grid gap-3 text-xs text-white/70">
                    <p>
                      <span className="font-semibold text-white/90">
                        Address:
                      </span>{" "}
                      {locationDetails?.addressLine1 || "Not provided"}
                    </p>
                    <p>
                      <span className="font-semibold text-white/90">
                        Coordinates:
                      </span>{" "}
                      {locationDetails?.coordinates?.latitude
                        ? `${Number(locationDetails.coordinates.latitude).toFixed(4)}, ${
                            locationDetails.coordinates.longitude
                              ? Number(
                                  locationDetails.coordinates.longitude,
                                ).toFixed(4)
                              : "Not set"
                          }`
                        : "Not provided"}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
