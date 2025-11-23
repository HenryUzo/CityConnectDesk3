import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "./hooks/use-auth";
import { ProtectedRoute } from "./lib/protected-route";
import { AdminAuthProvider } from "@/pages/admin-super-dashboard";

import LandingPage from "@/pages/landing-page";
import AuthPage from "@/pages/auth-page";
import ResidentDashboard from "@/pages/resident-dashboard";
import ProviderDashboard from "@/pages/provider-dashboard";
import ProviderCompanyRegistration from "@/pages/provider-company-registration";
import CompanyDashboard from "@/pages/company-dashboard";
import ProviderStoreItems from "@/pages/provider-store-items";
import AdminDashboard from "@/pages/admin-dashboard";
import AdminSuperDashboard from "@/pages/admin-super-dashboard";
import BookArtisan from "@/pages/book-artisan";
import BookMarketRun from "@/pages/book-market-run";
import TrackOrders from "@/pages/track-orders";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/" component={LandingPage} />
      <Route path="/auth" component={AuthPage} />
      <ProtectedRoute path="/resident" component={ResidentDashboard} />
      <Route path="/company-registration" component={ProviderCompanyRegistration} />
      <Route path="/company-dashboard" component={CompanyDashboard} />
      <ProtectedRoute path="/provider" component={ProviderDashboard} />
      <ProtectedRoute path="/provider/stores/:storeId/items" component={ProviderStoreItems} />
      <ProtectedRoute path="/admin" component={AdminDashboard} />
      <Route path="/admin/login">
        <Redirect to="/admin-dashboard" />
      </Route>
      <Route path="/admin-dashboard/stores/inventory/:storeId">
        <AdminAuthProvider>
          <AdminSuperDashboard />
        </AdminAuthProvider>
      </Route>
      <Route path="/admin-dashboard/:section?">
        <AdminAuthProvider>
          <AdminSuperDashboard />
        </AdminAuthProvider>
      </Route>
      <ProtectedRoute path="/book-artisan" component={BookArtisan} />
      <ProtectedRoute path="/book-market-run" component={BookMarketRun} />
      <ProtectedRoute path="/track-orders" component={TrackOrders} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
