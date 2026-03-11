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
import NotificationsPage from "@/pages/notifications";
import ProviderDashboard from "@/pages/provider-dashboard";
import ProviderJobs from "@/pages/provider-jobs";
import ProviderChatPage from "@/pages/provider-chat";
import ProviderStores from "@/pages/provider-stores";
import ProviderMarketplace from "@/pages/provider-marketplace";
import ProviderCompanyRegistration from "@/pages/provider-company-registration";
import CompanyDashboard from "@/pages/company-dashboard";
import ProviderStoreItems from "@/pages/provider-store-items";
import ProviderStoreOrders from "@/pages/provider-store-orders";
import AdminDashboard from "@/pages/admin-dashboard";
import AdminSuperDashboard from "@/pages/admin-super-dashboard";
import AdminAiConversationsPage from "@/pages/admin-ai-conversations";
import AdminAiPreparedRequestsPage from "@/pages/admin-ai-prepared-requests";
import AdminProviderMatchingPage from "@/pages/admin-provider-matching";
import CompanyStores from "@/pages/company-stores";
import CompanyInventory from "@/pages/company-inventory";
import CompanyTasks from "@/pages/company-tasks";
import ProviderTasks from "@/pages/provider-tasks";
import BookArtisan from "@/pages/book-artisan";
import ServiceCategories from "@/pages/service-categories";
import BookMarketRun from "@/pages/book-market-run";
import TrackOrders from "@/pages/track-orders";
import ServiceRequestsPage from "@/pages/service-requests";
import CheckoutDiagnosis from "@/pages/checkout-diagnosis";
import PaymentPolicy from "@/pages/payment-policy";
import PaymentConfirmation from "@/pages/payment-confirmation";
import SelectCategory from "@/pages/resident/SelectCategory";
import RequestConversation from "@/pages/resident/RequestConversation";
import BookServiceChat from "@/pages/resident/BookServiceChat";
import ScheduleInspection from "@/pages/resident/ScheduleInspection";
import CityMart from "@/pages/resident/CityMart";
import CartPage from "@/pages/resident/CartPage";
import OrdersPage from "@/pages/resident/OrdersPage";
import StoreOrdersDashboard from "@/pages/StoreOrdersDashboard";
import Settings from "@/pages/resident/Settings";
import Homepage from "@/pages/resident/Homepage";
import OrdinaryConversationFlow from "@/pages/resident/OrdinaryConversationFlow";
import NotFound from "@/pages/not-found";
import { ProfileProvider } from "@/contexts/ProfileContext";
import { useAuth } from "./hooks/use-auth";
import { apiRequest, queryClient } from "./lib/queryClient";
import { Button } from "@/components/ui/button";


function Router() {
  return (
    <Switch>
      <Route path="/" component={LandingPage} />
      <Route path="/auth" component={AuthPage} />
      <Route path="/waiting-room" component={WaitingRoom} />
      <Route path="/provider-waiting-room" component={WaitingRoom} />
      <ProtectedRoute path="/notifications" component={NotificationsPage} />
      <ProtectedRoute path="/resident" component={Homepage} />
      <Route path="/company-registration" component={ProviderCompanyRegistration} />
      <Route path="/company-dashboard" component={CompanyDashboard} />
      <Route path="/company-dashboard/:rest*" component={CompanyDashboard} />
      <ProtectedRoute path="/company/stores" component={CompanyStores} />
      <ProtectedRoute path="/company/inventory" component={CompanyInventory} />
      <ProtectedRoute path="/company/tasks" component={CompanyTasks} />
      <ProtectedRoute path="/provider" component={ProviderDashboard} requiredRole="provider" />
      <ProtectedRoute path="/provider-dashboard" component={ProviderDashboard} requiredRole="provider" />
      <ProtectedRoute path="/provider/tasks" component={ProviderTasks} requiredRole="provider" />
      <ProtectedRoute path="/provider/jobs" component={ProviderJobs} requiredRole="provider" />
      <ProtectedRoute path="/provider/chat" component={ProviderChatPage} requiredRole="provider" />
      <ProtectedRoute path="/provider-store-items" component={ProviderStores} requiredRole="provider" />
      <ProtectedRoute path="/provider/marketplace" component={ProviderMarketplace} requiredRole="provider" />
      <ProtectedRoute path="/provider/stores/:storeId/items" component={ProviderStoreItems} requiredRole="provider" />
      <ProtectedRoute path="/provider/stores/:storeId/orders" component={ProviderStoreOrders} requiredRole="provider" />
      <ProtectedRoute path="/provider/stores/:storeId/dashboard" component={StoreOrdersDashboard} requiredRole="provider" />
      <ProtectedRoute path="/admin" component={AdminDashboard} requiredRole="admin" />
      <ProtectedRoute path="/admin/ai/conversations" component={AdminAiConversationsPage} requiredRole="admin" />
      <ProtectedRoute path="/admin/ai/prepared-requests" component={AdminAiPreparedRequestsPage} requiredRole="admin" />
      <Route path="/admin/pricing-rules">
        <Redirect to="/admin-dashboard/pricing-rules" />
      </Route>
      <Route path="/admin/request-questions">
        <Redirect to="/admin-dashboard/request-questions" />
      </Route>
      <ProtectedRoute path="/admin/providers/matching" component={AdminProviderMatchingPage} />
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
      <ProtectedRoute path="/resident/requests/new" component={SelectCategory} />
      <ProtectedRoute path="/resident/requests/new/:category" component={RequestConversation} />
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
