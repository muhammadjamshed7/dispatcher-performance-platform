import { handleApi } from "@/server/api/response";
import { requireAccessScope } from "@/server/auth/require-auth";
import { ADMIN } from "@/lib/constants/roles";
import type { Role } from "@/lib/constants/roles";
import type { AuditAction } from "@/lib/db/types";
import { listAuditLogs } from "@/server/services/audit-logs.service";

const ROLES: Role[] = ["ADMIN", "TEAM_LEAD", "DISPATCHER"];

export async function GET(request: Request) {
  return handleApi(async () => {
    const { scope } = await requireAccessScope(ADMIN);
    const url = new URL(request.url);
    const params = url.searchParams;

    const limit = Number(params.get("limit") ?? "200");
    const action = params.get("action") as AuditAction | null;
    const entityType = params.get("entityType");
    const roleParam = params.get("role") as Role | null;
    const role = roleParam && ROLES.includes(roleParam) ? roleParam : undefined;
    const status = params.get("status");
    const search = params.get("search");
    const dateFrom = params.get("dateFrom");
    const dateTo = params.get("dateTo");

    return listAuditLogs(scope, {
      limit: Number.isFinite(limit) ? limit : 200,
      action: action ?? undefined,
      entityType: entityType ?? undefined,
      role,
      status: status ?? undefined,
      search: search ?? undefined,
      dateFrom: dateFrom ?? undefined,
      dateTo: dateTo ?? undefined,
    });
  });
}
