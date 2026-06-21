# Team Lead Guide — Dispatcher Performance Platform

This document explains what the **Team Lead** role does, what they can access, and how the application works from a team manager’s perspective.

Related docs:
- [Admin guide](./admin.md)
- [Dispatcher guide](./dispatcher.md)

---

## What is the Team Lead role?

The **Team Lead** manages **one team** within the organization. They oversee dispatchers and carriers on their team, review activities, and run team-level reports — but they **cannot** manage other teams, organization settings, or user registration approvals.

| Aspect | Team Lead |
|--------|-----------|
| **Scope** | Single team (`teamId` on user record) |
| **Login URL** | `/team-lead/login` |
| **Dashboard** | `/team-lead/dashboard` |
| **Primary job** | Run the team: dispatchers, carriers, daily ops, team performance |

The UI shows a **team-scoped banner** (e.g. “Showing data for Team Alpha”). All API responses are filtered to that team automatically.

---

## Team Lead navigation (sidebar)

| Menu item | URL | Purpose |
|-----------|-----|---------|
| Dashboard | `/team-lead/dashboard` | Team KPIs and activity preview |
| Dispatchers | `/team-lead/dispatchers` | Manage team dispatchers |
| Carriers | `/team-lead/carriers` | Manage team carriers |
| Activities | `/team-lead/activities` | View and log team activities |
| Rankings | `/team-lead/rankings` | Team-scoped rankings |
| Reports | `/team-lead/reports` | Team reports and CSV export |
| Account | `/team-lead/account` | Profile and session |

### Pages Team Leads cannot access

- Teams management (`/admin/teams`)
- Settings (`/admin/settings`)
- User Requests (`/admin/users/requests`)
- Admin-only dashboard analytics

---

## Dashboard (Team Lead)

The team lead dashboard shows **team-level metrics** for the current month (via API scope).

### KPI cards

| Metric | Meaning |
|--------|---------|
| **Team Revenue** | Delivered load revenue for the team |
| **Team Loads** | Total activity records for the team |
| **Team Dispatchers** | Count of dispatchers on the team |
| **Team Carriers** | Count of carriers assigned to the team |

### Activity preview

A table shows the **5 most recent team activities** with dispatcher, carrier, status, and load amount.

> The team lead dashboard uses a simpler layout than the admin dashboard. Cross-team charts and org-wide filters are admin-only.

---

## Dispatchers (Team Lead)

Team leads manage dispatchers **on their team only**.

### What team leads can do

- **Create dispatcher** — name, email, phone, team (fixed to their team)
- **Edit** — profile and status
- **Activate / Deactivate** — remove dispatcher from active operations

### What team leads cannot do

- Create or edit dispatchers on **another team**
- Assign someone as **Admin**
- Open the global dispatchers list for other teams

### Login note

Creating a dispatcher via the UI does **not** create a Supabase login automatically. The new user needs:

- Admin approval via registration, or
- Admin running `sync-auth-user`, or
- Manual Supabase account creation + sync

---

## Carriers (Team Lead)

Team leads manage carriers assigned to **their team**.

### Fields (same as admin, scoped to team)

- Carrier name, driver name, MC number
- Truck type, dispatch fee %
- Assigned dispatcher (must be on the same team)
- Status

### Actions

| Action | Team Lead |
|--------|:---------:|
| Create carrier | ✅ |
| Edit carrier profile | ✅ |
| Reassign to another dispatcher on **same team** | ✅ |
| Reassign to **another team** | ❌ (admin only) |
| Activate / Deactivate | ✅ |

**Reassign** closes the old assignment history record and opens a new one — full audit trail is kept.

---

## Daily Activities (Team Lead)

Team leads can **view and create/edit** daily activities for carriers on their team.

### Status types

| Status | Meaning |
|--------|---------|
| **Delivered** | Load completed — requires origin, destination, miles, amount |
| **In Transit** (`NOT_WORKING`) | Load in progress — requires reason |
| **Pending** (`NOT_BOOKED`) | Not booked yet — requires reason |
| **Canceled** | Load canceled — requires reason |

### Rules

- One activity **per carrier per day**
- Delivered loads calculate rate/mile and dispatch fee automatically
- Team leads can log activities for **any carrier on their team**, not only their personal assignments

---

## Rankings (Team Lead)

Same three ranking types as admin, but **filtered to the team**:

| Tab | Shows |
|-----|-------|
| Dispatchers | Team dispatchers ranked by active carrier count |
| Carriers | Team carriers ranked by delivery score |
| Teams | Only relevant team data in org context |

Use rankings to identify top performers and carriers needing attention.

---

## Reports (Team Lead)

Team leads have full access to the **Reports** page for their team scope.

### Available periods

- Daily, Weekly, Monthly, Historical, Custom

### Report contents

- Revenue and dispatch fee totals
- Delivered vs cancelled load counts
- Daily rows and aggregated dispatcher/carrier/team tables
- Cancellation rate, booking efficiency, average rate per mile

### CSV export

Export team-scoped data to CSV. Filename and format follow organization settings (configured by admin).

---

## Account (Team Lead)

View profile, role (`TEAM LEAD`), and linked team. Sign out from header.

---

## Data the Team Lead sees (scoping)

| Entity | Visibility |
|--------|------------|
| Teams | Own team only (read via APIs) |
| Dispatchers | Dispatchers where `teamId` = lead’s team |
| Carriers | Carriers on the same team |
| Activities | Activities on the same team |
| Reports / Rankings | Same team filter applied server-side |

Team leads **cannot** filter by another team’s ID — the API returns forbidden if attempted.

---

## How someone becomes a Team Lead

1. **Admin creates user** with role `TEAM_LEAD` and assigns a team, or
2. **Admin approves registration** and selects role `TEAM_LEAD` + team, or
3. **Admin assigns team lead** on the Teams page (`teamLeadUserId`), or
4. `npm run sync-auth-user -- email@example.com TEAM_LEAD` (creates/links user; admin should assign proper team)

Team lead must log in at **`/team-lead/login`**, not admin or dispatcher portals.

---

## Authentication

1. Email + password at `/team-lead/login`
2. Prisma user must have role `TEAM_LEAD`, status `ACTIVE`, and valid `teamId`
3. Supabase session established
4. All subsequent API calls scoped to that team

---

## API access (Team Lead)

| Endpoint | Access |
|----------|--------|
| `GET /api/dashboard/team-lead` | Team metrics |
| `GET /api/dispatchers` | Team dispatchers |
| `POST /api/dispatchers` | Create on own team |
| `PATCH /api/dispatchers/[id]` | Own team only |
| `GET/POST /api/carriers` | Team carriers |
| `PATCH /api/carriers/[id]` | Team carriers |
| `POST /api/carriers/[id]/reassign` | Within team |
| `GET/POST/PATCH /api/activities` | Team activities |
| `GET /api/rankings` | Team-scoped |
| `GET /api/reports` | Team-scoped |
| `POST /api/reports/export` | Team-scoped CSV |
| `GET /api/teams` | Own team in list |
| `GET/PATCH /api/settings` | ❌ Forbidden |
| User requests APIs | ❌ Admin only |

---

## Typical Team Lead workflows

### 1. Onboard a new dispatcher

1. Go to **Dispatchers → Add**
2. Fill profile; team is pre-scoped
3. Ensure admin creates Supabase login or approves registration
4. Assign carriers to the new dispatcher

### 2. Assign a carrier

1. **Carriers → Add**
2. Select dispatcher on your team
3. Set truck type, MC number, dispatch fee %
4. Carrier appears on dispatcher’s “My Carriers” list

### 3. Move carrier to another dispatcher

1. Open carrier → **Reassign**
2. Pick new dispatcher (same team)
3. History record updated automatically

### 4. Review daily performance

1. Open **Activities** — filter by date/status
2. Check **Dashboard** for team totals
3. Use **Reports** for weekly/monthly summaries
4. Use **Rankings** to compare dispatchers and carriers

### 5. Handle missing daily entries

Dispatchers should log one activity per assigned carrier per day. Team lead can:

- View dispatcher dashboard completion hints (dispatcher-side)
- Log or correct activities on behalf of the team if needed

---

## Team Lead vs Admin vs Dispatcher

| Capability | Admin | Team Lead | Dispatcher |
|------------|:-----:|:---------:|:----------:|
| See all teams | ✅ | ❌ | ❌ |
| Manage own team dispatchers | ✅ | ✅ | ❌ |
| Manage own team carriers | ✅ | ✅ | ❌ |
| Log team activities | ✅ | ✅ | Own carriers only |
| Team reports | ✅ | ✅ | ❌ |
| Approve registrations | ✅ | ❌ | ❌ |
| Org settings | ✅ | ❌ | ❌ |
| Self-register | ❌ | ❌ | ✅ |

---

## Truck types (reference)

Allowed values (set org-wide by admin):

- Dry Van (`DRY_VAN`)
- Reefer (`REEFER`)
- Flatbed (`FLATBED`)
- Box Truck (`BOX_TRUCK`)
- Hotshot (`HOTSHOT`)
- Power Only (`POWER_ONLY`)
- Cargo Van (`CARGO_VAN`)

---

## Support and escalation

Team leads should escalate to **Admin** for:

- New team creation or team structure changes
- Carriers moving to **another team**
- Organization settings (fees, reasons, truck types)
- User registration approvals
- Supabase login / password issues for team members
- Cross-team reporting needs

See [admin.md](./admin.md) for full platform administration.
