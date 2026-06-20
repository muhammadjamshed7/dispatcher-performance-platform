import "server-only";

import type { AuditAction, Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db/prisma";

type AuditInput = {
  organizationId: string;
  actorUserId?: string | null;
  action: AuditAction;
  entityType: string;
  entityId?: string | null;
  metadata?: Prisma.InputJsonValue;
};

export async function writeAuditLog(input: AuditInput): Promise<void> {
  await db.auditLog.create({
    data: {
      organizationId: input.organizationId,
      actorUserId: input.actorUserId ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      metadata: input.metadata,
    },
  });
}
