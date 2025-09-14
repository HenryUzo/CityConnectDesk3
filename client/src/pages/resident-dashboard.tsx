import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { 
  Home, 
  Wrench, 
  ShoppingBag, 
  ClipboardList, 
  LogOut, 
  Wallet,
  Plus,
  Clock,
  CheckCircle,
  DollarSign,
  Menu
} from "lucide-react";
import { useState } from "react";

export default function ResidentDashboard() {
  const { user, logoutMutation } = useAuth();
  const [, setLocation] = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const { data: wallet } = useQuery({
    queryKey: ["/api/wallet"],
  });

  const { data: serviceRequests = [] } = useQuery({
    queryKey: ["/api/service-requests"],
  });

  const handleLogout = async () => {
    await logoutMutation.mutateAsync();
    setLocation("/");
  };

  const stats = {
    active: serviceRequests.filter((r: any) => ['pending', 'assigned', 'in_progress'].includes(r.status)).length,
    completed: serviceRequests.filter((r: any) => r.status === 'completed').length,
    totalSpent: serviceRequests
      .filter((r: any) => r.status === 'completed')
      .reduce((sum: number, r: any) => sum + (parseFloat(r.budget.split('-')[1]?.replace(/[₦,]/g, '') || '0') || 0), 0)
  };

  const recentActivity = serviceRequests
    .slice(0, 3)
    .map((request: any) => ({
      ...request,
      statusColor: request.status === 'completed' ? 'bg-green-100 text-green-800' :
                  request.status === 'in_progress' ? 'bg-yellow-100 text-yellow-800' :
                  request.status === 'assigned' ? 'bg-blue-100 text-blue-800' :
                  'bg-gray-100 text-gray-800'
    }));

  // Navigation component for mobile
  const NavigationItems = ({ onLinkClick }: { onLinkClick?: () => void }) => (
    <nav className="space-y-2">
      <Button variant="default" className="w-full justify-start h-12" asChild>
        <Link href="/resident" data-testid="link-dashboard" onClick={onLinkClick}>
          <Home className="w-5 h-5 mr-3" />
          Dashboard Overview
        </Link>
      </Button>
      <Button variant="ghost" className="w-full justify-start h-12" asChild>
        <Link href="/book-artisan" data-testid="link-book-artisan" onClick={onLinkClick}>
          <Wrench className="w-5 h-5 mr-3" />
          Book Artisan Repair
        </Link>
      </Button>
      <Button variant="ghost" className="w-full justify-start h-12" asChild>
        <Link href="/book-market-run" data-testid="link-book-market-run" onClick={onLinkClick}>
          <ShoppingBag className="w-5 h-5 mr-3" />
          Request Market Run
        </Link>
      </Button>
      <Button variant="ghost" className="w-full justify-start h-12" asChild>
        <Link href="/track-orders" data-testid="link-track-orders" onClick={onLinkClick}>
          <ClipboardList className="w-5 h-5 mr-3" />
          Track Orders
        </Link>
      </Button>
    </nav>
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile-First Navigation */}
      <nav className="bg-card shadow-sm border-b border-border sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8">
          <div className="flex justify-between items-center h-14 sm:h-16">
            {/* Mobile menu button and logo */}
            <div className="flex items-center space-x-3">
              {/* Mobile menu button */}
              <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
                <SheetTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="lg:hidden h-10 w-10 p-0" 
                    data-testid="button-mobile-menu"
                  >
                    <Menu className="w-5 h-5" />
                    <span className="sr-only">Open menu</span>
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-72 p-6">
                  <div className="mb-6">
                    <h2 className="text-lg font-semibold text-foreground">Navigation</h2>
                  </div>
                  <NavigationItems onLinkClick={() => setMobileMenuOpen(false)} />
                </SheetContent>
              </Sheet>
              
              {/* Logo and title */}
              <div className="flex items-center">
                <h1 className="text-lg sm:text-xl font-bold text-primary">CityConnect</h1>
                <span className="ml-2 sm:ml-3 text-xs sm:text-sm text-muted-foreground hidden sm:inline">
                  Resident Dashboard
                </span>
              </div>
            </div>
            
            {/* Wallet and logout */}
            <div className="flex items-center space-x-2 sm:space-x-4">
              {/* Mobile-optimized wallet display */}
              <div className="flex items-center bg-muted rounded-lg px-2 sm:px-3 py-1.5 sm:py-1">
                <Wallet className="w-4 h-4 text-muted-foreground" />
                <span className="ml-1 sm:ml-2 text-xs sm:text-sm font-semibold text-foreground" data-testid="text-wallet-balance">
                  ₦{wallet?.balance || '25,000'}
                </span>
              </div>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={handleLogout} 
                data-testid="button-logout"
                className="h-10 w-10 p-0"
              >
                <LogOut className="w-4 h-4" />
                <span className="sr-only">Logout</span>
              </Button>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 py-4 sm:py-6 lg:py-8">
        <div className="grid lg:grid-cols-4 gap-4 sm:gap-6 lg:gap-8">
          {/* Desktop Sidebar - Hidden on mobile */}
          <div className="hidden lg:block lg:col-span-1">
            <NavigationItems />
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3 space-y-4 sm:space-y-6">
            {/* Welcome Section */}
            <div className="text-center sm:text-left">
              <h2 className="text-xl sm:text-2xl font-bold text-foreground mb-2">
                Welcome back, <span data-testid="text-user-name">{user?.name}!</span>
              </h2>
              <p className="text-sm sm:text-base text-muted-foreground">Here's what's happening with your services</p>
            </div>

            {/* Stats Cards - Mobile-first responsive grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 lg:gap-6">
              <Card className="hover:shadow-md transition-shadow">
                <CardContent className="p-4 sm:p-6">
                  <div className="flex items-center justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs sm:text-sm font-medium text-muted-foreground mb-1">Active Requests</p>
                      <p className="text-xl sm:text-2xl font-bold text-foreground" data-testid="text-active-requests">
                        {stats.active}
                      </p>
                    </div>
                    <div className="bg-accent/10 p-2 sm:p-3 rounded-lg ml-3">
                      <Clock className="w-5 h-5 sm:w-6 sm:h-6 text-accent" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="hover:shadow-md transition-shadow">
                <CardContent className="p-4 sm:p-6">
                  <div className="flex items-center justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs sm:text-sm font-medium text-muted-foreground mb-1">Completed</p>
                      <p className="text-xl sm:text-2xl font-bold text-foreground" data-testid="text-completed-requests">
                        {stats.completed}
                      </p>
                    </div>
                    <div className="bg-secondary/10 p-2 sm:p-3 rounded-lg ml-3">
                      <CheckCircle className="w-5 h-5 sm:w-6 sm:h-6 text-secondary" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="hover:shadow-md transition-shadow sm:col-span-2 lg:col-span-1">
                <CardContent className="p-4 sm:p-6">
                  <div className="flex items-center justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs sm:text-sm font-medium text-muted-foreground mb-1">Total Spent</p>
                      <p className="text-xl sm:text-2xl font-bold text-foreground" data-testid="text-total-spent">
                        ₦{stats.totalSpent.toLocaleString()}
                      </p>
                    </div>
                    <div className="bg-primary/10 p-2 sm:p-3 rounded-lg ml-3">
                      <DollarSign className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Quick Actions - Mobile-optimized */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 lg:gap-6">
              <Link to="/book-artisan">
                <Card className="hover:shadow-md transition-shadow cursor-pointer">
                  <CardHeader className="pb-3 sm:pb-6">
                    <CardTitle className="flex items-center text-base sm:text-lg">
                      <Wrench className="w-5 h-5 sm:w-6 sm:h-6 mr-2 sm:mr-3 text-primary" />
                      Book Artisan Repair
                    </CardTitle>
                    <CardDescription className="text-sm">
                      Electrician, Plumber, Carpenter services
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <Button className="w-full h-11 sm:h-10" data-testid="button-book-artisan">
                      <Plus className="w-4 h-4 mr-2" />
                      Book Now
                    </Button>
                  </CardContent>
                </Card>
              </Link>

              <Link to="/book-market-run">
                <Card className="hover:shadow-md transition-shadow cursor-pointer">
                  <CardHeader className="pb-3 sm:pb-6">
                    <CardTitle className="flex items-center text-base sm:text-lg">
                      <ShoppingBag className="w-5 h-5 sm:w-6 sm:h-6 mr-2 sm:mr-3 text-secondary" />
                      Request Market Run
                    </CardTitle>
                    <CardDescription className="text-sm">
                      Groceries, Deliveries, Errands
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <Button variant="secondary" className="w-full h-11 sm:h-10" data-testid="button-request-market-run">
                      <Plus className="w-4 h-4 mr-2" />
                      Request Now
                    </Button>
                  </CardContent>
                </Card>
              </Link>
            </div>

            {/* Recent Activity - Mobile-optimized */}
            <Card>
              <CardHeader className="pb-3 sm:pb-6">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center space-y-2 sm:space-y-0">
                  <CardTitle className="text-lg sm:text-xl">Recent Activity</CardTitle>
                  <Button variant="outline" size="sm" className="self-start sm:self-auto h-9" asChild>
                    <Link to="/track-orders" data-testid="link-view-all-orders">
                      View All
                    </Link>
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 sm:space-y-4">
                  {recentActivity.length > 0 ? (
                    recentActivity.map((activity: any) => (
                      <div 
                        key={activity.id} 
                        className="flex items-start sm:items-center space-x-3 sm:space-x-4 p-3 sm:p-4 bg-muted rounded-lg"
                        data-testid={`activity-${activity.id}`}
                      >
                        <div className="bg-primary text-primary-foreground w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center flex-shrink-0">
                          {activity.category === 'market_runner' ? (
                            <ShoppingBag className="w-4 h-4 sm:w-5 sm:h-5" />
                          ) : (
                            <Wrench className="w-4 h-4 sm:w-5 sm:h-5" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-foreground text-sm sm:text-base break-words">{activity.description}</p>
                          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                            {activity.providerId ? `Assigned to provider` : 'Pending assignment'} • 
                            {new Date(activity.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="flex-shrink-0">
                          <Badge className={`${activity.statusColor} text-xs px-2 py-1`}>
                            {activity.status.replace('_', ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}
                          </Badge>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-6 sm:py-8 text-muted-foreground">
                      <ClipboardList className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-3 sm:mb-4 opacity-50" />
                      <p className="text-sm sm:text-base">No recent activity</p>
                      <p className="text-xs sm:text-sm">Start by booking a service!</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
