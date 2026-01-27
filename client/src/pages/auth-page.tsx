import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type Company = {
  id: string;
  name: string;
  description?: string;
};

type EstateOption = {
  id: string;
  name: string;
  address?: string;
  slug?: string;
  accessType?: string | null;
};


const residentRegisterSchema = z.object({
  firstName: z.string().min(2, "First name must be at least 2 characters"),
  lastName: z.string().min(2, "Last name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  phone: z.string().min(10, "Phone number must be at least 10 digits"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  inviteCode: z.string().optional(),
  estateId: z.string().optional(),
  location: z.object({
    address: z.string().optional(),
    latitude: z.number().optional(),
    longitude: z.number().optional(),
  }),
});

const providerRegisterSchema = z.object({
  firstName: z.string().min(2, "First name must be at least 2 characters"),
  lastName: z.string().min(2, "Last name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  phone: z.string().min(10, "Phone number must be at least 10 digits"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  company: z.string().min(1, "Select a company"),
  experience: z.number().min(0, "Experience must be 0 or greater"),
});

const residentLoginSchema = z.object({
  email: z.string().optional(),
  password: z.string().optional(),
  accessCode: z.string().optional(),
}).refine(
  (data) => {
    // Access code login: just need accessCode with 6 digits
    if (data.accessCode) {
      return data.accessCode.length === 6;
    }
    // Email login: need valid email and password
    if (data.email && data.password) {
      return z.string().email().safeParse(data.email).success && data.password.length > 0;
    }
    return false;
  },
  {
    message: "Either provide a valid email/password or a 6-digit access code",
    path: ["root"] // Show error at form level, not field level
  }
);

const providerLoginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

export default function AuthPage() {
  const [, setLocation] = useLocation();
  const { user, loginMutation, registerMutation } = useAuth();
  const { toast } = useToast();
  const [userType, setUserType] = useState<"resident" | "provider">("resident");
  const [loginMethod, setLoginMethod] = useState<"email" | "code">("email");
  const [authMode, setAuthMode] = useState<"login" | "register">("login");

  // All hook calls must be above any conditional returns
  const residentLoginForm = useForm({
    resolver: zodResolver(residentLoginSchema),
    defaultValues: {
      email: "",
      password: "",
      accessCode: "",
    },
  });

  const providerLoginForm = useForm({
    resolver: zodResolver(providerLoginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const residentRegisterForm = useForm({
    resolver: zodResolver(residentRegisterSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      password: "",
      inviteCode: "",
      estateId: "",
      location: {
        address: "",
        latitude: undefined,
        longitude: undefined,
      },
    },
  });

  const providerRegisterForm = useForm({
    resolver: zodResolver(providerRegisterSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      password: "",
      company: "",
      experience: 0,
    },
  });

  const { data: companies = [], isLoading: isCompaniesLoading } = useQuery<Company[]>({
    queryKey: ["companies"],
    queryFn: async () => {
      const res = await fetch("/api/companies?public=true");
      if (!res.ok) {
        throw new Error("Failed to load companies");
      }
      return res.json();
    },
    enabled: authMode === "register" && userType === "provider",
    staleTime: 1000 * 60 * 5,
  });

  const { data: openAccessEstates = [] } = useQuery<EstateOption[]>({
    queryKey: ["public-estates", "open-access"],
    queryFn: async () => {
      const res = await fetch("/api/estates?filter=open-access");
      if (!res.ok) {
        throw new Error("Failed to load estates");
      }
      return res.json();
    },
    staleTime: 1000 * 60 * 5,
  });

  useEffect(() => {
    if (
      authMode === "register" &&
      userType === "provider" &&
      companies.length > 0 &&
      !providerRegisterForm.getValues("company")
    ) {
      const defaultCompany = companies[0].name || companies[0].id;
      if (defaultCompany) {
        providerRegisterForm.setValue("company", defaultCompany);
      }
    }
  }, [authMode, userType, companies, providerRegisterForm]);

  const inviteCodeValue = residentRegisterForm.watch("inviteCode");
  const estateSelectionDisabled = Boolean(inviteCodeValue && inviteCodeValue.trim().length > 0);

  // Redirect if already logged in - after all hooks are declared
  useEffect(() => {
    if (user) {
      if (user.role === "resident") {
        setLocation("/resident");
      } else if (user.role === "provider") {
        if (user.isApproved === false) {
          setLocation("/waiting-room");
        } else {
          setLocation("/provider");
        }
      } else if (user.role === "admin") {
        setLocation("/admin");
      }
    }
  }, [user, setLocation]);

  if (user) {
    return null;
  }

  const onLogin = async (data: any) => {
    try {
      let loginData;
      
      if (userType === "resident") {
        if (data.accessCode) {
          loginData = { 
            username: data.accessCode,
            password: "x" // Dummy password for access code login
          };
        } else {
          loginData = { 
            username: data.email, 
            password: data.password 
          };
        }
      } else {
        loginData = { 
          username: data.email, 
          password: data.password 
        };
      }
      
      const loggedInUser = await loginMutation.mutateAsync(loginData);
      
      // Handle redirect immediately after login
      if (loggedInUser) {
        if (loggedInUser.role === "resident") {
          setLocation("/resident");
        } else if (loggedInUser.role === "provider") {
          if (loggedInUser.isApproved === false) {
            setLocation("/waiting-room");
          } else {
            setLocation("/provider");
          }
        } else if (loggedInUser.role === "admin") {
          setLocation("/admin");
        }
      }
    } catch (error) {
      console.error("Login failed:", error);
    }
  };

  const onRegister = async (data: any) => {
    try {
      if (userType === "provider") {
        const payload = {
          firstName: data.firstName,
          lastName: data.lastName,
          name: [data.firstName, data.lastName].filter(Boolean).join(" ").trim(),
          email: data.email,
          phone: data.phone,
          company: data.company || "",
          experience: Number.isFinite(Number(data.experience)) ? Number(data.experience) : 0,
          password: data.password,
        };

        const res = await fetch("/api/company/provider-requests", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          throw new Error(errorData?.message || "Signup failed.");
        }

        toast({
          title: "Provider request submitted",
          description: "Your provider account has been submitted for approval.",
        });
        setAuthMode("login");
        setUserType("provider");
        return;
      }

      // Transform location data for submission
      const fullName = [data.firstName, data.lastName]
        .filter(Boolean)
        .join(" ")
        .trim();
      const submitData = {
        ...data,
        role: userType,
        isApproved: userType === "resident", // Residents auto-approved, providers need approval
        username: data.email,
        name: fullName || data.email || data.username || "",
      };

      // For residents, transform location object to string and add coordinates
      if (userType === "resident" && data.location) {
        submitData.location = data.location.address;
        submitData.latitude = data.location.latitude;
        submitData.longitude = data.location.longitude;
        const invite = data.inviteCode?.trim();
        const estate = data.estateId?.trim();
        if (invite) {
          submitData.inviteCode = invite;
          delete submitData.estateId;
        } else if (estate) {
          submitData.estateId = estate;
          delete submitData.inviteCode;
        } else {
          delete submitData.inviteCode;
          delete submitData.estateId;
        }
      }

      await registerMutation.mutateAsync(submitData);
      toast({
        title: "Account created successfully",
      });
      setAuthMode("login");
      setUserType("resident");
    } catch (error: any) {
      const message =
        error?.message || error?.response?.data?.message || "Signup failed.";
      toast({
        title: "Registration failed",
        description: message,
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile-first layout with responsive design */}
      <div className="flex flex-col lg:flex-row min-h-screen">
        {/* Form Container - Full width on mobile, left side on desktop */}
        <div className="flex-1 flex items-center justify-center p-4 sm:p-6 lg:p-8">
          <div className="w-full max-w-sm sm:max-w-md">
            <Button 
              variant="ghost" 
              onClick={() => setLocation("/")}
              className="mb-4 sm:mb-6 h-10 sm:h-11 min-h-[44px] px-3 sm:px-4"
              data-testid="button-back-home"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              <span className="text-sm sm:text-base">Back to Home</span>
            </Button>

            <Card className="border-0 sm:border shadow-none sm:shadow-sm">
              <CardHeader className="text-center px-4 sm:px-6 pt-4 sm:pt-6 pb-4 sm:pb-6">
                <CardTitle className="text-xl sm:text-2xl font-bold">
                  {authMode === "login" ? "Welcome Back" : "Create Account"}
                </CardTitle>
                <CardDescription className="text-sm sm:text-base mt-2">
                  {authMode === "login" 
                    ? "Sign in to access your account" 
                    : "Join CityConnect today"}
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-4 sm:space-y-6 px-4 sm:px-6 pb-4 sm:pb-6">
                {/* User Type Toggle - Mobile optimized */}
                <Tabs value={userType} onValueChange={(value: any) => setUserType(value)}>
                  <TabsList className="w-full h-10 sm:h-11 p-1">
                    <TabsTrigger 
                      value="resident" 
                      data-testid="tab-resident"
                      className="flex-1 h-8 sm:h-9 min-h-[44px] text-xs sm:text-sm font-medium px-2 sm:px-4"
                    >
                      Resident
                    </TabsTrigger>
                    <TabsTrigger 
                      value="provider" 
                      data-testid="tab-provider"
                      className="flex-1 h-8 sm:h-9 min-h-[44px] text-xs sm:text-sm font-medium px-2 sm:px-4"
                    >
                      Provider
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="resident" className="mt-4 sm:mt-6">
                    {authMode === "login" ? (
                      <div className="space-y-4 sm:space-y-6">
                        {/* Login Method Toggle for Residents - Mobile optimized */}
                        <Tabs value={loginMethod} onValueChange={(value: any) => setLoginMethod(value)}>
                          <TabsList className="w-full h-10 sm:h-11 p-1">
                            <TabsTrigger 
                              value="email" 
                              data-testid="tab-email-login"
                              className="flex-1 h-8 sm:h-9 min-h-[44px] text-xs sm:text-sm font-medium px-2 sm:px-3"
                            >
                              Email
                            </TabsTrigger>
                            <TabsTrigger 
                              value="code" 
                              data-testid="tab-code-login"
                              className="flex-1 h-8 sm:h-9 min-h-[44px] text-xs sm:text-sm font-medium px-2 sm:px-3"
                            >
                              Access Code
                            </TabsTrigger>
                          </TabsList>

                          <TabsContent value="email" className="mt-4 sm:mt-6">
                            <Form {...residentLoginForm}>
                              <form onSubmit={residentLoginForm.handleSubmit(onLogin)} className="space-y-4 sm:space-y-5">
                                <FormField
                                  control={residentLoginForm.control}
                                  name="email"
                                  render={({ field }) => (
                                    <FormItem className="space-y-1.5 sm:space-y-2">
                                      <FormLabel className="text-sm sm:text-base font-medium">Email Address</FormLabel>
                                      <FormControl>
                                        <Input 
                                          {...field} 
                                          type="email"
                                          inputMode="email"
                                          autoComplete="email"
                                          className="h-11 sm:h-12 text-base"
                                          placeholder="Enter your email"
                                          data-testid="input-email" 
                                        />
                                      </FormControl>
                                      <FormMessage className="text-xs sm:text-sm" />
                                    </FormItem>
                                  )}
                                />
                                <FormField
                                  control={residentLoginForm.control}
                                  name="password"
                                  render={({ field }) => (
                                    <FormItem className="space-y-1.5 sm:space-y-2">
                                      <FormLabel className="text-sm sm:text-base font-medium">Password</FormLabel>
                                      <FormControl>
                                        <PasswordInput 
                                          autoComplete="current-password"
                                          className="h-11 sm:h-12 text-base"
                                          placeholder="Enter your password"
                                          {...field} 
                                          data-testid="input-password" 
                                        />
                                      </FormControl>
                                      <FormMessage className="text-xs sm:text-sm" />
                                    </FormItem>
                                  )}
                                />
                                <Button 
                                  type="submit" 
                                  className="w-full h-12 sm:h-13 min-h-[48px] text-base font-medium mt-6" 
                                  disabled={loginMutation.isPending}
                                  data-testid="button-resident-login"
                                >
                                  {loginMutation.isPending ? "Signing In..." : "Sign In"}
                                </Button>
                              </form>
                            </Form>
                          </TabsContent>

                          <TabsContent value="code" className="mt-4 sm:mt-6">
                            <Form {...residentLoginForm}>
                              <form onSubmit={residentLoginForm.handleSubmit(onLogin)} className="space-y-5 sm:space-y-6">
                                <FormField
                                  control={residentLoginForm.control}
                                  name="accessCode"
                                  render={({ field }) => (
                                    <FormItem className="space-y-2 sm:space-y-3">
                                      <FormLabel className="text-sm sm:text-base font-medium text-center block">Access Code</FormLabel>
                                      <FormControl>
                                        <Input 
                                          {...field} 
                                          placeholder="000000"
                                          inputMode="numeric"
                                          pattern="[0-9]*"
                                          className="text-center text-xl sm:text-2xl tracking-[0.3em] sm:tracking-widest h-14 sm:h-16 font-mono border-2 focus:border-primary"
                                          maxLength={6}
                                          autoComplete="one-time-code"
                                          data-testid="input-access-code"
                                        />
                                      </FormControl>
                                      <FormMessage className="text-xs sm:text-sm text-center" />
                                      <p className="text-xs sm:text-sm text-muted-foreground text-center mt-2">
                                        Code provided by your estate management
                                      </p>
                                    </FormItem>
                                  )}
                                />
                                <Button 
                                  type="submit" 
                                  className="w-full h-12 sm:h-13 min-h-[48px] text-base font-medium mt-6" 
                                  disabled={loginMutation.isPending}
                                  data-testid="button-access-code-login"
                                >
                                  {loginMutation.isPending ? "Accessing..." : "Access Dashboard"}
                                </Button>
                              </form>
                            </Form>
                          </TabsContent>
                      </Tabs>
                    </div>
                    ) : (
                      <Form {...residentRegisterForm}>
                        <form autoComplete="new-password" onSubmit={residentRegisterForm.handleSubmit(onRegister)} className="space-y-4 sm:space-y-5 mt-4 sm:mt-6">
                          <div className="sr-only" aria-hidden="true">
                            <input type="text" name="username" autoComplete="username" tabIndex={-1} />
                            <input type="password" name="password" autoComplete="new-password" tabIndex={-1} />
                          </div>
                          <div className="grid grid-cols-2 gap-3 sm:gap-4">
                            <FormField
                              control={residentRegisterForm.control}
                              name="firstName"
                              render={({ field }) => (
                                <FormItem className="space-y-1.5 sm:space-y-2">
                                  <FormLabel className="text-sm sm:text-base font-medium">First Name</FormLabel>
                                  <FormControl>
                                    <Input 
                                      {...field} 
                                      autoComplete="given-name"
                                      className="h-11 sm:h-12 text-base"
                                      placeholder="First name"
                                      data-testid="input-first-name" 
                                    />
                                  </FormControl>
                                  <FormMessage className="text-xs sm:text-sm" />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={residentRegisterForm.control}
                              name="lastName"
                              render={({ field }) => (
                                <FormItem className="space-y-1.5 sm:space-y-2">
                                  <FormLabel className="text-sm sm:text-base font-medium">Last Name</FormLabel>
                                  <FormControl>
                                    <Input 
                                      {...field} 
                                      autoComplete="family-name"
                                      className="h-11 sm:h-12 text-base"
                                      placeholder="Last name"
                                      data-testid="input-last-name" 
                                    />
                                  </FormControl>
                                  <FormMessage className="text-xs sm:text-sm" />
                                </FormItem>
                              )}
                            />
                          </div>
                          <FormField
                            control={residentRegisterForm.control}
                            name="email"
                            render={({ field }) => (
                              <FormItem className="space-y-1.5 sm:space-y-2">
                                <FormLabel className="text-sm sm:text-base font-medium">Email Address</FormLabel>
                                <FormControl>
                                  <Input 
                                    {...field} 
                                    type="email"
                                    inputMode="email"
                                    autoComplete="off"
                                    data-lpignore="true"
                                    data-bwignore="true"
                                    data-1p-ignore="true"
                                    data-form-type="other"
                                    autoCapitalize="none"
                                    autoCorrect="off"
                                    spellCheck={false}
                                    className="h-11 sm:h-12 text-base"
                                    placeholder="Enter your email"
                                    data-testid="input-email" 
                                  />
                                </FormControl>
                                <FormMessage className="text-xs sm:text-sm" />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={residentRegisterForm.control}
                            name="phone"
                            render={({ field }) => (
                              <FormItem className="space-y-1.5 sm:space-y-2">
                                <FormLabel className="text-sm sm:text-base font-medium">Phone Number</FormLabel>
                                <FormControl>
                                  <Input 
                                    {...field} 
                                    type="tel"
                                    inputMode="tel"
                                    autoComplete="tel"
                                    className="h-11 sm:h-12 text-base"
                                    placeholder="Enter your phone number"
                                    data-testid="input-phone" 
                                  />
                                </FormControl>
                                <FormMessage className="text-xs sm:text-sm" />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={residentRegisterForm.control}
                            name="password"
                            render={({ field }) => (
                              <FormItem className="space-y-1.5 sm:space-y-2">
                                <FormLabel className="text-sm sm:text-base font-medium">Password</FormLabel>
                                <FormControl>
                                  <PasswordInput 
                                    autoComplete="new-password"
                                    className="h-11 sm:h-12 text-base"
                                    placeholder="Create a password"
                                    {...field} 
                                    data-testid="input-password" 
                                  />
                                </FormControl>
                                <FormMessage className="text-xs sm:text-sm" />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={residentRegisterForm.control}
                            name="estateId"
                            render={({ field }) => (
                              <FormItem className="space-y-1.5 sm:space-y-2">
                                <FormLabel className="text-sm sm:text-base font-medium">Estate or Region</FormLabel>
                                <FormControl>
                                  <Select
                                    value={field.value || ""}
                                    onValueChange={(value) => {
                                      field.onChange(value);
                                      if (value) {
                                        residentRegisterForm.setValue("inviteCode", "");
                                      }
                                    }}
                                    disabled={estateSelectionDisabled}
                                  >
                                    <SelectTrigger className="h-11 sm:h-12 text-base">
                                      <SelectValue placeholder="Select your estate or region" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {openAccessEstates.length > 0 ? (
                                        openAccessEstates.map((estate) => (
                                          <SelectItem key={estate.id} value={estate.id}>
                                            <div className="flex flex-col">
                                              <span className="font-medium">{estate.name}</span>
                                              {estate.address ? (
                                                <span className="text-xs text-muted-foreground">{estate.address}</span>
                                              ) : null}
                                            </div>
                                          </SelectItem>
                                        ))
                                      ) : (
                                        <SelectItem value="none" disabled>
                                          No estates available
                                        </SelectItem>
                                      )}
                                    </SelectContent>
                                  </Select>
                                </FormControl>
                                <FormMessage className="text-xs sm:text-sm" />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={residentRegisterForm.control}
                            name="inviteCode"
                            render={({ field }) => (
                              <FormItem className="space-y-1.5 sm:space-y-2">
                                <FormLabel className="text-sm sm:text-base font-medium">Access Code (optional)</FormLabel>
                                <FormControl>
                                  <Input
                                    {...field}
                                    className="h-11 sm:h-12 text-base"
                                    placeholder="Enter invite/access code"
                                    onChange={(e) => {
                                      field.onChange(e.target.value);
                                      if (e.target.value) {
                                        residentRegisterForm.setValue("estateId", "");
                                      }
                                    }}
                                    data-testid="input-resident-access-code"
                                  />
                                </FormControl>
                                <FormMessage className="text-xs sm:text-sm" />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={residentRegisterForm.control}
                            name="location"
                            render={({ field }) => (
                              <FormItem className="space-y-1.5 sm:space-y-2">
                                <FormLabel className="text-sm sm:text-base font-medium">Location (Block/Flat, optional)</FormLabel>
                                <FormControl>
                                  <Input
                                    placeholder="e.g., Block 5, Flat 3B"
                                    value={field.value?.address || ""}
                                    onChange={(e) => field.onChange({
                                      address: e.target.value,
                                      latitude: undefined,
                                      longitude: undefined
                                    })}
                                    className="w-full"
                                    data-testid="input-location"
                                  />
                                </FormControl>
                                <FormMessage className="text-xs sm:text-sm" />
                              </FormItem>
                            )}
                          />
                          <Button 
                            type="submit" 
                            className="w-full h-12 sm:h-13 min-h-[48px] text-base font-medium mt-6" 
                            disabled={registerMutation.isPending}
                            data-testid="button-resident-register"
                          >
                            {registerMutation.isPending ? "Creating Account..." : "Create Account"}
                          </Button>
                        </form>
                      </Form>
                    )}
                </TabsContent>

                  <TabsContent value="provider" className="mt-4 sm:mt-6">
                    {authMode === "login" ? (
                      <Form {...providerLoginForm}>
                        <form onSubmit={providerLoginForm.handleSubmit(onLogin)} className="space-y-4 sm:space-y-5">
                          <FormField
                            control={providerLoginForm.control}
                            name="email"
                            render={({ field }) => (
                              <FormItem className="space-y-1.5 sm:space-y-2">
                                <FormLabel className="text-sm sm:text-base font-medium">Email Address</FormLabel>
                                <FormControl>
                                  <Input 
                                    {...field} 
                                    type="email"
                                    inputMode="email"
                                    autoComplete="off"
                                    autoCapitalize="none"
                                    autoCorrect="off"
                                    spellCheck={false}
                                    className="h-11 sm:h-12 text-base"
                                    placeholder="Enter your email"
                                    data-testid="input-provider-email" 
                                  />
                                </FormControl>
                                <FormMessage className="text-xs sm:text-sm" />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={providerLoginForm.control}
                            name="password"
                            render={({ field }) => (
                              <FormItem className="space-y-1.5 sm:space-y-2">
                                <FormLabel className="text-sm sm:text-base font-medium">Password</FormLabel>
                                <FormControl>
                                  <PasswordInput 
                                    autoComplete="current-password"
                                    className="h-11 sm:h-12 text-base"
                                    placeholder="Enter your password"
                                    {...field} 
                                    data-testid="input-provider-password" 
                                  />
                                </FormControl>
                                <FormMessage className="text-xs sm:text-sm" />
                              </FormItem>
                            )}
                          />
                          <Button 
                            type="submit" 
                            className="w-full h-12 sm:h-13 min-h-[48px] text-base font-medium mt-6" 
                            disabled={loginMutation.isPending}
                            data-testid="button-provider-login"
                          >
                            {loginMutation.isPending ? "Signing In..." : "Sign In as Provider"}
                          </Button>
                        </form>
                      </Form>
                    ) : (
                      <Form {...providerRegisterForm}>
                        {/* Disable browser autofill on registration form to avoid credentials leaking into wrong fields */}
                        <form autoComplete="new-password" onSubmit={providerRegisterForm.handleSubmit(onRegister)} className="space-y-4 sm:space-y-5">
                          <div className="sr-only" aria-hidden="true">
                            <input type="text" name="username" autoComplete="username" tabIndex={-1} />
                            <input type="password" name="password" autoComplete="new-password" tabIndex={-1} />
                          </div>
                          <div className="grid grid-cols-2 gap-3 sm:gap-4">
                            <FormField
                              control={providerRegisterForm.control}
                              name="firstName"
                              render={({ field }) => (
                                <FormItem className="space-y-1.5 sm:space-y-2">
                                  <FormLabel className="text-sm sm:text-base font-medium">First Name</FormLabel>
                                  <FormControl>
                                    <Input 
                                      {...field} 
                                      autoComplete="given-name"
                                      className="h-11 sm:h-12 text-base"
                                      placeholder="First name"
                                      data-testid="input-provider-first-name" 
                                    />
                                  </FormControl>
                                  <FormMessage className="text-xs sm:text-sm" />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={providerRegisterForm.control}
                              name="lastName"
                              render={({ field }) => (
                                <FormItem className="space-y-1.5 sm:space-y-2">
                                  <FormLabel className="text-sm sm:text-base font-medium">Last Name</FormLabel>
                                  <FormControl>
                                    <Input 
                                      {...field} 
                                      autoComplete="family-name"
                                      className="h-11 sm:h-12 text-base"
                                      placeholder="Last name"
                                      data-testid="input-provider-last-name" 
                                    />
                                  </FormControl>
                                  <FormMessage className="text-xs sm:text-sm" />
                                </FormItem>
                              )}
                            />
                          </div>
                          <FormField
                            control={providerRegisterForm.control}
                            name="email"
                            render={({ field }) => (
                              <FormItem className="space-y-1.5 sm:space-y-2">
                                <FormLabel className="text-sm sm:text-base font-medium">Email Address</FormLabel>
                                <FormControl>
                                  <Input 
                                    {...field} 
                                    type="email"
                                    inputMode="email"
                                    autoComplete="off"
                                    data-lpignore="true"
                                    data-bwignore="true"
                                    data-1p-ignore="true"
                                    data-form-type="other"
                                    autoCapitalize="none"
                                    autoCorrect="off"
                                    spellCheck={false}
                                    className="h-11 sm:h-12 text-base"
                                    placeholder="Enter your email"
                                    data-testid="input-provider-email" 
                                  />
                                </FormControl>
                                <FormMessage className="text-xs sm:text-sm" />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={providerRegisterForm.control}
                            name="phone"
                            render={({ field }) => (
                              <FormItem className="space-y-1.5 sm:space-y-2">
                                <FormLabel className="text-sm sm:text-base font-medium">Phone Number</FormLabel>
                                <FormControl>
                                  <Input 
                                    {...field} 
                                    type="tel"
                                    inputMode="tel"
                                    autoComplete="tel"
                                    className="h-11 sm:h-12 text-base"
                                    placeholder="Enter your phone number"
                                    data-testid="input-provider-phone" 
                                  />
                                </FormControl>
                                <FormMessage className="text-xs sm:text-sm" />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={providerRegisterForm.control}
                            name="password"
                            render={({ field }) => (
                              <FormItem className="space-y-1.5 sm:space-y-2">
                                <FormLabel className="text-sm sm:text-base font-medium">Password</FormLabel>
                                <FormControl>
                                  <PasswordInput 
                                    autoComplete="new-password"
                                    className="h-11 sm:h-12 text-base"
                                    placeholder="Create a password"
                                    {...field} 
                                    data-testid="input-provider-password" 
                                  />
                                </FormControl>
                                <FormMessage className="text-xs sm:text-sm" />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={providerRegisterForm.control}
                            name="company"
                            render={({ field }) => (
                              <FormItem className="space-y-1.5 sm:space-y-2">
                                <FormLabel className="text-sm sm:text-base font-medium">Company</FormLabel>
                                <FormControl>
                                  <Select
                                    onValueChange={field.onChange}
                                    value={field.value || undefined}
                                    disabled={isCompaniesLoading}
                                  >
                                    <SelectTrigger
                                      className="h-11 sm:h-12 text-base"
                                      data-testid="select-company"
                                    >
                                      <SelectValue
                                        placeholder={
                                          isCompaniesLoading
                                            ? "Loading companies..."
                                            : "Select your company"
                                        }
                                      />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {companies.length === 0 ? (
                                        <SelectItem value="placeholder" disabled>
                                          {isCompaniesLoading
                                            ? "Loading companies..."
                                            : "No companies available"}
                                        </SelectItem>
                                      ) : (
                                        companies.map((company) => (
                                          <SelectItem
                                            key={company.id}
                                            value={company.name || company.id}
                                          >
                                            {company.name || company.id}
                                          </SelectItem>
                                        ))
                                      )}
                                    </SelectContent>
                                  </Select>
                                </FormControl>
                                <FormMessage className="text-xs sm:text-sm" />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={providerRegisterForm.control}
                            name="experience"
                            render={({ field }) => (
                              <FormItem className="space-y-1.5 sm:space-y-2">
                                <FormLabel className="text-sm sm:text-base font-medium">Years of Experience</FormLabel>
                                <FormControl>
                                  <Input 
                                    type="number" 
                                    inputMode="numeric"
                                    min="0"
                                    max="50"
                                    className="h-11 sm:h-12 text-base"
                                    placeholder="Enter years of experience"
                                    {...field} 
                                    onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                                    data-testid="input-experience"
                                  />
                                </FormControl>
                                <FormMessage className="text-xs sm:text-sm" />
                              </FormItem>
                            )}
                          />
                          <Button 
                            type="submit" 
                            className="w-full h-12 sm:h-13 min-h-[48px] text-base font-medium mt-6" 
                            disabled={registerMutation.isPending}
                            data-testid="button-provider-register"
                          >
                            {registerMutation.isPending ? "Creating Account..." : "Create Provider Account"}
                          </Button>
                        </form>
                      </Form>
                    )}
                </TabsContent>
              </Tabs>

                <Separator className="my-6 sm:my-8" />

                <div className="text-center space-y-2">
                  <p className="text-xs sm:text-sm text-muted-foreground px-4">
                    Running a business? Register your services and get access to the CityConnect marketplace.
                  </p>
                  <Button
                    variant="secondary"
                    onClick={() => setLocation("/company-registration")}
                    className="h-10 sm:h-11 min-h-[44px] w-full"
                    data-testid="button-register-business"
                  >
                    Register as a business
                  </Button>
                </div>

                {/* Toggle between login and register - Mobile optimized */}
                <div className="text-center">
                  <Button
                    variant="link"
                    onClick={() => setAuthMode(authMode === "login" ? "register" : "login")}
                    className="h-10 sm:h-11 min-h-[44px] text-sm sm:text-base px-4 py-2"
                    data-testid="button-toggle-auth-mode"
                  >
                    {authMode === "login" 
                      ? "Don't have an account? Sign up" 
                      : "Already have an account? Sign in"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Right side - Hero - Desktop only */}
        <div className="hidden lg:flex lg:flex-1 bg-gradient-to-br from-primary to-accent items-center justify-center p-8">
          <div className="text-center text-white max-w-md">
            <h1 className="text-4xl font-bold mb-4">CityConnect</h1>
            <p className="text-xl opacity-90 mb-8">
              Your gateway to quality estate services. Connect with trusted professionals and get things done efficiently.
            </p>
            <div className="space-y-4">
              <div className="flex items-center justify-center space-x-2">
                <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                  Ô£ô
                </div>
                <span>Verified Service Providers</span>
              </div>
              <div className="flex items-center justify-center space-x-2">
                <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                  Ô£ô
                </div>
                <span>Real-time Order Tracking</span>
              </div>
              <div className="flex items-center justify-center space-x-2">
                <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                  Ô£ô
                </div>
                <span>Secure Payments</span>
              </div>
            </div>
            <div className="mt-8 flex justify-center">
              <Button
                variant="outline"
                className="h-10 sm:h-11 min-h-[44px]"
                onClick={() => setLocation("/company-registration")}
                data-testid="button-hero-register-business"
              >
                Register as a business
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

