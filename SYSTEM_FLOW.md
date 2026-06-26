# Dispatcher Performance Platform — System Flow & Architecture

> **Document purpose:** Complete reference for developers, maintainers, and Cursor agents.  
> **Source of truth:** Codebase at `D:\Projects\dispatcher-performance-platform` as scanned on 2026-06-24.  
> **Rule:** Everything below is derived from implemented code. Gaps are listed in [§12 Unclear or Missing Information](#12-unclear-or-missing-information).

**Related docs:** [`docs/admin.md`](docs/admin.md) · [`docs/lead.md`](docs/lead.md) · [`docs/dispatcher.md`](docs/dispatcher.md)

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [User Roles and Permissions](#2-user-roles-and-permissions)
3. [Complete System Flow](#3-complete-system-flow)
4. [UI and Page Flow](#4-ui-and-page-flow)
5. [Filters, Search, Sorting, and Data Views](#5-filters-search-sorting-and-data-views)
6. [Project Structure](#6-project-structure)
7. [Database Structure](#7-database-structure)
8. [API Flow](#8-api-flow)
9. [Feature Documentation](#9-feature-documentation)
10. [Authentication and Authorization](#10-authentication-and-authorization)
11. [Environment Variables and Setup](#11-environment-variables-and-setup)
12. [Unclear or Missing Information](#12-unclear-or-missing-information)
13. [Developer Notes](#13-developer-notes)

---

## 1. Project Overview

### What the platform does

The **Dispatcher Performance Platform (DPP)** is a multi-tenant SaaS web application for freight dispatch organizations. It tracks **daily load activities** per **carrier** (trucking company/driver), calculates **revenue**, **dispatch fees**, and **rate per mile**, and surfaces performance through **role-based dashboards**, **rankings**, **reports**, and **finance views**.

### Problem it solves

Dispatch organizations need a single system to:

- Assign carriers to teams and dispatchers
- Log daily load outcomes (delivered, cancelled, not booked, not working)
- Measure dispatcher and team performance
- Export financial and operational reports
- Onboard users with admin approval

### How each persona uses it

| Persona | In codebase | How they use the platform |
|---------|-------------|---------------------------|
| **Admin** | `UserRole.ADMIN` | Company-wide access: teams, dispatchers, carriers, activities, rankings, reports, daily report, settings, user registration approvals, per-dispatcher finance |
| **Team Leader** | `UserRole.TEAM_LEAD` | Team-scoped access: monitor dispatchers, carriers, activities, rankings, and reports for their assigned team; create/manage dispatchers and carriers on their team |
| **Dispatcher** | `UserRole.DISPATCHER` | Personal scope: view assigned carriers, log daily activities, track personal performance and finance, view account summary |
| **Carrier** | *Not a login role* | **Business entity** (trucking company/driver record). Carriers do not sign in. They are managed by admins/team leads and appear in dispatcher activity forms |
| **Account / Finance user** | *Not a separate role* | Finance is a **feature area**, not a role. Dispatchers use `/dispatcher/finance`; admins use `/admin/dispatchers/[id]/finance`. All roles have an **Account** page for profile/session info |

### Technology stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 16 (App Router), React 19, TypeScript |
| Styling | Tailwind CSS 4, shadcn/ui |
| Auth | Supabase Auth (`@supabase/ssr`) |
| Database | PostgreSQL (hosted via Supabase) |
| ORM / schema | Prisma 7 (schema, migrations, generate, scripts) |
| Runtime DB access | Supabase service-role client (`src/lib/db/client.ts`) |
| Forms / validation | React Hook Form, Zod |
| Charts | Recharts |
| PDF | jsPDF + jspdf-autotable (activities); `window.print()` (finance) |
| CSV | Server-generated, client download |

---

## 2. User Roles and Permissions

### Implemented user roles

Only **three** roles exist in `prisma/schema.prisma` and `src/lib/constants/roles.ts`:

```text
ADMIN | TEAM_LEAD | DISPATCHER
```

### User statuses

| Status | Meaning | UI behavior |
|--------|---------|---------------|
| `ACTIVE` | Approved and can use the app | Full access per role |
| `PENDING_APPROVAL` | Registered, awaiting admin | `PendingApprovalScreen` |
| `INACTIVE` | Deactivated | `AccessDenied` screen |
| `INVITED` | Invitation not accepted | `AccessDenied` screen |

### Data scope model

| Role | Scope | `isCompanyWide` |
|------|-------|-----------------|
| Admin | Entire organization | `true` |
| Team Lead | Single `teamId` on user record | `false` |
| Dispatcher | Own `dispatcherId` + assigned carriers/activities | `false` |

Scope is built server-side in `src/server/auth/types.ts` (`buildAccessScope`) and client-side in `src/lib/role-scope.ts` (`buildRoleScopeFromSession`).

### Permission matrix

| Capability | Admin | Team Lead | Dispatcher |
|------------|:-----:|:---------:|:----------:|
| **View** company-wide data | ✓ | — | — |
| **View** team data | ✓ | ✓ (own team) | — |
| **View** own data | ✓ | ✓ | ✓ |
| **Teams** — list | ✓ | ✓ (scoped) | — |
| **Teams** — create/edit/deactivate | ✓ | — | — |
| **Dispatchers** — list | ✓ | ✓ (team) | — |
| **Dispatchers** — create (DISPATCHER or TEAM_LEAD role) | ✓ | ✓ (team only; cannot create TEAM_LEAD) | — |
| **Dispatchers** — edit / activate / deactivate | ✓ | ✓ (team) | — |
| **Dispatchers** — finance view | ✓ (`/admin/dispatchers/[id]/finance`) | — | — |
| **Carriers** — list | ✓ | ✓ (team) | ✓ (assigned only, read-only) |
| **Carriers** — create / edit / reassign / activate / deactivate | ✓ | ✓ (team) | — |
| **Activities** — list | ✓ | ✓ (team) | ✓ (own) |
| **Activities** — create / edit | ✓ | ✓ (team carriers) | ✓ (own carriers) |
| **Activities** — PDF export | ✓ | ✓ | ✓ |
| **Rankings** | ✓ | ✓ (team) | — |
| **Reports** — view / CSV export | ✓ | ✓ (team) | — |
| **Daily Report** (admin live snapshot) | ✓ | — | — |
| **Settings** | ✓ | — | — |
| **User registration requests** — approve/reject | ✓ | — | — |
| **Self registration** | — | — | ✓ (creates pending request) |
| **Finance** — own loads/fees | — | — | ✓ |
| **Finance** — any dispatcher | ✓ | — | — |
| **Account** — profile / logout | ✓ | ✓ | ✓ |
| **Global search** | ✓ (scoped results) | ✓ | ✓ |

**Export summary**

| Export type | Admin | Team Lead | Dispatcher |
|-------------|:-----:|:---------:|:----------:|
| Reports CSV | ✓ | ✓ | — |
| Activities PDF | ✓ | ✓ | ✓ |
| Finance CSV | ✓ (per dispatcher) | — | ✓ (self) |
| Finance PDF | ✓ (print) | — | ✓ (print) |
| Admin dashboard → Reports link | ✓ | — | — |

**Delete behavior:** No hard-delete UI for core entities. Teams, dispatchers, and carriers use **soft delete** (`deletedAt`) and **deactivate** (`status` → `INACTIVE`). Activities are created/updated; no delete endpoint was found in API routes.

---

## 3. Complete System Flow

### 3.1 Login and authentication flow

```mermaid
flowchart TD
  A["User visits /"] --> B{Choose portal}
  B --> C["/admin/login"]
  B --> D["/team-lead/login"]
  B --> E["/dispatcher/login"]
  E --> F["/dispatcher/register"]
  C & D & E --> G["RoleLoginForm"]
  G --> H["POST /api/auth/login"]
  H --> I{"Supabase signInWithPassword + DB user check"}
  I -->|expectedRole match + ACTIVE| J["Set Supabase cookies + dpp_user_role cookie"]
  I -->|fail| K["Show error"]
  J --> L["Role dashboard"]
  F --> M["POST /api/auth/register"]
  M --> N["RegistrationRequest PENDING"]
  N --> O["PendingApprovalScreen on next login attempt"]
```

**Steps:**

1. User lands on `/` and picks Admin, Team Lead, or Dispatcher portal.
2. `RoleLoginForm` posts to `POST /api/auth/login` with `{ email, password, expectedRole }`.
3. Server (`src/server/auth/auth.service.ts`): Supabase password sign-in → load `User` by `supabaseUserId` → verify email, role, `ACTIVE` status.
4. On success: Supabase session cookies + httpOnly `dpp_user_role` cookie set.
5. Client `SessionProvider` loads `GET /api/auth/me` → stores `SessionUser`.
6. `RoleGuard` in role layouts validates session before rendering `DashboardShell`.

**Password reset:**

1. `/auth/reset-password` → `POST /api/auth/forgot-password` → Supabase email.
2. User follows link → `/auth/callback` (code exchange) → `/auth/update-password`.
3. `POST /api/auth/update-password` (requires authenticated session).

> **Note:** `next.config.ts` redirects `/auth/reset-password` → `/`. The page file exists at `src/app/auth/reset-password/page.tsx` but may be unreachable via that redirect.

**Logout:**

- `POST /api/auth/logout` clears session → redirect to role login with `?loggedOut=1`.

---

### 3.2 Dashboard flow

| Role | Route | API | Data loaded |
|------|-------|-----|-------------|
| Admin | `/admin/dashboard` | `GET /api/dashboard/admin` | KPIs, growth, revenue trend, loads by team, status donut, top performers, recent activities |
| Team Lead | `/team-lead/dashboard` | `GET /api/dashboard/team-lead` | Team revenue, loads, dispatcher/carrier counts, activity overview table |
| Dispatcher | `/dispatcher/dashboard` | `GET /api/dashboard/dispatcher` | Personal revenue, delivered loads, avg rate/mile, assigned carriers, today completion, pending carriers, charts, recent activities |

**Admin dashboard filter flow:** User adjusts filters → state updates → `router.replace` writes filters to URL → `useApiData` refetches → charts/tables re-render.

**Dispatcher dashboard:** `DispatcherFilterBar` → local state → refetch (URL not persisted).

---

### 3.3 Dispatcher daily activity flow

```mermaid
flowchart TD
  A["Dispatcher opens /dispatcher/activities"] --> B["Fetch activities + status reasons"]
  B --> C{"Action"}
  C -->|Add| D["ActivityModal create"]
  C -->|Edit row| E["ActivityModal edit"]
  D & E --> F["DailyActivityForm"]
  F --> G{"Status"}
  G -->|DELIVERED| H["origin, destination, miles, loadAmount"]
  G -->|Other| I["reason from StatusReason list"]
  H & I --> J["POST or PATCH /api/activities"]
  J --> K["Server: assertCarrierAccess + computeFinancials"]
  K --> L["Persist DailyActivity + upsert DailySubmission"]
  L --> M["Realtime refresh on DailyActivity table"]
```

**Rules (server):**

- One activity per carrier per date (`@@unique([carrierId, activityDate])`).
- Dispatcher can only log for carriers where `carrier.dispatcherId === scope.dispatcherId`.
- `DELIVERED` status computes `ratePerMile` and `dispatchFee` using org fee rules.
- Snapshots (carrier name, driver, team, fee %) stored on the activity row.

---

### 3.4 Carrier creation and detail view flow

**Create (Admin / Team Lead):**

1. `/admin/carriers` or `/team-lead/carriers` → **Create Carrier** button.
2. `CarrierModal` → `CarrierForm` → `POST /api/carriers`.
3. Server validates team access, creates `Carrier`, writes `AuditLog`, optionally `CarrierAssignmentHistory`.

**Dispatcher view (read-only):**

1. `/dispatcher/carriers` (`compact` mode) — excel-style filters, no create button, `readOnly` table.

**Detail view:**

- Not a standalone page. Detail panels live inside modals:
  - `CarrierDetailView` in `CarrierModal` (view mode) — shows carrier info + recent activities fetched via API.
  - Same pattern for `DispatcherDetailView`, `ActivityDetailView`, `TeamDetailView`.

**Reassign:**

- `CarrierModal` reassign mode → `POST /api/carriers/[id]/reassign` with `{ teamId, dispatcherId, notes? }`.

---

### 3.5 Team leader view flow

1. Team Lead logs in at `/team-lead/login`.
2. `RoleScopeBanner` shows team name (e.g. "Acme team view").
3. All list APIs apply `teamScopeFilter` / `carrierScopeFilter` server-side.
4. Team Lead can manage dispatchers and carriers on their team but cannot access Settings, Daily Report, User Requests, or admin-only finance routes.
5. Rankings and Reports are team-scoped via the same filter/assertion layer.

---

### 3.6 Admin management flow

| Area | Flow |
|------|------|
| **Teams** | Create → assign team lead user → activate/deactivate |
| **Dispatchers** | Create with temp password dialog → assign team + role (DISPATCHER or TEAM_LEAD) |
| **User requests** | Review pending registrations → approve (assign role + team + temp password) or reject |
| **Settings** | Edit dispatch fee rules, truck types, timezone, currency, CSV defaults, status reasons |
| **Daily report** | Select date/filters → live metrics + `LiveActivityTable` with Supabase realtime |

---

### 3.7 Account / finance flow

| User | Entry | API |
|------|-------|-----|
| Dispatcher | `/dispatcher/finance` or account summary link | `GET /api/dispatcher/finance` |
| Admin | Dispatchers table → Finance action → `/admin/dispatchers/[id]/finance` | `GET /api/admin/dispatchers/[id]/finance` |

**Finance page shows:** profile card, summary metrics (revenue, fees, loads, avg rate), load history table, carrier breakdown table.

**Export:** CSV via POST export routes; PDF via browser print (`window.print()`), not generated PDF bytes.

---

### 3.8 Reports flow

1. Admin or Team Lead opens `/admin/reports` or `/team-lead/reports`.
2. Select period tab: Daily, Weekly, Monthly, Historical, Custom.
3. Apply `ReportFilterBar` (date range, team, dispatcher, carrier, status).
4. `GET /api/reports?period=...` returns summary metrics + four breakdown tables.
5. **Export CSV** → `POST /api/reports/export` → client blob download.
6. Server logs `ReportExport` record + `REPORT_EXPORTED` audit entry.

---

### 3.9 PDF / export flow

| Export | Mechanism | Location |
|--------|-----------|----------|
| Activities PDF | Client-side jsPDF | `src/lib/reports/export-daily-activities-pdf.ts` |
| Reports CSV | Server | `src/server/services/reports.service.ts` |
| Finance CSV | Server | `src/server/services/dispatcher-finance.service.ts` |
| Finance PDF | `window.print()` | `dispatcher-finance-page-content.tsx` |

CSV row cap: `OrganizationSettings.csvMaxRows` (default 10,000).

---

### 3.10 Filter / search / sort flow

See [§5](#5-filters-search-sorting-and-data-views) for full detail.

**Summary:** Filters are page-local state or URL params. Global search (top nav) debounces 300ms, min 2 chars, calls `GET /api/search?q=`. Table column sorting is not interactive in the UI; rankings/reports sort server-side.

---

### 3.11 Refresh / reload data flow

| Mechanism | Where used |
|-----------|------------|
| Manual **Refresh** button | Admin dashboard, admin daily report, dispatcher dashboard |
| `useApiData` → `reload()` | All data pages on retry/error |
| `useRealtimeRefresh` | Activities, carriers, teams, user requests (Supabase `postgres_changes`) |
| `useDailyReportRealtime` | Admin daily report (`DailyActivity` changes) |
| Full page reload | Resets non-URL-persisted filters to defaults |

---

### 3.12 Role-based access flow

**Three layers:**

```mermaid
flowchart LR
  A["Edge: src/proxy.ts"] --> B["enforceProtectedRouteAccess"]
  B --> C["Client: RoleGuard"]
  C --> D["API: requireAccessScope"]
  D --> E["Service: scope-filters + assert*"]
```

1. **Edge** (`src/proxy.ts` → `src/lib/supabase/middleware.ts`): cookie/session refresh; redirect unauthenticated users to role login; redirect wrong-role users to their dashboard.
2. **Client** (`RoleGuard`): session status screens; wrong-role redirect.
3. **API** (`requireAccessScope`, `assertTeamAccess`, `assertDispatcherAccess`): 401/403 JSON errors.
4. **Services** (`scope-filters.ts`): Prisma/Supabase queries filtered by org + team/dispatcher.

---

### 3.13 Error / loading / empty-state flow

`PageContentGate` (`src/components/feedback/page-content-gate.tsx`) drives all list/dashboard pages:

| State | Component | Trigger |
|-------|-----------|---------|
| `loading` | `LoadingState` | `useApiData.isLoading` |
| `error` | `ErrorState` + Retry | API failure |
| `empty` | `EmptyState` + optional action | Zero rows after scope filter |
| `ready` | Page content | Data present |

Toasts (`AppToast`) show success/error for mutations (create carrier, save activity, etc.).

API envelope: `{ ok: true, data }` or `{ ok: false, error }` (`src/server/api/response.ts`).

401 from client: retry → `fetchSession` → redirect to login `?expired=1` or `/session-expired`.

---

## 4. UI and Page Flow

### 4.1 Page inventory

#### Public

| URL | File | Purpose |
|-----|------|---------|
| `/` | `src/app/page.tsx` | Portal picker (3 sign-in cards) |
| `/session-expired` | `src/app/session-expired/page.tsx` | Expired session screen |
| `/auth/reset-password` | `src/app/auth/reset-password/page.tsx` | Forgot password form |
| `/auth/update-password` | `src/app/auth/update-password/page.tsx` | Set new password |
| `/auth/callback` | `src/app/auth/callback/route.ts` | OAuth/code handler |

#### Admin (`/admin/*`)

| URL | Component | Access |
|-----|-----------|--------|
| `/admin/login` | `RoleLoginForm` | Public |
| `/admin/dashboard` | `AdminDashboardPage` | Admin |
| `/admin/teams` | `TeamsPageContent` | Admin |
| `/admin/dispatchers` | `DispatchersPageContent` | Admin |
| `/admin/dispatchers/[id]/finance` | `DispatcherFinancePageContent` (admin) | Admin |
| `/admin/carriers` | `CarriersPageContent` (compact) | Admin |
| `/admin/activities` | `ActivitiesPageContent` (full) | Admin |
| `/admin/rankings` | `RankingsPageContent` | Admin |
| `/admin/reports` | `ReportsPageContent` | Admin |
| `/admin/daily-report` | `AdminDailyReportPage` | Admin |
| `/admin/settings` | `SettingsPageContent` | Admin |
| `/admin/users/requests` | `UserRequestsPageContent` | Admin |
| `/admin/account` | `AccountPageContent` | Admin |

#### Team Lead (`/team-lead/*`)

| URL | Component | Access |
|-----|-----------|--------|
| `/team-lead/login` | `RoleLoginForm` | Public |
| `/team-lead/dashboard` | `TeamLeadDashboardPage` | Team Lead |
| `/team-lead/dispatchers` | `DispatchersPageContent` | Team Lead |
| `/team-lead/carriers` | `CarriersPageContent` (full) | Team Lead |
| `/team-lead/activities` | `ActivitiesPageContent` (full) | Team Lead |
| `/team-lead/rankings` | `RankingsPageContent` | Team Lead |
| `/team-lead/reports` | `ReportsPageContent` | Team Lead |
| `/team-lead/account` | `AccountPageContent` | Team Lead |

#### Dispatcher (`/dispatcher/*`)

| URL | Component | Access |
|-----|-----------|--------|
| `/dispatcher/login` | `RoleLoginForm` | Public |
| `/dispatcher/register` | `DispatcherRegisterForm` | Public |
| `/dispatcher/dashboard` | `DispatcherDashboardPage` | Dispatcher |
| `/dispatcher/carriers` | `CarriersPageContent` (compact, read-only) | Dispatcher |
| `/dispatcher/activities` | `ActivitiesPageContent` (compact) | Dispatcher |
| `/dispatcher/performance` | `DispatcherPerformancePage` | Dispatcher |
| `/dispatcher/finance` | `DispatcherFinancePageContent` | Dispatcher |
| `/dispatcher/account` | `AccountPageContent` + finance summary | Dispatcher |

**No `loading.tsx` or `error.tsx` route segments exist under `src/app/`.**

---

### 4.2 Shared layout shell

All authenticated role pages use:

```text
RoleProtectedLayout → RoleGuard → DashboardShell
  ├── AppSidebar (role nav from roles.ts)
  ├── TopNav (global search, account link)
  └── MainContent (page children)
```

---

### 4.3 UI elements by page type

| Page type | Cards | Tables | Buttons | Modals | Filters | Export | Refresh |
|-----------|:-----:|:------:|:-------:|:------:|:-------:|:------:|:-------:|
| Admin dashboard | KPI, metric, chart cards | Recent activities | Refresh, Export Report, filter popover | — | Date, team, dispatcher, carrier, truck, status | Link to reports | ✓ |
| Team dashboard | 4 metric cards | Team activity overview | — | — | — | — | — |
| Dispatcher dashboard | Metric, completion, pending cards | Carrier performance, recent activities | Refresh | — | Date, status, carrier, truck | — | ✓ |
| Teams | — | TeamsTable | Create Team | TeamModal | — | — | Realtime |
| Dispatchers | — | DispatchersTable | Create Dispatcher | DispatcherModal, credentials dialog | EntityFilterBar | Finance action (admin) | — |
| Carriers | — | CarriersTable | Create (non-dispatcher) | CarrierModal | Entity or Excel filters | — | Realtime |
| Activities | — | ActivitiesTable | Add Activity | ActivityModal | Entity or Excel filters | PDF | Realtime |
| Rankings | Metric summary | RankingsTable | Tab: dispatchers/carriers/teams | — | Team, dispatcher | — | — |
| Reports | Summary metrics | 4 report tables | Period tabs, Export CSV | — | ReportFilterBar | CSV | — |
| Daily report | 9 metric cards | LiveActivityTable | — | — | DailyReportFilterBar | — | ✓ + realtime |
| Settings | Settings cards | — | Save | — | — | — | — |
| User requests | — | Requests table | Approve/Reject | View, approve, reject, credentials dialogs | — | — | Realtime |
| Finance | Profile, summary cards | Load + carrier tables | Export CSV, Print PDF | — | FinanceFilterBar | CSV + print | — |
| Performance | 8 metric cards | Carriers preview (top 5) | — | — | — | — | — |
| Account | Profile card | — | Logout | — | — | — | — |

---

### 4.4 Navigation map

```mermaid
flowchart TB
  subgraph admin [Admin Sidebar]
    AD[Dashboard] --> AT[Teams]
    AT --> ADp[Dispatchers]
    ADp --> ADpf["Finance per dispatcher"]
    ADp --> AC[Carriers]
    AC --> AA[Activities]
    AA --> ARk[Rankings]
    ARk --> ARp[Reports]
    ARp --> ADr[Daily Report]
    ADr --> AS[Settings]
    AS --> AUR[User Requests]
    AUR --> AAcc[Account]
  end

  subgraph dispatcher [Dispatcher Sidebar]
    DD[Dashboard] --> DC[My Carriers]
    DC --> DA[Daily Activities]
    DA --> DP[My Performance]
    DP --> DF[Finance]
    DF --> DAcc[Account]
  end
```

**Global search** (`global-search.tsx`): navigates to role-appropriate list page with `?q=` or entity-specific query params.

**Legacy redirects** (`next.config.ts`): `/teams` → `/admin/teams`, `/dashboard/admin` → `/admin/dashboard`, etc.

---

## 5. Filters, Search, Sorting, and Data Views

### 5.1 Filter defaults

| Context | Default `dateRange` | Other defaults | Config file |
|---------|---------------------|----------------|-------------|
| Entity filters (activities, dispatchers, rankings) | `last-30-days` | All IDs = `all` | `entity-filter-params.ts` |
| Admin dashboard | `this-month` | Empty multi-selects | `admin-dashboard-filters.ts` |
| Activity excel (compact) | `last-30-days` | Empty arrays | `activity-excel-filter-params.ts` |
| Carrier excel (compact) | — | Empty arrays | `carrier-excel-filter-params.ts` |
| Dispatcher dashboard | `this-month` | All `all` | `dispatcher-filter-params.ts` |
| Finance | `this-month` | carrier/status `all` | `finance-filter-params.ts` |
| Reports | `today` | All `all` | `report-filter-params.ts` |
| Daily report | **Today's date** | team/dispatcher/status `all` | `daily-report-filter-params.ts` |

Date presets: `src/lib/constants/date-ranges.ts`, `finance-date-ranges.ts`.

---

### 5.2 Filter types by page

| Filter | Pages | Parameters |
|--------|-------|------------|
| **Date range** | Dashboards, activities, reports, finance, daily report, rankings (via entity bar) | `dateRange`, `dateFrom`, `dateTo` |
| **Team** | Admin dashboard, entity bar, reports, daily report, rankings | `teamId` |
| **Dispatcher** | Admin dashboard, entity bar, reports, daily report, rankings | `dispatcherId` |
| **Carrier** | Admin dashboard, entity bar, reports, dispatcher dashboard, finance | `carrierId` |
| **Truck type** | Admin dashboard, entity bar, carrier excel | `truckType` |
| **Status** | Admin dashboard, entity bar, reports, daily report, finance, activities | `status` / `statuses[]` |
| **Activity** | Entity bar (deep link) | `activityId` |
| **Search `q`** | Dispatchers, carriers, activities APIs | `q` (backend ILIKE) |
| **Report period** | Reports | `period`: DAILY, WEEKLY, MONTHLY, HISTORICAL, CUSTOM |

**Excel-style filters (compact pages):** Multi-select checkbox popovers for team, dispatcher, carrier, truck type, status with client-side option search (`searchPlaceholder` in popover).

---

### 5.3 Search

| Search | UI location | Min chars | Behavior |
|--------|-------------|-----------|----------|
| Global search | Top nav | 2 | Debounce 300ms, `GET /api/search`, max 8 results per group (carriers, dispatchers, activities) |
| List `q` param | API only (no EntityFilterBar input) | — | ILIKE on name/email/MC/origin/destination |
| Excel filter popovers | Compact filter controls | — | Client-side filter within option lists |

---

### 5.4 Sorting

- **No client-side column sorting** in tables.
- `@tanstack/react-table` is in `package.json` but **not imported** in `src/`.
- Server-side sort in: `rankings.service.ts`, `reports.service.ts`, `admin-dashboard.service.ts`.

---

### 5.5 Pagination

- **Not implemented.** All list endpoints return full filtered result sets.
- CSV exports capped by `csvMaxRows` (default 10,000).

---

### 5.6 URL persistence on refresh

| Page | Reads URL on load | Writes URL on Apply |
|------|:-----------------:|:-------------------:|
| Admin dashboard | ✓ | ✓ |
| Activities, carriers, dispatchers | ✓ | ✗ |
| Rankings, reports, finance, daily report, dispatcher dashboard | ✗ | ✗ |
| Global search | ✗ | ✗ |

After full page reload, non-URL pages reset filters to code defaults.

---

## 6. Project Structure

```text
dispatcher-performance-platform/
├── prisma/
│   ├── schema.prisma          # Data model (source of truth for tables)
│   └── migrations/            # SQL migrations
├── scripts/
│   ├── bootstrap.ts           # Seed org, settings, status reasons
│   ├── seed-demo-data.ts
│   ├── sync-auth-user.ts
│   ├── reset-user-password.ts
│   └── create-admin-user.ts
├── docs/                        # Role guides + integration notes
├── src/
│   ├── app/                     # Next.js App Router (pages + API)
│   │   ├── admin/               # Admin portal pages + layout
│   │   ├── team-lead/           # Team lead portal
│   │   ├── dispatcher/          # Dispatcher portal
│   │   ├── auth/                # Password reset pages + callback
│   │   └── api/                 # REST API route handlers
│   ├── components/
│   │   ├── activities/          # Activities page + excel filters + PDF button
│   │   ├── account/             # Account + dispatcher finance summary
│   │   ├── admin/               # User requests
│   │   ├── auth/                # Login, guard, session, register
│   │   ├── carriers/            # Carriers page + excel filters
│   │   ├── daily-report/        # Admin daily report
│   │   ├── dashboard/           # Role-specific dashboard widgets
│   │   ├── dashboards/          # Full dashboard page compositions
│   │   ├── details/             # Entity detail views (used in modals)
│   │   ├── dispatchers/         # Dispatchers page
│   │   ├── feedback/            # Loading, empty, error, toast, gate
│   │   ├── filters/             # Shared filter bars and fields
│   │   ├── finance/             # Finance page + tables + export
│   │   ├── forms/               # RHF forms for entities
│   │   ├── layout/              # Shell, sidebar, nav, search
│   │   ├── modals/              # Entity CRUD modals
│   │   ├── providers/           # Session + entity options
│   │   ├── rankings/            # Rankings page
│   │   ├── reports/             # Reports page
│   │   ├── settings/            # Settings page + form
│   │   ├── tables/              # Data tables per entity
│   │   └── ui/                  # shadcn primitives
│   ├── hooks/                   # useApiData, useRoleScope, realtime
│   ├── lib/
│   │   ├── api/                 # HTTP client + resource functions
│   │   ├── auth/                # Roles, permissions, session types
│   │   ├── constants/           # Enums, labels, filter options
│   │   ├── dashboard/           # Dashboard filter param builders
│   │   ├── db/                  # Supabase DB client + table names
│   │   ├── errors/              # Typed errors
│   │   ├── filters/             # URL/state filter parsing
│   │   ├── reports/             # PDF export + metrics
│   │   ├── supabase/            # Auth clients + middleware helpers
│   │   ├── utils/               # Calculations, formatting, date ranges
│   │   └── validation/          # Zod schemas for forms
│   ├── server/
│   │   ├── api/                 # Request/response helpers
│   │   ├── auth/                # Session, require-auth, auth.service
│   │   ├── mappers/             # DB row → DTO mappers
│   │   ├── services/            # Business logic per domain
│   │   └── utils/               # Scope filters, rate limit, security
│   ├── generated/prisma/        # Generated Prisma client (gitignored)
│   ├── styles/tokens.css        # Design tokens placeholder
│   └── proxy.ts                 # Edge middleware entry (session + route guard)
├── .env.example
├── next.config.ts               # Redirects, Prisma tracing includes
├── package.json
└── tsconfig.json
```

---

## 7. Database Structure

### 7.1 Database technology

| Aspect | Implementation |
|--------|----------------|
| Engine | PostgreSQL (Supabase-hosted) |
| Schema management | Prisma (`prisma/schema.prisma`, migrations) |
| Runtime queries | Supabase JS service-role client (`src/lib/db/client.ts`) |
| Auth users | Supabase Auth (`supabaseUserId` on `User`) |
| Row Level Security | **Not defined in this codebase** — access control is application-layer |

Connection env vars: `DATABASE_URL`, `DIRECT_URL`.

---

### 7.2 Tables and relationships

```mermaid
erDiagram
  Organization ||--o{ User : has
  Organization ||--o{ Team : has
  Organization ||--o{ Dispatcher : has
  Organization ||--o{ Carrier : has
  Organization ||--o{ DailyActivity : has
  Organization ||--o| OrganizationSettings : has
  Organization ||--o{ RegistrationRequest : has
  Organization ||--o{ AuditLog : has
  Organization ||--o{ ReportExport : has
  Team ||--o{ User : members
  Team ||--o| User : teamLead
  Team ||--o{ Dispatcher : has
  Team ||--o{ Carrier : has
  User ||--o| Dispatcher : profile
  Dispatcher ||--o{ Carrier : assigned
  Carrier ||--o{ DailyActivity : logs
  Dispatcher ||--o{ DailyActivity : records
  Carrier ||--o{ CarrierAssignmentHistory : history
```

#### Core tables

| Table | Purpose | Key fields |
|-------|---------|------------|
| `Organization` | Tenant | `name`, `slug`, `timezone`, `currency`, `deletedAt` |
| `User` | Login identity | `email`, `fullName`, `role`, `status`, `teamId`, `supabaseUserId` |
| `Team` | Dispatch team | `name`, `teamLeadUserId`, `status` |
| `Dispatcher` | Dispatcher profile | `userId`, `teamId`, `status` |
| `Carrier` | Trucking company/driver | `carrierName`, `driverName`, `mcNumber`, `truckType`, `teamId`, `dispatcherId`, `dispatchFeePercentage`, `status` |
| `DailyActivity` | Daily load record | `activityDate`, `carrierId`, `dispatcherId`, `teamId`, `status`, snapshots, `origin`, `destination`, `totalMiles`, `loadAmount`, `ratePerMile`, `dispatchFee`, `reason`, `notes` |
| `DailySubmission` | Daily entry completion tracker | `dispatcherId`, `submissionDate`, `carrierCount`, `activityCount` |
| `CarrierAssignmentHistory` | Reassignment audit trail | `carrierId`, `teamId`, `dispatcherId`, snapshots, `assignedAt`, `unassignedAt` |
| `StatusReason` | Org-specific cancel/not-booked reasons | `label`, `isActive`, `sortOrder` |
| `OrganizationSettings` | Fee rules, CSV defaults, truck types | `defaultDispatchFeePercent`, `minimumDispatchFee`, `roundToNearestDollar`, `allowedTruckTypes`, `csvMaxRows`, etc. |
| `RegistrationRequest` | Self-registration queue | `email`, `requestedRole`, `preferredTeamId`, `status` |
| `AuditLog` | Immutable action log | `action`, `entityType`, `entityId`, `metadata` |
| `ReportExport` | Export job record | `reportType`, `period`, `filters`, `status`, `rowCount` |

#### Enums

| Enum | Values |
|------|--------|
| `UserRole` | ADMIN, TEAM_LEAD, DISPATCHER |
| `UserStatus` | ACTIVE, PENDING_APPROVAL, INACTIVE, INVITED |
| `TeamStatus` / dispatcher status | ACTIVE, INACTIVE |
| `CarrierStatus` | ACTIVE, INACTIVE |
| `LoadActivityStatus` | DELIVERED, CANCELLED, NOT_BOOKED, NOT_WORKING |
| `TruckType` | DRY_VAN, REEFER, FLATBED, BOX_TRUCK, HOTSHOT, POWER_ONLY, CARGO_VAN |
| `RegistrationRequestStatus` | PENDING, APPROVED, REJECTED |
| `ReportExportStatus` | PENDING, COMPLETED, FAILED |
| `AuditAction` | USER_APPROVED, CARRIER_CREATED, ACTIVITY_UPDATED, REPORT_EXPORTED, … (see schema) |

#### Key constraints

- `User`: unique `(organizationId, email)`, unique `supabaseUserId`
- `Carrier`: unique `(organizationId, mcNumber)`
- `DailyActivity`: unique `(carrierId, activityDate)` — one entry per carrier per day
- `DailySubmission`: unique `(dispatcherId, submissionDate)`
- Soft delete: `deletedAt` on Organization, User, Team, Dispatcher, Carrier

---

### 7.3 Data flow: frontend → API → database

```text
Page component
  → useApiData / form submit
  → lib/api/resources.ts (apiFetch)
  → app/api/*/route.ts (handleApi wrapper)
  → requireAccessScope() + service layer
  → db().from(T.Table) — Supabase service role
  → PostgreSQL
```

Mutations also call `writeAuditLog()` where applicable.

**Prisma client** is used in `scripts/*` and `prisma generate` / build, not in runtime API services.

---

## 8. API Flow

**Base URL:** `/api`  
**Auth:** Session cookies (Supabase) on all protected routes unless noted.  
**Response shape:** `{ ok: true, data: T }` | `{ ok: false, error: string }`

### 8.1 Auth

| Route | Method | Purpose | Body / query | Roles |
|-------|--------|---------|--------------|-------|
| `/api/auth/login` | POST | Sign in | `{ email, password, expectedRole }` | Public |
| `/api/auth/logout` | POST | Sign out | — | Public |
| `/api/auth/me` | GET | Current session user | — | Public (null if unauthenticated) |
| `/api/auth/register` | POST | Self-register dispatcher | `{ fullName, email, phoneNumber, preferredTeamId?, notes? }` | Public |
| `/api/auth/forgot-password` | POST | Send reset email | `{ email }` | Public |
| `/api/auth/update-password` | POST | Set password | `{ password }` | Authenticated |

### 8.2 Health

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/health` | GET | Liveness |
| `/api/health/ready` | GET | Env + DB connectivity check |

### 8.3 Public data

| Route | Method | Purpose | Callers |
|-------|--------|---------|---------|
| `/api/public/teams` | GET | Active team list for registration | `dispatcher-register-form.tsx` |

### 8.4 Teams

| Route | Method | Auth | Purpose |
|-------|--------|------|---------|
| `/api/teams` | GET | Scoped | List teams |
| `/api/teams` | POST | Admin | Create team |
| `/api/teams/[id]` | PATCH | Admin | Update team |

### 8.5 Dispatchers

| Route | Method | Auth | Purpose |
|-------|--------|------|---------|
| `/api/dispatchers` | GET | Scoped | List (`?q, teamId, dispatcherId`) |
| `/api/dispatchers` | POST | Admin / Team Lead | Create dispatcher or team lead user |
| `/api/dispatchers/[id]` | PATCH | Admin / Team Lead | Update |
| `/api/dispatchers/[id]` | POST | Admin / Team Lead | `{ action: "activate" \| "deactivate" }` |

### 8.6 Carriers

| Route | Method | Auth | Purpose |
|-------|--------|------|---------|
| `/api/carriers` | GET | Scoped | List with filters |
| `/api/carriers` | POST | Admin / Team Lead | Create |
| `/api/carriers/[id]` | PATCH | Admin / Team Lead | Update |
| `/api/carriers/[id]/reassign` | POST | Admin / Team Lead | Reassign team/dispatcher |

### 8.7 Activities

| Route | Method | Auth | Purpose |
|-------|--------|------|---------|
| `/api/activities` | GET | Scoped | List with activity filters |
| `/api/activities` | POST | Scoped | Create daily activity |
| `/api/activities/[id]` | PATCH | Scoped | Update activity |

### 8.8 Dashboards

| Route | Method | Role | Purpose |
|-------|--------|------|---------|
| `/api/dashboard/admin` | GET | Admin | Admin dashboard bundle |
| `/api/dashboard/team-lead` | GET | Team Lead | Team dashboard metrics |
| `/api/dashboard/dispatcher` | GET | Dispatcher | Dispatcher dashboard bundle |

### 8.9 Admin-specific

| Route | Method | Role | Purpose |
|-------|--------|------|---------|
| `/api/admin/daily-report` | GET | Admin | Live daily snapshot |
| `/api/admin/dispatchers/[id]/finance` | GET | Admin | Dispatcher finance bundle |
| `/api/admin/dispatchers/[id]/finance/export` | POST | Admin | Finance CSV |

### 8.10 Rankings, reports, search

| Route | Method | Auth | Purpose |
|-------|--------|------|---------|
| `/api/rankings` | GET | Scoped | `?type=dispatcher\|carrier\|team` |
| `/api/reports` | GET | Scoped | Report bundle by period |
| `/api/reports/export` | POST | Scoped | CSV export |
| `/api/search` | GET | Scoped | `?q=` global search |

### 8.11 Settings

| Route | Method | Auth | Purpose |
|-------|--------|------|---------|
| `/api/settings` | GET | Admin | Organization settings |
| `/api/settings` | PATCH | Admin | Update settings |
| `/api/settings/status-reasons` | GET | Scoped | Active status reason labels |
| `/api/settings/dispatch-fee-rules` | GET | Scoped | Fee calculation rules |

### 8.12 User requests

| Route | Method | Auth | Purpose |
|-------|--------|------|---------|
| `/api/users/requests` | GET | Admin | Pending registration requests |
| `/api/users/requests/[id]/approve` | POST | Admin | Approve + create user |
| `/api/users/requests/[id]/reject` | POST | Admin | Reject with reason |

### 8.13 Dispatcher finance

| Route | Method | Auth | Purpose |
|-------|--------|------|---------|
| `/api/dispatcher/finance` | GET | Dispatcher | Own finance bundle |
| `/api/dispatcher/finance/export` | POST | Dispatcher | Own finance CSV |

### 8.14 Error handling

- `handleApi` catches `UnauthorizedError` → 401, `ForbiddenError` → 403, `NotFoundError` → 404, `ValidationError` → 400.
- Rate limiting on auth endpoints (`src/server/utils/rate-limit.ts`).
- Same-origin check on login/logout (`assertSameOrigin`).

---

## 9. Feature Documentation

### 9.1 Implemented features

| Feature | Status | Key locations |
|---------|--------|---------------|
| Multi-role portals (admin / team-lead / dispatcher) | ✓ Complete | `src/app/{admin,team-lead,dispatcher}/` |
| Supabase password auth + session | ✓ Complete | `src/server/auth/`, `src/lib/supabase/` |
| Dispatcher self-registration + admin approval | ✓ Complete | register form, user requests |
| Team management | ✓ Complete | `teams.service.ts`, admin teams page |
| Dispatcher CRUD + activate/deactivate | ✓ Complete | `dispatchers.service.ts` |
| Carrier CRUD + reassign + history | ✓ Complete | `carriers.service.ts` |
| Daily activity logging + financial calc | ✓ Complete | `activities.service.ts`, calc utils |
| Daily submission tracking | ✓ Complete | `upsertDailySubmission` (backend only; no dedicated UI) |
| Admin dashboard with filters + charts | ✓ Complete | `admin-dashboard-page.tsx` |
| Team lead dashboard | ✓ Complete | `team-lead-dashboard-page.tsx` |
| Dispatcher dashboard + today completion | ✓ Complete | `dispatcher-dashboard-page.tsx` |
| Dispatcher performance page | ✓ Complete | `dispatcher-performance-page.tsx` |
| Rankings (dispatchers, carriers, teams) | ✓ Complete | `rankings-page-content.tsx` |
| Reports (5 periods) + CSV export | ✓ Complete | `reports-page-content.tsx` |
| Admin daily report + realtime table | ✓ Complete | `admin-daily-report-page.tsx` |
| Finance views + CSV export | ✓ Complete | `dispatcher-finance-page-content.tsx` |
| Activities PDF export (jsPDF) | ✓ Complete | `export-daily-activities-pdf.ts` |
| Global search | ✓ Complete | `global-search.tsx` |
| Organization settings | ✓ Complete | `settings-page-content.tsx` |
| Audit logging | ✓ Complete | `audit.service.ts` |
| Realtime list refresh | ✓ Complete | `use-realtime-refresh.ts` |
| Role scope banners | ✓ Complete | `role-scope-banner.tsx` |
| Health / readiness endpoints | ✓ Complete | `api/health*` |

### 9.2 Planned, incomplete, broken, duplicated, or unclear

| Item | Status | Notes |
|------|--------|-------|
| **Carrier user role** | Not implemented | Carriers are data records, not login users |
| **Dedicated Finance/Account role** | Not implemented | Finance is a page feature for Admin + Dispatcher |
| **List pagination** | Not implemented | Full result sets returned |
| **Interactive table sorting** | Not implemented | `@tanstack/react-table` unused |
| **Entity filter search box (`q`)** | Partial | API supports `q`; `EntityFilterBar` has no search input |
| **Finance PDF** | Partial | Uses browser print, not jsPDF |
| **URL filter persistence** | Partial | Only admin dashboard writes filters to URL |
| **`/auth/reset-password` redirect** | Conflict | Page exists; `next.config.ts` redirects to `/` |
| **Root README.md** | Stale | Default Next.js boilerplate, not project-specific |
| **`docs/frontend-backend-integration-notes.md`** | Stale | References mock data; app uses live APIs |
| **Duplicate components** | Present | Multiple `StatusBadge`, `DateRangeFilter` implementations |
| **Admin carriers compact vs team-lead full** | Inconsistent UX | Different filter UIs for same entity |
| **Supabase RLS** | Not in repo | All DB access via service role; app-layer auth only |
| **`ReportExport` PENDING/FAILED flows** | Backend model only | Exports appear synchronous; async job UI not found |
| **Design tokens** | Placeholder | `src/styles/tokens.css` |
| **Route-level loading/error UI** | Missing | No `loading.tsx` / `error.tsx` in `src/app/` |
| **Activity delete** | Not implemented | Create/update only |
| **Multi-organization UI** | Not implemented | Schema supports multi-tenant; bootstrap creates one org |

---

## 10. Authentication and Authorization

### Login system

- **Provider:** Supabase Auth (email/password).
- **App user linkage:** `User.supabaseUserId` must match Supabase user after sign-in.
- **Role enforcement at login:** `expectedRole` in login body must match `User.role`.

### Session handling

| Layer | Mechanism |
|-------|-----------|
| Supabase cookies | `sb-*-auth-token` — refreshed in edge proxy |
| Role hint cookie | `dpp_user_role` (httpOnly) — used for fast route-role checks |
| Client state | `SessionProvider` + `useSession()` |
| Server | `getCurrentUser()` via Supabase `getUser()` + DB lookup |

### User role detection

1. Path prefix → `getRoleFromPathname()` (`/admin` → ADMIN, etc.)
2. Session → `SessionUser.role`
3. Cookie → `dpp_user_role` for middleware redirects

### Protected routes

| Path pattern | Protection |
|--------------|------------|
| `/admin/*` (except login) | ADMIN session |
| `/team-lead/*` (except login) | TEAM_LEAD session |
| `/dispatcher/*` (except login, register) | DISPATCHER session |
| `/api/*` (except public/auth/health) | `requireAccessScope` |

### Middleware behavior (`src/proxy.ts`)

- Matcher: all routes except static assets.
- Calls `updateSession()` → optional Supabase refresh (3s timeout) → `enforceProtectedRouteAccess()`.
- Skips refresh for public paths and when no auth cookies present on API routes.

### Redirect behavior

| Condition | Redirect |
|-----------|----------|
| Protected role path, no auth cookies | Role login (`ROLE_LOGIN_PATH`) |
| Wrong role cookie vs path | User's dashboard (`ROLE_DASHBOARD_PATH`) |
| Client: no session | `router.replace(loginPath)` |
| Client: wrong role | Own dashboard |
| API 401 | Login with `?expired=1` or `/session-expired` |

### Access restrictions by role

Enforced in services via `requireAdmin`, `requireAdminOrTeamLead`, `assertCarrierAccess`, `assertFilterAccess`, and `scope-filters.ts`.

---

## 11. Environment Variables and Setup

### Required variables (names only — do not commit secrets)

From `.env.example`:

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_APP_URL` | Public app URL (default `http://localhost:3000`) |
| `NEXT_PUBLIC_APP_NAME` | Display name |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-side DB + admin auth operations |
| `DATABASE_URL` | PostgreSQL connection (pooler) |
| `DIRECT_URL` | Direct PostgreSQL connection (migrations) |

**Also referenced in code (not in `.env.example`):**

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Alternate anon key name |
| `NODE_ENV` / `VERCEL` | Production runtime detection |
| `DEFAULT_TIMEZONE` / `DEFAULT_CURRENCY` | Bootstrap script defaults |

### Local setup

```bash
# 1. Clone / open project
cd dispatcher-performance-platform

# 2. Install dependencies
npm install

# 3. Configure environment
# Copy .env.example → .env.local and fill values

# 4. Run database migrations
npm run prisma:migrate

# 5. Bootstrap organization + default settings
npm run bootstrap

# 6. Create admin user (see scripts/create-admin-user.ts)
# 7. Optional demo data
npm run seed:demo

# 8. Start dev server
npm run dev
```

### Commands

| Command | Purpose |
|---------|---------|
| `npm run dev` | Dev server (webpack) |
| `npm run dev:turbo` | Dev server (Turbopack) |
| `npm run build` | `prisma generate` + production build |
| `npm run start` | Production server |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript check |
| `npm run test` | Unit tests (`src/**/*.test.ts`) |
| `npm run prisma:generate` | Generate Prisma client |
| `npm run prisma:migrate` | Run migrations |
| `npm run prisma:studio` | Prisma Studio GUI |
| `npm run bootstrap` | Seed org + settings |
| `npm run sync-auth-user` | Sync Supabase auth user with DB |
| `npm run reset-password` | Reset user password script |

### Supabase / database requirements

1. Create Supabase project with PostgreSQL.
2. Run Prisma migrations against `DIRECT_URL`.
3. Configure Supabase Auth (email/password enabled).
4. Set `DATABASE_URL` to pooler URL for runtime; `DIRECT_URL` for migrations.
5. Enable Supabase Realtime on tables used by `useRealtimeRefresh` if live updates are desired (`DailyActivity`, `Carrier`, `Team`, `RegistrationRequest`, `User`).
6. Service role key required — all API DB access uses service role (bypasses RLS).

---

## 12. Unclear or Missing Information

| Topic | What is missing or unclear |
|-------|---------------------------|
| **Carrier login role** | Not in codebase. "Carrier" is a managed entity only. |
| **Finance/Account user role** | Not in codebase. Finance is a feature, not a role. |
| **Supabase RLS policies** | No SQL/policy files in repo; authorization is app-layer only. |
| **Multi-organization switching** | Schema supports multiple orgs; UI assumes single org from bootstrap. |
| **`DailySubmission` UI** | Written on activity create/update; no page displays submission status beyond dispatcher dashboard "today completion". |
| **`ReportExport` async workflow** | Model supports PENDING/FAILED; exports appear synchronous in UI. |
| **Password reset page reachability** | `next.config.ts` redirect may block `/auth/reset-password`. |
| **Hard delete** | Soft delete only; no documented purge flow. |
| **Email delivery (Resend, etc.)** | Not present in current `.env.example` (differs from original foundation plan). |
| **Sentry / structured logging** | Not implemented in scanned source. |

---

## 13. Developer Notes

### Important dependencies

| Package | Usage |
|---------|-------|
| `next` 16 | App Router, `src/proxy.ts` as edge middleware |
| `@supabase/ssr` + `@supabase/supabase-js` | Auth + DB + realtime |
| `prisma` + `@prisma/client` | Schema, migrations, scripts |
| `zod` | API + form validation |
| `react-hook-form` + `@hookform/resolvers` | Forms |
| `recharts` | Dashboard charts |
| `jspdf` + `jspdf-autotable` | Activities PDF |
| `decimal.js` | Financial precision in schema |
| `date-fns` | Date formatting and ranges |

### Common debugging points

1. **401 loops:** Check Supabase cookies, `SUPABASE_SERVICE_ROLE_KEY`, and `User.supabaseUserId` linkage (`npm run sync-auth-user`).
2. **403 on team lead actions:** Verify `User.teamId` matches target resource `teamId`.
3. **Empty dispatcher dashboard:** Dispatcher needs `Dispatcher` row linked to `User` and assigned carriers.
4. **Realtime not firing:** Supabase Realtime must be enabled per table; browser client needs valid anon key.
5. **Build failures:** Run `npm run prisma:generate` — client outputs to `src/generated/prisma`.
6. **Readiness 503:** `GET /api/health/ready` — check all env vars and DB connectivity.

### Performance considerations

Documented in `docs/performance-audit-admin-login.md`:

- Edge `getUser()` runs on many routes (3s timeout).
- Duplicate auth resolution possible (middleware + API + SessionProvider).
- Admin dashboard compiles many chart components — first load can be slow.

### Repeated API calls

- `SessionProvider` calls `/api/auth/me` on mount.
- `EntityOptionsProvider` prefetches teams/dispatchers/carriers for filter dropdowns.
- Admin dashboard refetches on every filter URL change.
- Realtime subscriptions trigger full `reload()` on any matching row change (no debounce).

### Data refresh behavior

- Manual refresh buttons call `useApiData.reload()`.
- Realtime hooks call the same `reload()` — may cause rapid refetches on bulk updates.
- Non-URL filters reset on page reload.

### Possible improvements

1. Add pagination for large activity/carrier lists.
2. Unify filter UI (compact excel vs full entity bar).
3. Consolidate duplicate `StatusBadge` / `DateRangeFilter` components.
4. Wire `EntityFilterBar` search input to `q` param.
5. Persist filters to URL on all list pages.
6. Replace finance `window.print()` with jsPDF for consistent exports.
7. Add `loading.tsx` / `error.tsx` route segments.
8. Update root `README.md` to point here.
9. Resolve `/auth/reset-password` redirect conflict.
10. Consider Supabase RLS as defense-in-depth if reducing service-role surface.

### Code areas that need cleanup

- `docs/frontend-backend-integration-notes.md` — outdated mock references.
- Unused `@tanstack/react-table` dependency.
- `src/styles/tokens.css` — placeholder only.
- Admin dashboard status filter maps `IN_TRANSIT` and `BOOKED` both to `NOT_WORKING` (`admin-dashboard-filters.ts`) — verify intentional.

---

*Generated from full codebase scan. For role-specific user guides, see `docs/admin.md`, `docs/lead.md`, and `docs/dispatcher.md`.*
