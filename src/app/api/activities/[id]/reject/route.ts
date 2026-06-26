import { z } from "zod";

import { parseJsonBody } from "@/server/api/request";
import { handleApi } from "@/server/api/response";
import { requireAccessScope } from "@/server/auth/require-auth";
import { ADMIN, TEAM_LEAD } from "@/lib/constants/roles";
import { ForbiddenError } from "@/lib/errors/forbidden-error";
import { rejectActivity } from "@/server/services/activities.service";

const bodySchema = z.object({
  reason: z.string().trim().min(1),
  requestChanges: z.boolean().optional(),
  approvalNotes: z.string().trim().optional(),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return handleApi(async () => {
    const { user, scope } = await requireAccessScope();
    if (scope.role !== ADMIN && scope.role !== TEAM_LEAD) {
      throw new ForbiddenError("Team lead or admin access is required.");
    }
    const { id } = await context.params;
    const body = await parseJsonBody(request, bodySchema);
    return rejectActivity(scope, user, id, body);
  }, request);
}
