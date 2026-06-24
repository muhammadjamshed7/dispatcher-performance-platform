import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const globalForDb = globalThis as unknown as {
  supabaseAdmin: ReturnType<typeof createSupabaseAdminClient> | undefined;
};

/** Server-side Supabase client (service role) for all database access. */
export function db() {
  if (!globalForDb.supabaseAdmin) {
    globalForDb.supabaseAdmin = createSupabaseAdminClient();
  }

  return globalForDb.supabaseAdmin;
}

/** PascalCase Postgres table names (Prisma schema). */
export const T = {
  Organization: "Organization",
  User: "User",
  Team: "Team",
  Dispatcher: "Dispatcher",
  Carrier: "Carrier",
  CarrierAssignmentHistory: "CarrierAssignmentHistory",
  DailyActivity: "DailyActivity",
  DailySubmission: "DailySubmission",
  StatusReason: "StatusReason",
  OrganizationSettings: "OrganizationSettings",
  RegistrationRequest: "RegistrationRequest",
  AuditLog: "AuditLog",
  ReportExport: "ReportExport",
} as const;
