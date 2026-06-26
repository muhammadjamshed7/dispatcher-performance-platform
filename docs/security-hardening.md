# Security and Performance Hardening

This document captures recommended follow-up work for production deployment. Runtime database access uses the Supabase service-role client from API routes only; browser clients use anon auth plus Realtime subscriptions.

## Row Level Security (RLS)

Enable RLS on all tenant-scoped tables and deny-by-default policies:

| Table | Policy intent |
| --- | --- |
| `User`, `Team`, `Dispatcher`, `Carrier`, `DailyActivity`, `DailySubmission`, `ActivityEditRequest`, `Notification`, `AuditLog`, `RegistrationRequest` | Restrict rows to `organizationId` matching the authenticated user's organization |
| `Notification` | Additional `recipientUserId = auth.uid()` mapping via `User.supabaseUserId` |
| `DailyActivity` | Dispatchers: `dispatcherId` matches their dispatcher record; Team leads: `teamId` in scope; Admins: organization-wide |
| `ActivityEditRequest` | Same scope rules as underlying activity team/dispatcher |

Service-role API routes bypass RLS today. After RLS is enabled, keep using the service role only on the server and never expose it to the browser. Realtime channels should use authenticated Supabase sessions with policies that mirror API scope rules.

## Indexes

Existing migrations include core indexes. Consider adding:

```sql
CREATE INDEX IF NOT EXISTS "Notification_recipientUserId_readAt_idx"
  ON "Notification" ("recipientUserId", "readAt");

CREATE INDEX IF NOT EXISTS "Notification_organizationId_createdAt_idx"
  ON "Notification" ("organizationId", "createdAt" DESC);

CREATE INDEX IF NOT EXISTS "DailyActivity_org_team_approval_date_idx"
  ON "DailyActivity" ("organizationId", "teamId", "approvalStatus", "activityDate" DESC);

CREATE INDEX IF NOT EXISTS "ActivityEditRequest_org_status_created_idx"
  ON "ActivityEditRequest" ("organizationId", "approvalStatus", "createdAt" DESC);

CREATE INDEX IF NOT EXISTS "AuditLog_organizationId_createdAt_idx"
  ON "AuditLog" ("organizationId", "createdAt" DESC);
```

## Pagination

High-volume list endpoints should accept `cursor` or `page` + `pageSize` and return `{ items, nextCursor, total }`:

- `/api/notifications` — default `pageSize=50`
- `/api/admin/logs` — default `pageSize=100`
- `/api/activities` — enforce max `pageSize=200` for exports and dashboards

Client hooks should pass pagination params instead of loading full tables on dashboard previews (detail modals already cap at three approved activities).

## Reduced API Calls

- Realtime refresh is debounced (400ms) in `use-realtime-refresh.ts`; memoize table arrays in each subscriber.
- Notification dropdown loads only when opened if unread polling becomes heavy.
- Detail views should prefer scoped query params (`approvalStatus=APPROVED`, entity ids) over client-side filtering of full lists where possible.

## Windows build note

On case-insensitive filesystems (Windows), opening the repo as `D:\Projects\...` while the canonical path is `D:\projects\...` can duplicate Next.js modules and break `next build` with `Expected workStore to be initialized` during `/_global-error` prerender. The `npm run build` script resolves the canonical path via `fs.realpathSync.native()` and pins Turbopack/webpack roots in `next.config.ts`. Prefer opening the project using the lowercase path shown by:

```bash
node -e "console.log(require('fs').realpathSync.native(process.cwd()))"
```

## Realtime Publication

Ensure Supabase Realtime publication includes: `Notification`, `ActivityEditRequest`, `AuditLog`, `DailyActivity`, `DailySubmission`, `Carrier`, `Team`, `RegistrationRequest`, `User`.
