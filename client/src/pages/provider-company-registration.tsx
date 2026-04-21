import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import CompanyRegistrationFormFields, {
  CompanyForm,
  companySchema,
  defaultCompanyFormValues,
  CompanyFormSection,
  isCompanyCoreFieldsComplete,
} from "@/components/company/CompanyRegistrationFormFields";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MapPin, Shield, Eye } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ProviderShell } from "@/components/provider/ProviderShell";

export default function ProviderCompanyRegistration() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [activeSection, setActiveSection] =
    useState<CompanyFormSection>("business");

  const companyForm = useForm<CompanyForm>({
    resolver: zodResolver(companySchema),
    defaultValues: defaultCompanyFormValues,
  });

  const {
    handleSubmit,
    watch,
    getValues,
    formState: { isSubmitting },
  } = companyForm;

  // Watch all form values to trigger re-render on changes
  const watchAllValues = watch();
  
  // Calculate core fields completion based on current form state
  const isCoreFieldsComplete = isCompanyCoreFieldsComplete(watchAllValues);

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

  const handlePreviewEdit = (section: CompanyFormSection) => {
    setActiveSection(section);
  };

  const onSubmit = async (values: CompanyForm) => {
    if (registerCompanyMutation.isPending) return;
    await registerCompanyMutation.mutateAsync(values);
  };

  return (
    <ProviderShell
      title="Register business"
      subtitle="Submit your company profile, banking, and location details for review."
      contentClassName="overflow-auto"
    >
      <div className="space-y-10 rounded-[36px] bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 px-4 py-8 lg:px-6">
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
          <p className="text-xs text-white/50 max-w-2xl mx-auto">
            Complete the important fields (name, email, phone, and address) to submit for review. Additional business and banking details can be added later.
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
                  onClick={() => setLocation("/provider/dashboard")}
                >
                  Back to dashboard
                </Button>
              </div>

              <form
                onSubmit={handleSubmit(onSubmit)}
                className="space-y-6 mt-6"
              >
                <CompanyRegistrationFormFields
                  form={companyForm}
                  activeTab={activeSection}
                  onTabChange={setActiveSection}
                />
                <div className="flex justify-end">
                  <Button
                    type="submit"
                    size="lg"
                    className="w-full lg:w-auto"
                    disabled={
                      registerCompanyMutation.isPending ||
                      isSubmitting ||
                      !isCoreFieldsComplete
                    }
                  >
                    {registerCompanyMutation.isPending
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
                {(() => {
                  const { businessDetails, bankDetails, locationDetails } = watchAllValues;
                  return (
                    <>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-xs text-white/60 uppercase tracking-[0.45em]">
                            Business
                          </p>
                          <p className="text-lg font-semibold">
                            {watchAllValues.name || "Not set"}
                          </p>
                          <p className="text-xs text-white/70">
                            {watchAllValues.contactEmail || "No contact email yet"}
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
                    </>
                  );
                })()}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </ProviderShell>
  );
}

