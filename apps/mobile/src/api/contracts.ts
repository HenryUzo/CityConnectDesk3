export type AppRole =
  | "resident"
  | "provider"
  | "admin"
  | "super_admin"
  | "estate_admin";

export type ServiceRequestStatus =
  | "pending"
  | "pending_inspection"
  | "assigned"
  | "assigned_for_job"
  | "in_progress"
  | "work_completed_pending_resident"
  | "completed"
  | "disputed"
  | "rework_required"
  | "cancelled";

export interface AppUser {
  id: string;
  name?: string | null;
  email?: string | null;
  username?: string | null;
  phone?: string | null;
  role?: AppRole | null;
  globalRole?: string | null;
  company?: string | null;
  serviceCategory?: string | null;
  location?: string | null;
  isActive?: boolean | null;
  isApproved?: boolean | null;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface MobileAuthResponse extends AuthTokens {
  user: AppUser;
}

export interface OtpChallengeResponse {
  challengeId: string;
  expiresIn: number;
  resendAvailableIn: number;
  maskedDestination: string;
  pendingRegistrationId?: string | null;
  userId?: string | null;
}

export interface OtpVerifyResponse {
  verified: true;
  verificationToken: string;
  pendingRegistrationId: string | null;
  userId: string | null;
}

export interface PublicCompany {
  id: string;
  name: string;
  description?: string | null;
  isActive?: boolean | null;
}

export interface ProviderRequestPayload {
  firstName: string;
  lastName: string;
  name?: string;
  email: string;
  phone?: string;
  company: string;
  companyId?: string;
  companyMode: "existing" | "new";
  newCompanyName?: string;
  newCompanyDescription?: string;
  categories?: string[];
  experience?: number;
  description?: string;
  password?: string;
}

export interface RequestCategory {
  id: string;
  categoryKey?: string | null;
  name?: string | null;
  label?: string | null;
  description?: string | null;
  emoji?: string | null;
  displayOrder?: number | null;
  isEnabled?: boolean | null;
}

export interface RequestConfigQuestion {
  id: string;
  question: string;
  mode?: string | null;
  options?: string[] | null;
}

export interface RequestConfig {
  settings: Record<string, unknown> | null;
  ordinaryQuestions: RequestConfigQuestion[];
  aiQuestions: RequestConfigQuestion[];
}

export interface ResidentDashboardStats {
  maintenanceScheduleCount?: number | null;
  nextMaintenance?: string | null;
  nextMaintenanceCost?: number | null;
  activeContractsCount?: number | null;
  contractsChangePercent?: number | null;
  completedRequestsCount?: number | null;
  completedChangePercent?: number | null;
  pendingRequestsCount?: number | null;
  totalRequestsCount?: number | null;
}

export interface MarketTrendPoint {
  monthIndex: number;
  monthLabel: string;
  value: number;
}

export interface MarketTrendSeries {
  id: string;
  name: string;
  slug: string;
  color: string;
  unit?: string | null;
  position: number;
  isActive: boolean;
  points: MarketTrendPoint[];
}

export interface MarketTrendsResponse {
  series: MarketTrendSeries[];
}

export interface DynamicFlowOption {
  id: string;
  optionKey: string;
  label: string;
  value: string;
  icon?: string | null;
  orderIndex?: number | null;
}

export interface DynamicFlowQuestion {
  id: string;
  questionKey: string;
  prompt: string;
  description?: string | null;
  inputType:
    | "single_select"
    | "multi_select"
    | "text"
    | "number"
    | "date"
    | "time"
    | "datetime"
    | "location"
    | "file"
    | "yes_no"
    | "urgency"
    | "estate";
  isRequired: boolean;
  isTerminal: boolean;
  options: DynamicFlowOption[];
  answer?: unknown;
}

export interface DynamicFlowSession {
  sessionId: string;
  stateRevision: number;
  history: DynamicFlowQuestion[];
  currentQuestion: DynamicFlowQuestion | null;
  activePath: DynamicFlowQuestion[];
  answers: Record<string, unknown>;
  isComplete: boolean;
}

export type OrdinaryFlowStartResponse =
  | { fallback: true; reason?: string; categoryKey?: string }
  | { fallback: false; session: DynamicFlowSession }
  | { session: DynamicFlowSession }
  | DynamicFlowSession;

export interface RequestMessage {
  id: string;
  requestId: string;
  senderId: string;
  senderRole: "resident" | "provider" | "admin";
  message: string;
  attachmentUrl?: string | null;
  createdAt?: string | null;
}

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  type?: string | null;
  isRead?: boolean | null;
  metadata?: Record<string, unknown> | null;
  createdAt?: string | null;
}

export interface ServiceRequest {
  id: string;
  category?: string | null;
  categoryLabel?: string | null;
  description?: string | null;
  location?: string | null;
  urgency?: string | null;
  status?: ServiceRequestStatus | string | null;
  paymentStatus?: string | null;
  billedAmount?: string | number | null;
  paymentRequestedAt?: string | null;
  preferredTime?: string | null;
  updatedAt?: string | null;
  createdAt?: string | null;
  assignedAt?: string | null;
  residentId?: string | null;
  providerId?: string | null;
  provider?: {
    id: string;
    name?: string | null;
    company?: string | null;
    serviceCategory?: string | null;
  } | null;
  consultancyReport?: Record<string, unknown> | null;
  cancellationCase?: Record<string, unknown> | null;
  maintenance?: MaintenanceSummary | null;
}

export interface ResidentProfile {
  id: string;
  name?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  username?: string | null;
  email?: string | null;
  phone?: string | null;
  location?: string | null;
  role?: string | null;
  profileImage?: string | null;
  bio?: string | null;
  website?: string | null;
  countryCode?: string | null;
  timezone?: string | null;
  lastUpdatedAt?: string | null;
}

export interface MaintenanceSummary {
  source?: string | null;
  scheduleId?: string | null;
  subscriptionId?: string | null;
  title?: string | null;
  introTitle?: string | null;
  introMessage?: string | null;
  nextStep?: string | null;
  asset?: {
    id: string;
    label?: string | null;
    customName?: string | null;
    itemTypeName?: string | null;
    locationLabel?: string | null;
    condition?: string | null;
  } | null;
  plan?: {
    id: string;
    name?: string | null;
    durationType?: string | null;
    visitsIncluded?: number | null;
  } | null;
  schedule?: {
    id: string;
    scheduledFor?: string | null;
    status?: string | null;
  } | null;
}

export interface MaintenanceCategory {
  id: string;
  name: string;
  slug?: string | null;
  description?: string | null;
  icon?: string | null;
  itemCount?: number | null;
}

export interface MaintenanceItem {
  id: string;
  name: string;
  slug?: string | null;
  description?: string | null;
  category?: MaintenanceCategory | null;
}

export interface ResidentAsset {
  id: string;
  customName?: string | null;
  locationLabel?: string | null;
  brand?: string | null;
  model?: string | null;
  condition?: string | null;
  notes?: string | null;
  itemType?: MaintenanceItem | null;
  category?: MaintenanceCategory | null;
}

export interface MaintenancePlan {
  id: string;
  name: string;
  description?: string | null;
  durationType?: string | null;
  price?: string | number | null;
  visitsIncluded?: number | null;
  includedTasks?: string[] | null;
}

export interface MaintenanceSubscription {
  id: string;
  status?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  nextScheduleAt?: string | null;
  residentAsset?: ResidentAsset | null;
  plan?: MaintenancePlan | null;
}

export interface MaintenanceSchedule {
  id: string;
  scheduledDate?: string | null;
  status?: string | null;
  sourceRequestId?: string | null;
  notes?: string | null;
}

export interface MaintenanceInitiationResponse {
  status: string;
  reference?: string | null;
  amountKobo?: number | null;
  amountFormatted?: string | null;
  subscriptionId?: string | null;
  paystack?: {
    reference: string;
    amountInNaira: number;
    callbackUrl?: string | null;
  } | null;
  subscription?: MaintenanceSubscription | null;
}

export interface PaystackSessionResponse {
  reference: string;
  amountKobo: number;
  amountFormatted: string;
}

export interface ProviderTask {
  id: string;
  title?: string | null;
  description?: string | null;
  status?: string | null;
  priority?: string | null;
  createdAt?: string | null;
  updates?: Array<{
    id: string;
    message?: string | null;
    attachments?: string[] | null;
    createdAt?: string | null;
  }>;
}

export interface ProviderCompany {
  id: string;
  name?: string | null;
  description?: string | null;
  location?: string | null;
  phone?: string | null;
  email?: string | null;
  isActive?: boolean | null;
  approvalStatus?: string | null;
  providerId?: string | null;
  isOwner?: boolean | null;
}

