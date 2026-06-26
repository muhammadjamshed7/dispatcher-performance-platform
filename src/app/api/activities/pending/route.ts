import { handleApi } from "@/server/api/response";
import { requireAccessScope } from "@/server/auth/require-auth";
import { ADMIN, TEAM_LEAD } from "@/lib/constants/roles";
import { ForbiddenError } from "@/lib/errors/forbidden-error";
import { listPendingApprovals } from "@/server/services/approvals.service";

export async function GET() {
  return handleApi(async () => {
    const { scope } = await requireAccessScope();
    if (scope.role !== ADMIN && scope.role !== TEAM_LEAD) {
      throw new ForbiddenError("Team lead or admin access is required.");
    }
    return listPendingApprovals(scope);
  });
}
