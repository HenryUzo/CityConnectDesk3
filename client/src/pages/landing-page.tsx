import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Wrench, 
  ShoppingBag, 
  Shield, 
  Clock, 
  Smartphone,
  Star,
  CheckCircle,
  Users,
  Menu,
  X
} from "lucide-react";

export default function LandingPage() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Redirect to appropriate dashboard if already logged in
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

  const handleGetStarted = (userType: string) => {
    setLocation(`/auth?type=${userType}`);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card shadow-sm border-b border-border relative">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-14 sm:h-16">
            <div className="flex items-center">
              <h1 className="text-xl sm:text-2xl font-bold text-primary">CityConnect</h1>
            </div>
            
            {/* Desktop Navigation */}
            <div className="hidden sm:flex items-center space-x-3 md:space-x-4">
              <Button 
                variant="ghost" 
                onClick={() => setLocation("/auth")}
                className="min-h-[44px] px-4"
                data-testid="button-signin-desktop"
              >
                Sign In
              </Button>
              <Button 
                onClick={() => setLocation("/auth")}
                className="min-h-[44px] px-4"
                data-testid="button-getstarted-desktop"
              >
                Get Started
              </Button>
            </div>
            
            {/* Mobile Menu Button */}
            <div className="sm:hidden">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="min-h-[44px] min-w-[44px] p-2"
                data-testid="button-mobile-menu"
              >
                {isMobileMenuOpen ? (
                  <X className="h-6 w-6" />
                ) : (
                  <Menu className="h-6 w-6" />
                )}
              </Button>
            </div>
          </div>
          
          {/* Mobile Navigation Menu */}
          {isMobileMenuOpen && (
            <div className="sm:hidden border-t border-border bg-card">
              <div className="px-2 pt-2 pb-3 space-y-1">
                <Button 
                  variant="ghost" 
                  onClick={() => {
                    setLocation("/auth");
                    setIsMobileMenuOpen(false);
                  }}
                  className="w-full justify-start min-h-[44px] px-3 py-2 text-base"
                  data-testid="button-signin-mobile"
                >
                  Sign In
                </Button>
                <Button 
                  onClick={() => {
                    setLocation("/auth");
                    setIsMobileMenuOpen(false);
                  }}
                  className="w-full min-h-[44px] px-3 py-2 text-base"
                  data-testid="button-getstarted-mobile"
                >
                  Get Started
                </Button>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-primary/10 to-secondary/10 min-h-[70vh] sm:min-h-[60vh] flex items-center">
        <div className="absolute inset-0 bg-primary/70 bg-[url('https://images.unsplash.com/photo-1449824913935-59a10b8d2000?ixlib=rb-4.0.3&auto=format&fit=crop&w=1920&h=1080')] bg-cover bg-center"></div>
        <div className="relative max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-4 sm:mb-6 leading-tight">
            Connect Your Estate to<br/>
            <span className="text-accent">Quality Services</span>
          </h2>
          <p className="text-base sm:text-lg md:text-xl lg:text-2xl text-white/90 mb-6 sm:mb-8 max-w-2xl lg:max-w-3xl mx-auto leading-relaxed px-2">
            From artisan repairs to market runs, CityConnect bridges residents with trusted service providers in your community.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row sm:gap-4 justify-center px-2">
            <Button 
              onClick={() => handleGetStarted("resident")}
              size="lg"
              className="bg-accent text-accent-foreground hover:bg-accent/90 text-base sm:text-lg px-6 sm:px-8 py-4 sm:py-6 min-h-[48px] sm:min-h-[52px] w-full sm:w-auto"
              data-testid="button-resident-signup"
            >
              I Need Services
            </Button>
            <Button 
              onClick={() => handleGetStarted("provider")}
              size="lg"
              variant="secondary"
              className="bg-secondary text-secondary-foreground hover:bg-secondary/90 text-base sm:text-lg px-6 sm:px-8 py-4 sm:py-6 min-h-[48px] sm:min-h-[52px] w-full sm:w-auto"
              data-testid="button-provider-signup"
            >
              I Provide Services
            </Button>
          </div>
        </div>
      </section>

      {/* Services Section */}
      <section className="py-8 sm:py-12 lg:py-16 bg-background">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
          <div className="text-center mb-8 sm:mb-12 lg:mb-16">
            <h3 className="text-2xl sm:text-3xl md:text-4xl font-bold text-foreground mb-3 sm:mb-4">Our Services</h3>
            <p className="text-base sm:text-lg md:text-xl text-muted-foreground max-w-xl md:max-w-2xl mx-auto px-2">
              Connecting you with verified professionals for all your estate needs
            </p>
          </div>

          <div className="grid gap-6 sm:gap-8 md:grid-cols-2 lg:gap-12">
            {/* Artisan Services */}
            <Card className="hover:shadow-xl transition-shadow touch-manipulation">
              <CardContent className="p-4 sm:p-6 lg:p-8">
                <img 
                  src="https://images.unsplash.com/photo-1581578731548-c64695cc6952?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=400" 
                  alt="Professional craftsman working on home repairs" 
                  className="w-full h-40 sm:h-48 object-cover rounded-lg mb-4 sm:mb-6" 
                />
                <div className="flex items-center mb-3 sm:mb-4">
                  <Wrench className="w-6 h-6 sm:w-8 sm:h-8 text-primary mr-2 sm:mr-3" />
                  <h4 className="text-lg sm:text-xl lg:text-2xl font-semibold text-foreground">Artisan Repairs</h4>
                </div>
                <p className="text-sm sm:text-base text-muted-foreground mb-4 sm:mb-6 leading-relaxed">
                  Connect with skilled electricians, plumbers, and carpenters for all your home repair needs. Verified professionals with ratings and reviews.
                </p>
                <div className="flex flex-wrap gap-1.5 sm:gap-2">
                  <Badge variant="secondary" className="text-xs sm:text-sm px-2 py-1">Electrician</Badge>
                  <Badge variant="secondary" className="text-xs sm:text-sm px-2 py-1">Plumber</Badge>
                  <Badge variant="secondary" className="text-xs sm:text-sm px-2 py-1">Carpenter</Badge>
                </div>
              </CardContent>
            </Card>

            {/* Market Runs */}
            <Card className="hover:shadow-xl transition-shadow touch-manipulation">
              <CardContent className="p-4 sm:p-6 lg:p-8">
                <img 
                  src="https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=400" 
                  alt="Delivery person with grocery bags and packages" 
                  className="w-full h-40 sm:h-48 object-cover rounded-lg mb-4 sm:mb-6" 
                />
                <div className="flex items-center mb-3 sm:mb-4">
                  <ShoppingBag className="w-6 h-6 sm:w-8 sm:h-8 text-secondary mr-2 sm:mr-3" />
                  <h4 className="text-lg sm:text-xl lg:text-2xl font-semibold text-foreground">Market Runs & Errands</h4>
                </div>
                <p className="text-sm sm:text-base text-muted-foreground mb-4 sm:mb-6 leading-relaxed">
                  Let trusted runners handle your grocery shopping, parcel pickups, and delivery needs. Safe, reliable, and convenient service.
                </p>
                <div className="flex flex-wrap gap-1.5 sm:gap-2">
                  <Badge variant="secondary" className="text-xs sm:text-sm px-2 py-1">Groceries</Badge>
                  <Badge variant="secondary" className="text-xs sm:text-sm px-2 py-1">Deliveries</Badge>
                  <Badge variant="secondary" className="text-xs sm:text-sm px-2 py-1">Errands</Badge>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-8 sm:py-12 lg:py-16 bg-muted">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
          <div className="text-center mb-8 sm:mb-12 lg:mb-16">
            <h3 className="text-2xl sm:text-3xl md:text-4xl font-bold text-foreground mb-3 sm:mb-4">How It Works</h3>
            <p className="text-base sm:text-lg md:text-xl text-muted-foreground px-2">Simple steps to get the help you need</p>
          </div>

          <div className="grid gap-8 sm:gap-8 md:grid-cols-3">
            <div className="text-center px-2">
              <div className="bg-primary text-primary-foreground w-12 h-12 sm:w-16 sm:h-16 rounded-full flex items-center justify-center text-lg sm:text-2xl font-bold mx-auto mb-4 sm:mb-6">
                1
              </div>
              <h4 className="text-lg sm:text-xl font-semibold text-foreground mb-3 sm:mb-4">Create Request</h4>
              <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">Describe your service need, set your budget, and choose urgency level</p>
            </div>
            <div className="text-center px-2">
              <div className="bg-secondary text-secondary-foreground w-12 h-12 sm:w-16 sm:h-16 rounded-full flex items-center justify-center text-lg sm:text-2xl font-bold mx-auto mb-4 sm:mb-6">
                2
              </div>
              <h4 className="text-lg sm:text-xl font-semibold text-foreground mb-3 sm:mb-4">Get Matched</h4>
              <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">Verified providers review and accept your request based on availability</p>
            </div>
            <div className="text-center px-2">
              <div className="bg-accent text-accent-foreground w-12 h-12 sm:w-16 sm:h-16 rounded-full flex items-center justify-center text-lg sm:text-2xl font-bold mx-auto mb-4 sm:mb-6">
                3
              </div>
              <h4 className="text-lg sm:text-xl font-semibold text-foreground mb-3 sm:mb-4">Track & Pay</h4>
              <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">Monitor progress in real-time and pay securely upon completion</p>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-8 sm:py-12 lg:py-16 bg-background">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
          <div className="text-center mb-8 sm:mb-12 lg:mb-16">
            <h3 className="text-2xl sm:text-3xl md:text-4xl font-bold text-foreground mb-3 sm:mb-4">Why Choose CityConnect?</h3>
          </div>

          <div className="grid gap-6 sm:gap-8 md:grid-cols-3">
            <div className="text-center p-4 sm:p-6">
              <div className="w-12 h-12 sm:w-16 sm:h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4">
                <Shield className="w-6 h-6 sm:w-8 sm:h-8 text-primary" />
              </div>
              <h4 className="text-lg sm:text-xl font-semibold text-foreground mb-3 sm:mb-4">Trusted Providers</h4>
              <p className="text-sm sm:text-base text-muted-foreground leading-relaxed px-2">All service providers are verified and rated by the community for your peace of mind.</p>
            </div>
            <div className="text-center p-4 sm:p-6">
              <div className="w-12 h-12 sm:w-16 sm:h-16 bg-accent/10 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4">
                <Clock className="w-6 h-6 sm:w-8 sm:h-8 text-accent" />
              </div>
              <h4 className="text-lg sm:text-xl font-semibold text-foreground mb-3 sm:mb-4">Quick Response</h4>
              <p className="text-sm sm:text-base text-muted-foreground leading-relaxed px-2">Get connected with available providers instantly. No more waiting around for services.</p>
            </div>
            <div className="text-center p-4 sm:p-6">
              <div className="w-12 h-12 sm:w-16 sm:h-16 bg-secondary/10 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4">
                <Smartphone className="w-6 h-6 sm:w-8 sm:h-8 text-secondary" />
              </div>
              <h4 className="text-lg sm:text-xl font-semibold text-foreground mb-3 sm:mb-4">Easy Tracking</h4>
              <p className="text-sm sm:text-base text-muted-foreground leading-relaxed px-2">Track your requests in real-time from booking to completion with our intuitive interface.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-card border-t border-border py-6 sm:py-8">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 text-center">
          <h1 className="text-lg sm:text-xl font-bold text-primary mb-2">CityConnect</h1>
          <p className="text-sm sm:text-base text-muted-foreground">Connecting communities through quality services</p>
        </div>
      </footer>
    </div>
  );
}
