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
  Users
} from "lucide-react";

export default function LandingPage() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();

  // Redirect to appropriate dashboard if already logged in
  if (user) {
    if (user.role === "resident") {
      setLocation("/resident");
      return null;
    } else if (user.role === "provider") {
      setLocation("/provider");
      return null;
    } else if (user.role === "admin") {
      setLocation("/admin");
      return null;
    }
  }

  const handleGetStarted = (userType: string) => {
    setLocation(`/auth?type=${userType}`);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card shadow-sm border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <h1 className="text-2xl font-bold text-primary">CityConnect</h1>
            </div>
            <div className="flex items-center space-x-4">
              <Button variant="ghost" onClick={() => setLocation("/auth")}>
                Sign In
              </Button>
              <Button onClick={() => setLocation("/auth")}>
                Get Started
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-primary/10 to-secondary/10 min-h-[60vh] flex items-center">
        <div className="absolute inset-0 bg-primary/70 bg-[url('https://images.unsplash.com/photo-1449824913935-59a10b8d2000?ixlib=rb-4.0.3&auto=format&fit=crop&w=1920&h=1080')] bg-cover bg-center"></div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-4xl md:text-6xl font-bold text-white mb-6">
            Connect Your Estate to<br/>
            <span className="text-accent">Quality Services</span>
          </h2>
          <p className="text-xl md:text-2xl text-white/90 mb-8 max-w-3xl mx-auto">
            From artisan repairs to market runs, CityConnect bridges residents with trusted service providers in your community.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button 
              onClick={() => handleGetStarted("resident")}
              size="lg"
              className="bg-accent text-accent-foreground hover:bg-accent/90 text-lg px-8 py-6"
              data-testid="button-resident-signup"
            >
              I Need Services
            </Button>
            <Button 
              onClick={() => handleGetStarted("provider")}
              size="lg"
              variant="secondary"
              className="bg-secondary text-secondary-foreground hover:bg-secondary/90 text-lg px-8 py-6"
              data-testid="button-provider-signup"
            >
              I Provide Services
            </Button>
          </div>
        </div>
      </section>

      {/* Services Section */}
      <section className="py-16 bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h3 className="text-3xl md:text-4xl font-bold text-foreground mb-4">Our Services</h3>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Connecting you with verified professionals for all your estate needs
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 lg:gap-12">
            {/* Artisan Services */}
            <Card className="hover:shadow-xl transition-shadow">
              <CardContent className="p-8">
                <img 
                  src="https://images.unsplash.com/photo-1581578731548-c64695cc6952?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=400" 
                  alt="Professional craftsman working on home repairs" 
                  className="w-full h-48 object-cover rounded-lg mb-6" 
                />
                <div className="flex items-center mb-4">
                  <Wrench className="w-8 h-8 text-primary mr-3" />
                  <h4 className="text-2xl font-semibold text-foreground">Artisan Repairs</h4>
                </div>
                <p className="text-muted-foreground mb-6">
                  Connect with skilled electricians, plumbers, and carpenters for all your home repair needs. Verified professionals with ratings and reviews.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary">Electrician</Badge>
                  <Badge variant="secondary">Plumber</Badge>
                  <Badge variant="secondary">Carpenter</Badge>
                </div>
              </CardContent>
            </Card>

            {/* Market Runs */}
            <Card className="hover:shadow-xl transition-shadow">
              <CardContent className="p-8">
                <img 
                  src="https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=400" 
                  alt="Delivery person with grocery bags and packages" 
                  className="w-full h-48 object-cover rounded-lg mb-6" 
                />
                <div className="flex items-center mb-4">
                  <ShoppingBag className="w-8 h-8 text-secondary mr-3" />
                  <h4 className="text-2xl font-semibold text-foreground">Market Runs & Errands</h4>
                </div>
                <p className="text-muted-foreground mb-6">
                  Let trusted runners handle your grocery shopping, parcel pickups, and delivery needs. Safe, reliable, and convenient service.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary">Groceries</Badge>
                  <Badge variant="secondary">Deliveries</Badge>
                  <Badge variant="secondary">Errands</Badge>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-16 bg-muted">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h3 className="text-3xl md:text-4xl font-bold text-foreground mb-4">How It Works</h3>
            <p className="text-xl text-muted-foreground">Simple steps to get the help you need</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="bg-primary text-primary-foreground w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-6">
                1
              </div>
              <h4 className="text-xl font-semibold text-foreground mb-4">Create Request</h4>
              <p className="text-muted-foreground">Describe your service need, set your budget, and choose urgency level</p>
            </div>
            <div className="text-center">
              <div className="bg-secondary text-secondary-foreground w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-6">
                2
              </div>
              <h4 className="text-xl font-semibold text-foreground mb-4">Get Matched</h4>
              <p className="text-muted-foreground">Verified providers review and accept your request based on availability</p>
            </div>
            <div className="text-center">
              <div className="bg-accent text-accent-foreground w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-6">
                3
              </div>
              <h4 className="text-xl font-semibold text-foreground mb-4">Track & Pay</h4>
              <p className="text-muted-foreground">Monitor progress in real-time and pay securely upon completion</p>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h3 className="text-3xl md:text-4xl font-bold text-foreground mb-4">Why Choose CityConnect?</h3>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center p-6">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Shield className="w-8 h-8 text-primary" />
              </div>
              <h4 className="text-xl font-semibold text-foreground mb-4">Trusted Providers</h4>
              <p className="text-muted-foreground">All service providers are verified and rated by the community for your peace of mind.</p>
            </div>
            <div className="text-center p-6">
              <div className="w-16 h-16 bg-accent/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Clock className="w-8 h-8 text-accent" />
              </div>
              <h4 className="text-xl font-semibold text-foreground mb-4">Quick Response</h4>
              <p className="text-muted-foreground">Get connected with available providers instantly. No more waiting around for services.</p>
            </div>
            <div className="text-center p-6">
              <div className="w-16 h-16 bg-secondary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Smartphone className="w-8 h-8 text-secondary" />
              </div>
              <h4 className="text-xl font-semibold text-foreground mb-4">Easy Tracking</h4>
              <p className="text-muted-foreground">Track your requests in real-time from booking to completion with our intuitive interface.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-card border-t border-border py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-xl font-bold text-primary mb-2">CityConnect</h1>
          <p className="text-muted-foreground">Connecting communities through quality services</p>
        </div>
      </footer>
    </div>
  );
}
