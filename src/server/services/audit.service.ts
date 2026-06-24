import "server-only";

import type { AuditAction, JsonValue } from "@/lib/db/types";
import { T, db } from "@/lib/db/client";
import { assertDbVoid, createId, nowIso } from "@/lib/db/utils";

type AuditInput = {
  organizationId: string;
  actorUserId?: string | null;
  action: AuditAction;
  entityType: string;
  entityId?: string | null;
  metadata?: JsonValue;
};

export async function writeAuditLog(input: AuditInput): Promise<void> {
  const result = await db()
    .from(T.AuditLog)
    .insert({
      id: createId(),
      organizationId: input.organizationId,
      actorUserId: input.actorUserId ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      metadata: input.metadata ?? null,
      createdAt: nowIso(),
    });

  assertDbVoid(result);
}
