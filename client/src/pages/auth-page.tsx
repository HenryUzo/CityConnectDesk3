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

type Company = {
  id: string;
  name: string;
  description?: string;
};


const residentRegisterSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  phone: z.string().min(10, "Phone number must be at least 10 digits"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  location: z.object({
    address: z.string().min(1, "Location is required"),
    latitude: z.number().optional(),
    longitude: z.number().optional(),
  }),
});

const providerRegisterSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
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
      name: "",
      email: "",
      phone: "",
      password: "",
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
      name: "",
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
      const res = await fetch("/api/companies");
      if (!res.ok) {
        throw new Error("Failed to load companies");
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

  // Redirect if already logged in - after all hooks are declared
  useEffect(() => {
    if (user) {
      if (user.role === "resident") {
        setLocation("/resident");
      } else if (user.role === "provider") {
        setLocation("/provider");
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
      if (userType === "resident") {
        if (data.accessCode) {
          await loginMutation.mutateAsync({ 
            username: data.accessCode,
            password: "x" // Dummy password for access code login
          });
        } else {
          await loginMutation.mutateAsync({ 
            username: data.email, 
            password: data.password 
          });
        }
      } else {
        await loginMutation.mutateAsync({ 
          username: data.email, 
          password: data.password 
        });
      }
    } catch (error) {
      console.error("Login failed:", error);
    }
  };

  const onRegister = async (data: any) => {
    try {
      // Transform location data for submission
      const submitData = {
        ...data,
        role: userType,
        isApproved: userType === "resident", // Residents auto-approved, providers need approval
        username: data.email,
      };

      // For residents, transform location object to string and add coordinates
      if (userType === "resident" && data.location) {
        submitData.location = data.location.address;
        submitData.latitude = data.location.latitude;
        submitData.longitude = data.location.longitude;
      }

      await registerMutation.mutateAsync(submitData);
    } catch (error) {
      console.error("Registration failed:", error);
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
                        <form onSubmit={residentRegisterForm.handleSubmit(onRegister)} className="space-y-4 sm:space-y-5 mt-4 sm:mt-6">
                          <FormField
                            control={residentRegisterForm.control}
                            name="name"
                            render={({ field }) => (
                              <FormItem className="space-y-1.5 sm:space-y-2">
                                <FormLabel className="text-sm sm:text-base font-medium">Full Name</FormLabel>
                                <FormControl>
                                  <Input 
                                    {...field} 
                                    autoComplete="name"
                                    className="h-11 sm:h-12 text-base"
                                    placeholder="Enter your full name"
                                    data-testid="input-name" 
                                  />
                                </FormControl>
                                <FormMessage className="text-xs sm:text-sm" />
                              </FormItem>
                            )}
                          />
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
                            name="location"
                            render={({ field }) => (
                              <FormItem className="space-y-1.5 sm:space-y-2">
                                <FormLabel className="text-sm sm:text-base font-medium">Location (Block/Flat)</FormLabel>
                                <FormControl>
                                  <Input
                                    placeholder="e.g., Block 5, Flat 3B"
                                    value={field.value.address}
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
                                    autoComplete="email"
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
                        <form onSubmit={providerRegisterForm.handleSubmit(onRegister)} className="space-y-4 sm:space-y-5">
                          <FormField
                            control={providerRegisterForm.control}
                            name="name"
                            render={({ field }) => (
                              <FormItem className="space-y-1.5 sm:space-y-2">
                                <FormLabel className="text-sm sm:text-base font-medium">Full Name</FormLabel>
                                <FormControl>
                                  <Input 
                                    {...field} 
                                    autoComplete="name"
                                    className="h-11 sm:h-12 text-base"
                                    placeholder="Enter your full name"
                                    data-testid="input-provider-name" 
                                  />
                                </FormControl>
                                <FormMessage className="text-xs sm:text-sm" />
                              </FormItem>
                            )}
                          />
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
                                    autoComplete="email"
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
                                        <SelectItem value="" disabled>
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
                  ✓
                </div>
                <span>Verified Service Providers</span>
              </div>
              <div className="flex items-center justify-center space-x-2">
                <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                  ✓
                </div>
                <span>Real-time Order Tracking</span>
              </div>
              <div className="flex items-center justify-center space-x-2">
                <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                  ✓
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
