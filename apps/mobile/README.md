# CityConnect Mobile

Expo + TypeScript mobile surface for CityConnect resident and provider flows.

Key constraints baked into this scaffold:

- Mobile auth uses `/api/mobile/auth/*` with bearer tokens.
- Resident request entry stays on `/api/app/*`.
- Core request lifecycle, chat, and payment verification stay on `/api/service-requests/*` and `/api/payments/paystack/*`.
- Provider operational flows stay on `/api/provider/*`.
- Admin-managed categories, request config, maintenance catalog, and plans are loaded from backend endpoints, not hardcoded.
- Provider maintenance scheduling is intentionally a placeholder because the backend does not expose a provider schedule API yet.

## Android runtime notes

- This project is on Expo SDK 52.
- Expo Go only supports one SDK line at a time, so a newer Expo Go build is not a reliable runtime for this app.
- `expo-dev-client` is installed and configured. Android device testing should use a development build, not Expo Go.
- No custom `updates.url` was configured in the project, but the default Expo updates behavior still checks for updates on launch. The app config now sets:
  - `runtimeVersion.policy = appVersion`
  - `updates.checkAutomatically = ON_ERROR_RECOVERY`
  - `expo-dev-client.launchMode = launcher`
- That combination avoids immediately trying to reopen the most recent remote project/update when the Android app starts and makes device testing more reliable through the local Metro server.

## Recommended Android workflow

1. Install dependencies from `apps/mobile`.
2. Set `EXPO_PUBLIC_API_URL` to the CityConnect backend origin.
3. Build and install a development build on the Android device:
   - local native build: `npm run android`
   - or EAS development build: `eas build --platform android --profile development`
4. Start Metro for the development client:
   - `npm run start`
5. Open the installed CityConnect development build on the device and connect to the local Metro server from the launcher.

## Foundation layout

- `app/`
  Expo Router route groups for `(auth)`, `(resident)`, and `(provider)`.
- `src/api/`
  Typed contracts, API client, and service modules mapped to current backend endpoints.
- `src/config/`
  Environment loading and normalization.
- `src/features/auth/`
  SecureStore-backed auth/session state with refresh flow.
- `src/navigation/`
  Shared auth and role guards plus reusable role-tab wiring.
- `src/providers/`
  App-level providers, including TanStack Query and session state.
- `src/query/`
  Shared query client setup.
- `src/theme/`
  Design tokens and status helpers for brand-consistent UI primitives.
- `src/components/`
  Shared UI primitives used by both resident and provider experiences.

## Environment

Copy `.env.example` and set:

- `EXPO_PUBLIC_API_URL`
- `EXPO_PUBLIC_APP_ENV`

The verified backend audit lives in `docs/mobile-audit.md`.
