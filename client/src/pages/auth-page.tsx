import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { ArrowLeft } from "lucide-react";

const residentRegisterSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  phone: z.string().min(10, "Phone number must be at least 10 digits"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  location: z.string().min(1, "Location is required"),
});

const providerRegisterSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  phone: z.string().min(10, "Phone number must be at least 10 digits"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  serviceCategory: z.enum(["electrician", "plumber", "carpenter", "market_runner"]),
  experience: z.number().min(0, "Experience must be 0 or greater"),
});

const residentLoginSchema = z.object({
  email: z.string().email("Invalid email address").optional(),
  password: z.string().optional(),
  accessCode: z.string().length(6, "Access code must be 6 digits").optional(),
}).refine(
  (data) => (data.email && data.password) || data.accessCode,
  "Either email/password or access code is required"
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

  // Redirect if already logged in
  if (user) {
    if (user.role === "resident") {
      setLocation("/resident");
    } else if (user.role === "provider") {
      setLocation("/provider");
    } else if (user.role === "admin") {
      setLocation("/admin");
    }
    return null;
  }

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
      location: "",
    },
  });

  const providerRegisterForm = useForm({
    resolver: zodResolver(providerRegisterSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      password: "",
      serviceCategory: "electrician" as const,
      experience: 0,
    },
  });

  const onLogin = async (data: any) => {
    try {
      if (userType === "resident") {
        if (data.accessCode) {
          await loginMutation.mutateAsync({ accessCode: data.accessCode });
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
      await registerMutation.mutateAsync({
        ...data,
        role: userType,
        isApproved: userType === "resident", // Residents auto-approved, providers need approval
        username: data.email,
      });
    } catch (error) {
      console.error("Registration failed:", error);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left side - Form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <Button 
            variant="ghost" 
            onClick={() => setLocation("/")}
            className="mb-4"
            data-testid="button-back-home"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Home
          </Button>

          <Card>
            <CardHeader className="text-center">
              <CardTitle className="text-2xl font-bold">
                {authMode === "login" ? "Welcome Back" : "Create Account"}
              </CardTitle>
              <CardDescription>
                {authMode === "login" 
                  ? "Sign in to access your account" 
                  : "Join CityConnect today"}
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-6">
              {/* User Type Toggle */}
              <Tabs value={userType} onValueChange={(value: any) => setUserType(value)}>
                <TabsList className="w-full">
                  <TabsTrigger value="resident" data-testid="tab-resident">Resident</TabsTrigger>
                  <TabsTrigger value="provider" data-testid="tab-provider">Service Provider</TabsTrigger>
                </TabsList>

                <TabsContent value="resident">
                  {authMode === "login" ? (
                    <div className="space-y-4">
                      {/* Login Method Toggle for Residents */}
                      <Tabs value={loginMethod} onValueChange={(value: any) => setLoginMethod(value)}>
                        <TabsList className="w-full">
                          <TabsTrigger value="email" data-testid="tab-email-login">Email Login</TabsTrigger>
                          <TabsTrigger value="code" data-testid="tab-code-login">Access Code</TabsTrigger>
                        </TabsList>

                        <TabsContent value="email">
                          <Form {...residentLoginForm}>
                            <form onSubmit={residentLoginForm.handleSubmit(onLogin)} className="space-y-4">
                              <FormField
                                control={residentLoginForm.control}
                                name="email"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>Email Address</FormLabel>
                                    <FormControl>
                                      <Input {...field} data-testid="input-email" />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                              <FormField
                                control={residentLoginForm.control}
                                name="password"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>Password</FormLabel>
                                    <FormControl>
                                      <Input type="password" {...field} data-testid="input-password" />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                              <Button 
                                type="submit" 
                                className="w-full" 
                                disabled={loginMutation.isPending}
                                data-testid="button-resident-login"
                              >
                                {loginMutation.isPending ? "Signing In..." : "Sign In"}
                              </Button>
                            </form>
                          </Form>
                        </TabsContent>

                        <TabsContent value="code">
                          <Form {...residentLoginForm}>
                            <form onSubmit={residentLoginForm.handleSubmit(onLogin)} className="space-y-4">
                              <FormField
                                control={residentLoginForm.control}
                                name="accessCode"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>Access Code</FormLabel>
                                    <FormControl>
                                      <Input 
                                        {...field} 
                                        placeholder="Enter 6-digit code"
                                        className="text-center text-2xl tracking-widest"
                                        maxLength={6}
                                        data-testid="input-access-code"
                                      />
                                    </FormControl>
                                    <FormMessage />
                                    <p className="text-xs text-muted-foreground">
                                      Code provided by your estate management
                                    </p>
                                  </FormItem>
                                )}
                              />
                              <Button 
                                type="submit" 
                                className="w-full" 
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
                      <form onSubmit={residentRegisterForm.handleSubmit(onRegister)} className="space-y-4">
                        <FormField
                          control={residentRegisterForm.control}
                          name="name"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Full Name</FormLabel>
                              <FormControl>
                                <Input {...field} data-testid="input-name" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={residentRegisterForm.control}
                          name="email"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Email Address</FormLabel>
                              <FormControl>
                                <Input {...field} data-testid="input-email" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={residentRegisterForm.control}
                          name="phone"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Phone Number</FormLabel>
                              <FormControl>
                                <Input {...field} data-testid="input-phone" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={residentRegisterForm.control}
                          name="password"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Password</FormLabel>
                              <FormControl>
                                <Input type="password" {...field} data-testid="input-password" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={residentRegisterForm.control}
                          name="location"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Location (Block/Flat)</FormLabel>
                              <FormControl>
                                <Input {...field} placeholder="e.g., Block 5, Flat 3B" data-testid="input-location" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <Button 
                          type="submit" 
                          className="w-full" 
                          disabled={registerMutation.isPending}
                          data-testid="button-resident-register"
                        >
                          {registerMutation.isPending ? "Creating Account..." : "Create Account"}
                        </Button>
                      </form>
                    </Form>
                  )}
                </TabsContent>

                <TabsContent value="provider">
                  {authMode === "login" ? (
                    <Form {...providerLoginForm}>
                      <form onSubmit={providerLoginForm.handleSubmit(onLogin)} className="space-y-4">
                        <FormField
                          control={providerLoginForm.control}
                          name="email"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Email Address</FormLabel>
                              <FormControl>
                                <Input {...field} data-testid="input-provider-email" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={providerLoginForm.control}
                          name="password"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Password</FormLabel>
                              <FormControl>
                                <Input type="password" {...field} data-testid="input-provider-password" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <Button 
                          type="submit" 
                          className="w-full" 
                          disabled={loginMutation.isPending}
                          data-testid="button-provider-login"
                        >
                          {loginMutation.isPending ? "Signing In..." : "Sign In as Provider"}
                        </Button>
                      </form>
                    </Form>
                  ) : (
                    <Form {...providerRegisterForm}>
                      <form onSubmit={providerRegisterForm.handleSubmit(onRegister)} className="space-y-4">
                        <FormField
                          control={providerRegisterForm.control}
                          name="name"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Full Name</FormLabel>
                              <FormControl>
                                <Input {...field} data-testid="input-provider-name" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={providerRegisterForm.control}
                          name="email"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Email Address</FormLabel>
                              <FormControl>
                                <Input {...field} data-testid="input-provider-email" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={providerRegisterForm.control}
                          name="phone"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Phone Number</FormLabel>
                              <FormControl>
                                <Input {...field} data-testid="input-provider-phone" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={providerRegisterForm.control}
                          name="password"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Password</FormLabel>
                              <FormControl>
                                <Input type="password" {...field} data-testid="input-provider-password" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={providerRegisterForm.control}
                          name="serviceCategory"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Service Category</FormLabel>
                              <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                  <SelectTrigger data-testid="select-service-category">
                                    <SelectValue placeholder="Select your service" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="electrician">Electrician</SelectItem>
                                  <SelectItem value="plumber">Plumber</SelectItem>
                                  <SelectItem value="carpenter">Carpenter</SelectItem>
                                  <SelectItem value="market_runner">Market Runner</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={providerRegisterForm.control}
                          name="experience"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Years of Experience</FormLabel>
                              <FormControl>
                                <Input 
                                  type="number" 
                                  {...field} 
                                  onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                                  data-testid="input-experience"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <Button 
                          type="submit" 
                          className="w-full" 
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

              <Separator />

              {/* Toggle between login and register */}
              <div className="text-center">
                <Button
                  variant="link"
                  onClick={() => setAuthMode(authMode === "login" ? "register" : "login")}
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

      {/* Right side - Hero */}
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
        </div>
      </div>
    </div>
  );
}
