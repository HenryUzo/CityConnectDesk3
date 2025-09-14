import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  DollarSign
} from "lucide-react";

export default function ResidentDashboard() {
  const { user, logoutMutation } = useAuth();
  const [, setLocation] = useLocation();

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

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="bg-card shadow-sm border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-bold text-primary">CityConnect</h1>
              <span className="ml-3 text-sm text-muted-foreground">Resident Dashboard</span>
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex items-center bg-muted rounded-lg px-3 py-1">
                <Wallet className="w-4 h-4 mr-2 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Wallet:</span>
                <span className="ml-2 font-semibold text-foreground" data-testid="text-wallet-balance">
                  ₦{wallet?.balance || '25,000'}
                </span>
              </div>
              <Button variant="ghost" size="sm" onClick={handleLogout} data-testid="button-logout">
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid lg:grid-cols-4 gap-8">
          {/* Sidebar */}
          <div className="lg:col-span-1">
            <nav className="space-y-2">
              <Button variant="default" className="w-full justify-start" asChild>
                <Link href="/resident" data-testid="link-dashboard">
                  <Home className="w-4 h-4 mr-2" />
                  Dashboard Overview
                </Link>
              </Button>
              <Button variant="ghost" className="w-full justify-start" asChild>
                <Link href="/book-artisan" data-testid="link-book-artisan">
                  <Wrench className="w-4 h-4 mr-2" />
                  Book Artisan Repair
                </Link>
              </Button>
              <Button variant="ghost" className="w-full justify-start" asChild>
                <Link href="/book-market-run" data-testid="link-book-market-run">
                  <ShoppingBag className="w-4 h-4 mr-2" />
                  Request Market Run
                </Link>
              </Button>
              <Button variant="ghost" className="w-full justify-start" asChild>
                <Link href="/track-orders" data-testid="link-track-orders">
                  <ClipboardList className="w-4 h-4 mr-2" />
                  Track Orders
                </Link>
              </Button>
            </nav>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3 space-y-6">
            {/* Welcome Section */}
            <div>
              <h2 className="text-2xl font-bold text-foreground mb-2">
                Welcome back, <span data-testid="text-user-name">{user?.name}!</span>
              </h2>
              <p className="text-muted-foreground">Here's what's happening with your services</p>
            </div>

            {/* Stats Cards */}
            <div className="grid md:grid-cols-3 gap-6">
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Active Requests</p>
                      <p className="text-2xl font-bold text-foreground" data-testid="text-active-requests">
                        {stats.active}
                      </p>
                    </div>
                    <div className="bg-accent/10 p-3 rounded-lg">
                      <Clock className="w-6 h-6 text-accent" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Completed</p>
                      <p className="text-2xl font-bold text-foreground" data-testid="text-completed-requests">
                        {stats.completed}
                      </p>
                    </div>
                    <div className="bg-secondary/10 p-3 rounded-lg">
                      <CheckCircle className="w-6 h-6 text-secondary" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Total Spent</p>
                      <p className="text-2xl font-bold text-foreground" data-testid="text-total-spent">
                        ₦{stats.totalSpent.toLocaleString()}
                      </p>
                    </div>
                    <div className="bg-primary/10 p-3 rounded-lg">
                      <DollarSign className="w-6 h-6 text-primary" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Quick Actions */}
            <div className="grid md:grid-cols-2 gap-6">
              <Card className="hover:shadow-md transition-shadow cursor-pointer" asChild>
                <Link href="/book-artisan">
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <Wrench className="w-6 h-6 mr-3 text-primary" />
                      Book Artisan Repair
                    </CardTitle>
                    <CardDescription>
                      Electrician, Plumber, Carpenter services
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button className="w-full" data-testid="button-book-artisan">
                      <Plus className="w-4 h-4 mr-2" />
                      Book Now
                    </Button>
                  </CardContent>
                </Link>
              </Card>

              <Card className="hover:shadow-md transition-shadow cursor-pointer" asChild>
                <Link href="/book-market-run">
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <ShoppingBag className="w-6 h-6 mr-3 text-secondary" />
                      Request Market Run
                    </CardTitle>
                    <CardDescription>
                      Groceries, Deliveries, Errands
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button variant="secondary" className="w-full" data-testid="button-request-market-run">
                      <Plus className="w-4 h-4 mr-2" />
                      Request Now
                    </Button>
                  </CardContent>
                </Link>
              </Card>
            </div>

            {/* Recent Activity */}
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle>Recent Activity</CardTitle>
                  <Button variant="outline" size="sm" asChild>
                    <Link href="/track-orders" data-testid="link-view-all-orders">
                      View All
                    </Link>
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {recentActivity.length > 0 ? (
                    recentActivity.map((activity: any) => (
                      <div 
                        key={activity.id} 
                        className="flex items-center space-x-4 p-4 bg-muted rounded-lg"
                        data-testid={`activity-${activity.id}`}
                      >
                        <div className="bg-primary text-primary-foreground w-10 h-10 rounded-full flex items-center justify-center">
                          {activity.category === 'market_runner' ? (
                            <ShoppingBag className="w-5 h-5" />
                          ) : (
                            <Wrench className="w-5 h-5" />
                          )}
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-foreground">{activity.description}</p>
                          <p className="text-sm text-muted-foreground">
                            {activity.providerId ? `Assigned to provider` : 'Pending assignment'} • 
                            {new Date(activity.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                        <Badge className={activity.statusColor}>
                          {activity.status.replace('_', ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}
                        </Badge>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <ClipboardList className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p>No recent activity</p>
                      <p className="text-sm">Start by booking a service!</p>
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
