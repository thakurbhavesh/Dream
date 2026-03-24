# TeamChatX Frontend Guide

Last updated: 2026-03-13

## 1. Purpose of this README

This document explains the frontend end-to-end:
- folder structure
- key files and their responsibilities
- runtime workflows (routing, auth, chat state, socket/presence, settings)
- where to edit when you want to add or fix a feature

Frontend stack:
- React 18 + Vite
- React Router
- MUI + Emotion + styled-components
- Redux Toolkit + redux-persist
- Local first chat state via `threadService`
- Optional realtime via `socket.io-client`

## API Base URL

- Development: `frontend/.env.development` -> `http://localhost:5000`
- Production: `frontend/.env.production` -> `https://server.officechatkarlo.com`
- Resolution priority in code:
  - `REACT_APP_API_URL`
  - `VITE_API_URL`
  - `VITE_SERVER_URL`
  - `VITE_BACKEND_URL`
  - `VITE_APP_API_URL`
- Hard fallback in code:
  - dev mode -> `http://localhost:5000`
  - prod mode -> `https://server.officechatkarlo.com`

Detailed page/API workflow:
- `frontend/docs/workflow.md`
- Auth login deep-dive:
  - `frontend/docs/a.md`
- Signup flow:
  - `frontend/docs/Signupflow.md`
- Auth flow diagram:
  - `frontend/docs/auth-flow-diagram.md`

## JWT Session Lifecycle (Frontend)

Backend token policy:
- `JWT_EXPIRES_IN=15m`
- `JWT_REFRESH_EXPIRES_IN=90d`

Frontend refresh behavior:
- app mount pe `authStore.ensureFreshSession()` run hota hai (`src/main.jsx`).
- interval ticker every 60s run hota hai (`authStore.startAutoRefresh()`).
- access token expiry ke ~60s pehle refresh call trigger hota hai.
- expired/401 response pe `fetchWithAuth` one retry refresh flow chalata hai (`src/utils/authApi.js`).

Meaning:
- `/auth/refresh` 90 din baad nahi, zarurat padte hi call hota hai.
- active user usually logout tak signed-in rahega, jab tak refresh session revoke/expire na ho.
- same trusted/known device par logout ke baad relogin me OTP repeat nahi aata; OTP mostly new device ke liye trigger hota hai.

## 2. Run and Build

From `frontend/`:

```bash
npm install
npm run dev
npm run build
npm run preview
npm run lint
```

Default dev server is Vite.

## 3. Top-Level Folder Map

- `public/`: static assets (icons, wallpapers, sounds, manifest, service worker)
- `scripts/`: support scripts (for example emoji map generation)
- `src/`: actual application source
- `vite.config.js`: build/dev config + React alias/dedupe
- `eslint.config.js`: lint rules

## 4. `src/` Directory Breakdown

Current high-level module size (approx file count):

- `assets/` (5): local image/illustration assets
- `components/` (122): reusable UI building blocks
- `contexts/` (7): global context providers (theme, connectivity, lock, sockets, typing)
- `data/` (4): mock/seeding/common constants
- `hooks/` (12): reusable hooks
- `layouts/` (5): shell layouts (`auth`, `dashboard`)
- `pages/` (17): route-level screens
- `redux/` (4): store + slices
- `routes/` (2): route definitions
- `services/` (1): thread service (local chat data source)
- `theme/` (6): MUI theme system
- `utils/` (19): helper functions (auth/storage/network/etc.)
- `website/` (53): public marketing site UI

Special note:
- `src/config/` and `src/sections/` currently exist but are effectively unused/empty.

## 5. App Bootstrap Flow

### Entry path

1. `src/main.jsx`
2. `src/App.jsx`
3. `src/routes/index.jsx`

### `src/main.jsx`

What it does:
- mounts React app
- wraps app with core providers:
  - `HelmetProvider`
  - `ReduxProvider`
  - `SettingsProvider`
  - `BrowserRouter`
- registers service worker only in production
- unregisters old service workers in dev for clean behavior
- applies global root sizing behavior using route-aware helper (`ApplyGlobalStyles`)

### `src/App.jsx`

What it does:
- wraps route tree with theme stack:
  - custom `ThemeProvider`
  - `ThemeSettings` wrapper (RTL/localization/color preset composition)
- renders app router

## 6. Routing and Access Workflow

Primary file: `src/routes/index.jsx`

Route groups:
- `/auth/*`: login/register/reset screens
- `/app/*`: main authenticated product area (dashboard/chat/admin/settings)
- `/`: public marketing website

Auth gating logic:
- Uses `authStore.useAuthStatus()` from `src/utils/auth.js`
- If authenticated:
  - `/auth/*` redirects to `/app`
- If unauthenticated:
  - `/app/*` redirects to `/auth/login`

Lazy loading:
- Most pages are lazy-imported
- Global fallback: `LoadingScreen`

## 7. Dashboard Shell Workflow

Main shell file: `src/layouts/dashboard/index.jsx`

Provider chain inside dashboard:
1. `ConnectivityProvider`
2. `SocketProvider`
3. `PresenceProvider`
4. `ChatLockProvider`
5. `TypingIndicatorProvider`

UI shell composition:
- `TopBar`
- `SideBar`
- content outlet via `KeepAliveOutlet`

`KeepAliveOutlet` (`src/layouts/dashboard/KeepAliveOutlet.jsx`):
- caches selected route elements
- preserves component state across route switches
- avoids unnecessary re-initialization for cached paths

## 8. Main Product Screens

### `src/pages/dashboard/GeneralApp.jsx`

This is the core chat workspace.

Responsibilities:
- organization and thread selection
- message list loading/pagination
- composer send/edit/reply/forward flows
- message actions (copy/react/delete/info/select)
- lock-state aware rendering
- sidebar info panel and overlays
- local thread selection persistence
- real backend thread sync via `useChatSync` hook (auto-syncs on load)
- real thread detection: `isRealThread(threadId)` checks `dm-` or `group-` prefix
- messages for real threads fetched from `GET /chat/threads/:id/messages`
- send message for real threads calls `POST /chat/threads/:id/messages`
- mark read calls `POST /chat/threads/:id/read` on thread select
- multi-org support: `OrganizationTabs` shown when user belongs to multiple orgs
- auto-switches to real org on first sync (`autoSwitchedRef`)

It orchestrates many modules, especially:
- `useThreadData`
- `useConversationCache`
- `useChatSync`
- chat message helper utilities
- Redux sidebar state (`app` slice)

### `src/pages/dashboard/Admin.jsx`

Admin container with tabbed modules:
- Home
- Users
- Groups
- Controls
- Billing
- Advanced (role dependent)

### `src/pages/dashboard/Settings.jsx`

User/workspace settings area with tabs:
- Profile
- Password + chat lock PIN
- Devices and sessions
- Wallpapers
- Notifications and privacy

## 9. Public Website (Marketing) App

Files under `src/website/*`.

Entry:
- `src/website/index.jsx`

Layout:
- Navbar
- `Outlet` for page content
- Footer

Pages include:
- Home
- Pricing
- Features
- Demo
- Help
- How It Works
- Contact

This is separate from `/app` dashboard UX.

## 10. State Management Architecture

## Redux

Files:
- `src/redux/store.js`
- `src/redux/rootReducer.js`
- `src/redux/slices/app.js`
- `src/redux/slices/typingSlice.js`

Used for:
- global UI state (sidebar etc.)
- persisted app-level preferences/state chunks

## Service + Hook state (important)

Primary pattern for chat data:
- `src/services/threadService.js` stores the canonical thread/message snapshot
- `src/hooks/useThreadData.js` exposes this snapshot with `useSyncExternalStore`

Why this matters:
- chat data is not fetched directly in every component
- components subscribe to one shared snapshot source
- local cache persists in `localStorage` with controlled writes

## Conversation cache

`src/hooks/useConversationCache.js`:
- LRU-like cache for thread message windows
- keeps recent conversations hot
- reduces reload cost while switching threads

## 11. Context Providers and Their Roles

### `SettingsContext`
File: `src/contexts/SettingsContext.jsx`

Handles:
- theme mode
- theme preset/custom brand color
- font family and font size
- chat list alignment preference

Backed by local storage via `useLocalStorage` hook.

### `ConnectivityContext`
File: `src/contexts/ConnectivityContext.jsx`

Handles:
- online/offline status
- internet probing (`utils/networkStatus.js`)
- offline timestamp

### `SocketContext`
File: `src/contexts/SocketContext.jsx`

Handles:
- socket initialization
- auto reconnect states
- connection status and transport details
- exposes `connect`/`disconnect`

### `PresenceProvider`
File: `src/contexts/PresenceProvider.jsx`

Handles:
- user presence (`Online`, `Idle`, `Away`, `Offline`)
- browser activity/visibility tracking
- optional Electron bridge behavior
- socket emit for presence updates

### `ChatLockContext`
File: `src/contexts/ChatLockContext.jsx`

Handles:
- lock/unlock modal state
- PIN-protected conversation access
- shared lock state dispatch via events

### `TypingIndicatorContext`
File: `src/contexts/TypingIndicatorContext.jsx`

Handles:
- per-thread typing participants
- expiry timers to auto-clear stale typing indicators
- optional simulation mode

## 12. Auth Handling

File: `src/utils/auth.js`

Behavior:
- stores auth identity in browser storage
- exposes `login`, `logout`, `isAuthenticated`
- emits `auth:changed` for reactive route gating
- used by router for protected navigation
- secure cookie auth support:
  - `credentials: include` on auth requests
  - CSRF header attach for unsafe methods (`src/utils/csrf.js`, `src/utils/authApi.js`)
  - refresh-reuse forced logout handling (`force_logout_all`)

## 13. Theme System

Core files:
- `src/theme/index.jsx`
- `src/theme/palette.js`
- `src/theme/typography.js`
- `src/theme/shadows.js`
- `src/theme/overrides/index.js`

Theme behavior:
- mode-aware palette (light/dark)
- settings-driven font family
- MUI component overrides
- localization + RTL wrappers through `components/settings/*`

## 14. Important Utility Zones

- `src/utils/secureStorage.js`: storage abstraction
- `src/utils/networkStatus.js`: online probe helper
- `src/utils/threadUtils.js`: thread-level utility helpers
- `src/utils/blobUtils.js`: blob/clipboard helpers
- `src/utils/richTextSanitizer.js`: content sanitization helper
- `src/utils/notificationBridge.js`: browser/electron notification integration helpers

## 15. High-Value Component Areas

- `src/components/chats/*`: left thread list and list actions
- `src/components/conversation/*`: chat header/body/footer + composer + message rendering
- `src/components/conversation/messages/*`: message-type renderers and overlays
- `src/components/Admin/*`: admin panels, dialogs, forms, tabs
- `src/components/settings/*`: theme/settings UI wrappers

## 16. End-to-End Runtime Workflow (Practical)

1. App boots in `main.jsx` with providers.
2. Router checks auth status from `authStore`.
3. If user enters `/app`, dashboard layout providers initialize.
4. `GeneralApp` subscribes to `threadService` through `useThreadData`.
5. Thread/message windows are loaded from cached snapshot.
6. Message operations mutate service state (`append`, `patch`, `remove`) and UI updates reactively.
7. Connectivity/presence/socket layers continuously update status context.
8. Settings changes persist to local storage and theme/context immediately reflect in UI.

## 17. Where to Change What

- Add new authenticated screen:
  - page under `src/pages/dashboard/*`
  - route in `src/routes/index.jsx`
- Add new marketing page:
  - page under `src/website/pages/*`
  - route in website route group
- Add new chat behavior:
  - service logic: `src/services/threadService.js`
  - UI rendering: `src/components/conversation/*`
- Add global preference:
  - settings context + settings page tab/components
- Add admin module:
  - `src/components/Admin/tabs/*` and hook it in `Admin.jsx`

## 18. Known Architectural Characteristics

- Strong local-first chat model (service + cache) currently drives message UI.
- Socket support exists but many flows can still run without backend push.
- Dashboard and marketing website are separate route systems in one frontend app.
- Multiple global providers are nested in dashboard layout, so most app behaviors are context-driven.

## 19. Quick Orientation Checklist for New Developer

Read in this order:
1. `src/main.jsx`
2. `src/routes/index.jsx`
3. `src/layouts/dashboard/index.jsx`
4. `src/pages/dashboard/GeneralApp.jsx`
5. `src/services/threadService.js`
6. `src/hooks/useThreadData.js`
7. `src/contexts/*` (especially Connectivity, Socket, Presence, ChatLock)
8. `src/pages/dashboard/Settings.jsx`
9. `src/components/conversation/*`
10. `src/components/chats/*`

This sequence gives the fastest full mental model of the frontend.

## Update Log (2026-02-25)

- Backend integration references synced for `POST /contact-us` and `GET /product-features/catalog`.
- Contact-form email formatting is now fully backend-template driven (`backend/src/templates/mail/*`).
- Backend security settings module added:
  - `GET /organization-restrictions/ip`
  - `GET /organization-restrictions/platform`

## 20. Detailed File Responsibility Map

This section lists high-impact files so you know exactly where logic lives.

### Root-level frontend files

- `index.html`: Vite HTML shell.
- `vite.config.js`: React plugin + React alias dedupe to avoid duplicate React runtime.
- `package.json`: scripts + dependency lock for frontend runtime.
- `eslint.config.js`: lint configuration.

### `src` root files

- `src/main.jsx`: true app bootstrap.
- `src/App.jsx`: theme + router composition.
- `src/config.js`: default settings object, navbar constants, default path helper.
- `src/index.css`: global CSS baseline overrides.

### Routing layer

- `src/routes/index.jsx`: complete route tree and auth guards.
- `src/routes/paths.js`: path constants (currently minimal usage).

### Layout layer

- `src/layouts/dashboard/index.jsx`: dashboard shell and provider stack.
- `src/layouts/dashboard/TopBar.jsx`: session controls, connectivity display, logout, lock toggle.
- `src/layouts/dashboard/SideBar.jsx`: left navigation rail and route switching.
- `src/layouts/dashboard/KeepAliveOutlet.jsx`: route outlet caching.
- `src/layouts/auth/AuthSplitLayout.jsx`: auth page shell.

### Core pages

- `src/pages/dashboard/GeneralApp.jsx`: main chat experience orchestration.
- `src/pages/dashboard/Admin.jsx`: admin tab shell.
- `src/pages/dashboard/Settings.jsx`: user/workspace settings.
- `src/pages/auth/Login.jsx`: login form and auth persistence entry.
- `src/pages/auth/Register.jsx`: registration UI.
- `src/pages/auth/ResetPassword.jsx`: reset request flow.
- `src/pages/auth/NewPassword.jsx`: new password apply flow.
- `src/pages/Page404.jsx`: fallback page.

### Chat UI modules

- `src/components/chats/ChatList.jsx`: left thread list rendering/search.
- `src/components/chats/ChatElement.jsx`: single thread row.
- `src/components/chats/ChatListActionsMenu.jsx`: quick actions near list.
- `src/components/conversation/Header.jsx`: active conversation header.
- `src/components/conversation/Message.jsx`: message pane container.
- `src/components/conversation/Footer.jsx`: composer and send interaction.
- `src/components/conversation/messages/*`: message type renderers (text/file/media/link/code/etc.).
- `src/components/conversation/lists/VirtualizedMessageList.jsx`: virtualization path for large message feeds.

### Admin modules

- `src/components/Admin/tabs/*`: top-level admin tab content.
- `src/components/Admin/sections/*`: section-level admin widgets.
- `src/components/Admin/forms/*`: reusable admin forms.
- `src/components/Admin/dialogs/*`: admin modal workflows.
- `src/pages/dashboard/Admin.jsx`: tab content lazy-loaded for better initial render performance.

### Settings modules

- `src/components/settings/*`: theme wrappers and settings helpers.
- `src/components/settings/drawer/*`: runtime theme drawer controls.
- `src/pages/dashboard/settings/*`: settings defaults, permission config, storage keys, utilities.
- `src/pages/dashboard/settings/tabs/*`: profile/password/activity/wallpaper/notification tab UI.

### Context modules

- `src/contexts/SettingsContext.jsx`: visual/system preference state.
- `src/contexts/ConnectivityContext.jsx`: online state + probe.
- `src/contexts/SocketContext.jsx`: socket lifecycle state.
- `src/contexts/PresenceProvider.jsx`: user activity/presence state.
- `src/contexts/ChatLockContext.jsx`: lock state provider.
- `src/contexts/TypingIndicatorContext.jsx`: typing participants state.
- `src/contexts/socket.jsx`: additional socket helper context (legacy/support path).

### Hooks modules

- `src/hooks/useThreadData.js`: subscription bridge to `threadService`.
- `src/hooks/useConversationCache.js`: per-thread message cache manager.
- `src/hooks/useThreadMessagesState.js`: message state helper for thread UI.
- `src/hooks/useSettings.js`: settings context consumer.
- `src/hooks/useChatLock.js`: chat lock business logic.
- `src/hooks/useSecureStorageValue.js`: reactive secure storage reads.
- `src/hooks/useLocalStorage.js`: generic local storage state hook.
- `src/hooks/useResponsive.js`: responsive breakpoint helper.
- `src/hooks/useStickyScroll.js`: sticky scroll behavior.
- `src/hooks/useControlsApi.js`: control panel helper hooks.
- `src/hooks/useMascot.js`: mascot asset selection helper.
- `src/hooks/useLocales.js`: locale helper.
- `src/hooks/useOtpResendCooldown.js`: reusable resend cooldown timer state for OTP screens.

### Auth UI modules

- `src/components/auth/OtpCodeInput.jsx`: 6-box numeric OTP input (paste, auto-focus).
- `src/components/auth/OtpAttemptStatus.jsx`: compact attempts-left progress panel shown only after invalid OTP.

### Data and service modules

- `src/data/CommonData.js`: seeded mock organizations/threads/messages + branding constants.
- `src/data/userProfile.js`: profile normalization defaults (fake defaults removed; email, designation, department, location now blank by default).
- `src/data/brandingStore.js`: branding values.
- `src/data/authHighlights.js`: auth-page descriptive content.
- `src/services/threadService.js`: central local-first thread and message state engine. `CACHE_VERSION = 5` clears stale localStorage on upgrade. `baseSelfMessages = []` — Myself thread starts empty.
- `src/services/chatApi.js`: API client for all `/chat` backend endpoints (NEW).

### Chat sync hooks

- `src/hooks/useChatSync.js`: syncs all orgs + their threads from backend into `threadService` on mount (NEW).

### Redux modules

- `src/redux/store.js`: store + persist setup.
- `src/redux/rootReducer.js`: reducer composition.
- `src/redux/slices/app.js`: UI shell state (sidebar etc.).
- `src/redux/slices/typingSlice.js`: redux typing state slice.

### Theme modules

- `src/theme/index.jsx`: MUI theme creation based on settings.
- `src/theme/palette.js`: light/dark palette definitions.
- `src/theme/typography.js`: typography definitions.
- `src/theme/shadows.js`: shadow presets.
- `src/theme/breakpoints.js`: custom breakpoint config.
- `src/theme/overrides/index.js`: component override registration.

### Utility modules

- `src/utils/auth.js`: auth store events and persistence.
- `src/utils/secureStorage.js`, `secureCipher.js`, `secureText.js`: storage and protection helpers.
- `src/utils/networkStatus.js`: network probe implementation.
- `src/utils/threadUtils.js`, `threadNavigationEvents.js`: thread and navigation helpers.
- `src/utils/typingFormatter.js`: typing text summarization.
- `src/utils/blobUtils.js`: clipboard/blob helper utilities.
- `src/utils/richTextSanitizer.js`: message content sanitization.
- `src/utils/notificationBridge.js`: native vs browser notification support.

### Website modules

- `src/website/index.jsx`: website shell.
- `src/website/pages/*`: marketing route pages.
- `src/website/components/*`: marketing blocks.
- `src/website/components/HelpCenter/*`: help center sub-components.
- `src/website/assets/*`: website-specific assets and illustrations.
- `src/website/website.css`: website styling.

## 21. Concrete Workflows

### A. Login workflow

1. User opens `/auth/login`.
2. Login page writes identity/token via `authStore.login`.
3. `authStore` emits `auth:changed`.
4. Router auth hook updates and redirects to `/app`.
5. Dashboard providers initialize.

### B. Conversation open + send workflow

1. `GeneralApp` selects thread.
2. `useConversationCache.loadThread` reads message window from `threadService`.
3. User sends message through conversation footer.
4. `appendMessages` updates `threadService`.
5. Subscribers (`useThreadData`) re-render message and thread preview immediately.
6. Optional socket/presence logic can sync outward.

### C. Settings update workflow

1. User changes a setting in Settings page or theme drawer.
2. Context/hook persists value to secure/local storage.
3. Theme or target component reacts to updated state.
4. Change survives refresh due to persisted storage.

## 22. Developer Playbook (Fast)

- Need to add a new chat message type:
  - add renderer in `src/components/conversation/messages/`
  - wire helper/normalizer update in message helpers and service if needed
- Need to add a new dashboard route:
  - create page in `src/pages/dashboard/`
  - register in `src/routes/index.jsx`
  - optionally add navigation entry in `SideBar.jsx`
- Need to add new global toggle:
  - add key in settings storage/constants
  - expose in `SettingsContext`
  - consume via `useSettings`
- Need to integrate backend chat API:
  - keep UI unchanged
  - integrate fetch/sync in `threadService.refreshOrg` and related methods
- Need to integrate backend product features tabs/content:
  - fetch tab+item payload from `GET /product-features/catalog`
  - use admin panel write APIs (`POST/PUT/PATCH`) only for owner role (`role_id=1`)
- Need to integrate contact form with backend:
  - submit to `POST /contact-us`
  - backend sends admin notify mail (`CONTACT_US_NOTIFY_TO`) and customer thank-you mail asynchronously

## 23. 15-Minute Onboarding Checklist

Use this exact sequence for fastest ramp-up.

1. Run project once
   - `npm install`
   - `npm run dev`
   - Open app and confirm `/`, `/auth/login`, `/app` routes work.

2. Understand route gates
   - Read `src/routes/index.jsx`.
   - Confirm how `authStore.useAuthStatus()` controls redirects.

3. Understand shell
   - Read `src/layouts/dashboard/index.jsx`.
   - Identify provider order and why dashboard behaviors are context-driven.

4. Understand chat core
   - Read `src/pages/dashboard/GeneralApp.jsx`.
   - Track thread select, message load, and send/edit actions.

5. Understand data source
   - Read `src/services/threadService.js`.
   - Focus on `getThreadsForOrg`, `getMessagesWindow`, `appendMessages`, `patchMessage`, `removeMessage`.

6. Understand subscription bridge
   - Read `src/hooks/useThreadData.js`.
   - Confirm how `useSyncExternalStore` keeps components reactive.

7. Understand settings and theme
   - Read `src/contexts/SettingsContext.jsx` and `src/theme/index.jsx`.
   - Confirm how setting changes update live UI.

8. Understand connectivity and realtime foundation
   - Read `src/contexts/ConnectivityContext.jsx`, `SocketContext.jsx`, `PresenceProvider.jsx`.
   - Confirm offline/online and socket status flow.

9. Understand lock and typing behavior
   - Read `src/contexts/ChatLockContext.jsx` and `TypingIndicatorContext.jsx`.
   - Confirm event/state interaction with chat screen.

10. Make one tiny safe change
   - Change a static label in a chat/website component.
   - Verify hot reload and build still pass.

11. Run validation before pushing
   - `npm run lint`
   - `npm run build`

12. Optional confidence check
   - Add a console trace in `threadService.appendMessages`.
   - Send a message and confirm full render/update path.

## Update Log (2026-02-27)

- Login/Register/Reset OTP flows migrated to shared 6-box numeric OTP component.
- OTP attempts panel behavior refined:
  - hidden on first open
  - visible only after invalid OTP response.
- OTP resend cooldown centralized through `useOtpResendCooldown`.
- Auth refresh hardening synced:
  - CSRF retry on 403
  - forced logout on refresh-token reuse detection.
- Admin page render optimized using lazy tab module loading.

## Update Log (2026-03-02)

- Global Members tab permission management modal enhanced:
  - wider responsive dialog
  - improved header stats + quick actions
  - better left/right list operations for default chat-permission users.
- Documentation synchronized with current admin global-access behavior.

## Update Log (2026-03-09)

- Admin Users UI updates:
  - Department tab row actions changed from 3-dot menu to inline `Edit` and `Delete` buttons.
  - Designation tab row actions changed from 3-dot menu to inline `Edit` and `Delete` buttons.
  - Designation add/edit form order updated:
    - department selection now appears first.
    - designation input is enabled only after department selection.
  - Department and Designation tables tuned for cleaner alignment:
    - centered action columns
    - consistent row/header heights for better responsive readability.
- Billing tab reworked for complete dynamic flow:
  - plans now fetched from `/plans` for pricing/seat/storage rendering.
  - compare plans uses `/plan-features/plan/:planId/summary` for active feature counts and feature matrix.
  - UI adapted for both light and dark theme with responsive cards/table layouts.
  - country/currency selectors added with API quote flow (`/billing/quote`) and Stripe redirect checkout (`/billing/checkout-session`).
  - checkout return path confirms payment (`/billing/checkout/confirm`) and refreshes payment history (`/billing/payment-history`).
  - billing wizard now supports 3-step flow:
    - Step 1: plan + users + country/currency
    - Step 2: billing address
    - Step 3: checkout summary + payment
  - Step-2 country/state fields are now API-driven using:
    - `GET /geo/countries`
    - `GET /geo/states`
  - compare table now consumes `/billing/plan-comparison` (feature_items join mapping).
- Membership status display normalized in user-facing admin grids:
  - primary status chip now reflects `organization_members.status`.

## Update Log (2026-03-09, Docs Sync 2)

- Billing thank-you UI was redesigned into a centered success screen with improved loading, success, and error states.
- Shared subscription normalization now lives in `frontend/src/utils/subscription.js`.
  - `buildSubscriptionView(currentPlan, { activeUsers })` is the standard helper for plan name, status, expiry, cycle label, remaining days, and license usage.
- Billing views now consistently use shared helpers for subscription state, expiry display, site-details resolution, and notifications.
- Invoice labels should prefer the backend-generated `INV-TCX...` value and only fall back to the same pattern client-side.
- Subscription UI state is now standardized through `frontend/src/utils/subscription.js`.
  - Use `buildSubscriptionView(currentPlan, { activeUsers })` for plan name, status, expiry label, cycle label, remaining days, and license usage.
  - Admin `Home`, `Billing`, and `Payment History` should reuse this helper instead of recalculating subscription fields inline.
- Billing UI behavior synced:
  - Compare Plans now opens in dialog/modal view.
  - Coupon flow is manual-entry only (`Apply` / `Clear`), no hardcoded quick button required.
  - Price summary card is responsive and dark/light adaptive.
- Step-2 Address flow synced:
  - top-2 recent billing addresses selectable
  - `Add New Address` mode supported
  - country/state are manual text inputs



## Update Log (2026-03-09, Latest Sync)

- Billing confirm idempotency hardened for same `session_id`.
- Payment history constraints strengthened:
  - `invoice_number` uniqueness guard.
  - partial unique index on `transaction_id` (`IS NOT NULL`).
- Billing invoice download now exports real `.pdf` (A4 style) with transaction id.
- Admin payment success UX improved:
  - duplicate confirm call removed.
  - success modal auto-close in 2s.
  - confetti visibility fixed.
- Billing UI updates:
  - Subscription Overview uses preset/theme palette colors.
  - readability improved for top status chips.
- User management updates:
  - add user flow optimized (non-blocking credential mail + faster dialog close).
  - role mapping locked:
    - organization create default role = `3`.
    - user form platform admin = `2`, otherwise `4`.
  - default toggles remain unchecked unless user explicitly selects.
- Added/updated migrations:
  - `030_reset_and_seed_plans_reasonable_pricing.sql`
  - `031_payment_history_strong_uniques.sql`

## Update Log (2026-03-13)

- New file: `src/services/chatApi.js` — API client for all `/chat` endpoints.
- New file: `src/hooks/useChatSync.js` — syncs all orgs + their threads from backend into `threadService` on mount.
- `GeneralApp.jsx` updated:
  - `useChatSync` hook integrated; auto-syncs real threads on load.
  - `isRealThread(threadId)` helper detects `dm-` or `group-` prefixed IDs.
  - Messages for real threads fetched from `GET /chat/threads/:id/messages`.
  - Send message for real threads calls `POST /chat/threads/:id/messages`.
  - Mark read calls `POST /chat/threads/:id/read` on thread select.
  - Multi-org support: `OrganizationTabs` shown when user belongs to multiple orgs.
  - Auto-switch to real org on first sync (`autoSwitchedRef`).
- `threadService.js` updated:
  - `CACHE_VERSION = 5` clears stale localStorage on upgrade.
  - `baseSelfMessages = []` — Myself thread starts empty (no hardcoded mock messages).
  - `buildSelfThread` — email, designation, department, location from real `agentProfile`.
- `ChatElement.jsx` updated:
  - Tick/read-status icon only shown when `normalizedLastMessage` exists.
  - `fallbackPreview` = email only (removed "No recent communication" hardcoded text).
  - `displayPreview` = `previewText || fallbackPreview` (email shows when no messages).
- `ChatList.jsx` updated:
  - Empty search shows "No Group found" when `showGroupsOnly` is true, else "No User found".
- `ConversationInfoSidebar.jsx` updated:
  - Profile panel shows `designation`, `department`, `location` from DM thread data.
- `userProfile.js` updated:
  - `DEFAULT_PROFILE` fake defaults removed; email, designation, department, location now blank.
- `GeneralApp.jsx` profile sync:
  - `currentUser.email` preferred over stored profile email.
