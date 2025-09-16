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
  Award,
  MessageSquare,
  CreditCard,
  Sparkles,
  UserPlus
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

      {/* Modern Services Section */}
      <section ref={servicesRef} className="py-20 sm:py-24 lg:py-32 relative overflow-hidden">
        {/* Background Elements */}
        <div className="absolute inset-0">
          <motion.div
            className="absolute top-0 left-1/4 w-64 h-64 bg-gradient-to-r from-blue-400/10 to-purple-400/10 rounded-full blur-3xl"
            animate={{
              scale: [1, 1.2, 1],
              rotate: [0, 180, 360],
            }}
            transition={{
              duration: 20,
              repeat: Infinity,
              ease: "linear"
            }}
          />
          <motion.div
            className="absolute bottom-0 right-1/4 w-96 h-96 bg-gradient-to-r from-purple-400/10 to-pink-400/10 rounded-full blur-3xl"
            animate={{
              scale: [1, 0.8, 1],
              rotate: [360, 180, 0],
            }}
            transition={{
              duration: 25,
              repeat: Infinity,
              ease: "linear"
            }}
          />
        </div>

        <div className="relative max-w-7xl mx-auto px-6 sm:px-8 lg:px-12">
          <motion.div
            className="text-center mb-16 lg:mb-20"
            initial={{ opacity: 0, y: 30 }}
            animate={servicesInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.8 }}
          >
            <motion.div
              className="inline-flex items-center px-4 py-2 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-sm font-medium mb-4"
              initial={{ opacity: 0, scale: 0.5 }}
              animate={servicesInView ? { opacity: 1, scale: 1 } : {}}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              ✨ Our Services
            </motion.div>
            
            <motion.h2
              className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-6 bg-gradient-to-r from-slate-900 via-blue-700 to-indigo-700 dark:from-slate-100 dark:via-blue-300 dark:to-indigo-300 bg-clip-text text-transparent"
              initial={{ opacity: 0, y: 20 }}
              animate={servicesInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.8, delay: 0.3 }}
            >
              Connecting You With
              <br />
              <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                Verified Professionals
              </span>
            </motion.h2>
            
            <motion.p
              className="text-lg sm:text-xl text-slate-600 dark:text-slate-400 max-w-2xl mx-auto"
              initial={{ opacity: 0, y: 20 }}
              animate={servicesInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.8, delay: 0.4 }}
            >
              From emergency repairs to daily errands, we've got your estate covered with trusted professionals
            </motion.p>
          </motion.div>

          <div className="grid gap-8 lg:gap-12 md:grid-cols-2">
            {[
              {
                title: "Artisan Repairs",
                description: "Connect with skilled electricians, plumbers, and carpenters for all your home repair needs. Every professional is verified with ratings and reviews from your community.",
                icon: Wrench,
                gradient: "from-blue-500 to-cyan-500",
                bgGradient: "from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20",
                tags: ["Electrician", "Plumber", "Carpenter", "HVAC"],
                image: "https://images.unsplash.com/photo-1581578731548-c64695cc6952?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=400",
                delay: 0.5
              },
              {
                title: "Market Runs & Errands",
                description: "Let trusted runners handle your grocery shopping, parcel pickups, and delivery needs. Safe, reliable, and convenient service for busy residents.",
                icon: ShoppingBag,
                gradient: "from-purple-500 to-pink-500",
                bgGradient: "from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20",
                tags: ["Groceries", "Deliveries", "Errands", "Shopping"],
                image: "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=400",
                delay: 0.7
              }
            ].map((service, index) => {
              const IconComponent = service.icon;
              return (
                <motion.div
                  key={service.title}
                  initial={{ opacity: 0, y: 50, scale: 0.9 }}
                  animate={servicesInView ? { opacity: 1, y: 0, scale: 1 } : {}}
                  transition={{ duration: 0.8, delay: service.delay }}
                  className="group relative"
                >
                  <motion.div
                    whileHover={{ y: -8, scale: 1.02 }}
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                    className={`relative overflow-hidden rounded-3xl bg-gradient-to-br ${service.bgGradient} p-8 shadow-xl border border-white/20 dark:border-slate-700/20 backdrop-blur-sm h-full`}
                  >
                    {/* Animated Background Gradient */}
                    <motion.div
                      className={`absolute inset-0 bg-gradient-to-br ${service.gradient} opacity-0 group-hover:opacity-5 transition-opacity duration-500`}
                      initial={false}
                      animate={{ opacity: 0 }}
                      whileHover={{ opacity: 0.1 }}
                    />

                    {/* Service Image */}
                    <motion.div
                      className="relative overflow-hidden rounded-2xl mb-6"
                      whileHover={{ scale: 1.05 }}
                      transition={{ duration: 0.3 }}
                    >
                      <img 
                        src={service.image}
                        alt={`${service.title} professional service`}
                        className="w-full h-48 sm:h-56 object-cover"
                      />
                      <div className={`absolute inset-0 bg-gradient-to-t ${service.gradient} opacity-20 group-hover:opacity-30 transition-opacity duration-300`} />
                    </motion.div>

                    {/* Icon and Title */}
                    <div className="flex items-center mb-4">
                      <motion.div
                        className={`w-12 h-12 rounded-xl bg-gradient-to-r ${service.gradient} p-3 mr-4 shadow-lg`}
                        whileHover={{ rotate: 360, scale: 1.1 }}
                        transition={{ duration: 0.6 }}
                      >
                        <IconComponent className="w-full h-full text-white" />
                      </motion.div>
                      <h3 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100">
                        {service.title}
                      </h3>
                    </div>

                    {/* Description */}
                    <p className="text-slate-700 dark:text-slate-300 mb-6 leading-relaxed">
                      {service.description}
                    </p>

                    {/* Tags */}
                    <div className="flex flex-wrap gap-2">
                      {service.tags.map((tag) => (
                        <motion.span
                          key={tag}
                          whileHover={{ scale: 1.05 }}
                          className="px-3 py-1 text-xs font-medium rounded-full bg-white/60 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 backdrop-blur-sm border border-white/20 dark:border-slate-700/20"
                        >
                          {tag}
                        </motion.span>
                      ))}
                    </div>

                    {/* Hover Effect Elements */}
                    <motion.div
                      className="absolute top-4 right-4 w-2 h-2 bg-blue-400 rounded-full opacity-0 group-hover:opacity-60"
                      animate={{
                        scale: [1, 1.5, 1],
                      }}
                      transition={{
                        duration: 2,
                        repeat: Infinity,
                        ease: "easeInOut"
                      }}
                    />
                    <motion.div
                      className="absolute bottom-4 left-4 w-1 h-1 bg-purple-400 rounded-full opacity-0 group-hover:opacity-40"
                      animate={{
                        scale: [1, 2, 1],
                      }}
                      transition={{
                        duration: 3,
                        repeat: Infinity,
                        ease: "easeInOut",
                        delay: 1
                      }}
                    />
                  </motion.div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Enhanced How It Works Section */}
      <section className="py-20 sm:py-24 lg:py-32 relative overflow-hidden">
        {/* Background Elements */}
        <div className="absolute inset-0 bg-gradient-to-r from-slate-50 via-blue-50/30 to-purple-50/30 dark:from-slate-900 dark:via-blue-950/30 dark:to-purple-950/30">
          <motion.div
            className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-blue-400/10 to-cyan-400/10 rounded-full blur-3xl"
            animate={{
              x: [0, -50, 0],
              y: [0, 30, 0],
            }}
            transition={{
              duration: 18,
              repeat: Infinity,
              ease: "easeInOut"
            }}
          />
          <motion.div
            className="absolute bottom-0 left-0 w-80 h-80 bg-gradient-to-br from-purple-400/10 to-pink-400/10 rounded-full blur-3xl"
            animate={{
              x: [0, 50, 0],
              y: [0, -30, 0],
            }}
            transition={{
              duration: 22,
              repeat: Infinity,
              ease: "easeInOut"
            }}
          />
        </div>

        <div className="relative max-w-7xl mx-auto px-6 sm:px-8 lg:px-12">
          <motion.div
            className="text-center mb-16 lg:mb-20"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
          >
            <motion.div
              className="inline-flex items-center px-4 py-2 rounded-full bg-gradient-to-r from-blue-100 to-purple-100 dark:from-blue-900/30 dark:to-purple-900/30 text-blue-700 dark:text-blue-300 text-sm font-medium mb-4"
              initial={{ opacity: 0, scale: 0.5 }}
              whileInView={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              viewport={{ once: true }}
            >
              🔄 How It Works
            </motion.div>
            
            <motion.h2
              className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-6 bg-gradient-to-r from-slate-900 via-blue-700 to-indigo-700 dark:from-slate-100 dark:via-blue-300 dark:to-indigo-300 bg-clip-text text-transparent"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.3 }}
              viewport={{ once: true }}
            >
              Simple Steps to
              <br />
              <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                Get Help Fast
              </span>
            </motion.h2>
            
            <motion.p
              className="text-lg sm:text-xl text-slate-600 dark:text-slate-400 max-w-2xl mx-auto"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.4 }}
              viewport={{ once: true }}
            >
              From request creation to service completion - streamlined for your convenience
            </motion.p>
          </motion.div>

          {/* Animated Steps */}
          <div className="relative">
            {/* Progress Line */}
            <div className="hidden md:block absolute top-24 left-1/2 transform -translate-x-1/2 w-full max-w-2xl h-0.5">
              <motion.div
                className="h-full bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 rounded-full"
                initial={{ scaleX: 0 }}
                whileInView={{ scaleX: 1 }}
                transition={{ duration: 2, delay: 0.5 }}
                viewport={{ once: true }}
                style={{ transformOrigin: "left" }}
              />
            </div>

            <div className="grid gap-12 md:gap-8 md:grid-cols-3 relative z-10">
              {[
                {
                  step: 1,
                  title: "Create Request",
                  description: "Describe your service need, set your budget, and choose urgency level. Our smart matching system will find the perfect provider for you.",
                  icon: MessageSquare,
                  color: "from-blue-500 to-cyan-500",
                  bgColor: "from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20",
                  delay: 0.6
                },
                {
                  step: 2,
                  title: "Get Matched",
                  description: "Verified providers in your area review and accept your request. Get instant notifications when someone is available to help.",
                  icon: Users,
                  color: "from-purple-500 to-pink-500",
                  bgColor: "from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20",
                  delay: 0.8
                },
                {
                  step: 3,
                  title: "Track & Pay",
                  description: "Monitor progress in real-time with live updates. Pay securely upon completion and rate your experience to help the community.",
                  icon: CreditCard,
                  color: "from-emerald-500 to-teal-500",
                  bgColor: "from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20",
                  delay: 1.0
                }
              ].map((step) => {
                const IconComponent = step.icon;
                return (
                  <motion.div
                    key={step.step}
                    initial={{ opacity: 0, y: 50, scale: 0.9 }}
                    whileInView={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ duration: 0.8, delay: step.delay }}
                    viewport={{ once: true }}
                    className="relative group"
                  >
                    {/* Step Card */}
                    <motion.div
                      whileHover={{ y: -8, scale: 1.02 }}
                      transition={{ type: "spring", stiffness: 300, damping: 30 }}
                      className={`relative p-8 rounded-3xl bg-gradient-to-br ${step.bgColor} backdrop-blur-sm border border-white/20 dark:border-slate-700/20 shadow-xl overflow-hidden h-full`}
                    >
                      {/* Animated Background */}
                      <motion.div
                        className={`absolute inset-0 bg-gradient-to-br ${step.color} opacity-0 group-hover:opacity-5`}
                        initial={false}
                        whileHover={{ opacity: 0.1 }}
                        transition={{ duration: 0.3 }}
                      />

                      {/* Step Number with Animated Ring */}
                      <div className="relative mb-6">
                        <motion.div
                          className={`w-16 h-16 rounded-2xl bg-gradient-to-r ${step.color} p-4 mx-auto shadow-lg relative overflow-hidden`}
                          whileHover={{ rotate: 360, scale: 1.1 }}
                          transition={{ duration: 0.6 }}
                        >
                          <IconComponent className="w-full h-full text-white" />
                          
                          {/* Animated Ring */}
                          <motion.div
                            className="absolute inset-0 rounded-2xl border-2 border-white/20"
                            initial={{ scale: 1, opacity: 1 }}
                            animate={{ 
                              scale: [1, 1.3, 1], 
                              opacity: [1, 0, 1] 
                            }}
                            transition={{
                              duration: 3,
                              repeat: Infinity,
                              ease: "easeInOut"
                            }}
                          />
                        </motion.div>
                        
                        {/* Step Number Badge */}
                        <motion.div
                          className={`absolute -top-2 -right-2 w-8 h-8 bg-gradient-to-r ${step.color} rounded-full flex items-center justify-center text-white font-bold text-sm shadow-lg`}
                          initial={{ scale: 0 }}
                          whileInView={{ scale: 1 }}
                          transition={{ duration: 0.5, delay: step.delay + 0.2 }}
                          viewport={{ once: true }}
                        >
                          {step.step}
                        </motion.div>
                      </div>

                      {/* Content */}
                      <div className="text-center relative z-10">
                        <motion.h3
                          className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100 mb-4"
                          initial={{ opacity: 0, y: 10 }}
                          whileInView={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.6, delay: step.delay + 0.3 }}
                          viewport={{ once: true }}
                        >
                          {step.title}
                        </motion.h3>
                        
                        <motion.p
                          className="text-slate-700 dark:text-slate-300 leading-relaxed"
                          initial={{ opacity: 0, y: 10 }}
                          whileInView={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.6, delay: step.delay + 0.4 }}
                          viewport={{ once: true }}
                        >
                          {step.description}
                        </motion.p>
                      </div>

                      {/* Decorative Elements */}
                      <motion.div
                        className="absolute top-4 right-4 w-2 h-2 bg-blue-400 rounded-full opacity-0 group-hover:opacity-60"
                        animate={{
                          scale: [1, 1.5, 1],
                        }}
                        transition={{
                          duration: 2,
                          repeat: Infinity,
                          ease: "easeInOut"
                        }}
                      />
                      <motion.div
                        className="absolute bottom-4 left-4 w-1 h-1 bg-purple-400 rounded-full opacity-0 group-hover:opacity-40"
                        animate={{
                          scale: [1, 2, 1],
                        }}
                        transition={{
                          duration: 3,
                          repeat: Infinity,
                          ease: "easeInOut",
                          delay: 1
                        }}
                      />
                    </motion.div>
                  </motion.div>
                );
              })}
            </div>

            {/* Call to Action */}
            <motion.div
              className="text-center mt-16 lg:mt-20"
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 1.2 }}
              viewport={{ once: true }}
            >
              <motion.div
                whileHover={{ scale: 1.05, y: -2 }}
                whileTap={{ scale: 0.95 }}
                className="group inline-block"
              >
                <Button
                  onClick={() => setLocation("/auth")}
                  size="lg"
                  className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-8 py-4 text-lg font-semibold rounded-full shadow-lg hover:shadow-2xl transition-all duration-300 group-hover:shadow-blue-500/25"
                  data-testid="button-start-journey"
                >
                  <Sparkles className="w-5 h-5 mr-2" />
                  Start Your Journey
                  <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
                </Button>
              </motion.div>
            </motion.div>
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
