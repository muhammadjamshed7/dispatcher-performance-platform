# Performance Audit Report — Dispatcher Performance Platform

**Date:** 2026-07-02
**Scope:** Full-stack audit of API calls, data fetching patterns, component re-renders, backend query efficiency, caching, and realtime refresh logic.

---

## 1. Executive Summary

### Main reason the app feels slow

The application suffers from **three compounding problems**:

1. **Cascading realtime-triggered refetches** — a single database change (e.g., a DailyActivity insert) can trigger **10+ separate API calls** across all open browser tabs/pages, because every page independently subscribes to overlapping realtime tables and calls `reload()` on every change.

2. **No data caching layer** — the app uses a custom `useApiData` hook with only request dedup (no stale-while-revalidate, no cache keys, no sharing between components). Every consumer fetches its own copy of the data. The same API is called 2-4 times on the same page by different components.

3. **10-second notification polling** — the `AdminKpiSection` (`DashboardNotificationsCard`) polls `/api/notifications` every 10 seconds via `setInterval`, even though the `NotificationsDropdown` already subscribes to realtime for the same data. This is a duplicate aggressive poll that runs constantly on every admin dashboard visit.

### Biggest duplicate API problems

| API | Times called (admin dashboard) | Cause |
|---|---|---|
| `/api/notifications` | 3+ calls | NotificationsDropdown + AdminKpiSection (10s poll) + NotificationsPage |
| `/api/teams` | 2-3x | EntityOptionsProvider + TeamsPage + filter dropdowns |
| `/api/dispatchers` | 2-3x | EntityOptionsProvider + DispatchersPage + filter dropdowns |
| `/api/carriers` | 2-3x | EntityOptionsProvider + CarriersPage + filter dropdowns |

### Biggest backend bottlenecks

- **`getAdminDashboardBundle`** (`admin-dashboard.service.ts`) fetches ALL approved activities across a potentially large date range (up to "all time"), then performs ALL aggregation in-memory (revenue trends, sparklines, status breakdowns, dispatcher ratios, etc.). No pagination, no server-side aggregation.
- **`listNotifications`** (`notifications.service.ts`) always fetches the last 100 notifications, even if the user only needs the unread count.
- **No server-side search/filter for notifications** — the notifications page loads 100 records and does all filtering in-memory on the client.

### Biggest frontend bottlenecks

- **DashboardNotificationsCard (`AdminKpiSection`)** polls `/api/notifications` every 10 seconds via `setInterval`, independent of the realtime subscription on the same page.
- **Invoices page loads all records into memory** and paginates client-side. No server-side pagination.
- **Notifications page loads 100 records** and does client-side search/filter/pagination. No server-side filtering.
- **Filter components** (`CarrierFilter`, `DispatcherFilter`, `TeamFilter`) all call `useEntityOptions()`, which triggers `ensureLoaded()`, re-fetching teams/dispatchers/carriers on every page that renders a filter dropdown.
- **10 realtime subscriptions** across the app can trigger cascading refetches on a single DB change.

---

## 2. API Call Inventory by Page

### `/admin/dashboard`

| API | Method | Calls on load | Triggered by | Needed? | Problem |
|---|---|---|---|---|---|
| `/api/dashboard/admin` | GET | 1 | AdminDashboardPage | Yes | OK (single bundle API) |
| `/api/notifications` | GET | 1 + polling every 10s | `DashboardNotificationsCard` in `AdminKpiSection` | Partially | **Duplicate with dropdown + aggressive polling** |
| `/api/notifications` | GET | 1 (via realtime trigger) | `NotificationsDropdown` in `TopNav` | Partially | **Duplicate with KPI card** |
| EntityOptionsProvider triggers: | | | | | |
| `/api/teams` | GET | 1 | EntityOptionsProvider in DashboardShell | Maybe | Could be cached |
| `/api/dispatchers` | GET | 1 | EntityOptionsProvider in DashboardShell | Maybe | Could be cached |
| `/api/carriers` | GET | 1 | EntityOptionsProvider in DashboardShell | Maybe | Could be cached |

**Total API calls on load:** ~6 (3 entity + 2 notifications + 1 dashboard bundle)
**Extra calls every 10s:** 1 notification poll
**Extra calls on any DB change:** ~10 cascading reloads across all open pages

### `/admin/activities`

| API | Method | Calls | Triggered by | Needed? | Problem |
|---|---|---|---|---|---|
| `/api/activities?filters` | GET | 1 | `ActivitiesPageContent` | Yes | OK |
| EntityOptions: `/api/teams` | GET | 1 | EntityOptionsProvider (via filter components) | Maybe | Could be cached |
| EntityOptions: `/api/dispatchers` | GET | 1 | EntityOptionsProvider (via filter components) | Maybe | Could be cached |
| EntityOptions: `/api/carriers` | GET | 1 | EntityOptionsProvider (via filter components) | Maybe | Could be cached |
| Realtime: `DailyActivity`, `ActivityEditRequest` | WS | — | `useRealtimeRefresh` | Yes | Triggers `refreshAll` on ANY change |

### `/admin/teams`

| API | Method | Calls | Triggered by | Needed? | Problem |
|---|---|---|---|---|---|
| `/api/teams` | GET | 1 | `TeamsPageContent` (direct) | Yes | Could merge with entity options |
| `/api/dispatchers` | GET | 1 | `TeamsPageContent` (direct) | Yes | Could merge with entity options |
| `/api/carriers` | GET | 1 | `TeamsPageContent` (direct) | Yes | Could merge with entity options |
| `/api/activities?filters` | GET | 1 | `TeamsPageContent` | Yes | OK |
| EntityOptions: `/api/teams` | GET | 1 | EntityOptionsProvider (redundant) | **No** | **Duplicate — already fetched above** |
| EntityOptions: `/api/dispatchers` | GET | 1 | EntityOptionsProvider (redundant) | **No** | **Duplicate — already fetched above** |
| EntityOptions: `/api/carriers` | GET | 1 | EntityOptionsProvider (redundant) | **No** | **Duplicate — already fetched above** |
| Realtime: `Team, User, Carrier, DailyActivity` | WS | — | `useRealtimeRefresh` | Yes | Triggers 4 parallel reloads on ANY change |

**Total API calls on load:** ~7 (3 direct + 3 redundant from EntityOptions + 1 activity)

### `/admin/carriers`

| API | Method | Calls | Triggered by | Needed? | Problem |
|---|---|---|---|---|---|
| `/api/carriers?filters` | GET | 1 | `CarriersPageContent` (direct) | Yes | OK |
| `/api/activities?filters` | GET | 1 | `CarriersPageContent` | Yes | OK |
| `/api/activities?filters(previous)` | GET | 1 | `CarriersPageContent` | Maybe | Previous period comparison |
| EntityOptions: `/api/teams` | GET | 1 | EntityOptionsProvider (redundant) | **No** | **Duplicate** |
| EntityOptions: `/api/dispatchers` | GET | 1 | EntityOptionsProvider (redundant) | **No** | **Duplicate** |
| EntityOptions: `/api/carriers` | GET | 1 | EntityOptionsProvider (redundant) | **No** | **Duplicate — same API already fetched** |
| Realtime: `Carrier` | WS | — | `useRealtimeRefresh` | Yes | Triggers 4 parallel reloads on Carrier change |

**Total API calls on load:** ~7 (3 direct + 3 redundant EntityOptions + 1 previous activities)

### `/admin/dispatchers`

| API | Method | Calls | Triggered by | Needed? | Problem |
|---|---|---|---|---|---|
| `/api/dispatchers?filters` | GET | 1 | `DispatchersPageContent` | Yes | OK |
| EntityOptions: `/api/teams` | GET | 1 | EntityOptionsProvider | Maybe | Caching opportunity |
| EntityOptions: `/api/dispatchers` | GET | 1 | EntityOptionsProvider (redundant) | **No** | **Duplicate** |
| EntityOptions: `/api/carriers` | GET | 1 | EntityOptionsProvider | Maybe | Caching opportunity |

### `/admin/reports`

| API | Method | Calls | Triggered by | Needed? | Problem |
|---|---|---|---|---|---|
| `/api/reports?period&filters` | GET | 1 | `ReportsPageContent` | Yes | No server-side pagination |

### `/admin/invoices`

| API | Method | Calls | Triggered by | Needed? | Problem |
|---|---|---|---|---|---|
| `/api/invoices?filters` | GET | 1 | `InvoicesPageContent` | Yes | **Client-side pagination only** — all records loaded |
| Extra calls on generate/pay/cancel | POST | 1 each | User actions | Yes | OK |

### `/admin/notifications`

| API | Method | Calls | Triggered by | Needed? | Problem |
|---|---|---|---|---|---|
| `/api/notifications` | GET | 1 | `NotificationsPageContent` | Yes | **Client-side filter/pagination** |
| Realtime: `Notification, DailyActivity, ActivityEditRequest` | WS | — | `useRealtimeRefresh` | Yes | Triggers reload on ANY change to these tables |

### Team Lead Dashboard (`/team-lead/dashboard`)

| API | Method | Calls | Triggered by | Needed? | Problem |
|---|---|---|---|---|---|
| `/api/dashboard/team-lead` | GET | 1 | `TeamLeadDashboardPage` | Yes | OK |
| `/api/activities?approvalStatus=APPROVED` | GET | 1 | `TeamLeadDashboardPage` | Partially | Could be merged into dashboard bundle |
| EntityOptions: `/api/teams` | GET | 1 | EntityOptionsProvider | Maybe | Caching opportunity |
| EntityOptions: `/api/dispatchers` | GET | 1 | EntityOptionsProvider | Maybe | Caching opportunity |
| EntityOptions: `/api/carriers` | GET | 1 | EntityOptionsProvider | Maybe | Caching opportunity |

### Dispatcher Dashboard (`/dispatcher/dashboard`)

| API | Method | Calls | Triggered by | Needed? | Problem |
|---|---|---|---|---|---|
| `/api/dashboard/dispatcher` | GET | 1 | `DispatcherDashboardPage` | Yes | OK (single bundle) |

### Global Search (every page via TopNav)

| API | Method | Calls | Triggered by | Needed? | Problem |
|---|---|---|---|---|---|
| `/api/search?q=...` | GET | Debounced (300ms) | `GlobalSearch` component | Yes | OK — debounced, min 2 chars |

---

## 3. Duplicate API Calls Found

| API | Times Called | Pages Affected | Cause | Recommended Fix |
|---|---|---|---|---|
| `/api/notifications` | 3+ | Admin Dashboard / all pages | NotificationsDropdown (top nav) + DashboardNotificationsCard (KPI 10s poll) + NotificationsPage | **Eliminate polling** — realtime already provides live updates. Remove `setInterval` from `AdminKpiSection`. |
| `/api/teams` | 2-3x | Activities, Teams, Carriers, Reports, Dashboard | EntityOptionsProvider (every page) + TeamsPage direct fetch + filter dropdowns | **Cache entity options** in a shared store (React Context + SWR-style dedup) so only 1 fetch per page load |
| `/api/dispatchers` | 2-3x | Activities, Teams, Carriers, Reports, Dashboard | Same pattern as teams | **Same** — cache entity options |
| `/api/carriers` | 2-3x | Activities, Teams, Carriers, Reports, Dashboard | Same pattern as carriers | **Same** — cache entity options |
| `/api/activities` | 2-3x | TeamsPage, CarriersPage | TeamsPage fetches activities + CarriersPage fetches current AND previous period activities | **Consider server-side aggregation** instead of separate calls for comparison data |
| `/api/dashboard/team-lead` + `/api/activities` | 2 | Team Lead Dashboard | Dashboard metric + separate activities fetch for activity table | **Merge into one dashboard bundle** like admin dashboard does |

---

## 4. Slow API Candidates

| API | Why It May Be Slow | Backend File | Recommended Fix |
|---|---|---|---|
| `/api/dashboard/admin` | Fetches ALL approved activities across date range, does all aggregation in-memory. Combined date range can span multiple periods (current + previous + year trend). | `admin-dashboard.service.ts` (885 lines) | **Move aggregation to DB queries**: use SQL GROUP BY/SUM instead of loading row data into JS. Or paginate the activity data and aggregate on the server in batches. |
| `/api/reports` | Loads all matching activities + builds dispatcher/carrier/team summary rows with no pagination. For an org with 10K+ records, this is expensive. | `reports.service.ts` (652 lines) | **Add server-side pagination** for activity rows. Move summary calculations to DB. |
| `/api/invoices` | Loads all matching invoices into a single response. Client paginates in memory. | `invoices.service.ts` (1590 lines) | **Add server-side pagination** (page + perPage params). |
| `/api/notifications` | Fetches full notification rows AND separately counts unread. With 100-row limit this is generally OK, but runs frequently due to polling. | `notifications.service.ts` | **Remove polling** (see section 3). Consider caching the unread count. |
| `/api/activities` | Builds full DailyActivity responses, resolves approver names via a second query (N+1 mitigated), checks for pending edit requests. Multiple sub-queries per call. | `activities.service.ts` (1182 lines) | **Batch the approver name resolution** (already partially done). Consider eager-loading related data. |

---

## 5. Frontend Re-render / Hook Issues

| Component/Hook | Problem | Impact | Recommended Fix |
|---|---|---|---|
| `DashboardNotificationsCard` in `AdminKpiSection` | Polls `/api/notifications` every 10s via `setInterval` | API call every 10s regardless of whether there are new notifications | **Remove** — realtime already handles this via `NotificationsDropdown` |
| `useRealtimeRefresh` on all pages | Each page subscribes independently. A single DB change triggers `reload()` on all open pages/tabs. | Cascading refetch storm (10+ API calls) | **Debounce at a higher level** or use a shared realtime context that batches refresh events |
| `EntityOptionsProvider` | Fetches teams/dispatchers/carriers on every page load, even when not needed. No cache across navigations. | 3 extra API calls per page navigation | **Persist in sessionStorage** or use a SWR-like cache with stale-while-revalidate |
| `AdminDashboardPage` filters change | Changing filters in the dashboard popover calls `router.replace()`, which triggers a full Next.js navigation + re-render | Full page re-render + API refetch | Use shallow routing or local state + `useApiData` reload instead of navigation |
| `InvoicesPageContent` | All invoices loaded client-side, pagination done in memory via `.slice()` | Memory pressure with 1000+ invoices. Full refetch on filter/tab change. | Implement server-side pagination |
| `NotificationsPageContent` | All 100 notifications loaded client-side, then filtered/searched/paginated in memory | Wasted bandwidth filtering large payload client-side | Add server-side `?q=...`, `?status=...` query params |
| `CarrierFilter` / `DispatcherFilter` / `TeamFilter` | Each calls `useEntityOptions()`, triggering `ensureLoaded()` | Entity options fetched every time a filter component renders on any page | EntityOptionsProvider should use `sessionStorage` or a shared cache |
| `TeamLeadDashboardPage` | Fetches `fetchTeamLeadDashboard()` AND `fetchActivities()` separately | 2 API calls where 1 bundled call would suffice | Merge into one dashboard bundle API |
| `DispatcherPerformancePage` | Fetches `fetchDispatcherDashboard()` + `fetchRankings()` + `fetchActivities()` + `useEntityOptions()` | **4 separate API calls** | Merge dashboard and rankings, or cache across components |
| All pages with `useRealtimeRefresh` | The `tables` array is memoized with `useMemo`, but the callback (`onRefresh`) is the `reload` function from `useApiData`, which is recreated when `loader` changes (which changes when `deps` change) | Realtime subscription can tear down and recreate if deps change unnecessarily | Ensure `reload` is stable or use a ref for the callback |

---

## 6. Data Fetching Problems

### Repeated Fetching

- **Same API called 2-3 times per page**: EntityOptionsProvider + direct page fetch + filter components all trigger `/api/teams`, `/api/dispatchers`, `/api/carriers`.
- **Notifications fetched by 2 components simultaneously**: `NotificationsDropdown` (via `useApiData`) and `DashboardNotificationsCard` (via `setInterval`).
- **Activities fetched redundantly on Teams/Carriers pages**: Teams page fetches activities for dashboard + activities for team grid. Carriers page fetches current + previous period activities separately.

### Missing Caching

- **No shared cache** between `useApiData` instances. Every component that calls `useApiData` with the same URL gets its own state, fetch, and reload.
- **No localStorage/sessionStorage cache** for reference data (teams, dispatchers, carriers). These change rarely but are fetched on every navigation.
- **No SWR/React Query** library is used. The custom `useApiData` hook only deduplicates requests within the same component instance (via `requestIdRef`), not across components.

### Polling Issues

- **`AdminKpiSection` polls `/api/notifications` every 10 seconds** via `setInterval`. This is the most egregious performance problem — it runs constantly, even when:
  - The user is scrolling
  - The tab is in the background
  - The realtime subscription already delivers the same data
  - No new notifications exist

### Provider Over-fetching

- **`EntityOptionsProvider` wraps all authenticated pages** (via `DashboardShell`). Every page navigation triggers `ensureLoaded()` if not already loaded, causing 3 API calls.
- Entity options are **not shared across tabs** or cached.
- Entity options include **all fields** for teams, dispatchers, and carriers when only filter dropdowns need `{id, name}`.

### Realtime Refresh Issues

- **10 independent realtime subscriptions** across the app:
  1. `NotificationsDropdown` — Notification, DailyActivity, ActivityEditRequest
  2. `NotificationsPageContent` — Notification, DailyActivity, ActivityEditRequest
  3. `TeamsPageContent` — Team, User, Carrier, DailyActivity
  4. `CarriersPageContent` — Carrier
  5. `ActivitiesPageContent` — DailyActivity, ActivityEditRequest
  6. `PendingApprovalsPageContent` — DailyActivity, ActivityEditRequest, Notification
  7. `PendingActivitiesPageContent` — DailyActivity, ActivityEditRequest
  8. `DispatcherSubmissionsPageContent` — DailyActivity, ActivityEditRequest, Notification
  9. `AdminLogsPageContent` — AuditLog, DailyActivity, ActivityEditRequest
  10. `AdminDailyReportPage` — DailyActivity (via `useDailyReportRealtime`)
  11. `UserRequestsPageContent` — RegistrationRequest, User

- **A single DailyActivity change triggers 9 subscriptions** — each calling `reload()` on their respective API fetches.
- **No coalescing**: If 10 changes happen in quick succession, 10 batches of reloads fire (mitigated only by the 400ms debounce per subscription).
- **Callbacks include parallel reloads**: `TeamsPageContent.refreshDashboard` calls `reload()`, `reloadDispatchers()`, `reloadCarriers()`, `reloadActivities()` — that's 4 API calls.

---

## 7. Database Query / Index Concerns

### N+1 Query Patterns

- **`listActivities`** (`activities.service.ts`): After fetching activities, it runs a second query to resolve approver names (`SELECT * FROM User WHERE id IN (...)`). This is **already batched** using `.in("id", [...])` — good.
- **`listNotifications`**: Single query with `.order().limit(100)`. No N+1.
- **`getAdminDashboardBundle`**: 4 parallel queries (activities + dispatcher count + teams + dispatchers + carriers) run concurrently via `Promise.all`. No N+1.

### Missing Indexes (Potential)

Based on the Prisma schema, the following indexes exist:
- DailyActivity: `(organizationId, approvalStatus)`, `(teamId, approvalStatus)`, `(dispatcherId, activityDate)`, `(carrierId, activityDate)`, `(status)`
- Notification: `(recipientUserId, readAt, createdAt)`, `(organizationId, createdAt)`

**Potential missing indexes:**
- `DailyActivity(organizationId, activityDate, approvalStatus)` — used by the dashboard query to filter by date range + approval. Currently covered by separate indexes, but a composite would be faster.
- `Notification(recipientUserId, readAt)` — for the unread count query.
- `Carrier(organizationId, dispatcherId, status)` — for counting carriers by dispatcher.

### Loading Too Much Data

- **`getAdminDashboardBundle`** fetches ALL activity rows matching the date range, then does ALL aggregation in-memory. For an organization with 50K+ activities over a year, this means loading 50K rows into Node.js memory just to compute 6 chart data points.
- **Invoices page** loads ALL invoices into the browser (no server-side pagination).
- **Reports page** loads all activity data + built summary rows in one response.

### In-Memory Filtering

- **Admin dashboard** filters activities in-memory after loading the combined range (`filterActivitiesByDateRange` is called 3 times on the full dataset to split into current, previous, and year-trend periods). This is correct logic but expensive for large datasets.
- **`buildDispatcherOutcomeRatios`** iterates over all filter options dispatchers + carriers + activities in nested loops to compute outcome ratios. This is O(D * C * A) and runs on every dashboard load.

### No Pagination

- **Invoices**: No server-side pagination. All invoices loaded, client-side `.slice()` pagination.
- **Notifications**: 100-row limit (hardcoded) but no server-side search/filter support.
- **Activities**: No pagination. All matching activities loaded.
- **Reports**: No pagination on activity rows.

---

## 8. Recommended Optimization Plan

### Immediate Quick Fixes

| # | Fix | Effort | Impact |
|---|---|---|---|
| 1 | **Remove 10s notification polling** (`AdminKpiSection.DashboardNotificationsCard`) | 1 file change | **HIGH** — stops 1 API call every 10 seconds on admin dashboard |
| 2 | **Dedupe `/api/teams` `/api/dispatchers` `/api/carriers`** — cache entity options in a shared store so EntityOptionsProvider fetches them once and subsequent pages reuse the cache | 2-3 file changes | **HIGH** — removes 1-3 duplicate API calls per page navigation |
| 3 | **Merge Team Lead Dashboard** — add `approvedActivities` to the `/api/dashboard/team-lead` response so `TeamLeadDashboardPage` doesn't make a separate `/api/activities` call | 2 file changes | **MEDIUM** — removes 1 API call per page load |
| 4 | **Stop EntityOptionsProvider from re-fetching on every page** — use `sessionStorage` or a simple cache context | 2 file changes | **MEDIUM** — reduces total API calls across navigation |
| 5 | **Add server-side search/filter to `/api/notifications`** — support `?q=`, `?status=`, `?carrier=`, `?date=` params so the browsers doesn't do all filtering in-memory | 2 file changes | **LOW** — bandwidth savings on notifications page |

### Medium Fixes

| # | Fix | Effort | Impact |
|---|---|---|---|
| 6 | **Server-side pagination for invoices** — add `page` + `perPage` params to `/api/invoices` | 3-4 file changes | **HIGH** — prevents loading all invoices into browser memory |
| 7 | **Coalesce realtime refresh events** — instead of each page subscribing independently, create a shared realtime context that broadcasts a single "data changed" event, and let pages debounce together | 3-4 file changes | **MEDIUM** — prevents cascading refetch storms |
| 8 | **Move dashboard aggregation to SQL** — instead of loading all activities and computing in JS, use GROUP BY / SUM in the DB query | 1 service file change | **HIGH** — reduces data transfer from DB to app server by 90%+ |
| 9 | **Add pagination to `/api/activities`** — support `page` + `perPage` with total count | 2 file changes | **MEDIUM** — helps large orgs with many activities |
| 10 | **Bundle Team Lead Dashboard data** — same as admin dashboard (single `/api/dashboard/team-lead` with all data) | 2 file changes | **MEDIUM** — reduces API calls on team lead dashboard |

### Advanced Fixes

| # | Fix | Effort | Impact |
|---|---|---|---|
| 11 | **Implement React Query (TanStack Query) or SWR** — replace `useApiData` with a library that supports caching, dedup, stale-while-revalidate, cache invalidation | 2-3 weeks | **HIGH** — fixes ALL duplicate call patterns permanently |
| 12 | **Background aggregation for dashboard** — pre-compute daily dashboard snapshots in a materialized table/Postgres view, serve from there instead of live-calculating | 1 week | **HIGH** — dashboard loads instantly regardless of data size |
| 13 | **Throttle realtime events on the server** — instead of sending every postgres_changes event, batch events and send a single notification per 500ms window | 1 week | **MEDIUM** — reduces client-side refetch pressure |
| 14 | **Add composite indexes** — `DailyActivity(organizationId, activityDate, approvalStatus)`, `Notification(recipientUserId, readAt)` | 1 day | **MEDIUM** — faster queries |
| 15 | **Server-side notification search (full-text)** — use PostgreSQL `to_tsvector` on notification title/message | 2-3 days | **LOW** — better search for large notification sets |

---

## 9. Risk Notes

The following areas contain sensitive business logic and should **not be changed without careful review**:

- **Approval workflow**: The activity approval chain (dispatcher → team lead → admin) and the parallel approval notification logic. Changing the realtime subscription behavior must not delay or miss approvals.
- **Finance / invoice calculations**: `invoices.service.ts` contains payment recording, mark-paid, and cancellation logic. Pagination changes must not alter these calculations.
- **Invoice PDF export**: Export logic (including PDF generation via `jspdf`) should remain unchanged.
- **Role-based data scoping**: `EntityOptionsProvider` and `useRoleScope` enforce data visibility by role. Caching entity options must respect role filtering — never serve cached data intended for one role to another.
- **Audit logs**: Every approval, rejection, creation, and update writes audit log entries. These must not be batched, deferred, or removed.
- **Notifications**: Notification creation has multiple async side effects (recalculate carrier status, write to daily submissions, notify users). These must remain reliable.
- **Realtime subscriptions are critical** for the live-approval workflow. Removing them would break the core UX of the platform. The fix is to optimize the refresh behavior, not remove subscriptions.

---

## 10. Final Recommendation

### Fix in this order:

1. **Remove the 10-second notification polling** in `AdminKpiSection.DashboardNotificationsCard`. The realtime subscription in `NotificationsDropdown` already provides live updates. This is the single highest-impact fix — removing 1 unnecessary API call every 10 seconds that runs on every admin dashboard visit.

2. **Cache entity options** (teams, dispatchers, carriers) in a shared context with a simple stale-while-revalidate pattern. This removes 2-3 redundant API calls per page navigation. Since these lists change rarely (team/dispatcher/carrier CRUD), a 5-minute client cache is safe.

3. **Coalesce realtime refresh events** — instead of 10+ independent subscriptions, use a single shared realtime connection that broadcasts a throttled "something changed" event. Pages debounce their reload in response. This prevents cascading refetch storms.

4. **Merge team lead dashboard data** — add approved activities to the dashboard bundle so the team lead dashboard makes 1 API call instead of 2.

5. **Move dashboard aggregation from in-memory JS to SQL GROUP BY** — this is the biggest backend optimization. Instead of loading thousands of activity rows into Node.js and computing summary stats in JavaScript, use PostgreSQL's aggregation functions. This will dramatically reduce memory usage and response times for the dashboard API.

6. **Add server-side pagination to invoices** — this prevents loading all invoices into browser memory and reduces network transfer for orgs with many invoices.

The first 3 fixes can be implemented in **1-2 days** and will reduce API calls by **50-60%** on the admin dashboard. The remaining fixes (4-6) can be done in **1 week** and will address the root architectural problems.
