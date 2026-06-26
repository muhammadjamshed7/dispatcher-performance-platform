-- Performance indexes for notifications, approvals, and audit logs.
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
