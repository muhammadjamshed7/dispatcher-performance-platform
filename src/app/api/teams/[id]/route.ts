import { z } from "zod";

import { TEAM_STATUSES } from "@/lib/constants/team-statuses";
import { idSchema } from "@/lib/validation/common";
import { parseJsonBody } from "@/server/api/request";
import { handleApi } from "@/server/api/response";
import { requireAccessScope } from "@/server/auth/require-auth";
import { updateTeam } from "@/server/services/teams.service";

const updateTeamBodySchema = z
  .object({
    name: z.string().trim().min(1),
    teamLeadUserId: z.string().optional(),
    status: z.enum(TEAM_STATUSES),
  })
  .partial();

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return handleApi(async () => {
    const { id } = await context.params;
    const teamId = idSchema.parse(id);
    const { user, scope } = await requireAccessScope("ADMIN");
    const body = await parseJsonBody(request, updateTeamBodySchema);
    return updateTeam(scope, user, teamId, body);
  }, request);
}
