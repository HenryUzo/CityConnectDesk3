# CityConnect — Project Architecture

## Overview

CityConnect is a full-stack web application for estate residents to request services, interact with AI assistants, and manage marketplace activities. Built with a monorepo structure using React (Vite) on the frontend and Express.js on the backend, with PostgreSQL via both Drizzle ORM and Prisma.

---

## Tech Stack

| Layer      | Technology                                                  |
|------------|-------------------------------------------------------------|
| Frontend   | React 18, TypeScript, Vite, Tailwind CSS v3, shadcn/ui     |
| Backend    | Express.js, TypeScript, Node.js ≥ 20                       |
| Database   | PostgreSQL (Neon serverless), Drizzle ORM + Prisma          |
| AI         | Google Gemini, OpenAI, Ollama (pluggable providers)         |
| Payments   | Paystack                                                    |
| Realtime   | Socket.IO / WebSockets                                      |
| Routing    | wouter (client), Express Router (server)                    |
| State      | TanStack React Query                                        |
| Deployment | Vercel (via `vercel.json`)                                  |
| Testing    | Vitest (unit), Playwright (e2e)                             |

---

## Directory Structure

```
CityConnectDesk/
├── client/                          # Frontend (React + Vite)
│   ├── index.html                   # HTML entry point
│   └── src/
│       ├── App.tsx                   # Root component & route definitions
│       ├── main.tsx                  # React DOM entry
│       ├── index.css                 # Global styles (Tailwind directives)
│       ├── assets/                   # Static images & illustrations
│       │   ├── avatars/
│       │   ├── categories/
│       │   ├── citybuddy/
│       │   └── illustrations/
│       ├── components/               # Reusable UI components
│       │   ├── admin/                # Admin-specific components
│       │   │   ├── AdminLayout.tsx
│       │   │   ├── AdminStatsPanel.tsx
│       │   │   ├── ArtisanRequestsPanel.tsx
│       │   │   ├── DetailsView.tsx
│       │   │   ├── EmojiCombobox.tsx
│       │   │   ├── ProviderLayout.tsx
│       │   │   └── ProviderRequestsNotifications.tsx
│       │   ├── citybuddy/            # CityBuddy AI chat components
│       │   │   ├── CityBuddyChat.tsx
│       │   │   └── engines/types.ts
│       │   ├── company/              # Company registration components
│       │   │   └── CompanyRegistrationFormFields.tsx
│       │   ├── layout/               # Shell & navigation
│       │   │   ├── ClosedSidebar.tsx
│       │   │   ├── MobileNavDrawer.tsx
│       │   │   ├── Nav.tsx
│       │   │   └── ResidentShell.tsx
│       │   ├── notifications/
│       │   │   └── NotificationBell.tsx
│       │   ├── payments/
│       │   │   └── PayWithPaystackButton.tsx
│       │   ├── resident/             # Resident-specific components
│       │   │   ├── BookArtisanForm.tsx
│       │   │   ├── CityBuddyChat.tsx
│       │   │   ├── CityBuddyMascot.tsx
│       │   │   ├── CityBuddyMessage.tsx
│       │   │   ├── citybuddyIntake.ts
│       │   │   ├── citybuddySituation.ts
│       │   │   ├── MyRequestsList.tsx
│       │   │   ├── ProviderComparison.tsx
│       │   │   ├── RequestsSidebar.tsx
│       │   │   └── ResidentLayout.tsx
│       │   ├── ui/                   # shadcn/ui primitives & custom UI
│       │   │   ├── imports/          # SVG path data modules
│       │   │   ├── accordion.tsx ... tooltip.tsx  (shadcn/ui)
│       │   │   ├── ProfilePics.tsx   # Avatar component
│       │   │   ├── banners.tsx       # Custom banner components
│       │   │   ├── buttons.tsx       # Custom button variants
│       │   │   ├── cards.tsx         # Custom card components
│       │   │   ├── icon.tsx          # Icon system
│       │   │   ├── inputfields.tsx   # Custom form inputs
│       │   │   ├── modals.tsx        # Custom modal components
│       │   │   └── navigation.tsx    # Navigation components
│       │   ├── LocationPicker.tsx
│       │   ├── ServiceRequestsTable.tsx
│       │   └── theme-toggle.tsx
│       ├── contexts/                 # React Context providers
│       │   ├── NotificationsContext.tsx
│       │   └── ProfileContext.tsx
│       ├── hooks/                    # Custom React hooks
│       │   ├── use-auth.tsx          # Authentication hook
│       │   ├── use-mobile.tsx        # Mobile detection
│       │   ├── use-toast.ts          # Toast notifications
│       │   ├── useAiConversationFlowSettings.ts
│       │   ├── useCategories.ts
│       │   ├── useCityMart.ts
│       │   ├── useCityMartBanners.ts
│       │   ├── useMyEstates.ts
│       │   ├── useResidentDashboard.ts
│       │   └── useServiceRequests.ts
│       ├── lib/                      # Client utilities & API clients
│       │   ├── adminApi.ts           # Admin API client
│       │   ├── categoriesClient.ts   # Categories API
│       │   ├── citybuddy-gemini.ts   # AI chat client
│       │   ├── citybuddy-types.ts    # AI chat type definitions
│       │   ├── conversations.ts      # Conversation management
│       │   ├── paystack.ts           # Paystack integration
│       │   ├── protected-route.tsx   # Route guard component
│       │   ├── queryClient.ts        # TanStack Query setup
│       │   ├── residentApi.ts        # Resident API client
│       │   └── utils.ts              # Shared utilities (cn, etc.)
│       ├── pages/                    # Page-level components (routes)
│       │   ├── admin-*.tsx           # Admin pages
│       │   ├── auth-page.tsx         # Login/Register
│       │   ├── company-*.tsx         # Company management pages
│       │   ├── provider-*.tsx        # Provider pages
│       │   ├── resident/             # Resident sub-pages
│       │   │   ├── Homepage.tsx
│       │   │   ├── CityMart.tsx
│       │   │   ├── CartPage.tsx
│       │   │   ├── OrdersPage.tsx
│       │   │   ├── Settings.tsx
│       │   │   ├── SettingsMain.tsx
│       │   │   ├── SelectCategory.tsx
│       │   │   ├── BookServiceChat.tsx
│       │   │   ├── RequestConversation.tsx
│       │   │   ├── OrdinaryConversationFlow.tsx
│       │   │   ├── ScheduleInspection.tsx
│       │   │   └── Playground.tsx
│       │   ├── resident-dashboard.tsx
│       │   ├── landing-page.tsx
│       │   ├── not-found.tsx
│       │   └── waiting-room.tsx
│       └── utils/
│           └── formatDate.ts
│
├── server/                          # Backend (Express.js)
│   ├── index.ts                     # Server entry point & Express setup
│   ├── routes.ts                    # Main API routes
│   ├── app-routes.ts                # Application-specific routes
│   ├── provider-routes.ts           # Provider API routes
│   ├── marketplace-routes.ts        # Marketplace API routes
│   ├── db.ts                        # Drizzle ORM database connection
│   ├── storage.ts                   # Data access layer / storage interface
│   ├── env.ts                       # Environment variable validation
│   ├── vite.ts                      # Vite dev server middleware
│   ├── prepare-static.ts            # Static file serving (production)
│   ├── auth.ts                      # Authentication (Passport + session)
│   ├── auth-middleware.ts           # Auth middleware (JWT + session)
│   ├── auth-utils.ts                # Auth utility functions
│   ├── jwt-utils.ts                 # JWT token helpers
│   ├── rate-limiter.ts              # API rate limiting
│   ├── payments.ts                  # Payment processing routes
│   ├── paystack.ts                  # Paystack API client
│   ├── paystackHandlers.ts          # Paystack webhook handlers
│   ├── paystackService.ts           # Paystack business logic
│   ├── openaiClient.ts              # OpenAI client wrapper
│   ├── ai/                          # AI subsystem
│   │   ├── index.ts                 # AI router & main endpoint
│   │   ├── diagnose.ts              # AI diagnostic endpoint
│   │   ├── geminiClient.ts          # Gemini API client
│   │   ├── ollama.ts                # Ollama local AI client
│   │   ├── safe-json.ts             # Safe JSON parsing
│   │   ├── schema.ts                # AI request/response schemas
│   │   ├── types.ts                 # AI type definitions
│   │   └── providers/               # Pluggable AI providers
│   │       ├── gemini.ts
│   │       ├── ollama.ts
│   │       └── openai.ts
│   ├── lib/
│   │   └── prisma.ts                # Prisma client singleton
│   ├── middlewares/
│   │   └── estate-context.ts        # Estate context middleware
│   ├── providers/
│   │   └── matching.ts              # Provider matching algorithm
│   └── utils/
│       └── validate-dataurl.ts      # Data URL validation utility
│
├── shared/                          # Shared code (client & server)
│   ├── schema.ts                    # Drizzle ORM schema (main tables)
│   ├── admin-schema.ts              # Admin-specific schema extensions
│   └── marketplace-categories.ts    # Marketplace category definitions
│
├── migrations/                      # Drizzle ORM SQL migrations
│   ├── 0000_curvy_loki.sql          # Initial schema
│   ├── 0001_*.sql – 0011_*.sql      # Incremental migrations
│   └── meta/                        # Migration metadata & snapshots
│
├── prisma/                          # Prisma ORM
│   ├── schema.prisma                # Prisma schema definition
│   ├── seed.ts                      # Database seeder
│   ├── migrations/                  # Prisma migration history
│   └── add_location_to_service_requests.sql
│
├── scripts/                         # Utility scripts (npm scripts)
│   ├── createSampleRequest.ts       # Create sample service request
│   └── ensureSessionTable.ts        # Ensure session table exists
│
├── tests/                           # Test suites
│   ├── *.test.ts                    # Unit tests (Vitest)
│   ├── *.spec.ts                    # Component specs
│   └── e2e/                         # End-to-end tests (Playwright)
│       ├── *.spec.ts
│       └── utils/testData.ts
│
├── .env.example                     # Environment variable template
├── .gitignore                       # Git ignore rules
├── components.json                  # shadcn/ui CLI configuration
├── drizzle.config.ts                # Drizzle Kit configuration
├── package.json                     # Dependencies & scripts
├── playwright.config.ts             # Playwright e2e test config
├── postcss.config.js                # PostCSS / Tailwind processing
├── tailwind.config.ts               # Tailwind CSS v3 configuration
├── tsconfig.json                    # TypeScript configuration
├── tsconfig.test.json               # TypeScript test configuration
├── vercel.json                      # Vercel deployment configuration
├── vite.config.ts                   # Vite build configuration
└── vitest.config.ts                 # Vitest unit test configuration
```

---

## Key Application Flows

### Authentication
- Session-based auth via Passport.js + JWT tokens
- `server/auth.ts` → Passport setup, login/register/logout routes
- `server/auth-middleware.ts` → Protects API routes (supports both session & JWT)
- `client/src/hooks/use-auth.tsx` → Client-side auth state management
- `client/src/lib/protected-route.tsx` → Route guard for authenticated pages

### Service Request Flow
1. Resident selects a category → `SelectCategory.tsx`
2. AI conversation intake → `BookServiceChat.tsx` / `CityBuddyChat.tsx`
3. Request created via API → `server/routes.ts` (POST `/api/service-requests`)
4. Provider matching → `server/providers/matching.ts`
5. Tracking → `RequestConversation.tsx`, `MyRequestsList.tsx`

### AI Chat (CityBuddy)
- Multi-provider architecture: Gemini, OpenAI, Ollama
- `server/ai/index.ts` → AI routing endpoint
- `server/ai/providers/` → Pluggable provider implementations
- `client/src/components/resident/CityBuddyChat.tsx` → Chat UI

### Marketplace (CityMart)
- `client/src/pages/resident/CityMart.tsx` → Storefront
- `server/marketplace-routes.ts` → Marketplace API
- `shared/marketplace-categories.ts` → Category definitions

### Payments
- Paystack integration for wallet top-up and transactions
- `server/paystack.ts` → API client
- `server/paystackService.ts` → Business logic
- `server/paystackHandlers.ts` → Webhook handlers
- `client/src/components/payments/PayWithPaystackButton.tsx` → Payment UI

### Admin Dashboard
- `client/src/pages/admin-super-dashboard.tsx` → Main admin UI (self-contained)
- `client/src/pages/admin-login.tsx` → Admin authentication
- `server/routes.ts` → Admin API endpoints

---

## npm Scripts

| Script               | Description                                    |
|----------------------|------------------------------------------------|
| `npm run dev`        | Start development server (Express + Vite HMR)  |
| `npm run build`      | Production build (Vite + esbuild)              |
| `npm start`          | Run production server                          |
| `npm run check`      | TypeScript type check                          |
| `npm run test:unit`  | Run unit tests (Vitest)                        |
| `npm run test:e2e`   | Run e2e tests (Playwright)                     |
| `npm run db:push`    | Push Drizzle schema to database                |
| `npm run db:generate`| Generate Drizzle migrations                    |
| `npm run db:migrate` | Run Drizzle migrations                         |
| `npm run db:seed`    | Seed database via Prisma                       |

---

## Path Aliases

| Alias       | Resolves To       | Used In    |
|-------------|-------------------|------------|
| `@/*`       | `client/src/*`    | Client     |
| `@shared/*` | `shared/*`        | Both       |

---

## Environment Variables

See `.env.example` for the full list. Key variables:

- `DATABASE_URL` — PostgreSQL connection string (Neon)
- `SESSION_SECRET` — Express session secret
- `JWT_SECRET` — JWT signing key
- `ADMIN_JWT_SECRET` — Admin JWT signing key
- `GEMINI_API_KEY` — Google Gemini AI API key
- `OPENAI_API_KEY` — OpenAI API key
- `PAYSTACK_SECRET_KEY` — Paystack payment key
- `MAPBOX_TOKEN` — Mapbox location services
