import "server-only";

import type { AuditAction } from "@/lib/db/types";
import { T, db } from "@/lib/db/client";
import { assertDb, toIsoString } from "@/lib/db/utils";
import type { AuditLogEntry } from "@/lib/types";
import type { AccessScope } from "@/server/auth/types";
import { ForbiddenError } from "@/lib/errors/forbidden-error";
import { ADMIN } from "@/lib/constants/roles";

type ListAuditLogsInput = {
  limit?: number;
  entityType?: string;
  action?: AuditAction;
};

export async function listAuditLogs(
  scope: AccessScope,
  input: ListAuditLogsInput = {},
): Promise<AuditLogEntry[]> {
  if (scope.role !== ADMIN) {
    throw new ForbiddenError("Admin access is required to view logs.");
  }

  const limit = Math.min(input.limit ?? 200, 500);

  let query = db()
    .from(T.AuditLog)
    .select("*")
    .eq("organizationId", scope.organizationId)
    .order("createdAt", { ascending: false })
    .limit(limit);

  if (input.entityType) {
    query = query.eq("entityType", input.entityType);
  }

  if (input.action) {
    query = query.eq("action", input.action);
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
          .select("id, fullName, role, team:Team!User_teamId_fkey(name)")
          .in("id", actorIds)
      : { data: [], error: null };

  const users = assertDb(usersResult) ?? [];
  const userMap = new Map(
    users.map((user) => [
      user.id as string,
      {
        fullName: user.fullName as string,
        role: user.role as AuditLogEntry["actorRole"],
        teamName:
          (Array.isArray(user.team)
            ? user.team[0]?.name
            : (user.team as { name: string } | null)?.name) ?? null,
      },
    ]),
  );

  return rows.map((row) => {
    const metadata = (row.metadata ?? {}) as Record<string, unknown>;
    const actor = row.actorUserId
      ? userMap.get(row.actorUserId as string)
      : null;

    return {
      id: row.id as string,
      action: row.action as string,
      entityType: row.entityType as string,
      entityId: (row.entityId as string | null) ?? null,
      actorName: actor?.fullName ?? null,
      actorRole: actor?.role ?? null,
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
}
