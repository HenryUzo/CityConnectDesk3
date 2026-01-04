# AI-First Service Request Flow - Implementation Guide

## Overview
Implemented a 2-step AI-powered service request creation flow for residents with a coin-based system, intelligent sidebar, and AI diagnosis.

## Files Changed & Created

### Backend (Server)
1. **server/app-routes.ts** (MODIFIED)
   - Added `GET /api/app/wallet` - Fetch resident's coin balance (default 300 coins)
   - Added `POST /api/app/wallet/spend` - Deduct 100 coins per AI conversation
   - Added `GET /api/app/service-requests/mine` - Fetch 5 most recent requests

### Frontend (Client)

#### New Components
2. **client/src/components/resident/RequestsSidebar.tsx** (NEW)
   - Sidebar panel showing:
     - "+ Create new request" CTA button (disabled if coins < 100)
     - Recent requests list (last 5, clickable)
     - Coins balance display with subscription hint
     - Lock icon when insufficient coins

#### New Pages
3. **client/src/pages/resident/SelectCategory.tsx** (NEW)
   - Category selection grid with search
   - Grid cards showing:
     - Category icon/emoji
     - Category name
     - Provider avatars + count
   - Fetches from `/api/categories?scope=global` with fallback list
   - Navigates to conversation on selection

4. **client/src/pages/resident/RequestConversation.tsx** (NEW)
   - AI conversation interface:
     - Selected category display with "Change category" link
     - CityBuddy mascot (ask/think/answer states)
     - Conversation message history
     - Large textarea for description input
     - Send button (paper plane icon)
   - On message send:
     1. Deduct 100 coins (optimistic)
     2. Call `/api/ai/diagnose` with category & description
     3. Display thinking state while loading
     4. Create service request via `POST /api/app/service-requests`
     5. Show AI diagnosis result with suggested checks & pro tips
     6. Update recents list
     7. Show success toast with "View Request" link

#### Routes & Navigation
5. **client/src/App.tsx** (MODIFIED)
   - Added route: `ProtectedRoute path="/resident/requests/new" component={SelectCategory}`
   - Added route: `ProtectedRoute path="/resident/requests/new/:category" component={RequestConversation}`
   - Imported new page components

6. **client/src/components/resident/ResidentLayout.tsx** (MODIFIED)
   - Updated "Book a Service" nav link to point to `/resident/requests/new` instead of `/book-artisan`
   - Maintains active state for both old and new paths

#### Assets
7. **client/src/assets/citybuddy/ask.svg** (NEW)
   - Green mascot asking a question (curious expression)

8. **client/src/assets/citybuddy/think.svg** (NEW)
   - Orange mascot thinking (hand-on-chin pose)

9. **client/src/assets/citybuddy/answer.svg** (NEW)
   - Green mascot celebrating (happy smile, star icons)

## Feature Implementation Details

### Coin System (V1)
- Default: 300 coins per new resident
- Cost: 100 coins per AI conversation
- Wallet balance stored in existing `Wallet` table via Prisma
- Endpoints use `storage.getWalletByUserId()`, `storage.createWallet()`, `storage.updateWalletBalance()`
- If wallet doesn't exist, endpoint creates one with 300 coins

### Recents List
- Shows last 5 service requests ordered by creation date (descending)
- Displays status badge (PENDING, IN_PROGRESS, COMPLETED)
- Date shown in local format
- Uses React Query with key: `["my-recent-requests"]`
- Auto-refreshes after new request creation

### AI Diagnosis
- Reuses existing `/api/ai/diagnose` endpoint
- Payload: `{ category, description, urgency, specialInstructions }`
- Returns: `{ summary, suggestedChecks: string[], whenToCallPro: string[] }`
- Displayed in blue info box with icons and formatting

### Service Request Creation
- Title auto-generated: `"${category}: ${first 40 chars of description}..."`
- Uses existing `POST /api/app/service-requests` endpoint
- Payload: `{ category, description, urgency, title, specialInstructions, preferredTime }`
- Creates with status: PENDING

## How to Test

### Prerequisites
1. Ensure database is running with Prisma migrations applied
2. Check that `/api/categories` endpoint works (used in SelectCategory)
3. Verify `/api/ai/diagnose` is functional with Gemini API key configured

### Test Flow (Step-by-Step)

#### 1. Navigate to Category Selection
```
1. Log in as resident
2. Click "Book a Service" in sidebar OR navigate to /resident/requests/new
3. Should see "Select Categories" page with grid of 6+ categories
4. Search bar should filter categories by name
```

#### 2. Test Insufficient Coins
```
1. If coins < 100, "Create new request" button in sidebar should be DISABLED
2. Click it should show toast: "Insufficient Coins - Subscribe to get more coins"
3. Coins display should show actual balance (0, 50, etc.)
```

#### 3. Select Category & Start Conversation
```
1. Click any category card
2. Should navigate to /resident/requests/new/{category-id}
3. Should see:
   - Category name in header
   - "Change category" link
   - CityBuddy ask state (green, curious expression)
   - First message: "Tell us what you need?"
   - Large textarea: "Describe what services you need rendered…"
   - Send button (paper plane icon)
```

#### 4. Send Message & AI Diagnosis
```
1. Type a description (e.g., "Water is leaking from my kitchen sink")
2. Click Send or press Shift+Enter
3. Message should appear in conversation
4. Mascot should change to think state (orange)
5. After 2-3 seconds, should see:
   - AI diagnosis response in blue box
   - Suggested checks list
   - When to call pro list
   - Mascot changes to answer state (green, happy)
6. Toast should show: "Request Submitted - Your service request has been created successfully"
7. Coins should decrease by 100 (check sidebar)
```

#### 5. Verify Service Request Created
```
1. Click "View Request" or navigate to /service-requests
2. New request should appear at top of list
3. Title should be: "{category}: {first 40 chars}..."
4. Status: PENDING
5. Created date should be today
```

#### 6. Verify Recents List Updated
```
1. In RequestsSidebar, look at "Recent Requests" section
2. New request should appear at top
3. Clicking it should show details
4. Status badge should match service request status
```

#### 7. Test Multiple Conversations
```
1. Click "Create new request" again
2. Should navigate back to SelectCategory
3. Select same or different category
4. Send another message
5. Coins should decrease by 100 again (total -200)
6. Both requests should appear in recents
```

#### 8. Test Coins Exhaustion
```
1. With 200 coins left, create 2 more requests (100 each)
2. Coins should drop to 0
3. "Create new request" button should be DISABLED
4. Any further click should show insufficient coins toast
```

### Manual Testing Endpoints

#### Check Wallet Balance
```bash
curl -H "Authorization: Bearer {token}" \
  http://localhost:5000/api/app/wallet
# Response: { "coins": 300 }
```

#### Spend Coins
```bash
curl -X POST \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{"amount": 100, "reason": "service_request_conversation"}' \
  http://localhost:5000/api/app/wallet/spend
# Response: { "ok": true, "coins": 200, "reason": "..." }
```

#### Get Recent Requests
```bash
curl -H "Authorization: Bearer {token}" \
  "http://localhost:5000/api/app/service-requests/mine?limit=5"
# Response: [ {...}, {...}, ... ]
```

## Known Limitations & Future Enhancements

### V1 Limitations
- Mascot images are simple SVGs; can be replaced with better artwork
- No subscription implementation (button shows hint only)
- Coin balance is numeric only; no transaction history UI
- No persistence of messages in conversation (cleared on page reload)
- AI diagnosis is read-only (no follow-up questions)
- No location/preferred time input (hardcoded in request creation)

### Future Features
1. **Coin Purchase System**: Implement Paystack integration for buying coins
2. **Message History**: Store conversations in DB for later reference
3. **Follow-up Questions**: Allow AI to ask clarifying questions
4. **Subscription Plans**: Add tiers with different coin allocations
5. **Pro Provider Selection**: Show matched providers after diagnosis
6. **Schedule Integration**: Allow preferred time/date selection
7. **Photo Uploads**: Support images in service requests
8. **Chat Persistence**: Load/save conversation state in localStorage or DB

## Architecture Notes

### Component Hierarchy
```
ResidentLayout
├── RequestsSidebar (coin display, recents, CTA)
└── Main Content
    ├── SelectCategory (grid + search)
    └── RequestConversation (AI chat + diagnosis)
```

### Data Flow
```
SelectCategory
  ↓ (category click)
RequestConversation
  ├─ useQuery("wallet") → GET /api/app/wallet
  ├─ useMutation("spend-coins") → POST /api/app/wallet/spend
  ├─ useMutation("ai-diagnose") → POST /api/ai/diagnose
  └─ useMutation("create-request") → POST /api/app/service-requests
       ↓
  RequestsSidebar
    └─ useQuery("my-recent-requests") → GET /api/app/service-requests/mine
```

### Coin State Management
- **Request Time**: Optimistic deduction (show immediately)
- **On Success**: Verify actual balance from server
- **On Failure**: Show error toast, don't deduct
- **Refetch**: Triggered after wallet/spend mutation success

## Troubleshooting

### Issue: Category grid shows blank
**Solution**: Check `/api/categories?scope=global` endpoint. Fallback list should display.

### Issue: Coin button always disabled
**Solution**: Verify wallet has been created. Check GET `/api/app/wallet` returns `{ coins: X }`.

### Issue: AI diagnose returns error
**Solution**: Verify `GEMINI_API_KEY` is set in .env. Check `/api/ai/diagnose` endpoint directly.

### Issue: Service request not created
**Solution**: Check if user is authenticated. Verify `/api/app/service-requests` POST endpoint. Check category exists.

### Issue: Images not showing
**Solution**: SVG files are in `client/src/assets/citybuddy/`. Update paths if folder structure differs.

## Testing Checklist

- [ ] Sidebar shows correct coin balance
- [ ] "Create new request" disabled when coins < 100
- [ ] Category selection navigates to conversation
- [ ] Message send triggers AI diagnosis
- [ ] Mascot changes states (ask → think → answer)
- [ ] Coins deducted after successful request
- [ ] Service request created with correct title/category
- [ ] Recents list updates after new request
- [ ] Multiple requests can be created in sequence
- [ ] Insufficient coins prevents new requests
- [ ] TypeScript compilation passes (`npm run check`)
- [ ] No console errors in browser DevTools
- [ ] All API endpoints return expected status codes

