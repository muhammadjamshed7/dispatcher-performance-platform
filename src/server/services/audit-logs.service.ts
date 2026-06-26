import "server-only";

import type { AuditAction } from "@/lib/db/types";
import { T, db } from "@/lib/db/client";
import { assertDb, toIsoString } from "@/lib/db/utils";
import type { AuditLogEntry } from "@/lib/types";
import type { Role } from "@/lib/constants/roles";
import type { AccessScope } from "@/server/auth/types";
import { ForbiddenError } from "@/lib/errors/forbidden-error";
import { ADMIN } from "@/lib/constants/roles";
import { actionsForStatus, deriveAuditStatus } from "@/lib/audit/audit-log-format";

type ListAuditLogsInput = {
  limit?: number;
  search?: string;
  action?: AuditAction;
  entityType?: string;
  role?: Role;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
};

function endOfDayIso(date: string): string {
  // Treat an inclusive end date (YYYY-MM-DD) as the end of that day.
  return `${date}T23:59:59.999Z`;
}

function startOfDayIso(date: string): string {
  return date.includes("T") ? date : `${date}T00:00:00.000Z`;
}

export async function listAuditLogs(
  scope: AccessScope,
  input: ListAuditLogsInput = {},
): Promise<AuditLogEntry[]> {
  if (scope.role !== ADMIN) {
    throw new ForbiddenError("Admin access is required to view logs.");
  }

  const limit = Math.min(input.limit ?? 200, 5000);

  // When filtering by actor role we first resolve the matching user IDs within
  // the organization, then constrain the logs query to those actors.
  let actorIdFilter: string[] | null = null;
  if (input.role) {
    const usersByRole = await db()
      .from(T.User)
      .select("id")
      .eq("organizationId", scope.organizationId)
      .eq("role", input.role);
    const roleUsers = assertDb(usersByRole) ?? [];
    actorIdFilter = roleUsers.map((user) => user.id as string);

    if (actorIdFilter.length === 0) {
      return [];
    }
  }

  let query = db()
    .from(T.AuditLog)
    .select("*")
    .eq("organizationId", scope.organizationId)
    .order("createdAt", { ascending: false })
    .limit(limit);

  if (input.action) {
    query = query.eq("action", input.action);
  } else if (input.status) {
    const statusActions = actionsForStatus(input.status);
    if (statusActions.length === 0) {
      return [];
    }
    query = query.in("action", statusActions);
  }

  if (input.entityType) {
    query = query.eq("entityType", input.entityType);
  }

  if (actorIdFilter) {
    query = query.in("actorUserId", actorIdFilter);
  }

  if (input.dateFrom) {
    query = query.gte("createdAt", startOfDayIso(input.dateFrom));
  }

  if (input.dateTo) {
    query = query.lte("createdAt", endOfDayIso(input.dateTo));
  }

  const result = await query;
  const rows = assertDb(result) ?? [];

  const actorIds = [
    ...new Set(
      rows
        .map((row) => row.actorUserId as string | null)
        .filter((id): id is string => Boolean(id)),
    ),
  ];

  const usersResult =
    actorIds.length > 0
      ? await db()
          .from(T.User)
          .select("id, fullName, email, role, team:Team!User_teamId_fkey(name)")
          .in("id", actorIds)
      : { data: [], error: null };

  const users = assertDb(usersResult) ?? [];
  const userMap = new Map(
    users.map((user) => [
      user.id as string,
      {
        fullName: user.fullName as string,
        email: user.email as string,
        role: user.role as AuditLogEntry["actorRole"],
        teamName:
          (Array.isArray(user.team)
            ? user.team[0]?.name
            : (user.team as { name: string } | null)?.name) ?? null,
      },
    ]),
  );

  const entries: AuditLogEntry[] = rows.map((row) => {
    const metadata = (row.metadata ?? {}) as Record<string, unknown>;
    const actor = row.actorUserId
      ? userMap.get(row.actorUserId as string)
      : null;
    const action = row.action as string;

    return {
      id: row.id as string,
      action,
      entityType: row.entityType as string,
      entityId: (row.entityId as string | null) ?? null,
      actorName:
        actor?.fullName ?? (metadata.actorName as string | null) ?? null,
      actorRole:
        actor?.role ?? (metadata.role as AuditLogEntry["actorRole"]) ?? null,
      teamName:
        (metadata.teamName as string | null) ??
        actor?.teamName ??
        (metadata.teamNameSnapshot as string | null) ??
        null,
      dispatcherName:
        (metadata.dispatcherName as string | null) ??
        (metadata.dispatcherNameSnapshot as string | null) ??
        null,
      approvalStatus:
        (metadata.approvalStatus as AuditLogEntry["approvalStatus"]) ?? null,
      status: deriveAuditStatus(action),
      notes:
        (metadata.reason as string | null) ??
        (metadata.approvalNotes as string | null) ??
        null,
      oldData:
        (metadata.previousData as Record<string, unknown> | null) ??
        (metadata.oldData as Record<string, unknown> | null) ??
        null,
      newData:
        (metadata.proposedChanges as Record<string, unknown> | null) ??
        (metadata.newData as Record<string, unknown> | null) ??
        null,
      createdAt: toIsoString(row.createdAt as string),
    };
  });

  const search = input.search?.trim().toLowerCase();
  if (!search) {
    return entries;
  }

  return entries.filter((entry) => {
    const haystack = [
      entry.actorName,
      entry.actorRole,
      entry.action,
      entry.entityType,
      entry.entityId,
      entry.teamName,
      entry.dispatcherName,
      entry.notes,
      entry.status,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return haystack.includes(search);
  });
}
