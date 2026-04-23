import { createApiClient } from "./client";
import {
  DynamicFlowSession,
  OrdinaryFlowStartResponse,
  MaintenanceCategory,
  MaintenanceInitiationResponse,
  MaintenancePlan,
  MaintenanceSchedule,
  MaintenanceSubscription,
  MarketTrendsResponse,
  MobileAuthResponse,
  NotificationItem,
  OtpChallengeResponse,
  OtpVerifyResponse,
  PaystackSessionResponse,
  ProviderRequestPayload,
  ProviderCompany,
  ProviderTask,
  PublicCompany,
  ResidentDashboardStats,
  ResidentProfile,
  RequestCategory,
  RequestConfig,
  RequestMessage,
  ServiceRequest,
} from "./contracts";

type Client = ReturnType<typeof createApiClient>;

export function createServices(client: Client) {
  return {
    auth: {
      loginStart: (payload: Record<string, unknown>) =>
        client.post<OtpChallengeResponse>("/api/mobile/auth/login/start", payload),
      loginVerify: (payload: { challengeId: string; code: string }) =>
        client.post<MobileAuthResponse>("/api/mobile/auth/login/verify", payload),
      registerStart: (payload: Record<string, unknown>) =>
        client.post<OtpChallengeResponse>("/api/mobile/auth/register", payload),
      registerComplete: (payload: { pendingRegistrationId: string; verificationToken: string }) =>
        client.post<MobileAuthResponse>("/api/mobile/auth/register/complete", payload),
      requestOtp: (payload: {
        purpose: "signup_verify" | "login_verify";
        channel?: "sms" | "email";
        destination?: string;
        pendingRegistrationId?: string | null;
        identifier?: string | null;
      }) => client.post<OtpChallengeResponse>("/api/mobile/auth/otp/request", payload),
      verifyOtp: (payload: { challengeId: string; code: string }) =>
        client.post<OtpVerifyResponse>("/api/mobile/auth/otp/verify", payload),
      resendOtp: (payload: { challengeId: string }) =>
        client.post<OtpChallengeResponse>("/api/mobile/auth/otp/resend", payload),
      publicCompanies: () => client.get<PublicCompany[]>("/api/companies", { public: true }),
      submitProviderRequest: (payload: ProviderRequestPayload) =>
        client.post<Record<string, unknown>>("/api/company/provider-requests", payload),
      me: () => client.get<{ user: MobileAuthResponse["user"] }>("/api/mobile/auth/me"),
      logout: () => client.post<void>("/api/mobile/auth/logout"),
    },
    resident: {
      categories: () => client.get<RequestCategory[]>("/api/app/categories"),
      requestConfig: () => client.get<RequestConfig>("/api/app/request-config"),
      dashboardStats: () => client.get<ResidentDashboardStats>("/api/app/dashboard/stats"),
      marketTrends: () => client.get<MarketTrendsResponse>("/api/app/market-trends"),
      profile: () => client.get<ResidentProfile>("/api/app/profile"),
      createRequest: (payload: Record<string, unknown>) =>
        client.post<ServiceRequest>("/api/app/service-requests", payload),
      requestList: () => client.get<ServiceRequest[]>("/api/app/service-requests/mine"),
      requestDetail: (requestId: string) =>
        client.get<ServiceRequest>(`/api/app/service-requests/${requestId}`),
      startOrdinaryFlow: (payload: { requestId: string; categoryKey: string }) =>
        client.post<OrdinaryFlowStartResponse>(
          "/api/app/ordinary-flow/sessions",
          payload,
        ),
      getOrdinaryFlow: (sessionId: string) =>
        client.get<{ fallback?: boolean; session: DynamicFlowSession }>(
          `/api/app/ordinary-flow/sessions/${sessionId}`,
        ),
      answerOrdinaryFlow: (
        sessionId: string,
        payload: { questionKey: string; answer: unknown; expectedRevision?: number },
      ) =>
        client.post<{ session: DynamicFlowSession }>(
          `/api/app/ordinary-flow/sessions/${sessionId}/answers`,
          payload,
        ),
      updateOrdinaryFlowAnswer: (
        sessionId: string,
        questionKey: string,
        payload: { answer: unknown; expectedRevision?: number },
      ) =>
        client.patch<{ session: DynamicFlowSession }>(
          `/api/app/ordinary-flow/sessions/${sessionId}/answers/${questionKey}`,
          payload,
        ),
      completeOrdinaryFlow: (sessionId: string) =>
        client.post<{ session: DynamicFlowSession }>(
          `/api/app/ordinary-flow/sessions/${sessionId}/complete`,
          {},
        ),
    },
    requests: {
      list: (status?: string) => client.get<ServiceRequest[]>("/api/service-requests", { status }),
      detail: (requestId: string) => client.get<ServiceRequest>(`/api/service-requests/${requestId}`),
      update: (requestId: string, payload: Record<string, unknown>) =>
        client.patch<ServiceRequest>(`/api/service-requests/${requestId}`, payload),
      accept: (requestId: string) =>
        client.post<ServiceRequest>(`/api/service-requests/${requestId}/accept`, {}),
      messages: (requestId: string) =>
        client.get<RequestMessage[]>(`/api/service-requests/${requestId}/messages`),
      sendMessage: (requestId: string, payload: { message: string; attachmentUrl?: string }) =>
        client.post<RequestMessage>(`/api/service-requests/${requestId}/messages`, payload),
      typingState: (requestId: string) =>
        client.get<Record<string, unknown>>(`/api/service-requests/${requestId}/typing`),
      setTyping: (requestId: string, isTyping: boolean) =>
        client.post<Record<string, unknown>>(`/api/service-requests/${requestId}/typing`, { isTyping }),
      createCancellationCase: (
        requestId: string,
        payload: {
          reasonCode: string;
          reasonDetail: string;
          preferredResolution: string;
          evidence?: string[];
        },
      ) => client.post(`/api/service-requests/${requestId}/cancellation-cases`, payload),
      declinePayment: (requestId: string, reason?: string) =>
        client.post(`/api/service-requests/${requestId}/payment/decline`, { reason }),
      markWorkCompleted: (requestId: string) =>
        client.post(`/api/service-requests/${requestId}/work-completed`, {}),
      confirmDelivery: (requestId: string) =>
        client.post(`/api/service-requests/${requestId}/confirm-delivery`, {}),
      disputeDelivery: (requestId: string, reason: string) =>
        client.post(`/api/service-requests/${requestId}/dispute-delivery`, { reason }),
      submitConsultancyReport: (requestId: string, payload: Record<string, unknown>) =>
        client.post(`/api/provider/service-requests/${requestId}/consultancy-report`, payload),
    },
    payments: {
      createSession: (payload: { amount: number; serviceRequestId?: string; description?: string }) =>
        client.post<PaystackSessionResponse>("/api/payments/paystack/session", payload),
      verify: (reference: string) =>
        client.post<Record<string, unknown>>("/api/payments/paystack/verify", { reference }),
    },
    maintenance: {
      catalogCategories: () =>
        client.get<MaintenanceCategory[]>("/api/app/maintenance/catalog/categories"),
      catalogItems: (categoryId?: string) =>
        client.get<Record<string, unknown>[]>("/api/app/maintenance/catalog/items", { categoryId }),
      assets: () => client.get<Record<string, unknown>[]>("/api/app/maintenance/assets"),
      createAsset: (payload: Record<string, unknown>) =>
        client.post<Record<string, unknown>>("/api/app/maintenance/assets", payload),
      updateAsset: (assetId: string, payload: Record<string, unknown>) =>
        client.patch<Record<string, unknown>>(`/api/app/maintenance/assets/${assetId}`, payload),
      assetPlans: (assetId: string) =>
        client.get<MaintenancePlan[]>(`/api/app/maintenance/assets/${assetId}/plans`),
      subscriptions: () =>
        client.get<MaintenanceSubscription[]>("/api/app/maintenance/subscriptions"),
      initiateSubscription: (payload: {
        residentAssetId: string;
        maintenancePlanId: string;
        startDate?: string;
      }) =>
        client.post<MaintenanceInitiationResponse>(
          "/api/app/maintenance/subscriptions/initiate",
          payload,
        ),
      verifySubscription: (reference: string) =>
        client.post<MaintenanceInitiationResponse>(
          "/api/app/maintenance/subscriptions/verify",
          { reference },
        ),
      pauseSubscription: (subscriptionId: string) =>
        client.post(`/api/app/maintenance/subscriptions/${subscriptionId}/pause`, {}),
      resumeSubscription: (subscriptionId: string) =>
        client.post(`/api/app/maintenance/subscriptions/${subscriptionId}/resume`, {}),
      cancelSubscription: (subscriptionId: string) =>
        client.post(`/api/app/maintenance/subscriptions/${subscriptionId}/cancel`, {}),
      schedules: () => client.get<MaintenanceSchedule[]>("/api/app/maintenance/schedules"),
      reschedule: (scheduleId: string, payload: { scheduledDate: string; notes?: string }) =>
        client.post(`/api/app/maintenance/schedules/${scheduleId}/reschedule`, payload),
    },
    provider: {
      company: () => client.get<ProviderCompany | null>("/api/provider/company"),
      tasks: (status?: string) => client.get<ProviderTask[]>("/api/provider/tasks", { status }),
      updateTaskStatus: (taskId: string, status: string) =>
        client.patch<ProviderTask>(`/api/provider/tasks/${taskId}`, { status }),
      addTaskUpdate: (taskId: string, payload: { message: string; attachments?: string[] }) =>
        client.post(`/api/provider/tasks/${taskId}/updates`, payload),
    },
    notifications: {
      list: () => client.get<NotificationItem[]>("/api/notifications"),
      markRead: (notificationId: string) =>
        client.patch<NotificationItem>(`/api/notifications/${notificationId}/read`, {}),
      markAllRead: () =>
        client.post<{ ok: boolean; updated: number }>("/api/notifications/mark-all-read", {}),
    },
  };
}


