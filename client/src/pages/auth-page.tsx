import { useState, useEffect } from "react";
import type { ReactNode } from "react";
import { useRef } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { ChevronLeft, ChevronRight, Clock3, CreditCard, Leaf, ShieldCheck } from "lucide-react";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import handymanFoyerImage from "@/assets/auth/handyman_in_a_modern_foyer.png";
import confidentTradesmanImage from "@/assets/auth/confident_tradesman_in_modern_home_setting.png";
import cleanerHomeImage from "@/assets/auth/bright_and_tidy_home_space_with_cleaner.png";
import gardenerGardenImage from "@/assets/auth/gardener_in_a_lush_modern_garden.png";
import smilingHandymanImage from "@/assets/auth/smiling_handyman_in_a_modern_home.png";

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

type OtpStartResponse = {
  challengeId: string;
  expiresIn: number;
  resendAvailableIn: number;
  maskedDestination: string;
  pendingRegistrationId?: string | null;
  debugCode?: string;
};

declare global {
  interface Window {
    google?: {
      accounts?: {
        id?: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential?: string }) => void;
            auto_select?: boolean;
            ux_mode?: "popup" | "redirect";
          }) => void;
          renderButton: (
            parent: HTMLElement,
            options: {
              type?: "standard" | "icon";
              theme?: "outline" | "filled_blue" | "filled_black";
              size?: "large" | "medium" | "small";
              text?: "signin_with" | "signup_with" | "continue_with" | "signin";
              shape?: "rectangular" | "pill" | "circle" | "square";
              logo_alignment?: "left" | "center";
              width?: number;
            },
          ) => void;
          cancel?: () => void;
        };
      };
    };
  }
}

const GOOGLE_CLIENT_ID = String(import.meta.env.VITE_GOOGLE_CLIENT_ID || "").trim();


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
  companyMode: z.enum(["existing", "new"]),
  companyId: z.string().optional(),
  newCompanyName: z.string().optional(),
  newCompanyDescription: z.string().optional(),
  experience: z.number().min(0, "Experience must be 0 or greater"),
}).refine(
  (data) => {
    if (data.companyMode === "existing") {
      return Boolean(data.companyId && data.companyId.trim().length > 0);
    }
    return Boolean(data.newCompanyName && data.newCompanyName.trim().length > 0);
  },
  {
    message: "Select a company or enter a new company name",
    path: ["companyId"],
  }
);

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

const AUTH_PRIMARY_BUTTON_CLASS =
  "h-[52px] min-h-[52px] w-full rounded-[20px] bg-[#0B4A2E] text-[15px] font-semibold text-white shadow-[0_18px_34px_-20px_rgba(11,74,46,0.95)] transition hover:bg-[#083B25] focus-visible:ring-2 focus-visible:ring-[#A9D6B8] focus-visible:ring-offset-2 disabled:bg-[#7D9B8E]";

const AUTH_SECONDARY_BUTTON_CLASS =
  "h-11 min-h-[44px] rounded-2xl border border-[#C8D8CD] bg-white/55 text-[14px] font-semibold text-[#0F5132] shadow-none hover:bg-[#EEF7F0] hover:text-[#0B3D28]";

const SEGMENTED_LIST_CLASS =
  "grid h-12 w-full gap-1 rounded-[20px] border border-[#D8E3D7] bg-[#EEF4EA]/72 p-1 shadow-inner shadow-white/70";

const SEGMENTED_TRIGGER_CLASS =
  "h-10 min-h-[40px] rounded-2xl text-sm font-semibold text-[#587367] transition data-[state=active]:bg-white data-[state=active]:text-[#0F5132] data-[state=active]:shadow-[0_10px_22px_-16px_rgba(15,81,50,0.85)]";

type AuthCarouselSlide = {
  id: string;
  image: string;
  badge: string;
  title: string;
  description: string;
  alt: string;
  objectPosition?: string;
  imageClassName?: string;
};

const AUTH_CAROUSEL_SLIDES: AuthCarouselSlide[] = [
  {
    id: "general-maintenance",
    image: handymanFoyerImage,
    badge: "Estate living, handled calmly",
    title: "CityConnect",
    description: "A cleaner way to request trusted maintenance, manage home care, and stay close to estate support.",
    alt: "African handyman in a modern foyer ready for household maintenance work",
    objectPosition: "58% center",
  },
  {
    id: "tradesman-plumbing",
    image: confidentTradesmanImage,
    badge: "Trusted trades, coordinated simply",
    title: "Skilled help, on schedule",
    description: "Book plumbing, repairs, and specialist estate services with clear updates from request to completion.",
    alt: "Confident African tradesman in a modern home setting holding plumbing tools",
    objectPosition: "60% center",
  },
  {
    id: "home-cleaning",
    image: cleanerHomeImage,
    badge: "Cleaner homes, calmer days",
    title: "Care for every room",
    description: "Find reliable cleaning and home support teams that keep your space ready, healthy, and comfortable.",
    alt: "African cleaner in a bright tidy home holding eco-friendly cleaning supplies",
    objectPosition: "61% center",
  },
  {
    id: "outdoor-care",
    image: gardenerGardenImage,
    badge: "Outdoor care, neatly managed",
    title: "Green spaces looked after",
    description: "Coordinate gardening and outdoor maintenance through the same trusted CityConnect service flow.",
    alt: "African gardener in a lush modern garden carrying outdoor care tools",
    objectPosition: "61% center",
  },
  {
    id: "home-repairs",
    image: smilingHandymanImage,
    badge: "Reliable help around the home",
    title: "Repairs without the runaround",
    description: "Connect with vetted artisans for everyday fixes, preventive care, and responsive home support.",
    alt: "Smiling African handyman walking through a modern home with a toolbox",
    objectPosition: "60% center",
  },
];

const AUTH_FEATURES = [
  {
    icon: ShieldCheck,
    title: "Trusted providers",
    description: "Verified artisans and service teams for estate work.",
  },
  {
    icon: Clock3,
    title: "Transparent progress",
    description: "Track requests, schedules, messages, and approvals in one place.",
  },
  {
    icon: CreditCard,
    title: "Secure payments",
    description: "Pay and confirm work through the CityConnect flow.",
  },
];

function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden bg-[#F7F4EC] text-[#10281F]">
      <section className="relative h-screen w-full overflow-y-auto bg-[#F7F4EC] px-5 py-8 sm:px-8 lg:w-[45%] lg:px-10 lg:py-12">
        <div className="pointer-events-none absolute -left-28 top-8 h-72 w-72 rounded-full bg-[#DDEFE3]/72 blur-3xl" />
        <div className="pointer-events-none absolute -right-24 bottom-24 h-64 w-64 rounded-full bg-[#B8D8C2]/38 blur-3xl" />
        <div className="relative mx-auto flex min-h-full w-full max-w-[610px] flex-col justify-center">
          {children}
        </div>
      </section>
      <CarouselPanel />
    </div>
  );
}

function AuthForm({ children }: { children: ReactNode }) {
  return (
    <Card className="rounded-[28px] border border-white/85 bg-white/72 p-5 shadow-[0_30px_90px_-58px_rgba(15,81,50,0.78)] backdrop-blur-xl sm:p-7">
      {children}
    </Card>
  );
}

function CarouselPanel() {
  const [activeSlide, setActiveSlide] = useState(0);
  const activeSlideContent = AUTH_CAROUSEL_SLIDES[activeSlide] ?? AUTH_CAROUSEL_SLIDES[0];

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setActiveSlide((current) => (current + 1) % AUTH_CAROUSEL_SLIDES.length);
    }, 5000);

    return () => window.clearInterval(intervalId);
  }, []);

  const goToPreviousSlide = () => {
    setActiveSlide((current) =>
      current === 0 ? AUTH_CAROUSEL_SLIDES.length - 1 : current - 1,
    );
  };

  const goToNextSlide = () => {
    setActiveSlide((current) => (current + 1) % AUTH_CAROUSEL_SLIDES.length);
  };

  return (
    <aside className="relative hidden h-screen w-[55%] shrink-0 overflow-hidden bg-[#062D1D] lg:block">
      {AUTH_CAROUSEL_SLIDES.map((slide, index) => (
        <img
          key={slide.id}
          src={slide.image}
          alt={slide.alt}
          className={cn(
            "absolute inset-0 h-full w-full object-cover transition-opacity duration-1000 ease-out will-change-opacity",
            slide.imageClassName,
            index === activeSlide ? "opacity-100" : "opacity-0",
          )}
          style={{ objectPosition: slide.objectPosition ?? "center" }}
          aria-hidden={index !== activeSlide}
        />
      ))}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(5,32,20,0.82)_0%,rgba(6,41,25,0.68)_38%,rgba(7,48,30,0.38)_67%,rgba(7,48,30,0.08)_100%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_78%_18%,rgba(184,216,194,0.1),transparent_34%),radial-gradient(circle_at_18%_76%,rgba(14,87,52,0.28),transparent_32%)]" />
      <div className="absolute inset-x-0 bottom-0 h-40 bg-[linear-gradient(to_top,rgba(3,22,13,0.68),transparent)]" />

      <div className="absolute inset-0 z-10 flex flex-col justify-center px-10 pb-24 pt-12 xl:px-16 2xl:px-20">
        <div className="max-w-[520px] -translate-y-2">
          <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-white/90 shadow-[0_18px_40px_-28px_rgba(0,0,0,0.7)] backdrop-blur-md">
            <Leaf className="h-4 w-4" />
            {activeSlideContent.badge}
          </div>

          <h1 className="max-w-[520px] text-[48px] font-semibold leading-[0.96] tracking-[-0.055em] text-white xl:text-[62px]">
            {activeSlideContent.title}
          </h1>
          <p className="mt-5 max-w-[430px] text-lg leading-8 tracking-[-0.02em] text-[#EAF4EC] xl:text-xl">
            {activeSlideContent.description}
          </p>

          <div className="mt-8 grid max-w-[500px] gap-3">
            {AUTH_FEATURES.map((feature) => {
              const Icon = feature.icon;
              return (
                <div
                  key={feature.title}
                  className="flex items-start gap-4 rounded-[24px] border border-white/15 bg-white/10 p-4 shadow-[0_20px_45px_-35px_rgba(0,0,0,0.82)] backdrop-blur-md"
                >
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#EEF8F0] text-[#0F5132] shadow-[0_18px_34px_-25px_rgba(0,0,0,0.8)]">
                    <Icon className="h-5 w-5 stroke-[1.9]" />
                  </div>
                  <div>
                    <p className="text-base font-semibold text-white">{feature.title}</p>
                    <p className="mt-1.5 text-[15px] leading-6 text-[#DCECE0]">{feature.description}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="absolute bottom-8 left-1/2 z-20 flex -translate-x-1/2 items-center gap-4 rounded-full border border-white/15 bg-[#041F14]/55 px-3 py-2 shadow-[0_24px_60px_-34px_rgba(0,0,0,0.92)] backdrop-blur-md">
        <button
          type="button"
          onClick={goToPreviousSlide}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white/80 transition hover:bg-white/20 hover:text-white"
          aria-label="Previous background image"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <CarouselIndicators
          count={AUTH_CAROUSEL_SLIDES.length}
          activeIndex={activeSlide}
          onSelect={setActiveSlide}
        />
        <button
          type="button"
          onClick={goToNextSlide}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white/80 transition hover:bg-white/20 hover:text-white"
          aria-label="Next background image"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>
    </aside>
  );
}

function CarouselIndicators({
  count,
  activeIndex,
  onSelect,
}: {
  count: number;
  activeIndex: number;
  onSelect: (index: number) => void;
}) {
  return (
    <div className="flex items-center gap-3">
      {Array.from({ length: count }).map((_, index) => (
        <button
          key={index}
          type="button"
          onClick={() => onSelect(index)}
          className={cn(
            "h-2.5 rounded-full transition-all duration-300",
            index === activeIndex ? "w-8 bg-[#22C986]" : "w-2.5 bg-white/45 hover:bg-white/75",
          )}
          aria-label={`Show background image ${index + 1}`}
          aria-current={index === activeIndex ? "true" : undefined}
        />
      ))}
    </div>
  );
}

function AuthBrandHeader() {
  return (
    <div className="flex items-center pb-7">
      <div className="inline-flex items-center gap-2 rounded-full border border-[#DDEFE3] bg-white/76 px-3.5 py-2 text-sm font-semibold text-[#0F5132] shadow-[0_12px_30px_-26px_rgba(15,81,50,0.8)] backdrop-blur">
        <Leaf className="h-4 w-4" />
        CityConnect access
      </div>
    </div>
  );
}

function AuthCardHeader({
  otpMode,
  authMode,
  maskedDestination,
}: {
  otpMode: "signup" | "login" | null;
  authMode: "login" | "register";
  maskedDestination: string;
}) {
  const title = otpMode ? "Verify your code" : authMode === "login" ? "Welcome back" : "Create your account";
  const description = otpMode
    ? `Enter the 6-digit code sent to ${maskedDestination}.`
    : authMode === "login"
      ? "Sign in to request trusted estate services, track jobs, and manage payments with less stress."
      : "Create your profile and set up trusted estate-service access in a few guided steps.";

  return (
    <CardHeader className="space-y-3 px-0 pb-8 pt-0 text-left">
      <div className="space-y-3">
        <CardTitle className="text-[38px] font-semibold leading-tight tracking-[-0.065em] text-[#10281F] sm:text-[46px]">
          {title}
        </CardTitle>
        <CardDescription className="max-w-[30rem] text-[16px] leading-7 text-[#5D6F65]">
          {description}
        </CardDescription>
      </div>
    </CardHeader>
  );
}

function AuthSegmentedList({
  children,
  columns = 2,
}: {
  children: ReactNode;
  columns?: 2 | 3;
}) {
  return (
    <TabsList className={cn(SEGMENTED_LIST_CLASS, columns === 2 ? "grid-cols-2" : "grid-cols-3")}>
      {children}
    </TabsList>
  );
}

function GoogleSignInButton({
  pending,
  mode = "signin",
  onCredential,
}: {
  pending: boolean;
  mode?: "signin" | "signup";
  onCredential: (credential: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID || !containerRef.current) return;

    let cancelled = false;

    const renderGoogleButton = () => {
      const container = containerRef.current;
      const googleId = window.google?.accounts?.id;
      if (!container || !googleId || cancelled) return;

      container.innerHTML = "";
      googleId.initialize({
        client_id: GOOGLE_CLIENT_ID,
        auto_select: false,
        ux_mode: "popup",
        callback: (response) => {
          if (response.credential) {
            onCredential(response.credential);
          }
        },
      });
      googleId.renderButton(container, {
        type: "standard",
        theme: "outline",
        size: "large",
        text: mode === "signup" ? "signup_with" : "signin_with",
        shape: "pill",
        logo_alignment: "left",
        width: Math.min(380, container.clientWidth || 360),
      });
    };

    if (window.google?.accounts?.id) {
      renderGoogleButton();
      return () => {
        cancelled = true;
      };
    }

    const existingScript = document.querySelector<HTMLScriptElement>(
      'script[src="https://accounts.google.com/gsi/client"]',
    );

    const handleLoad = () => renderGoogleButton();
    const handleError = () => {
      if (!cancelled) setLoadFailed(true);
    };

    if (existingScript) {
      existingScript.addEventListener("load", handleLoad);
      existingScript.addEventListener("error", handleError);
    } else {
      const script = document.createElement("script");
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.defer = true;
      script.addEventListener("load", handleLoad);
      script.addEventListener("error", handleError);
      document.head.appendChild(script);
    }

    return () => {
      cancelled = true;
      existingScript?.removeEventListener("load", handleLoad);
      existingScript?.removeEventListener("error", handleError);
    };
  }, [mode, onCredential]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-[#D9E2D7]" />
        <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[#6A7D73]">
          or
        </span>
        <div className="h-px flex-1 bg-[#D9E2D7]" />
      </div>
      <div
        className={cn(
          "flex min-h-[44px] w-full justify-center rounded-2xl",
          pending && "pointer-events-none opacity-60",
        )}
      >
        {!GOOGLE_CLIENT_ID ? (
          <div className="mx-auto w-full max-w-[380px] space-y-2">
            <Button
              type="button"
              variant="outline"
              disabled
              className="h-12 w-full rounded-full border-[#D9E2D7] bg-white/70 text-sm font-semibold text-[#315444] opacity-100"
            >
              Continue with Google
            </Button>
            <p className="text-center text-xs leading-5 text-[#6A7D73]">
              Google sign-in needs `VITE_GOOGLE_CLIENT_ID` to be configured.
            </p>
          </div>
        ) : loadFailed ? (
          <p className="text-center text-sm text-[#6A7D73]">
            Google sign-in could not load. Check your connection and try again.
          </p>
        ) : (
          <div ref={containerRef} className="mx-auto flex w-full max-w-[380px] justify-center [&>div]:mx-auto" />
        )}
      </div>
    </div>
  );
}

export default function AuthPage() {
  const [, setLocation] = useLocation();
  const { user, refreshUser } = useAuth();
  const { toast } = useToast();
  const [userType, setUserType] = useState<"resident" | "provider">("resident");
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [authPending, setAuthPending] = useState(false);
  const [otpPending, setOtpPending] = useState(false);
  const [otpMode, setOtpMode] = useState<"signup" | "login" | null>(null);
  const [otpChallengeId, setOtpChallengeId] = useState("");
  const [pendingRegistrationId, setPendingRegistrationId] = useState("");
  const [maskedDestination, setMaskedDestination] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [resendCountdown, setResendCountdown] = useState(0);

  function resetOtpState() {
    setOtpMode(null);
    setOtpChallengeId("");
    setPendingRegistrationId("");
    setMaskedDestination("");
    setOtpCode("");
    setResendCountdown(0);
    setOtpPending(false);
  }

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
      companyMode: "existing",
      companyId: "",
      newCompanyName: "",
      newCompanyDescription: "",
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
      providerRegisterForm.getValues("companyMode") === "existing" &&
      !providerRegisterForm.getValues("companyId")
    ) {
      const defaultCompany = companies[0].name || companies[0].id;
      if (defaultCompany) {
        providerRegisterForm.setValue("companyId", companies[0].id || defaultCompany);
      }
    }
  }, [authMode, userType, companies, providerRegisterForm]);
  useEffect(() => {
    if (authMode === "register" && userType === "provider" && companies.length === 0) {
      providerRegisterForm.setValue("companyMode", "new");
    }
  }, [authMode, userType, companies, providerRegisterForm]);

  useEffect(() => {
    if (!otpMode || resendCountdown <= 0) return;
    const timer = window.setTimeout(() => setResendCountdown((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [otpMode, resendCountdown]);

  useEffect(() => {
    resetOtpState();
  }, [authMode, userType]);

  const inviteCodeValue = residentRegisterForm.watch("inviteCode");
  const estateSelectionDisabled = Boolean(inviteCodeValue && inviteCodeValue.trim().length > 0);
  const providerCompanyMode = providerRegisterForm.watch("companyMode");

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

  function redirectAfterAuth(authenticatedUser: any) {
    if (!authenticatedUser) return;

    if (authenticatedUser.globalRole === "super_admin" || authenticatedUser.role === "admin") {
      setLocation("/admin-dashboard");
      return;
    }
    if (authenticatedUser.role === "estate_admin") {
      setLocation("/estate-dashboard");
      return;
    }
    if (authenticatedUser.role === "provider") {
      setLocation(authenticatedUser.isApproved === false ? "/waiting-room" : "/provider");
      return;
    }
    if (authenticatedUser.role === "resident") {
      setLocation("/resident");
    }
  }

  async function startOtpFlow(mode: "signup" | "login", response: OtpStartResponse) {
    setOtpMode(mode);
    setOtpChallengeId(response.challengeId);
    setPendingRegistrationId(String(response.pendingRegistrationId || ""));
    setMaskedDestination(response.maskedDestination);
    setOtpCode("");
    setResendCountdown(response.resendAvailableIn || 0);

    if (response.debugCode) {
      console.info("[cityconnect:otp]", response.debugCode);
      try {
        (window as any).__CITYCONNECT_DEBUG_OTP__ = response.debugCode;
      } catch {
        // ignore window assignment errors
      }
    }
  }

  const onLogin = async (data: any) => {
    setAuthPending(true);
    try {
      let loginData: Record<string, unknown>;

      if (userType === "resident") {
        loginData = data.accessCode
          ? { accessCode: data.accessCode }
          : { identifier: data.email, password: data.password };
      } else {
        loginData = { identifier: data.email, password: data.password };
      }

      const response = await apiRequest("POST", "/api/auth/login/start", loginData);
      const result = (await response.json()) as OtpStartResponse;
      await startOtpFlow("login", result);
      toast({
        title: "Verification code sent",
        description: `Enter the code sent to ${result.maskedDestination}.`,
      });
    } catch (error: any) {
      toast({
        title: "Login failed",
        description: error.message,
        error,
        source: "auth.login",
        variant: "destructive",
      });
    } finally {
      setAuthPending(false);
    }
  };

  async function handleGoogleCredential(credential: string) {
    setAuthPending(true);
    try {
      const response = await apiRequest("POST", "/api/auth/google", {
        credential,
        role: userType,
      });
      const payload = await response.json();
      const loggedInUser = payload.user || payload;
      queryClient.setQueryData(["/api/user"], loggedInUser);
      const freshUser =
        (await refreshUser().catch(() => loggedInUser)) || loggedInUser;
      redirectAfterAuth(freshUser);
    } catch (error: any) {
      toast({
        title: "Google sign-in failed",
        description: error.message,
        error,
        source: "auth.google",
        variant: "destructive",
      });
    } finally {
      setAuthPending(false);
    }
  }

  const onRegister = async (data: any) => {
    setAuthPending(true);
    try {
      let submitData: Record<string, unknown>;

      if (userType === "provider") {
        const companyMode = data.companyMode === "new" ? "new" : "existing";
        submitData = {
          firstName: data.firstName,
          lastName: data.lastName,
          name: [data.firstName, data.lastName].filter(Boolean).join(" ").trim(),
          email: data.email,
          phone: data.phone,
          role: "provider",
          companyMode,
          company: companyMode === "existing" ? data.companyId || "" : data.newCompanyName || "",
          companyId: companyMode === "existing" ? data.companyId || "" : "",
          newCompanyName: companyMode === "new" ? data.newCompanyName || "" : "",
          newCompanyDescription: companyMode === "new" ? data.newCompanyDescription || "" : "",
          experience: Number.isFinite(Number(data.experience)) ? Number(data.experience) : 0,
          password: data.password,
        };
      } else {
        const fullName = [data.firstName, data.lastName].filter(Boolean).join(" ").trim();
        const invite = data.inviteCode?.trim();
        const estate = data.estateId?.trim();
        const estateAccessMode = invite ? "access_code" : estate ? "open_estate" : "none";
        submitData = {
          ...data,
          role: "resident",
          username: data.email,
          name: fullName || data.email || data.username || "",
          email: data.email,
          phone: data.phone,
          estateAccessMode,
        };

        if (data.location) {
          submitData.location = data.location.address;
          submitData.latitude = data.location.latitude;
          submitData.longitude = data.location.longitude;
        }

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

      const response = await apiRequest("POST", "/api/register", submitData);
      const result = (await response.json()) as OtpStartResponse;
      await startOtpFlow("signup", result);
      toast({
        title: "Verification code sent",
        description: `Enter the code sent to ${result.maskedDestination} to continue.`,
      });
    } catch (error: any) {
      toast({
        title: "Registration failed",
        description: error?.message || "Signup failed.",
        error,
        source: "auth.register",
        variant: "destructive",
      });
    } finally {
      setAuthPending(false);
    }
  };

  async function handleOtpVerify() {
    if (!otpChallengeId || otpCode.trim().length !== 6) {
      toast({
        title: "Code required",
        description: "Enter the 6-digit verification code.",
        source: "auth.otp.verify",
        variant: "destructive",
      });
      return;
    }

    setOtpPending(true);
    try {
      if (otpMode === "signup") {
        const verifyResponse = await apiRequest("POST", "/api/auth/otp/verify", {
          challengeId: otpChallengeId,
          code: otpCode,
        });
        const verifyResult = await verifyResponse.json();
        const completeResponse = await apiRequest("POST", "/api/auth/register/complete", {
          pendingRegistrationId,
          verificationToken: verifyResult.verificationToken,
        });
        const completed = await completeResponse.json();
        const completedUser = completed?.user ?? null;
        if (completedUser) {
          queryClient.setQueryData(["/api/user"], completedUser);
        }
        const refreshedUser =
          (await refreshUser().catch(() => completedUser)) || completedUser;
        resetOtpState();
        toast({
          title: userType === "provider" ? "Provider request submitted" : "Account created",
          description:
            userType === "provider"
              ? "Your provider account has been submitted for approval."
              : "You are now signed in to CityConnect.",
        });
        redirectAfterAuth(refreshedUser);
        return;
      }

      const loginResponse = await apiRequest("POST", "/api/auth/login/verify", {
        challengeId: otpChallengeId,
        code: otpCode,
      });
      const loginResult = await loginResponse.json();
      const loggedInUser = loginResult?.user ?? null;
      if (loggedInUser) {
        queryClient.setQueryData(["/api/user"], loggedInUser);
      }
      const refreshedUser =
        (await refreshUser().catch(() => loggedInUser)) || loggedInUser;
      resetOtpState();
      redirectAfterAuth(refreshedUser);
    } catch (error: any) {
      toast({
        title: "Verification failed",
        description: error.message,
        error,
        source: "auth.otp.verify",
        variant: "destructive",
      });
    } finally {
      setOtpPending(false);
    }
  }

  async function handleOtpResend() {
    if (!otpChallengeId || resendCountdown > 0) return;

    setOtpPending(true);
    try {
      const response = await apiRequest("POST", "/api/auth/otp/resend", {
        challengeId: otpChallengeId,
      });
      const result = (await response.json()) as OtpStartResponse;
      setOtpChallengeId(result.challengeId);
      setMaskedDestination(result.maskedDestination);
      setResendCountdown(result.resendAvailableIn || 0);
      setOtpCode("");
      if (result.debugCode) {
        console.info("[cityconnect:otp]", result.debugCode);
        try {
          (window as any).__CITYCONNECT_DEBUG_OTP__ = result.debugCode;
        } catch {
          // ignore window assignment errors
        }
      }
      toast({
        title: "Code resent",
        description: `A new code was sent to ${result.maskedDestination}.`,
      });
    } catch (error: any) {
      toast({
        title: "Unable to resend code",
        description: error.message,
        error,
        source: "auth.otp.resend",
        variant: "destructive",
      });
    } finally {
      setOtpPending(false);
    }
  }

  return (
    <AuthLayout>
          <AuthBrandHeader />

          <AuthForm>
              <AuthCardHeader
                otpMode={otpMode}
                authMode={authMode}
                maskedDestination={maskedDestination}
              />

              <CardContent
                className={cn(
                  "space-y-6 px-0 pb-0",
                  "[&_label]:text-[13px] [&_label]:font-semibold [&_label]:tracking-[-0.01em] [&_label]:text-[#254B3A]",
                  "[&_input]:h-[52px] [&_input]:rounded-2xl [&_input]:border-[#D9E2D7] [&_input]:bg-[#F9F7F0]/88 [&_input]:text-[15px] [&_input]:text-[#18352A] [&_input]:shadow-inner [&_input]:shadow-white/50 [&_input]:placeholder:text-[#7B8B82]",
                  "[&_input:focus-visible]:border-[#0F5132] [&_input:focus-visible]:ring-2 [&_input:focus-visible]:ring-[#B8D8C2] [&_input:focus-visible]:ring-offset-0",
                  "[&_textarea]:rounded-2xl [&_textarea]:border-[#D9E2D7] [&_textarea]:bg-[#F9F7F0]/88 [&_textarea]:text-[15px] [&_textarea]:text-[#18352A] [&_textarea]:shadow-inner [&_textarea]:shadow-white/50 [&_textarea]:placeholder:text-[#7B8B82]",
                  "[&_textarea:focus-visible]:border-[#0F5132] [&_textarea:focus-visible]:ring-2 [&_textarea:focus-visible]:ring-[#B8D8C2] [&_textarea:focus-visible]:ring-offset-0",
                  "[&_[role=combobox]]:h-[52px] [&_[role=combobox]]:rounded-2xl [&_[role=combobox]]:border-[#D9E2D7] [&_[role=combobox]]:bg-[#F9F7F0]/88 [&_[role=combobox]]:text-[15px] [&_[role=combobox]]:text-[#18352A]",
                )}
              >
                {otpMode ? (
                  <div className="space-y-6">
                    <div className="space-y-4 rounded-[28px] border border-[#D9E2D7] bg-[#F8F5EC]/70 p-5 shadow-inner shadow-white/50 sm:p-6">
                      <div className="space-y-1 text-center">
                        <p className="text-sm font-semibold text-[#10281F]">Enter verification code</p>
                        <p className="text-xs leading-5 text-[#5D6F65] sm:text-sm">
                          Complete {otpMode === "signup" ? "signup" : "sign in"} with the code sent to {maskedDestination}.
                        </p>
                      </div>
                      <div className="flex justify-center">
                        <InputOTP maxLength={6} value={otpCode} onChange={setOtpCode}>
                          <InputOTPGroup>
                            <InputOTPSlot index={0} />
                            <InputOTPSlot index={1} />
                            <InputOTPSlot index={2} />
                            <InputOTPSlot index={3} />
                            <InputOTPSlot index={4} />
                            <InputOTPSlot index={5} />
                          </InputOTPGroup>
                        </InputOTP>
                      </div>
                      <div className="flex flex-col gap-3 sm:flex-row">
                        <Button
                          type="button"
                          variant="outline"
                          className={cn(AUTH_SECONDARY_BUTTON_CLASS, "flex-1")}
                          onClick={handleOtpResend}
                          disabled={otpPending || resendCountdown > 0}
                        >
                          {resendCountdown > 0 ? `Resend in ${resendCountdown}s` : "Resend code"}
                        </Button>
                        <Button
                          type="button"
                          className={cn(AUTH_PRIMARY_BUTTON_CLASS, "flex-1")}
                          onClick={handleOtpVerify}
                          disabled={otpPending || otpCode.trim().length !== 6}
                        >
                          {otpPending ? "Verifying..." : "Verify code"}
                        </Button>
                      </div>
                    </div>

                    <Button
                      type="button"
                      variant="ghost"
                      className="w-full rounded-2xl text-sm font-semibold text-[#315444] hover:bg-[#EAF3EA] hover:text-[#0F5132]"
                      onClick={resetOtpState}
                    >
                      Back to form
                    </Button>
                  </div>
                ) : (
                <>
                {/* User Type Toggle - Mobile optimized */}
                <Tabs value={userType} onValueChange={(value: any) => setUserType(value)}>
                  <AuthSegmentedList>
                    <TabsTrigger 
                      value="resident" 
                      data-testid="tab-resident"
                      className={SEGMENTED_TRIGGER_CLASS}
                    >
                      Resident
                    </TabsTrigger>
                    <TabsTrigger 
                      value="provider" 
                      data-testid="tab-provider"
                      className={SEGMENTED_TRIGGER_CLASS}
                    >
                      Provider
                    </TabsTrigger>
                  </AuthSegmentedList>

                  <TabsContent value="resident" className="mt-4 sm:mt-6">
                    {authMode === "login" ? (
                      <div className="space-y-4 sm:space-y-6">
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
                              className={cn(AUTH_PRIMARY_BUTTON_CLASS, "mt-6")}
                              disabled={authPending}
                              data-testid="button-resident-login"
                            >
                              {authPending ? "Sending code..." : "Sign In"}
                            </Button>
                          </form>
                          <GoogleSignInButton
                            pending={authPending}
                            onCredential={handleGoogleCredential}
                          />
                        </Form>
                    </div>
                    ) : (
                      <Form {...residentRegisterForm}>
                        <form autoComplete="new-password" onSubmit={residentRegisterForm.handleSubmit(onRegister)} className="space-y-4 sm:space-y-5 mt-4 sm:mt-6">
                          <div className="sr-only" aria-hidden="true">
                            <input type="text" name="username" autoComplete="username" tabIndex={-1} />
                            <input type="password" name="password" autoComplete="new-password" tabIndex={-1} />
                          </div>
                          <div className="grid gap-3 sm:grid-cols-2 sm:gap-4">
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
                            className={cn(AUTH_PRIMARY_BUTTON_CLASS, "mt-6")} 
                            disabled={authPending}
                            data-testid="button-resident-register"
                          >
                            {authPending ? "Sending code..." : "Create Account"}
                          </Button>
                        </form>
                        <GoogleSignInButton
                          pending={authPending}
                          mode="signup"
                          onCredential={handleGoogleCredential}
                        />
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
                            className={cn(AUTH_PRIMARY_BUTTON_CLASS, "mt-6")} 
                            disabled={authPending}
                            data-testid="button-provider-login"
                          >
                            {authPending ? "Sending code..." : "Sign In as Provider"}
                          </Button>
                        </form>
                        <GoogleSignInButton
                          pending={authPending}
                          onCredential={handleGoogleCredential}
                        />
                      </Form>
                    ) : (
                      <Form {...providerRegisterForm}>
                        {/* Disable browser autofill on registration form to avoid credentials leaking into wrong fields */}
                        <form autoComplete="new-password" onSubmit={providerRegisterForm.handleSubmit(onRegister)} className="space-y-4 sm:space-y-5">
                          <div className="sr-only" aria-hidden="true">
                            <input type="text" name="username" autoComplete="username" tabIndex={-1} />
                            <input type="password" name="password" autoComplete="new-password" tabIndex={-1} />
                          </div>
                          <div className="grid gap-3 sm:grid-cols-2 sm:gap-4">
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
                            name="companyMode"
                            render={({ field }) => (
                              <FormItem className="space-y-1.5 sm:space-y-2">
                                <FormLabel className="text-sm sm:text-base font-medium">Company</FormLabel>
                                <FormControl>
                                  <Select
                                    onValueChange={field.onChange}
                                    value={field.value}
                                  >
                                    <SelectTrigger
                                      className="h-11 sm:h-12 text-base"
                                      data-testid="select-company-mode"
                                    >
                                      <SelectValue placeholder="Choose company option" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="existing">Join an existing company</SelectItem>
                                      <SelectItem value="new">Create a new company</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </FormControl>
                                <FormMessage className="text-xs sm:text-sm" />
                              </FormItem>
                            )}
                          />
                          {providerCompanyMode === "existing" ? (
                            <FormField
                              control={providerRegisterForm.control}
                              name="companyId"
                              render={({ field }) => (
                                <FormItem className="space-y-1.5 sm:space-y-2">
                                  <FormLabel className="text-sm sm:text-base font-medium">Select Company</FormLabel>
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
                                              value={company.id}
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
                          ) : (
                            <>
                              <FormField
                                control={providerRegisterForm.control}
                                name="newCompanyName"
                                render={({ field }) => (
                                  <FormItem className="space-y-1.5 sm:space-y-2">
                                    <FormLabel className="text-sm sm:text-base font-medium">New Company Name</FormLabel>
                                    <FormControl>
                                      <Input
                                        {...field}
                                        className="h-11 sm:h-12 text-base"
                                        placeholder="Enter company name"
                                        data-testid="input-new-company-name"
                                      />
                                    </FormControl>
                                    <FormMessage className="text-xs sm:text-sm" />
                                  </FormItem>
                                )}
                              />
                              <FormField
                                control={providerRegisterForm.control}
                                name="newCompanyDescription"
                                render={({ field }) => (
                                  <FormItem className="space-y-1.5 sm:space-y-2">
                                    <FormLabel className="text-sm sm:text-base font-medium">Company Description (optional)</FormLabel>
                                    <FormControl>
                                      <Textarea
                                        {...field}
                                        className="min-h-[96px] text-base"
                                        placeholder="Tell us about your company"
                                        data-testid="input-new-company-description"
                                      />
                                    </FormControl>
                                    <FormMessage className="text-xs sm:text-sm" />
                                  </FormItem>
                                )}
                              />
                            </>
                          )}
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
                            className={cn(AUTH_PRIMARY_BUTTON_CLASS, "mt-6")} 
                            disabled={authPending}
                            data-testid="button-provider-register"
                          >
                            {authPending ? "Sending code..." : "Create Provider Account"}
                          </Button>
                        </form>
                        <GoogleSignInButton
                          pending={authPending}
                          mode="signup"
                          onCredential={handleGoogleCredential}
                        />
                      </Form>
                    )}
                </TabsContent>
              </Tabs>

                {/* Toggle between login and register - Mobile optimized */}
                <div className="text-center">
                  <Button
                    variant="link"
                    onClick={() => setAuthMode(authMode === "login" ? "register" : "login")}
                    className="h-10 min-h-[40px] rounded-full px-4 py-2 text-sm font-semibold text-[#0F5132] underline-offset-4 hover:bg-[#EAF3EA] hover:text-[#0B3D28]"
                    data-testid="button-toggle-auth-mode"
                  >
                    {authMode === "login" 
                      ? "Don't have an account? Sign up" 
                      : "Already have an account? Sign in"}
                  </Button>
                </div>
                </>
                )} 
              </CardContent>
            </AuthForm>

          <div className="mt-6 border-t border-[#D9E2D7] pt-6">
            <div className="space-y-3 rounded-[24px] border border-[#DDEFE3] bg-white/52 p-4 text-center shadow-[0_22px_52px_-42px_rgba(15,81,50,0.68)] backdrop-blur">
              <p className="px-2 text-xs leading-5 text-[#65776E] sm:text-sm">
                Running a business? Register your services for the CityConnect marketplace.
              </p>
              <Button
                variant="ghost"
                onClick={() => setLocation("/company-registration")}
                className="h-10 rounded-full px-4 text-sm font-semibold text-[#0F5132] hover:bg-[#EAF3EA] hover:text-[#0B3D28]"
                data-testid="button-register-business"
              >
                Register as a business
              </Button>
            </div>
          </div>
    </AuthLayout>
  );
}

