# Performance Audit: Admin Login Slow Path

## Measured Timing Data

```
GET /admin/login      200 in 14.5s  (next.js: 11.5s, proxy.ts: 1795ms, app-code: 1232ms)
POST /api/auth/login  200 in 11.7s  (next.js:  5.8s, proxy.ts:  796ms, app-code: 5.1s)
GET /api/auth/me      200 in 1688ms (next.js:  142ms, proxy.ts:  889ms, app-code:  656ms)
GET /admin/dashboard  200 in 27.6s
```

---

## Full Request Chain (5 sequential requests)

```
Browser                          Server
  │                                │
  ├─ GET /admin/login ────────────►│  middleware.ts (proxy.ts: 1.8s)
  │                                │    └─ supabase.auth.getUser()  ← NETWORK
  │                                │  app/layout.tsx
  │                                │  app/admin/login/page.tsx
  │                                │    └─ SessionProvider mounts
  │                                │        └─ GET /api/auth/me (queued)
  │◄────── 14.5s ─────────────────│
  │                                │
  ├─ POST /api/auth/login ───────►│  middleware.ts (proxy.ts: 0.8s)
  │                                │    └─ supabase.auth.getUser()
  │                                │  route.ts → auth.service.ts
  │                                │    1. supabase.auth.signInWithPassword()  ← NETWORK
  │                                │    2. supabase.auth.getUser()              ← NETWORK
  │                                │    3. db.user.findFirst()                   ← PRISMA
  │                                │    4. db.user.update(touchLastLogin)        ← PRISMA
  │◄────── 11.7s ─────────────────│
  │                                │
  │   Client calls refreshSession()
  │                                │
  ├─ GET /api/auth/me ───────────►│  middleware.ts (proxy.ts: 0.89s)  ← 53% OF TIME
  │                                │    └─ supabase.auth.getUser()     ← DUPLICATE
  │                                │  route.ts → auth.service.ts
  │                                │    └─ supabase.auth.getUser()     ← DUPLICATE
  │                                │    └─ db.user.findFirst()
  │◄────── 1.7s ──────────────────│
  │                                │
  │   router.replace(/admin/dashboard)
  │                                │
  ├─ GET /admin/dashboard ───────►│  middleware.ts (proxy.ts)
  │                                │  SessionProvider mounts AGAIN
  │                                │    └─ GET /api/auth/me (queued)   ← TRIPLICATE
  │                                │  RoleGuard checks role
  │                                │  DashboardShell renders
  │                                │  AdminDashboardPage mounts
  │                                │    └─ 8 recharts components       ← HEAVY COMPILE
  │                                │    └─ GET /api/dashboard/admin
  │                                │        ├─ supabase.auth.getUser() ← QUADRUPLICATE
  │                                │        ├─ db.user.findFirst()
  │                                │        ├─ 7× Prisma queries
  │                                │        └─ summarizeActivities (4 passes × 2)
  │◄────── 27.6s ─────────────────│
```

---

## Root Cause #1: middleware.ts runs `getUser()` on every request

**File:** `src/middleware.ts` + `src/lib/supabase/middleware.ts`

The middleware matches **all routes** except static files. Every single line of code runs on every page load.

### The problem

```typescript
// src/lib/supabase/middleware.ts:39
// Placeholder for future session refresh logic.
await supabase.auth.getUser();
```

- `supabase.auth.getUser()` is a **network call** to Supabase Auth API
- It adds **536ms–1795ms** per request (middleware + proxy.ts column)
- The comment says `// Placeholder` — this is **dead code** that runs in production
- The middleware creates a full Supabase SSR client, reads all cookies, calls `getUser()`, and writes cookies back — even on API routes and static pages

### Impact

| Request | Middleware time | % of total |
|---------|----------------|------------|
| GET /admin/login | 1.8s | 12% |
| POST /api/auth/login | 0.8s | 7% |
| GET /api/auth/me | 0.89s | **53%** |
| GET /admin/dashboard | ~1s | ~4% |

### Solution

Remove the `await supabase.auth.getUser()` call from middleware entirely, or at minimum limit the middleware matcher to only the routes that need it.

---

## Root Cause #2: Zero code splitting — recharts compiled eagerly

**Files:** `src/components/dashboard/admin/*.tsx` (8 files importing recharts)

### The problem

Every dashboard-related component **statically imports** recharts at the top level:

```typescript
// kpi-revenue-chart.tsx
import { AreaChart, Area, XAxis, YAxis, ... } from "recharts";

// kpi-loads-bar-chart.tsx
import { BarChart, Bar, XAxis, YAxis, ... } from "recharts";

// sparkline.tsx
import { AreaChart, Area } from "recharts";

// ... 5 more files
```

- recharts UMD bundle is **~1.7MB**
- All 8 chart components are imported synchronously by `admin-dashboard-page.tsx`
- webpack must parse the **entire recharts library** during compilation
- No `next/dynamic()` or `React.lazy()` used anywhere in the project

### Impact

`GET /admin/dashboard` takes **27.6s** — most of which is webpack compiling the recharts dependency tree.

### Solution

```typescript
// Before
import { AreaChart, Area } from "recharts";

// After
const AreaChart = dynamic(() => import("recharts").then(m => m.AreaChart), { ssr: false });
```

---

## Root Cause #3: Sequential Supabase calls in login flow

**File:** `src/server/auth/auth.service.ts` (function `signInWithRole`)

### The problem

Login runs **4 sequential operations** that could be parallelized:

```typescript
// Step 1: Sign in with password
await supabase.auth.signInWithPassword({ email, password });

// Step 2: Get current user
const sessionUser = await getCurrentUser();
  // 2a: supabase.auth.getUser()  ← network call
  // 2b: db.user.findFirst()      ← Prisma query

// Step 3: Touch last login
await touchLastLogin(sessionUser.id);
  // db.user.update()             ← Prisma query
```

Steps 2a and 3 are unnecessary round-trips. After `signInWithPassword` succeeds, the session is already established. Step 2a (`getUser()`) is redundant — you already know who just signed in. Step 3 could be batched or deferred.

### Impact

App-code time for POST /api/auth/login is **5.1s** — much of it is these 3 sequential network + DB hops.

### Solution

Use `getCurrentUserByEmail(parsed.email)` instead of `getCurrentUser()` — no Supabase call needed. Defer `touchLastLogin` or batch it.

---

## Root Cause #4: Session check fires on every page navigation (multiplication factor)

**File:** `src/components/auth/session-provider.tsx`

### The problem

`SessionProvider` calls `GET /api/auth/me` on mount via `queueMicrotask`. This means:

| Navigation step | Who checks auth | How many Supabase getUser() calls |
|----------------|-----------------|-----------------------------------|
| 1. GET /admin/login | middleware | 1 |
| 2. POST /api/auth/login | middleware + route handler | 2 |
| 3. GET /api/auth/me | middleware + route handler | 2 (triggered by SessionProvider) |
| 4. GET /admin/dashboard | middleware + route handler | 2 (triggered by SessionProvider again) |
| 5. GET /api/dashboard/admin | middleware + route handler | 2 (triggered by requireAccessScope) |
| **Total per full login flow** | | **9 Supabase getUser() calls** |

Each call is a full Supabase Auth network round-trip.

### Solution

- Cache the session check result after middleware already verified it
- Skip the SessionProvider fetch if middleware already attached the user to the request
- Don't re-mount SessionProvider on every page navigation

---

## Root Cause #5: 7+ Prisma queries on dashboard load

**File:** `src/server/services/admin-dashboard.service.ts`

### The problem

`getAdminDashboardBundle` runs:

```typescript
const [currentActivities, previousActivities] = await Promise.all([
  fetchActivities(scope, currentFilters),     // query #1
  fetchActivities(scope, previousFilters),    // query #2
]);

const trendActivities = await fetchActivities(scope, trendFilters);  // query #3

// Can't parallelize because next two depend on currentActivities
const activeDispatchers = await fetchActiveDispatchers(scope);       // query #4

const filterOptions = await Promise.all([
  fetchTeams(scope),                          // query #5
  fetchDispatchers(scope, { teamIds }),       // query #6
  fetchCarriers(scope),                       // query #7
]);

// Then CPU-heavy aggregation (4 passes over the same array)
const summary = summarizeActivities(currentActivities, ...);
const prevSummary = summarizeActivities(previousActivities, ...);
```

- **7 Prisma queries** for a single page load
- `summarizeActivities()` iterates the array **4 separate times**
- Queries 1, 2, 3 could be combined into a single query with grouping

### Impact

Significant DB load and response time — queries 4–7 run sequentially after 1–3 complete.

### Solution

- Combine current/previous/trend queries into one query with date-range grouping
- Reduce `summarizeActivities` to a single pass
- Make queries 4–7 parallel with 1–3 if possible

---

## Summary: Fix Priority

| # | Fix | Est. Time Saved | Effort | Files to Change |
|---|-----|----------------|--------|-----------------|
| 1 | Remove `getUser()` from middleware | **-0.5 to -1.8s per request** | 1 line | `src/lib/supabase/middleware.ts:39` |
| 2 | `next/dynamic` for recharts | **-15 to -20s on first dashboard** | 8 files | `src/components/dashboard/admin/*.tsx` |
| 3 | Use `getCurrentUserByEmail` instead of `getUser` after login | **-2 to -4s on login** | 1 file | `src/server/auth/auth.service.ts` |
| 4 | Eliminate redundant session checks (SessionProvider) | **-1.7s per navigation** | 1 file | `src/components/auth/session-provider.tsx` |
| 5 | Reduce middleware matcher scope (not all routes) | **-0.5 to -1.8s on static assets** | 1 file | `src/middleware.ts` |
| 6 | Combine dashboard Prisma queries | **-2 to -3s on dashboard** | 1 file | `src/server/services/admin-dashboard.service.ts` |
| 7 | Single-pass `summarizeActivities` | **-0.5 to -1s CPU** | 1 file | `src/server/services/admin-dashboard.service.ts` |
