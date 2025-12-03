import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Briefcase, CreditCard, MapPin } from "lucide-react";
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

export const companySchema = z.object({
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
    watch,
  } = form;
  const [activeTab, setActiveTab] = useState<TabId>("business");
  const values = watch();
  const selectedCountry = values.locationDetails?.country || "";
  const selectedState = (values.locationDetails?.state || "") as keyof typeof nigeriaStates;
  const stateOptions = countryStateMap[selectedCountry] ?? [];
  const lgaOptions = selectedCountry === "Nigeria" ? nigeriaStates[selectedState] ?? [] : [];
  const isBusinessReady = isBusinessSectionComplete(values);
  const isLocationReady = isLocationSectionComplete(values);

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

  return (
    <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as TabId)} className="space-y-4">
      <TabsList className="space-x-2">
        <TabsTrigger value="business">
          <span className="flex items-center gap-1">
            {businessIcon}
            Business
          </span>
        </TabsTrigger>
        <TabsTrigger value="bank">
          <span className="flex items-center gap-1">
            <CreditCard className="w-3 h-3" />
            Bank
          </span>
        </TabsTrigger>
        <TabsTrigger value="location">
          <span className="flex items-center gap-1">
            {locationIcon}
            Location
          </span>
        </TabsTrigger>
      </TabsList>

      <TabsContent value="business">
        <TabCard icon={<Briefcase className="w-5 h-5" />} title="Business Details">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="name">Business Name</Label>
              <Input id="name" {...register("name")} placeholder="e.g. Lekki Facilities" />
              {errors.name && (
                <p className="text-xs text-destructive mt-1">{errors.name.message}</p>
              )}
            </div>
            <div>
              <Label htmlFor="contactEmail">Primary Contact Email</Label>
              <Input
                id="contactEmail"
                {...register("contactEmail")}
                placeholder="contact@business.com"
              />
              {errors.contactEmail && (
                <p className="text-xs text-destructive mt-1">{errors.contactEmail.message}</p>
              )}
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="phone">Business Phone</Label>
              <Input id="phone" {...register("phone")} placeholder="+234 809 000 1234" />
              {errors.phone && (
                <p className="text-xs text-destructive mt-1">{errors.phone.message}</p>
              )}
            </div>
            <div>
              <Label htmlFor="description">Describe your services</Label>
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
              <Label htmlFor="registrationNumber">Business registration number</Label>
              <Input
                id="registrationNumber"
                {...register("businessDetails.registrationNumber")}
              />
              {errors.businessDetails?.registrationNumber && (
                <p className="text-xs text-destructive mt-1">
                  {errors.businessDetails.registrationNumber.message}
                </p>
              )}
            </div>
            <div>
              <Label htmlFor="taxId">Tax / TIN</Label>
              <Input id="taxId" {...register("businessDetails.taxId")} />
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
              <Label htmlFor="yearEstablished">Year established</Label>
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
        </TabCard>
      </TabsContent>

      <TabsContent value="bank">
        <TabCard icon={<CreditCard className="w-5 h-5" />} title="Bank & payouts">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="bankName">Bank</Label>
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
              <Input id="accountName" {...register("bankDetails.accountName")} />
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
              <Input id="accountNumber" {...register("bankDetails.accountNumber")} />
              {errors.bankDetails?.accountNumber && (
                <p className="text-xs text-destructive mt-1">
                  {errors.bankDetails.accountNumber.message}
                </p>
              )}
            </div>
            <div>
              <Label htmlFor="routingNumber">Routing / Sort Code</Label>
              <Input id="routingNumber" {...register("bankDetails.routingNumber")} />
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="swiftCode">SWIFT / IBAN</Label>
              <Input id="swiftCode" {...register("bankDetails.swiftCode")} />
            </div>
            <div>
              <Label htmlFor="bankNotes">Instructions</Label>
              <Textarea
                id="bankNotes"
                {...register("bankDetails.notes")}
                rows={2}
                placeholder="e.g. preferred payout cadence"
              />
            </div>
          </div>
        </TabCard>
      </TabsContent>

      <TabsContent value="location">
        <TabCard icon={<MapPin className="w-5 h-5" />} title="Business Location">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="addressLine1">Address Line 1</Label>
              <Input id="addressLine1" {...register("locationDetails.addressLine1")} />
              {errors.locationDetails?.addressLine1 && (
                <p className="text-xs text-destructive mt-1">
                  {errors.locationDetails.addressLine1.message}
                </p>
              )}
            </div>
            <div>
              <Label htmlFor="addressLine2">Address Line 2</Label>
              <Input id="addressLine2" {...register("locationDetails.addressLine2")} />
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="city">City</Label>
              <Input id="city" {...register("locationDetails.city")} />
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
              {(stateOptions.length > 0) ? (
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
              {lgaOptions.length > 0 ? (
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
                {...register("locationDetails.coordinates.latitude", {
                  valueAsNumber: true,
                })}
              />
            </div>
            <div>
              <Label htmlFor="longitude">Longitude</Label>
              <Input
                id="longitude"
                type="number"
                step="any"
                {...register("locationDetails.coordinates.longitude", {
                  valueAsNumber: true,
                })}
              />
            </div>
          </div>
        </TabCard>
      </TabsContent>
    </Tabs>
  );
};

export default CompanyRegistrationFormFields;
