# Frontend → Backend Integration Notes

Short reference for replacing mock frontend data with Supabase/backend services.

## Auth & Session

**Replace:** `src/lib/auth/mock-session.ts`, `MockSessionProvider`, login/register forms.

**Required session fields:**

- `userId` (Supabase auth user id)
- `fullName`, `email`
- `role`: `ADMIN` | `TEAM_LEAD` | `DISPATCHER`
- `status`: `ACTIVE` | `PENDING_APPROVAL` | `INACTIVE` | `INVITED`
- `teamId` (nullable)
- `dispatcherId` (nullable, for dispatcher profile link)

**Pages:**

- `/admin/login`, `/team-lead/login`, `/dispatcher/login`
- `/dispatcher/register`
- `/session-expired` (placeholder until real expiry handling)

**Env:** `INITIAL_ADMIN_EMAILS` in `.env.example` → backend seed script only.

---

## User Approval Flow

**Replace:** `mockPendingUserRequests` in `src/lib/mock-data.ts`, `/admin/users/requests` mock modals.

**Required fields per request:**

- `id`, `fullName`, `email`, `phoneNumber`
- `requestedRole` (`TEAM_LEAD` | `DISPATCHER`)
- `preferredTeam`, `notes`, `status`, `submittedAt`

**Rules:** Dispatcher self-register → `PENDING_APPROVAL`. Admin approves/rejects, assigns role + team.

---

## Pages Needing Backend Data

| Area                 | Routes                                   | Mock source                                         |
| -------------------- | ---------------------------------------- | --------------------------------------------------- |
| Admin dashboard      | `/admin/dashboard`                       | `mockAdminMetrics`, `mockActivities`                |
| Team Lead dashboard  | `/team-lead/dashboard`                   | `mockTeamLeadMetrics`, scoped filters               |
| Dispatcher dashboard | `/dispatcher/dashboard`                  | `mockDispatcherMetrics`, scoped carriers/activities |
| Teams                | `/admin/teams`                           | `mockTeams`                                         |
| Dispatchers          | `/admin/*`, `/team-lead/dispatchers`     | `mockDispatchers`                                   |
| Carriers             | all role carrier routes                  | `mockCarriers`                                      |
| Activities           | all role activity routes                 | `mockActivities`                                    |
| Rankings             | `/admin/rankings`, `/team-lead/rankings` | `mock*Rankings`                                     |
| Reports              | `/admin/reports`, `/team-lead/reports`   | `mockDailyReport`, etc.                             |
| Settings             | `/admin/settings`                        | `mockAppSettings`                                   |
| User requests        | `/admin/users/requests`                  | `mockPendingUserRequests`                           |
| Performance          | `/dispatcher/performance`                | `mockDailyReport.dispatchers`, rankings             |
| Account              | `/*/account`                             | mock session + user profile                         |

---

## Entity Field Expectations

**User:** `id`, `fullName`, `email`, `role`, `status`, `teamId`, `dispatcherId`, `phoneNumber?`

**Team:** `id`, `name`, `teamLeadName`, `status`, counts, `createdAt`

**Dispatcher:** `id`, `fullName`, `email`, `phoneNumber`, `teamName`, `role`, `status`, `assignedCarriersCount`, `createdAt`

**Carrier:** `id`, `carrierName`, `driverName`, `mcNumber`, `truckType`, assignment fields, `status`

**DailyActivity:** `id`, `date`, `dispatcherName`, `teamName`, `carrierName`, `status`, amounts, miles, fees, `notes`

**Reports/Rankings:** revenue, dispatch fees, load counts, rates — see `src/lib/types.ts`

---

## Centralized Frontend Modules (keep these paths)

- **Mock data:** `src/lib/mock-data.ts` → API/query layer
- **Types:** `src/lib/types.ts`
- **Auth/roles:** `src/lib/auth/*` (`roles.ts`, `permissions.ts`, `user-statuses.ts`)
- **Formatting:** `src/lib/utils/format-*.ts`
- **Validation:** `src/lib/validation/*`
- **Role scoping:** `src/lib/role-scope.ts`, `useRoleScope`

---

## Suggested Backend Hook-in Order

1. Supabase Auth + user profile table (roles/status/team)
2. Admin seed from `INITIAL_ADMIN_EMAILS`
3. User approval API + `/admin/users/requests`
4. Teams → Dispatchers → Carriers → Activities
5. Reports, rankings, settings, dispatcher performance aggregates

---

## Still Mock-Only (until backend phase)

- Client-side session (localStorage)
- No server middleware auth
- Registration/approval actions do not persist
- Last login on account page is a placeholder
