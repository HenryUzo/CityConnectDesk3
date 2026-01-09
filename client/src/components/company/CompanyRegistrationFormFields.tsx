import React, { useEffect, useRef, useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Briefcase, CheckCircle, AlertCircle, CreditCard, MapPin } from "lucide-react";
import { UseFormReturn } from "react-hook-form";
import { z } from "zod";

export const businessTypes = [
  "Sole Proprietorship",
  "Limited Liability Company (LLC)",
  "Partnership",
  "Cooperative",
  "Social Enterprise",
  "Freelance / Personal Brand",
  "Holding Company",
  "Other",
];

export const industries = [
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

export const banks = [
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

export const countries = [
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

const nigeriaStates: Record<string, string[]> = {
  Lagos: ["Ikeja", "Lekki", "Yaba", "Surulere"],
  Rivers: ["Port Harcourt", "Obio-Akpor", "Okrika", "Eleme"],
  Abuja: ["Abaji", "Bwari", "Gwagwalada", "Kuje", "Kwali"],
  Ogun: ["Abeokuta North", "Remo North", "Sagamu", "Ifo"],
};

const countryStateMap: Record<string, string[]> = {
  Nigeria: Object.keys(nigeriaStates),
};

const hasValue = (value: unknown) => {
  if (value === "" || value === null || value === undefined) return false;
  if (typeof value === "number") return !Number.isNaN(value);
  return String(value).trim().length > 0;
};

export const isCompanyCoreFieldsComplete = (values: Partial<CompanyForm>) => {
  // Core required fields for initial submission (submit for review)
  const coreRequired = [
    values.name,
    values.contactEmail,
    values.phone,
    values.locationDetails?.addressLine1,
    values.locationDetails?.city,
    values.locationDetails?.country,
  ];
  return coreRequired.every(hasValue);
};

export const isBusinessSectionComplete = (values: Partial<CompanyForm>) => {
  const required = [
    values.name,
    values.contactEmail,
    values.phone,
    values.description,
    values.businessDetails?.registrationNumber,
    values.businessDetails?.taxId,
    values.businessDetails?.businessType,
    values.businessDetails?.industry,
    values.businessDetails?.yearEstablished,
  ];
  return required.every(hasValue);
};

export const isLocationSectionComplete = (values: Partial<CompanyForm>) => {
  const required = [
    values.locationDetails?.addressLine1,
    values.locationDetails?.city,
    values.locationDetails?.country,
    values.locationDetails?.state,
    values.locationDetails?.lga,
  ];
  return required.every(hasValue);
};

export const companySchema = z.object({
  name: z.string().min(2, "Business name is required"),
  description: z.string().max(1000).optional(),
  contactEmail: z.string().email("Provide a valid contact email"),
  phone: z.string().min(6, "Business phone is required").max(20),
  businessDetails: z.object({
    registrationNumber: z.string().optional(),
    taxId: z.string().optional(),
    businessType: z.string().optional(),
    industry: z.string().optional(),
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
    website: z.preprocess((value) => {
      if (value === "" || value === null || value === undefined) return undefined;
      return value;
    }, z.string().url().optional()),
  }),
  bankDetails: z.object({
    bankName: z.string().optional(),
    accountName: z.string().optional(),
    accountNumber: z.string().optional(),
    routingNumber: z.string().optional(),
    swiftCode: z.string().optional(),
    notes: z.string().optional(),
  }),
  locationDetails: z.object({
    addressLine1: z.string().min(1, "Address line 1 is required"),
    addressLine2: z.string().optional(),
    city: z.string().min(1, "City is required"),
    state: z.string().optional(),
    lga: z.string().optional(),
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
            if (typeof value === "number" && Number.isNaN(value)) return undefined;
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
            if (typeof value === "number" && Number.isNaN(value)) return undefined;
            return value;
          }, z.number())
          .optional(),
      })
      .optional(),
  }),
});

export type CompanyForm = z.infer<typeof companySchema>;

export const defaultCompanyFormValues: CompanyForm = {
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

const RequiredLabel = ({ children }: { children: React.ReactNode }) => (
  <>
    {children}
    <span className="text-destructive ml-1">*</span>
  </>
);

export type CompanyFormSection = "business" | "bank" | "location";

type FormTabsProps = {
  form: UseFormReturn<CompanyForm>;
  activeTab?: CompanyFormSection;
  onTabChange?: (tab: CompanyFormSection) => void;
};

type TabId = CompanyFormSection;

const CompanyRegistrationFormFields = ({
  form,
  activeTab,
  onTabChange,
}: FormTabsProps) => {
  const {
    register,
    formState: { errors },
  } = form;
  const isControlled = activeTab !== undefined;
  const [internalTab, setInternalTab] = useState<TabId>(activeTab ?? "business");

  useEffect(() => {
    if (activeTab && activeTab !== internalTab) {
      setInternalTab(activeTab);
    }
  }, [activeTab, internalTab]);

  const currentTab = isControlled ? (activeTab as TabId) : internalTab;
  
  const memoizedValues = useMemo(() => form.getValues(), [form]);
  const selectedCountry = memoizedValues.locationDetails?.country || "";
  const selectedState = (memoizedValues.locationDetails?.state || "") as keyof typeof nigeriaStates;
  const stateOptions = useMemo(() => countryStateMap[selectedCountry] ?? [], [selectedCountry]);
  const lgaOptions = useMemo(() => selectedCountry === "Nigeria" ? nigeriaStates[selectedState] ?? [] : [], [selectedCountry, selectedState]);
  const isBusinessReady = useMemo(() => isCompanyCoreFieldsComplete(memoizedValues), [memoizedValues]);
  const isLocationReady = useMemo(() => {
    const required = [
      memoizedValues.locationDetails?.addressLine1,
      memoizedValues.locationDetails?.city,
      memoizedValues.locationDetails?.country,
    ];
    return required.every(hasValue);
  }, [memoizedValues]);

  const lastFocusedFieldRef = useRef<HTMLElement | null>(null);
  
  const attachFocusHandlers = <T extends { onBlur?: (...args: any[]) => void; onFocus?: (...args: any[]) => void }>(
    field: T,
  ) => field;

  const handleTabChange = (value: string) => {
    const nextTab = value as TabId;
    if (!isControlled) {
      setInternalTab(nextTab);
    }
    onTabChange?.(nextTab);
  };

  const TabCard = ({
    icon,
    title,
    children,
  }: {
    icon: JSX.Element;
    title: string;
    children: React.ReactNode;
  }) => (
    <div className="rounded-2xl border border-border bg-card shadow-sm">
      <div className="flex items-center gap-3 p-4">
        {icon}
        <div>
          <p className="text-base font-semibold">{title}</p>
          <p className="text-xs text-muted-foreground">
            Provide details for {title.toLowerCase()}
          </p>
        </div>
      </div>
      <div className="px-4 pb-6 space-y-4">{children}</div>
    </div>
  );

  const businessIcon = isBusinessReady ? (
    <CheckCircle className="w-4 h-4 text-emerald-500" />
  ) : (
    <AlertCircle className="w-4 h-4 text-orange-500" />
  );
  const locationIcon = isLocationReady ? (
    <CheckCircle className="w-4 h-4 text-emerald-500" />
  ) : (
    <AlertCircle className="w-4 h-4 text-orange-500" />
  );

  const tabs: Array<{ id: CompanyFormSection; label: string; icon: JSX.Element }> = [
    { id: "business", label: "Business", icon: businessIcon },
    { id: "bank", label: "Bank", icon: <CreditCard className="w-3 h-3" /> },
    { id: "location", label: "Location", icon: locationIcon },
  ];

  return (
    <div className="space-y-4">
      <div className="inline-flex h-10 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground">
        {tabs.map((tab) => {
          const isActive = currentTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => handleTabChange(tab.id)}
              className={`inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                isActive
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <span className="flex items-center gap-1">
                {tab.icon}
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>

      {currentTab === "business" && (
        <TabCard icon={<Briefcase className="w-5 h-5" />} title="Business Details">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="name">
                <RequiredLabel>Business Name</RequiredLabel>
              </Label>
              <Input
                id="name"
                {...attachFocusHandlers(register("name"))}
                placeholder="e.g. Lekki Facilities"
              />
              {errors.name && (
                <p className="text-xs text-destructive mt-1">{errors.name.message}</p>
              )}
            </div>
            <div>
              <Label htmlFor="contactEmail">
                <RequiredLabel>Primary Contact Email</RequiredLabel>
              </Label>
              <Input
                id="contactEmail"
                {...attachFocusHandlers(register("contactEmail"))}
                placeholder="contact@business.com"
              />
              {errors.contactEmail && (
                <p className="text-xs text-destructive mt-1">{errors.contactEmail.message}</p>
              )}
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="phone">
                <RequiredLabel>Business Phone</RequiredLabel>
              </Label>
              <Input
                id="phone"
                {...attachFocusHandlers(register("phone"))}
                placeholder="+234 809 000 1234"
              />
              {errors.phone && (
                <p className="text-xs text-destructive mt-1">{errors.phone.message}</p>
              )}
            </div>
            <div>
              <Label htmlFor="description">Describe your services</Label>
              <Textarea
                id="description"
                {...attachFocusHandlers(register("description"))}
                rows={2}
                placeholder="Summarize how your company operates"
              />
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="registrationNumber">Business registration number (optional)</Label>
              <Input
                id="registrationNumber"
                {...attachFocusHandlers(register("businessDetails.registrationNumber"))}
              />
              {errors.businessDetails?.registrationNumber && (
                <p className="text-xs text-destructive mt-1">
                  {errors.businessDetails.registrationNumber.message}
                </p>
              )}
            </div>
            <div>
              <Label htmlFor="taxId">Tax / TIN (optional)</Label>
              <Input id="taxId" {...attachFocusHandlers(register("businessDetails.taxId"))} />
              {errors.businessDetails?.taxId && (
                <p className="text-xs text-destructive mt-1">
                  {errors.businessDetails.taxId.message}
                </p>
              )}
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="businessType">Business Type (optional)</Label>
              <select
                id="businessType"
                {...attachFocusHandlers(register("businessDetails.businessType"))}
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
              <Label htmlFor="industry">Industry (optional)</Label>
              <select
                id="industry"
                {...attachFocusHandlers(register("businessDetails.industry"))}
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
              <Label htmlFor="yearEstablished">Year established (optional)</Label>
              <Input
                id="yearEstablished"
                type="number"
                {...attachFocusHandlers(
                  register("businessDetails.yearEstablished", {
                    valueAsNumber: true,
                  }),
                )}
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
                {...attachFocusHandlers(register("businessDetails.website"))}
                placeholder="https://example.com"
              />
              {errors.businessDetails?.website && (
                <p className="text-xs text-destructive mt-1">
                  {errors.businessDetails.website.message}
                </p>
              )}
            </div>
          </div>
        </TabCard>
      )}

      {currentTab === "bank" && (
        <TabCard icon={<CreditCard className="w-5 h-5" />} title="Bank & payouts">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="bankName">Bank</Label>
              <select
                id="bankName"
                {...attachFocusHandlers(register("bankDetails.bankName"))}
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
                {...attachFocusHandlers(register("bankDetails.accountName"))}
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
                {...attachFocusHandlers(register("bankDetails.accountNumber"))}
              />
              {errors.bankDetails?.accountNumber && (
                <p className="text-xs text-destructive mt-1">
                  {errors.bankDetails.accountNumber.message}
                </p>
              )}
            </div>
            <div>
              <Label htmlFor="routingNumber">Routing / Sort Code</Label>
              <Input
                id="routingNumber"
                {...attachFocusHandlers(register("bankDetails.routingNumber"))}
              />
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="swiftCode">SWIFT / IBAN</Label>
              <Input id="swiftCode" {...attachFocusHandlers(register("bankDetails.swiftCode"))} />
            </div>
            <div>
              <Label htmlFor="bankNotes">Instructions</Label>
              <Textarea
                id="bankNotes"
                {...attachFocusHandlers(register("bankDetails.notes"))}
                rows={2}
                placeholder="e.g. preferred payout cadence"
              />
            </div>
          </div>
        </TabCard>
      )}

      {currentTab === "location" && (
        <TabCard icon={<MapPin className="w-5 h-5" />} title="Business Location">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="addressLine1">
                <RequiredLabel>Address Line 1</RequiredLabel>
              </Label>
              <Input
                id="addressLine1"
                {...attachFocusHandlers(register("locationDetails.addressLine1"))}
              />
              {errors.locationDetails?.addressLine1 && (
                <p className="text-xs text-destructive mt-1">
                  {errors.locationDetails.addressLine1.message}
                </p>
              )}
            </div>
            <div>
              <Label htmlFor="addressLine2">Address Line 2 (optional)</Label>
              <Input
                id="addressLine2"
                {...attachFocusHandlers(register("locationDetails.addressLine2"))}
              />
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="city">
                <RequiredLabel>City</RequiredLabel>
              </Label>
              <Input id="city" {...attachFocusHandlers(register("locationDetails.city"))} />
              {errors.locationDetails?.city && (
                <p className="text-xs text-destructive mt-1">
                  {errors.locationDetails.city.message}
                </p>
              )}
            </div>
            <div>
              <Label htmlFor="country">
                <RequiredLabel>Country</RequiredLabel>
              </Label>
              <Input
                id="country"
                list="country-list"
                {...attachFocusHandlers(register("locationDetails.country"))}
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
              <Label htmlFor="state">State (optional)</Label>
              {stateOptions.length > 0 ? (
                <select
                  id="state"
                  {...attachFocusHandlers(register("locationDetails.state"))}
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
                  {...attachFocusHandlers(register("locationDetails.state"))}
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
              <Label htmlFor="lga">LGA (optional)</Label>
              {lgaOptions.length > 0 ? (
                <select
                  id="lga"
                  {...attachFocusHandlers(register("locationDetails.lga"))}
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
                  {...attachFocusHandlers(register("locationDetails.lga"))}
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
                {...attachFocusHandlers(
                  register("locationDetails.coordinates.latitude", {
                    valueAsNumber: true,
                  }),
                )}
              />
            </div>
            <div>
              <Label htmlFor="longitude">Longitude</Label>
              <Input
                id="longitude"
                type="number"
                step="any"
                {...attachFocusHandlers(
                  register("locationDetails.coordinates.longitude", {
                    valueAsNumber: true,
                  }),
                )}
              />
            </div>
          </div>
        </TabCard>
      )}
    </div>
  );
};

export default React.memo(CompanyRegistrationFormFields);
