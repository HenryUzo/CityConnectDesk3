import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { motion, useInView, useScroll, useTransform } from "framer-motion";
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
  X,
  ArrowRight,
  Zap,
  Heart,
  Award
} from "lucide-react";

export default function LandingPage() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const heroRef = useRef(null);
  const servicesRef = useRef(null);
  const featuresRef = useRef(null);
  
  const { scrollYProgress } = useScroll();
  const heroY = useTransform(scrollYProgress, [0, 1], ["0%", "30%"]);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.3], [1, 0]);
  
  const servicesInView = useInView(servicesRef, { once: true });
  const featuresInView = useInView(featuresRef, { once: true });

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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/50 to-indigo-50 dark:from-slate-900 dark:via-blue-950/50 dark:to-indigo-950">
      {/* Animated Background Pattern */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <motion.div 
          className="absolute -top-4 -right-4 w-96 h-96 bg-gradient-to-r from-blue-400/20 to-purple-400/20 rounded-full blur-3xl"
          animate={{
            x: [0, 100, 0],
            y: [0, -50, 0],
          }}
          transition={{
            duration: 20,
            repeat: Infinity,
            ease: "linear"
          }}
        />
        <motion.div 
          className="absolute -bottom-4 -left-4 w-96 h-96 bg-gradient-to-r from-pink-400/20 to-orange-400/20 rounded-full blur-3xl"
          animate={{
            x: [0, -100, 0],
            y: [0, 50, 0],
          }}
          transition={{
            duration: 25,
            repeat: Infinity,
            ease: "linear"
          }}
        />
        <motion.div 
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-gradient-to-r from-emerald-400/10 to-cyan-400/10 rounded-full blur-3xl"
          animate={{
            scale: [1, 1.2, 1],
            rotate: [0, 180, 360],
          }}
          transition={{
            duration: 30,
            repeat: Infinity,
            ease: "linear"
          }}
        />
      </div>

      {/* Modern Glass Header */}
      <motion.header 
        className="fixed top-0 left-0 right-0 z-50 bg-white/70 dark:bg-slate-900/70 backdrop-blur-lg border-b border-white/20 dark:border-slate-700/20"
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
      >
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16 sm:h-18">
            <motion.div 
              className="flex items-center"
              whileHover={{ scale: 1.05 }}
              transition={{ type: "spring", stiffness: 300 }}
            >
              <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg mr-3 flex items-center justify-center">
                <Zap className="w-5 h-5 text-white" />
              </div>
              <h1 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 bg-clip-text text-transparent">
                CityConnect
              </h1>
            </motion.div>
            
            {/* Desktop Navigation */}
            <div className="hidden sm:flex items-center space-x-3 md:space-x-4">
              <motion.div
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <Button 
                  variant="ghost" 
                  onClick={() => setLocation("/auth")}
                  className="min-h-[44px] px-6 text-slate-700 dark:text-slate-300 hover:bg-white/50 dark:hover:bg-slate-800/50 backdrop-blur-sm rounded-full transition-all duration-300"
                  data-testid="button-signin-desktop"
                >
                  Sign In
                </Button>
              </motion.div>
              <motion.div
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <Button 
                  onClick={() => setLocation("/auth")}
                  className="min-h-[44px] px-6 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white shadow-lg hover:shadow-xl rounded-full transition-all duration-300"
                  data-testid="button-getstarted-desktop"
                >
                  Get Started
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </motion.div>
            </div>
            
            {/* Mobile Menu Button */}
            <div className="sm:hidden">
              <motion.div
                whileTap={{ scale: 0.95 }}
              >
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                  className="min-h-[44px] min-w-[44px] p-2 bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm rounded-full"
                  data-testid="button-mobile-menu"
                >
                  <motion.div
                    animate={{ rotate: isMobileMenuOpen ? 90 : 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    {isMobileMenuOpen ? (
                      <X className="h-6 w-6" />
                    ) : (
                      <Menu className="h-6 w-6" />
                    )}
                  </motion.div>
                </Button>
              </motion.div>
            </div>
          </div>
          
          {/* Mobile Navigation Menu */}
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ 
              opacity: isMobileMenuOpen ? 1 : 0,
              height: isMobileMenuOpen ? "auto" : 0
            }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="sm:hidden overflow-hidden border-t border-white/20 dark:border-slate-700/20 bg-white/50 dark:bg-slate-900/50 backdrop-blur-lg"
          >
            <div className="px-2 pt-2 pb-3 space-y-2">
              <motion.div
                whileTap={{ scale: 0.95 }}
              >
                <Button 
                  variant="ghost" 
                  onClick={() => {
                    setLocation("/auth");
                    setIsMobileMenuOpen(false);
                  }}
                  className="w-full justify-start min-h-[44px] px-4 py-2 text-base bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm rounded-full"
                  data-testid="button-signin-mobile"
                >
                  Sign In
                </Button>
              </motion.div>
              <motion.div
                whileTap={{ scale: 0.95 }}
              >
                <Button 
                  onClick={() => {
                    setLocation("/auth");
                    setIsMobileMenuOpen(false);
                  }}
                  className="w-full min-h-[44px] px-4 py-2 text-base bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-full"
                  data-testid="button-getstarted-mobile"
                >
                  Get Started
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </motion.div>
            </div>
          </motion.div>
        </div>
      </motion.header>

      {/* Stunning Hero Section */}
      <motion.section 
        ref={heroRef}
        className="relative min-h-screen flex items-center justify-center overflow-hidden pt-20"
        style={{ y: heroY, opacity: heroOpacity }}
      >
        {/* Hero Background Elements */}
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-600/20 via-purple-600/20 to-indigo-600/20" />
          <motion.div
            className="absolute top-20 left-10 w-72 h-72 bg-gradient-to-br from-blue-400/30 to-cyan-400/30 rounded-full blur-3xl"
            animate={{
              x: [0, 50, 0],
              y: [0, -30, 0],
              scale: [1, 1.1, 1],
            }}
            transition={{
              duration: 8,
              repeat: Infinity,
              ease: "easeInOut"
            }}
          />
          <motion.div
            className="absolute bottom-20 right-10 w-96 h-96 bg-gradient-to-br from-purple-400/30 to-pink-400/30 rounded-full blur-3xl"
            animate={{
              x: [0, -30, 0],
              y: [0, 50, 0],
              scale: [1, 0.9, 1],
            }}
            transition={{
              duration: 10,
              repeat: Infinity,
              ease: "easeInOut"
            }}
          />
        </div>

        <div className="relative max-w-7xl mx-auto px-6 sm:px-8 lg:px-12 text-center z-10">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
          >
            <motion.div
              className="inline-flex items-center px-4 py-2 rounded-full bg-white/10 dark:bg-slate-800/10 backdrop-blur-sm border border-white/20 dark:border-slate-700/20 text-sm font-medium text-slate-700 dark:text-slate-300 mb-8"
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, delay: 0.4 }}
            >
              🚀 Connecting Communities Through Quality Services
            </motion.div>

            <motion.h1
              className="text-4xl sm:text-6xl lg:text-7xl xl:text-8xl font-bold mb-8 leading-tight"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.6 }}
            >
              <span className="bg-gradient-to-r from-slate-900 via-blue-700 to-indigo-700 dark:from-slate-100 dark:via-blue-300 dark:to-indigo-300 bg-clip-text text-transparent">
                Connect Your Estate to
              </span>
              <br />
              <motion.span
                className="bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 bg-clip-text text-transparent"
                initial={{ opacity: 0, x: -30 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.8, delay: 0.8 }}
              >
                Quality Services
              </motion.span>
            </motion.h1>

            <motion.p
              className="text-lg sm:text-xl lg:text-2xl text-slate-600 dark:text-slate-400 mb-12 max-w-3xl mx-auto leading-relaxed"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 1.0 }}
            >
              From artisan repairs to market runs, CityConnect bridges residents with trusted service providers in your community using cutting-edge technology.
            </motion.p>

            <motion.div
              className="flex flex-col sm:flex-row gap-6 justify-center items-center"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 1.2 }}
            >
              <motion.div
                whileHover={{ scale: 1.05, y: -2 }}
                whileTap={{ scale: 0.95 }}
                className="group"
              >
                <Button 
                  onClick={() => handleGetStarted("resident")}
                  size="lg"
                  className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-8 py-4 text-lg font-semibold rounded-full shadow-lg hover:shadow-2xl transition-all duration-300 group-hover:shadow-blue-500/25"
                  data-testid="button-resident-signup"
                >
                  <Users className="w-5 h-5 mr-2" />
                  I Need Services
                  <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
                </Button>
              </motion.div>
              
              <motion.div
                whileHover={{ scale: 1.05, y: -2 }}
                whileTap={{ scale: 0.95 }}
                className="group"
              >
                <Button 
                  onClick={() => handleGetStarted("provider")}
                  size="lg"
                  variant="outline"
                  className="bg-white/10 dark:bg-slate-800/10 backdrop-blur-sm border-2 border-white/20 dark:border-slate-700/20 text-slate-800 dark:text-slate-200 hover:bg-white/20 dark:hover:bg-slate-800/20 px-8 py-4 text-lg font-semibold rounded-full shadow-lg hover:shadow-2xl transition-all duration-300"
                  data-testid="button-provider-signup"
                >
                  <Heart className="w-5 h-5 mr-2" />
                  I Provide Services
                  <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
                </Button>
              </motion.div>
            </motion.div>

            {/* Stats Section */}
            <motion.div
              className="grid grid-cols-1 sm:grid-cols-3 gap-8 mt-20 max-w-2xl mx-auto"
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 1.4 }}
            >
              {[
                { number: "500+", label: "Happy Residents" },
                { number: "100+", label: "Verified Providers" },
                { number: "1000+", label: "Services Completed" }
              ].map((stat, index) => (
                <motion.div
                  key={stat.label}
                  className="text-center"
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.6, delay: 1.6 + index * 0.2 }}
                >
                  <div className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-2">
                    {stat.number}
                  </div>
                  <div className="text-slate-600 dark:text-slate-400 font-medium">
                    {stat.label}
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </motion.div>
        </div>

        {/* Floating Elements */}
        <motion.div
          className="absolute top-32 left-20 w-4 h-4 bg-blue-500 rounded-full opacity-60"
          animate={{
            y: [0, -20, 0],
            x: [0, 10, 0],
          }}
          transition={{
            duration: 6,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />
        <motion.div
          className="absolute top-40 right-32 w-6 h-6 bg-purple-500 rounded-full opacity-40"
          animate={{
            y: [0, 20, 0],
            x: [0, -15, 0],
          }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />
        <motion.div
          className="absolute bottom-40 left-32 w-3 h-3 bg-indigo-500 rounded-full opacity-50"
          animate={{
            y: [0, -15, 0],
            x: [0, 20, 0],
          }}
          transition={{
            duration: 7,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />
      </motion.section>

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
