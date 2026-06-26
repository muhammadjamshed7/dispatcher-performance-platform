import { handleApi } from "@/server/api/response";
import { requireAccessScope } from "@/server/auth/require-auth";
import { ADMIN } from "@/lib/constants/roles";
import type { AuditAction } from "@/lib/db/types";
import { listAuditLogs } from "@/server/services/audit-logs.service";

export async function GET(request: Request) {
  return handleApi(async () => {
    const { scope } = await requireAccessScope(ADMIN);
    const url = new URL(request.url);
    const limit = Number(url.searchParams.get("limit") ?? "200");
    const entityType = url.searchParams.get("entityType") ?? undefined;
    const action = url.searchParams.get("action") as AuditAction | null;
    return listAuditLogs(scope, {
      limit: Number.isFinite(limit) ? limit : 200,
      entityType,
      action: action ?? undefined,
    });
  });
}
