# CityConnect Mobile Audit

## Goal
This mobile implementation extends the existing CityConnect platform instead of rebuilding product logic in parallel. The mobile app is aligned to the real backend routes, current request lifecycle, admin-managed data, and current provider/resident responsibilities.

## Verified Product Flows

### Resident request entry
- Resident category entry is driven by `GET /api/app/categories`.
- Resident request configuration is driven by `GET /api/app/request-config`.
- Guided ordinary flow uses:
  - `POST /api/app/ordinary-flow/sessions`
  - `GET /api/app/ordinary-flow/sessions/:sessionId`
  - `POST /api/app/ordinary-flow/sessions/:sessionId/answers`
  - `PATCH /api/app/ordinary-flow/sessions/:sessionId/answers/:questionKey`
  - `POST /api/app/ordinary-flow/sessions/:sessionId/complete`
- Resident request records are created and read from `/api/app/service-requests*`.
- The ordinary-flow session API requires a `requestId`, so guided request entry attaches to a real service request record rather than a mobile-only draft entity.

### Core request lifecycle
- Core request lifecycle and messaging are handled on `/api/service-requests/*`.
- Verified backend status model:
  - `pending`
  - `pending_inspection`
  - `assigned`
  - `assigned_for_job`
  - `in_progress`
  - `work_completed_pending_resident`
  - `disputed`
  - `rework_required`
  - `completed`
  - `cancelled`
- Current business meaning:
  - `assigned` is inspection/initial provider assignment.
  - `assigned_for_job` is post-approval execution assignment.
  - `work_completed_pending_resident` waits for resident confirmation or dispute.

### Provider flow
- Provider job operations use the core request endpoints plus provider-scoped routes.
- Provider onboarding is approval-gated and uses `POST /api/company/provider-requests` on web for registration intent, followed by ordinary mobile/web auth only after the provider user exists.
- Public company selection for provider onboarding is driven by `GET /api/companies?public=true`.
- Current provider job interactions include:
  - available/assigned requests from `GET /api/service-requests`
  - accepting an available request via `POST /api/service-requests/:id/accept`
  - status progression via `PATCH /api/service-requests/:id`
  - consultancy report submission via `POST /api/provider/service-requests/:id/consultancy-report`
  - work completion via `POST /api/service-requests/:id/work-completed`
  - request chat via `/api/service-requests/:id/messages`
- Provider operational tasks are already available via:
  - `GET /api/provider/tasks`
  - `PATCH /api/provider/tasks/:taskId`
  - `POST /api/provider/tasks/:taskId/updates`

### Chat and realtime
- Request chat uses:
  - `GET /api/service-requests/:id/messages`
  - `POST /api/service-requests/:id/messages`
  - `GET /api/service-requests/:id/typing`
  - `POST /api/service-requests/:id/typing`
- Web realtime currently uses Socket.IO and SSE.
- Existing realtime transport assumes current web auth and same-origin behavior, so mobile starts with polling-safe abstractions and can enable sockets later.

### Payments
- Paystack payment orchestration already exists.
- Admin raises a payment request before resident payment for request execution.
- Verification/finalization already exists through current Paystack handlers and transaction logic.
- Core payment endpoints used by mobile:
  - `POST /api/payments/paystack/session`
  - `POST /api/payments/paystack/verify`
- Current backend finalization updates the real request lifecycle after successful verification.

### Maintenance
- Maintenance is already backend-driven for resident flows via `/api/app/maintenance/*`.
- Available resident maintenance areas include:
  - catalog categories and items
  - resident assets
  - asset plans
  - subscriptions
  - schedules
- Admin-managed maintenance configuration already exists for:
  - maintenance categories
  - maintenance items
  - maintenance plans
  - maintenance schedules
- Provider-facing maintenance schedule endpoints do not currently exist. Mobile keeps a placeholder entry point instead of inventing unsupported behavior.

### Notifications
- Notifications already exist via:
  - `GET /api/notifications`
  - `PATCH /api/notifications/:id/read`
  - `POST /api/notifications/mark-all-read`
- Push registration and push delivery endpoints do not currently exist.

## Admin-Managed Data That Must Stay Dynamic
- Resident request-entry categories come from `aiConversationFlowSettings` through `/api/app/categories`.
- Request conversation behavior is driven by:
  - `requestConversationSettings`
  - `requestQuestions`
  - `ordinaryFlowDefinitions`
  - `ordinaryFlowQuestions`
  - `ordinaryFlowOptions`
  - `ordinaryFlowRules`
- Provider matching and pricing are already admin-managed via:
  - `pricingRules`
  - `providerMatchingSettings`
- Maintenance behavior is admin-managed via:
  - `maintenanceCategories`
  - `maintenanceItems`
  - `maintenancePlans`
  - `maintenanceSchedules`

## Admin Influence on Mobile UX

### Resident mobile surfaces
- `apps/mobile/app/(resident)/index.tsx`
  - Consumes `/api/app/categories` so resident service entry reflects admin-managed category ordering, labels, descriptions, and emoji.
  - Consumes `/api/app/dashboard/stats` so the dashboard summary stays tied to real request and maintenance counts.
  - Consumes `/api/app/market-trends` so admin-managed homepage market-trend series now appear on mobile instead of being web-only.
- `apps/mobile/app/(resident)/request-flow.tsx`
  - Consumes `/api/app/request-config` and `/api/app/ordinary-flow/sessions*` so guided request entry follows admin-authored question sets, options, and branching rules.
  - Does not create a separate mobile question schema; the fallback renderer still submits answers to the real session engine.
- `apps/mobile/app/(resident)/request-detail.tsx`
  - Reflects admin/provider actions indirectly through the real request record and lifecycle.
  - Payment, cancellation review, and delivery confirmation remain tied to backend states raised by admin workflows.
- `apps/mobile/app/(resident)/maintenance.tsx`
  - Continues to consume `/api/app/maintenance/*`, which is downstream of admin-managed maintenance categories, items, plans, and schedules.
- `apps/mobile/app/(resident)/profile.tsx`
  - Uses `/api/app/profile`; settings expansion remains available on `/api/app/settings*` without introducing mobile-only profile models.

### Provider mobile surfaces
- `apps/mobile/app/(auth)/register.tsx`
  - Resident sign-up stays on `/api/mobile/auth/register`.
  - Provider sign-up now follows the existing backend onboarding contract by using `/api/company/provider-requests` plus public company lookup from `/api/companies?public=true`.
  - This keeps provider approval, company association, and pending-access behavior consistent with the web app instead of creating an immediately authenticated provider account flow on mobile.
- `apps/mobile/app/(auth)/provider-pending.tsx`
  - Handles the backend approval wait state for unapproved providers.
  - Polls `/api/mobile/auth/refresh` only when a provider is already authenticated but still pending approval.
- `apps/mobile/app/(provider)/index.tsx`
  - Consumes `/api/provider/company` so company approval and ownership context remain tied to the current backend/admin state.
  - Consumes `/api/provider/tasks` so auto-generated and assigned operational tasks appear from the same backend workflow.
- `apps/mobile/app/(provider)/jobs.tsx`
  - Consumes `/api/service-requests` and `/api/service-requests?status=available` so provider worklists stay aligned to the real request pool and assignment logic.
- `apps/mobile/app/(provider)/job-detail.tsx`
  - Uses the existing request lifecycle and provider consultancy endpoint.
  - Provider status actions remain constrained to backend-allowed transitions instead of mobile-defined shortcuts.
- `apps/mobile/app/(provider)/profile.tsx`
  - Reuses `/api/provider/company` for backend-owned provider/company identity rather than a mobile-only company record.

### Current mobile consistency rules
- Mobile uses `/api/app/categories` rather than legacy `/api/categories` for resident request entry.
- Mobile uses backend status strings directly and does not create alternate resident/provider-only status enums.
- Mobile surfaces admin-managed homepage, category, ordinary-flow, maintenance, company, and task data where backend routes already exist.
- Provider maintenance remains placeholder-only because provider-facing maintenance schedule APIs do not currently exist.
- Brand styling stays on the shared green/emerald token set in `apps/mobile/src/theme/tokens.ts`; provider and resident shells use the same product-family palette instead of ad hoc per-screen colors.

## Important Gaps and Normalization Work
- Existing web auth is session-cookie oriented.
- JWT utilities existed, but bearer auth was not mounted broadly for mobile-hit routes.
- A dedicated mobile auth surface was added under `/api/mobile/auth/*` to issue access and refresh tokens for Expo clients.
- Mobile-hit endpoints now rely on normalized actor context instead of browser-session assumptions where needed.
- Mobile provider onboarding originally drifted from the web flow by posting directly to `/api/mobile/auth/register`; mobile now follows `/api/company/provider-requests` and routes unapproved providers into an approval-pending screen.
- `/api/categories` still exists as a broader/legacy taxonomy source, but mobile uses `/api/app/categories` as the primary resident request-entry source.
