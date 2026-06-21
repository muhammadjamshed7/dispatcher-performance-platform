# Admin Guide — Dispatcher Performance Platform

This document explains what the **Admin** role does, what they can access, and how the full application works from an administrator’s perspective.

Related docs:
- [Team Lead guide](./lead.md)
- [Dispatcher guide](./dispatcher.md)

---

## What is the Admin role?

The **Admin** is the organization owner / platform operator. Admins have **company-wide access** to every team, dispatcher, carrier, activity, report, and setting in the organization.

| Aspect | Admin |
|--------|-------|
| **Scope** | Entire organization (all teams) |
| **Login URL** | `/admin/login` |
| **Dashboard** | `/admin/dashboard` |
| **Primary job** | Operate the platform, approve users, manage teams, monitor performance |

Admins see a banner or context indicating **company-wide view**. No data is hidden from an active admin unless filters are applied on the dashboard.

---

## Admin navigation (sidebar)

| Menu item | URL | Purpose |
|-----------|-----|---------|
| Dashboard | `/admin/dashboard` | KPIs, charts, filters, recent activity |
| Teams | `/admin/teams` | Create and manage teams |
| Dispatchers | `/admin/dispatchers` | Manage dispatchers and team leads |
| Carriers | `/admin/carriers` | Manage carriers across all teams |
| Activities | `/admin/activities` | View and log daily load activities |
| Rankings | `/admin/rankings` | Dispatcher, carrier, and team rankings |
| Reports | `/admin/reports` | Revenue, loads, fees — export CSV |
| Settings | `/admin/settings` | Organization rules and defaults |
| User Requests | `/admin/users/requests` | Approve or reject registration requests |
| Account | `/admin/account` | Profile and session info |

---

## Dashboard (Admin)

The admin dashboard is the main analytics screen. All numbers come from real database records (no demo data).

### KPI cards (6 metrics)

| Metric | Meaning |
|--------|---------|
| **Total Revenue** | Sum of delivered load amounts in the selected period |
| **Total Loads** | Count of all daily activity records |
| **Delivered Loads** | Activities with status `DELIVERED` |
| **Active Dispatchers** | Dispatchers with `ACTIVE` status |
| **On-Time Rate** | Delivered loads ÷ total loads (as %) |
| **Monthly Growth** | Revenue change vs the previous period |

Each card shows growth vs the prior period when data exists.

### Charts and tables

- **Revenue Trend** — daily delivered revenue over time
- **Loads by Team** — load count per team
- **Load Status Breakdown** — donut chart: Delivered, In Transit, Pending, Canceled
- **Top Performers** — top 3 dispatchers by delivered revenue
- **Recent Daily Activities** — latest 5 activity rows

### Filters

Admins can filter the entire dashboard by:

- Date range (today, last 7/30 days, this month, last month)
- Team
- Dispatcher
- Carrier
- Truck type
- Status

**Reset Filters** clears all filters back to defaults.

---

## Teams (Admin only)

Teams group dispatchers and carriers.

### What admins can do

- **Create team** — name, status, optional team lead assignment
- **Edit team** — update name, status, team lead
- **Deactivate team** — soft-delete; team no longer active in lists

### Team fields

- Team name
- Status (`ACTIVE` / `INACTIVE`)
- Team lead (linked user with `TEAM_LEAD` role)
- Counts: dispatchers and carriers on the team

Only admins can create or modify teams. Team leads can **view** their own team via scoped APIs but cannot open the Teams page.

---

## Dispatchers (Admin)

Dispatchers are users who manage assigned carriers and log daily activities.

### What admins can do

- **Create dispatcher** — full name, email, phone, team, role (`DISPATCHER` or `TEAM_LEAD`)
- **Edit** — profile, team, role, status
- **Activate / Deactivate** — deactivation sets user inactive and soft-deletes dispatcher record

### Important: login accounts

Creating a dispatcher in the UI creates a **Prisma user + Dispatcher record** but does **not** automatically create a Supabase login.

To give someone login access:

1. Create the user in **Supabase Dashboard → Authentication**, or
2. Approve a **registration request** (creates Supabase + Prisma), or
3. Run: `npm run sync-auth-user -- email@example.com DISPATCHER`

For dispatchers, also ensure a **Dispatcher** row exists and carriers are assigned.

---

## Carriers (Admin)

Carriers are trucking companies / loads under a dispatcher and team.

### Fields

| Field | Description |
|-------|-------------|
| Carrier name | Business name |
| Driver name | Primary driver contact |
| MC number | Unique per organization |
| Truck type | e.g. Dry Van, Reefer, Flatbed |
| Dispatch fee % | Percentage used in fee calculations |
| Team | Owning team |
| Dispatcher | Assigned dispatcher |
| Status | Active / Inactive |

### Actions

- **Create** — assigns team + dispatcher; opens assignment history
- **Edit** — update profile fields (not team/dispatcher via edit alone)
- **Reassign** — move carrier to new team + dispatcher; history is tracked
- **Activate / Deactivate**

---

## Daily Activities (Admin)

Daily activities record what happened with each carrier on a given day.

### Status types

| Status | UI label | Required fields |
|--------|----------|-----------------|
| `DELIVERED` | Delivered | Origin, destination, miles, load amount |
| `NOT_WORKING` | In Transit | Reason |
| `NOT_BOOKED` | Pending | Reason |
| `CANCELLED` | Canceled | Reason |

### Rules

- **One activity per carrier per calendar day** (unique constraint)
- **Delivered** loads auto-calculate:
  - Rate per mile = load amount ÷ total miles
  - Dispatch fee from org settings and carrier fee %
- Reasons for non-delivered statuses come from **Settings → Status reasons**
- Admins can create/edit activities for **any** carrier in the organization

---

## Rankings (Admin)

Three ranking tabs:

| Type | Ranked by |
|------|-----------|
| **Dispatchers** | Number of active assigned carriers |
| **Carriers** | Activity score (% delivered) |
| **Teams** | Total delivered revenue |

Data is organization-wide for admins.

---

## Reports (Admin)

Reports provide aggregated business intelligence.

### Periods

- Daily
- Weekly
- Monthly
- Historical (all time)
- Custom (requires date range)

### Report bundle includes

- Summary: revenue, dispatch fees, delivered/cancelled loads, active carriers
- Daily breakdown rows
- Aggregated tables by dispatcher, carrier, and team
- Metrics: cancellation rate, booking efficiency, avg rate/mile

### CSV export

- Click export on the Reports page
- Server generates CSV using org settings (headers, date format, max rows, filename prefix)
- Export is logged in audit trail

---

## Settings (Admin only)

Organization-wide configuration.

### Dispatch fees

- Calculation method
- Default dispatch fee percentage
- Minimum fee
- Round to nearest dollar option

### Truck types

Allowed truck types for carriers and activities (e.g. `DRY_VAN`, `REEFER`, `FLATBED`).

### Status reasons

Predefined reasons for `CANCELLED`, `NOT_BOOKED`, `NOT_WORKING` activities.

### Other

- Timezone
- CSV export defaults (headers, date format, max rows, filename prefix)

> **Note:** The settings UI is currently **read-only display**. Updates are available via `PATCH /api/settings` if needed programmatically.

---

## User Requests (Admin only)

Handles **dispatcher self-registration** from `/dispatcher/register`.

### Registration flow

1. Applicant submits: name, email, phone, preferred team, notes
2. Request stored as `PENDING`
3. Admin opens **User Requests**
4. **Approve** — choose team, role (`DISPATCHER` or `TEAM_LEAD`), temporary password (min 8 chars)
   - Creates Supabase auth user
   - Creates active Prisma user
   - Creates Dispatcher row if role is `DISPATCHER`
5. **Reject** — optional reason; applicant cannot log in

Self-registration requests are always submitted as **DISPATCHER**; admin may approve as Team Lead if appropriate.

---

## Account (Admin)

View profile information, role, and session details. Sign out from the header or account page.

---

## Data the Admin sees (scoping)

| Entity | Admin visibility |
|--------|------------------|
| Teams | All teams |
| Dispatchers | All dispatchers |
| Carriers | All carriers |
| Activities | All activities |
| Reports / Rankings | Organization-wide |

Admins may filter by any team or dispatcher. Other roles cannot filter outside their scope.

---

## Authentication (Admin setup)

### First-time setup

1. Configure environment variables (`.env` — see `.env.example`)
2. Run migrations: `npm run prisma:migrate`
3. Bootstrap org: `npm run bootstrap`
4. Create admin in **Supabase Authentication**
5. Link to Prisma:  
   `npm run sync-auth-user -- admin@company.com ADMIN`

### Login flow

1. User enters email + password at `/admin/login`
2. Server checks Prisma user exists, role is `ADMIN`, status is `ACTIVE`
3. Supabase `signInWithPassword`
4. Session cookie set; user redirected to dashboard

Wrong portal (e.g. admin creds on dispatcher login) is rejected.

---

## API access (Admin)

Admins can call all authenticated APIs. Key endpoints:

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/dashboard/admin` | GET | Full dashboard bundle + filters |
| `/api/teams` | GET, POST | List / create teams |
| `/api/teams/[id]` | PATCH | Update team |
| `/api/dispatchers` | GET, POST | List / create dispatchers |
| `/api/dispatchers/[id]` | PATCH, POST | Update / activate / deactivate |
| `/api/carriers` | GET, POST | List / create carriers |
| `/api/carriers/[id]` | PATCH | Update carrier |
| `/api/carriers/[id]/reassign` | POST | Reassign carrier |
| `/api/activities` | GET, POST | List / create activities |
| `/api/activities/[id]` | PATCH | Update activity |
| `/api/rankings?type=` | GET | Rankings |
| `/api/reports` | GET | Report bundle |
| `/api/reports/export` | POST | CSV export |
| `/api/settings` | GET, PATCH | Org settings |
| `/api/users/requests` | GET | Pending registrations |
| `/api/users/requests/[id]/approve` | POST | Approve user |
| `/api/users/requests/[id]/reject` | POST | Reject user |

Query filters: `dateFrom`, `dateTo`, `status`, `teamId`, `dispatcherId`, `carrierId`, `truckType`

---

## Audit trail

Sensitive actions are logged: user approve/reject, team CRUD, dispatcher CRUD, carrier CRUD/reassign, activity CRUD, settings updates, report exports.

---

## Deployment notes

- **Stack:** Next.js 16, React 19, Prisma, PostgreSQL (Supabase), Supabase Auth
- **Production:** Deploy on Vercel; use Supabase **pooler URLs** for `DATABASE_URL`
- **Health check:** `GET /api/health/ready` — validates DB and env
- **Scripts:**
  - `npm run bootstrap` — org + default settings
  - `npm run sync-auth-user` — link Supabase user to Prisma
  - `npm run seed:demo` — optional demo data

---

## Admin vs Team Lead vs Dispatcher (quick comparison)

| Capability | Admin | Team Lead | Dispatcher |
|------------|:-----:|:---------:|:----------:|
| All teams | ✅ | ❌ (own team) | ❌ |
| Manage teams | ✅ | ❌ | ❌ |
| Manage dispatchers | ✅ | ✅ (team) | ❌ |
| Manage carriers | ✅ | ✅ (team) | ❌ (view only) |
| Log activities | ✅ | ✅ (team) | ✅ (own carriers) |
| Rankings | ✅ | ✅ (team) | ❌ (performance page) |
| Reports | ✅ | ✅ (team) | ❌ |
| Settings | ✅ | ❌ | ❌ |
| User requests | ✅ | ❌ | ❌ |
| Rich admin dashboard | ✅ | ❌ | ❌ |

See [lead.md](./lead.md) and [dispatcher.md](./dispatcher.md) for the other roles.
