# Dispatcher Guide — Dispatcher Performance Platform

This document explains what the **Dispatcher** role does, what they can access, and how the application works from a dispatcher’s day-to-day perspective.

Related docs:
- [Admin guide](./admin.md)
- [Team Lead guide](./lead.md)

---

## What is the Dispatcher role?

A **Dispatcher** manages assigned **carriers** and logs **daily activities** (loads) for each carrier every working day. Dispatchers see only **their own** data — their carriers, their activities, and their personal performance metrics.

| Aspect | Dispatcher |
|--------|------------|
| **Scope** | Personal (`dispatcherId` linked to user) |
| **Login URL** | `/dispatcher/login` |
| **Register URL** | `/dispatcher/register` |
| **Dashboard** | `/dispatcher/dashboard` |
| **Primary job** | Log daily load status for every assigned carrier |

The UI shows a **personal view banner** (e.g. “Personal view for [Your Name]”).

---

## Dispatcher navigation (sidebar)

| Menu item | URL | Purpose |
|-----------|-----|---------|
| Dashboard | `/dispatcher/dashboard` | Personal KPIs and daily completion |
| My Carriers | `/dispatcher/carriers` | View assigned carriers |
| Daily Activities | `/dispatcher/activities` | Log and edit daily entries |
| My Performance | `/dispatcher/performance` | Revenue, loads, rankings context |
| Account | `/dispatcher/account` | Profile and session |

### Pages dispatchers cannot access

- Teams, Dispatchers management, Rankings page, Reports, Settings, User Requests (admin/team lead only)

---

## How to get a Dispatcher account

### Option A — Self-registration (recommended for new hires)

1. Go to **`/dispatcher/register`**
2. Fill in:
   - Full name
   - Email
   - Phone number
   - Preferred team (from public team list)
   - Optional notes
3. Submit — creates a **pending registration request**
4. **Admin** approves at `/admin/users/requests`:
   - Assigns team
   - Sets temporary password (minimum 8 characters)
   - Creates Supabase login + Prisma user + Dispatcher record
5. Log in at **`/dispatcher/login`** with email and temporary password

### Option B — Admin or Team Lead creates you

An admin/team lead may create your profile in **Dispatchers**, but you still need a **Supabase login** linked via admin (`sync-auth-user`) or registration approval before you can sign in.

### Requirements to use the portal

Your user record must have:

- Role: `DISPATCHER`
- Status: `ACTIVE`
- Linked **`Dispatcher`** row with assigned team
- Valid Supabase auth (`supabaseUserId`)

Without a Dispatcher record, scope filters will not return your carriers or activities.

---

## Dashboard (Dispatcher)

Personal performance snapshot for the current period.

### KPI cards

| Metric | Meaning |
|--------|---------|
| **Personal Revenue** | Total delivered load amount (month-to-date) |
| **Delivered Loads** | Count of `DELIVERED` activities |
| **Avg Rate / Mile** | Average across delivered loads |
| **Assigned Carriers** | Number of active carriers assigned to you |

### Daily entry completion

Shows how many assigned carriers have an activity logged **today**:

- “Logged today: X of Y assigned carriers”
- Lists **pending carriers** still needing today’s entry
- Goal: **100% daily logging** for all assigned carriers

### Activity preview table

Recent personal activities: carrier name, status, load amount.

---

## My Carriers

View all carriers **assigned to you**.

### What dispatchers can see

- Carrier name, driver, MC number
- Truck type, dispatch fee %
- Team name
- Status (Active / Inactive)

### What dispatchers cannot do

- **Create** new carriers (API requires Admin or Team Lead)
- **Edit** carrier assignment or profile
- **Reassign** carriers to another dispatcher

If the UI shows a Create button, the action will fail at the API — contact your **Team Lead** or **Admin** to add or change carriers.

---

## Daily Activities (core workflow)

This is the **main daily task** for every dispatcher.

### Purpose

Record what happened with each assigned carrier **once per calendar day**.

### How to log an activity

1. Open **Daily Activities**
2. Click **Add Activity**
3. Select **carrier** (only your assigned carriers appear)
4. Select **date** (usually today)
5. Select **status**
6. Fill required fields for that status
7. Save

### Status types

| Status | When to use | Required information |
|--------|-------------|----------------------|
| **Delivered** | Load completed and paid | Origin, destination, total miles, load amount |
| **In Transit** | Load moving, not yet delivered | Reason (from org list) |
| **Pending** | No load booked today | Reason |
| **Canceled** | Load was canceled | Reason |

### Automatic calculations (Delivered only)

When status is **Delivered**, the system calculates:

- **Rate per mile** = load amount ÷ total miles
- **Dispatch fee** = based on org settings and carrier’s dispatch fee %

### Important rules

| Rule | Detail |
|------|--------|
| **One entry per carrier per day** | Cannot duplicate same carrier + date |
| **Active carriers only** | Inactive carriers cannot receive new activities |
| **Your carriers only** | Cannot log for another dispatcher’s carriers |
| **Edit allowed** | Update same-day or past entries via row actions |

### Example daily routine

1. Morning: log **Pending** or **In Transit** for carriers in progress
2. After delivery: update to **Delivered** with route, miles, and amount
3. End of day: ensure **every assigned carrier** has exactly one activity row for today

---

## My Performance

Personal analytics page (alternative to org Rankings page).

Typically includes:

- Personal revenue and load counts
- Ranking context vs other dispatchers (scoped data)
- Breakdown by carrier / recent performance

Use this to track your own goals and identify carriers needing follow-up.

---

## Account (Dispatcher)

View your name, email, role, and team. Sign out from the header.

Password changes: use Supabase password reset flow at `/auth/reset-password` if enabled, or ask admin to reset.

---

## Data the Dispatcher sees (scoping)

| Entity | Visibility |
|--------|------------|
| Teams | Not directly managed; team name shown on records |
| Dispatchers | Only yourself (implicit) |
| Carriers | Where `dispatcherId` = your dispatcher ID |
| Activities | Where `dispatcherId` = your dispatcher ID |
| Reports | No UI access (API is scoped if called directly) |
| Rankings page | No UI; performance page may show ranking snippets |

You **cannot** filter or view another dispatcher’s data.

---

## Authentication

1. Go to **`/dispatcher/login`**
2. Enter email and password
3. Server validates:
   - Prisma user exists
   - Role is `DISPATCHER` (not Admin or Team Lead)
   - Status is `ACTIVE`
   - Supabase credentials valid
4. Session cookie set → redirect to dashboard

**Use the correct portal.** Admin credentials on dispatcher login will be rejected.

---

## API access (Dispatcher)

| Endpoint | Access |
|----------|--------|
| `GET /api/dashboard/dispatcher` | Personal metrics |
| `GET /api/carriers` | Assigned carriers only |
| `POST /api/carriers` | ❌ Forbidden |
| `GET /api/activities` | Own activities |
| `POST /api/activities` | Own carriers only |
| `PATCH /api/activities/[id]` | Own activities only |
| `GET /api/rankings` | Scoped (no dedicated nav page) |
| Reports / Settings / Teams / User requests | ❌ No access |

Activity filters available: date range, status, carrier, truck type (within your scope).

---

## Status reasons

For non-delivered statuses, you must pick a **reason**. Reasons are configured by Admin in Settings, for example:

- Customer cancelled
- No freight available
- Equipment issue
- Driver unavailable

Exact list depends on organization configuration.

---

## Truck types (reference)

Carriers are assigned a truck type. Common values:

| Code | Label |
|------|-------|
| `DRY_VAN` | Dry Van |
| `REEFER` | Reefer |
| `FLATBED` | Flatbed |
| `BOX_TRUCK` | Box Truck |
| `HOTSHOT` | Hotshot |
| `POWER_ONLY` | Power Only |
| `CARGO_VAN` | Cargo Van |

Truck type appears on activity snapshots and reports.

---

## Dispatcher vs Team Lead vs Admin

| Task | Dispatcher | Team Lead | Admin |
|------|:----------:|:---------:|:-----:|
| Log daily activities | ✅ Own carriers | ✅ Team | ✅ All |
| View assigned carriers | ✅ | ✅ Team | ✅ All |
| Create carriers | ❌ | ✅ | ✅ |
| Manage dispatchers | ❌ | ✅ Team | ✅ All |
| View team reports | ❌ | ✅ | ✅ |
| Approve new users | ❌ | ❌ | ✅ |
| Change org settings | ❌ | ❌ | ✅ |

---

## Who to contact

| Issue | Contact |
|-------|---------|
| Need new carrier assigned | Team Lead or Admin |
| Carrier reassigned to you | Team Lead or Admin |
| Cannot log in / password | Admin |
| Registration still pending | Admin (User Requests) |
| Wrong team assignment | Admin |
| Fee % or status reason changes | Admin (Settings) |
| Dispute over activity data | Team Lead |

---

## Application overview (dispatcher lens)

The **Dispatcher Performance Platform** connects three roles:

```
Organization
 └── Teams
      └── Dispatchers (you)
           └── Carriers
                └── Daily Activities (one per carrier per day)
```

**Your success metrics:**

- **Delivery rate** — % of activities marked Delivered
- **Revenue** — sum of delivered load amounts
- **Rate per mile** — efficiency on completed loads
- **Daily completion** — all carriers logged every day

Admins see the full picture across teams. Team leads manage your team. You focus on **accurate daily logging** for every carrier assigned to you.

For platform administration, see [admin.md](./admin.md).  
For team management, see [lead.md](./lead.md).
