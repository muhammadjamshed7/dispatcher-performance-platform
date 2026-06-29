import { z } from "zod";

import { ADMIN } from "@/lib/constants/roles";
import type { JsonValue } from "@/lib/db/types";
import { ForbiddenError } from "@/lib/errors/forbidden-error";
import { ValidationError } from "@/lib/errors/validation-error";
import { parseJsonBody } from "@/server/api/request";
import { handleApi } from "@/server/api/response";
import { requireAccessScope } from "@/server/auth/require-auth";
import { writeAuditLog } from "@/server/services/audit.service";

const exportEventBodySchema = z.object({
  action: z.enum([
    "ACTIVITY_EXPORTED",
    "CARRIER_EXPORTED",
    "AUDIT_LOGS_EXPORTED",
  ]),
  entityType: z.enum(["DailyActivity", "Carrier", "AuditLog"]),
  entityId: z.string().nullable().optional(),
  entityName: z.string().trim().optional(),
  format: z.enum(["csv", "pdf"]).default("pdf"),
  rowCount: z.number().int().min(0).optional(),
  filters: z.record(z.string(), z.unknown()).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

const ENTITY_TYPE_BY_ACTION = {
  ACTIVITY_EXPORTED: "DailyActivity",
  CARRIER_EXPORTED: "Carrier",
  AUDIT_LOGS_EXPORTED: "AuditLog",
} as const;

export async function POST(request: Request) {
  return handleApi(async () => {
    const { user, scope } = await requireAccessScope();
    const body = await parseJsonBody(request, exportEventBodySchema);

    if (body.entityType !== ENTITY_TYPE_BY_ACTION[body.action]) {
      throw new ValidationError("Invalid audit export event.");
    }

    if (body.action === "AUDIT_LOGS_EXPORTED" && scope.role !== ADMIN) {
      throw new ForbiddenError(
        "Admin access is required to export audit logs.",
      );
    }

    await writeAuditLog({
      organizationId: scope.organizationId,
      actorUserId: user.id,
      action: body.action,
      entityType: body.entityType,
      entityId: body.entityId ?? null,
      metadata: {
        ...body.metadata,
        entityName: body.entityName ?? body.metadata?.entityName,
        format: body.format,
        rowCount: body.rowCount ?? null,
        filters: body.filters ?? null,
      } as JsonValue,
    });

    return { success: true };
  }, request);
}
