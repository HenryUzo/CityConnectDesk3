import { Suspense, lazy, type ComponentType } from "react";
import { Switch, Route, Redirect } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "./hooks/use-auth";
import { ProtectedRoute } from "./lib/protected-route";
import { AdminAuthProvider } from "@/pages/admin-super-dashboard";
import { NotificationsProvider } from "@/contexts/NotificationsContext";

import LandingPage from "@/pages/landing-page";
import AuthPage from "@/pages/auth-page";
import WaitingRoom from "@/pages/waiting-room";
import ProviderCompanyRegistration from "@/pages/provider-company-registration";
import AdminDashboard from "@/pages/admin-dashboard";
import AdminSuperDashboard from "@/pages/admin-super-dashboard";
import AdminAiConversationsPage from "@/pages/admin-ai-conversations";
import AdminAiPreparedRequestsPage from "@/pages/admin-ai-prepared-requests";
import AdminProviderMatchingPage from "@/pages/admin-provider-matching";
import ProviderTasks from "@/pages/provider-tasks";
import BookArtisan from "@/pages/book-artisan";
import ServiceCategories from "@/pages/service-categories";
import BookMarketRun from "@/pages/book-market-run";
import TrackOrders from "@/pages/track-orders";
import ServiceRequestsPage from "@/pages/service-requests";
import CheckoutDiagnosis from "@/pages/checkout-diagnosis";
import PaymentPolicy from "@/pages/payment-policy";
import PaymentConfirmation from "@/pages/payment-confirmation";
import BookServiceChat from "@/pages/resident/BookServiceChat";
import ScheduleInspection from "@/pages/resident/ScheduleInspection";
import CityMart from "@/pages/resident/CityMart";
import CartPage from "@/pages/resident/CartPage";
import OrdersPage from "@/pages/resident/OrdersPage";
import Settings from "@/pages/resident/Settings";
import Homepage from "@/pages/resident/Homepage";
import OrdinaryConversationFlow from "@/pages/resident/OrdinaryConversationFlow";
import NotFound from "@/pages/not-found";
import { ProfileProvider } from "@/contexts/ProfileContext";
import { useAuth } from "./hooks/use-auth";
import { apiRequest, queryClient } from "./lib/queryClient";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";


function RouteLoadingFallback({ label = "Loading page" }: { label?: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6 py-10">
      <div className="flex items-center gap-3 rounded-full border border-border bg-card px-4 py-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>{label}...</span>
      </div>
    </div>
  );
}

function withRouteSuspense<P extends object>(
  LazyComponent: ComponentType<P>,
  label: string,
): ComponentType<P> {
  const Wrapped = (props: P) => (
    <Suspense fallback={<RouteLoadingFallback label={label} />}>
      <LazyComponent {...props} />
    </Suspense>
  );
  Wrapped.displayName = `RouteSuspense(${label})`;
  return Wrapped;
}

const NotificationsPageRoute = withRouteSuspense(
  lazy(() => import("@/pages/notifications")),
  "Loading notifications",
);
const ProviderDashboardRoute = withRouteSuspense(
  lazy(() => import("@/pages/provider-dashboard")),
  "Loading provider dashboard",
);
const ProviderJobsRoute = withRouteSuspense(
  lazy(() => import("@/pages/provider-jobs")),
  "Loading provider jobs",
);
const ProviderChatRoute = withRouteSuspense(
  lazy(() => import("@/pages/provider-chat")),
  "Loading provider chat",
);
const ProviderStoresRoute = withRouteSuspense(
  lazy(() => import("@/pages/provider-stores")),
  "Loading provider stores",
);
const ProviderMarketplaceRoute = withRouteSuspense(
  lazy(() => import("@/pages/provider-marketplace")),
  "Loading provider marketplace",
);
const ProviderStoreItemsRoute = withRouteSuspense(
  lazy(() => import("@/pages/provider-store-items")),
  "Loading store inventory",
);
const ProviderStoreOrdersRoute = withRouteSuspense(
  lazy(() => import("@/pages/provider-store-orders")),
  "Loading store orders",
);
const ProviderStoreDashboardRoute = withRouteSuspense(
  lazy(() => import("@/pages/StoreOrdersDashboard")),
  "Loading store dashboard",
);
const CompanyDashboardRoute = withRouteSuspense(
  lazy(() => import("@/pages/company-dashboard")),
  "Loading company dashboard",
);
const CompanyStoresRoute = withRouteSuspense(
  lazy(() => import("@/pages/company-stores")),
  "Loading company stores",
);
const CompanyInventoryRoute = withRouteSuspense(
  lazy(() => import("@/pages/company-inventory")),
  "Loading company inventory",
);
const CompanyTasksRoute = withRouteSuspense(
  lazy(() => import("@/pages/company-tasks")),
  "Loading company tasks",
);


function Router() {
  return (
    <Switch>
      <Route path="/" component={LandingPage} />
      <Route path="/auth" component={AuthPage} />
      <Route path="/waiting-room" component={WaitingRoom} />
      <Route path="/provider-waiting-room" component={WaitingRoom} />
      <ProtectedRoute path="/notifications" component={NotificationsPageRoute} requiredRoles={["resident", "provider"]} fallbackPath="/" />
      <ProtectedRoute path="/resident" component={Homepage} />
      <ProtectedRoute
        path="/company-registration"
        component={ProviderCompanyRegistration}
        requiredRole="provider"
        allowUnapprovedProvider
      />
      <ProtectedRoute
        path="/company-dashboard"
        component={CompanyDashboardRoute}
        requiredRole="provider"
        requireCompanyAccess
        requireActiveCompany
        requireCompanyOwner
        companyFallbackPath="/provider/dashboard"
      />
      <ProtectedRoute
        path="/company-dashboard/:rest*"
        component={CompanyDashboardRoute}
        requiredRole="provider"
        requireCompanyAccess
        requireActiveCompany
        requireCompanyOwner
        companyFallbackPath="/provider/dashboard"
      />
      <ProtectedRoute
        path="/company/stores"
        component={CompanyStoresRoute}
        requiredRole="provider"
        requireCompanyAccess
        requireActiveCompany
        requireCompanyOwner
        companyFallbackPath="/provider/dashboard"
      />
      <ProtectedRoute
        path="/company/inventory"
        component={CompanyInventoryRoute}
        requiredRole="provider"
        requireCompanyAccess
        requireActiveCompany
        requireCompanyOwner
        companyFallbackPath="/provider/dashboard"
      />
      <ProtectedRoute
        path="/company/tasks"
        component={CompanyTasksRoute}
        requiredRole="provider"
        requireCompanyAccess
        requireActiveCompany
        requireCompanyOwner
        companyFallbackPath="/provider/dashboard"
      />
      <Route path="/provider">
        <Redirect to="/provider/dashboard" />
      </Route>
      <ProtectedRoute path="/provider/dashboard" component={ProviderDashboardRoute} requiredRole="provider" />
      <Route path="/provider-dashboard">
        <Redirect to="/provider/dashboard" />
      </Route>
      <ProtectedRoute
        path="/provider/company-registration"
        component={ProviderCompanyRegistration}
        requiredRole="provider"
        allowUnapprovedProvider
      />
      {/* TODO(provider-tasks): Route kept for direct access while provider nav entry is intentionally hidden. */}
      <ProtectedRoute path="/provider/tasks" component={ProviderTasks} requiredRole="provider" />
      <ProtectedRoute path="/provider/jobs" component={ProviderJobsRoute} requiredRole="provider" />
      <ProtectedRoute path="/provider/chat" component={ProviderChatRoute} requiredRole="provider" />
      <ProtectedRoute path="/provider/stores" component={ProviderStoresRoute} requiredRole="provider" />
      <Route path="/provider-store-items">
        <Redirect to="/provider/stores" />
      </Route>
      <ProtectedRoute path="/provider/marketplace" component={ProviderMarketplaceRoute} requiredRole="provider" />
      <ProtectedRoute path="/provider/stores/:storeId/items" component={ProviderStoreItemsRoute} requiredRole="provider" />
      <ProtectedRoute path="/provider/stores/:storeId/orders" component={ProviderStoreOrdersRoute} requiredRole="provider" />
      <ProtectedRoute path="/provider/stores/:storeId/dashboard" component={ProviderStoreDashboardRoute} requiredRole="provider" />
      <ProtectedRoute path="/admin" component={AdminDashboard} requiredRole="admin" />
      <ProtectedRoute path="/admin/ai/conversations" component={AdminAiConversationsPage} requiredRole="admin" />
      <ProtectedRoute path="/admin/ai/prepared-requests" component={AdminAiPreparedRequestsPage} requiredRole="admin" />
      <Route path="/admin/pricing-rules">
        <Redirect to="/admin-dashboard/pricing-rules" />
      </Route>
      <Route path="/admin/request-questions">
        <Redirect to="/admin-dashboard/request-questions" />
      </Route>
      <ProtectedRoute path="/admin/providers/matching" component={AdminProviderMatchingPage} requiredRole="admin" />
      <Route path="/admin/login">
        <Redirect to="/admin-dashboard" />
      </Route>
      <Route path="/estate-dashboard">
        <Redirect to="/admin-dashboard" />
      </Route>
      <Route path="/admin-dashboard/stores/inventory/:storeId">
        <AdminAuthProvider>
          <AdminSuperDashboard />
        </AdminAuthProvider>
      </Route>
      <Route path="/admin-dashboard/stores/members/:storeId">
        <AdminAuthProvider>
          <AdminSuperDashboard />
        </AdminAuthProvider>
      </Route>
      <Route path="/admin-dashboard/companies/members/:companyId">
        <AdminAuthProvider>
          <AdminSuperDashboard />
        </AdminAuthProvider>
      </Route>
      <Route path="/admin-dashboard/companies/stores/:companyId/inventory/:storeId">
        <AdminAuthProvider>
          <AdminSuperDashboard />
        </AdminAuthProvider>
      </Route>
      <Route path="/admin-dashboard/companies/stores/:companyId/members/:storeId">
        <AdminAuthProvider>
          <AdminSuperDashboard />
        </AdminAuthProvider>
      </Route>
      <Route path="/admin-dashboard/companies/stores/:companyId">
        <AdminAuthProvider>
          <AdminSuperDashboard />
        </AdminAuthProvider>
      </Route>
      <Route path="/admin-dashboard/requests/:requestId">
        <AdminAuthProvider>
          <AdminSuperDashboard />
        </AdminAuthProvider>
      </Route>
      <Route path="/admin-dashboard/:section?">
        <AdminAuthProvider>
          <AdminSuperDashboard />
        </AdminAuthProvider>
      </Route>
      <ProtectedRoute path="/service-categories" component={ServiceCategories} />
      <ProtectedRoute path="/book-artisan" component={BookArtisan} />
      <ProtectedRoute path="/checkout-diagnosis" component={CheckoutDiagnosis} />
      <ProtectedRoute path="/payment-policy" component={PaymentPolicy} />
      <ProtectedRoute path="/payment-confirmation" component={PaymentConfirmation} />
      <ProtectedRoute path="/book-market-run" component={BookMarketRun} />
      <ProtectedRoute path="/track-orders" component={TrackOrders} />
      <ProtectedRoute path="/service-requests" component={ServiceRequestsPage} />
      <Route path="/resident/requests/new">
        <Redirect to="/resident/requests/ordinary" />
      </Route>
      <Route path="/resident/requests/new/:category">
        <Redirect to="/resident/requests/ordinary" />
      </Route>
      <ProtectedRoute path="/resident/book-a-service/chat" component={BookServiceChat} />
      <ProtectedRoute path="/resident/book-a-service/inspection" component={ScheduleInspection} />
      <ProtectedRoute path="/resident/requests/ordinary" component={OrdinaryConversationFlow} />
      <ProtectedRoute path="/resident/citymart/cart" component={CartPage} />
      <ProtectedRoute path="/resident/citymart/orders" component={OrdersPage} />
      <ProtectedRoute path="/resident/citymart" component={CityMart} />
      <ProtectedRoute path="/resident/settings" component={Settings} />
      <Route component={NotFound} />
    </Switch>
  );
}

function ImpersonationBanner() {
  const { user, refreshUser } = useAuth();
  const isImpersonating = (user as any)?.isImpersonating;
  const impersonatedBy = (user as any)?.impersonatedBy;

  if (!isImpersonating) return null;

  const handleStop = async () => {
    await apiRequest("POST", "/api/admin/impersonate/stop");
    queryClient.invalidateQueries({ queryKey: ["/api/user"] });
    await refreshUser();
  };

  return (
    <div className="bg-amber-100 text-amber-900 px-4 py-2 text-sm flex items-center justify-between">
      <span>
        Impersonating {user?.email || "user"}{" "}
        {impersonatedBy?.email ? `(by ${impersonatedBy.email})` : ""}
      </span>
      <Button size="sm" variant="outline" onClick={handleStop}>
        Stop Impersonating
      </Button>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <NotificationsProvider>
          <ProfileProvider>
            <TooltipProvider>
            <Toaster />
            <ImpersonationBanner />
            <Router />
            </TooltipProvider>
          </ProfileProvider>
        </NotificationsProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
