import { z } from "zod";

import { TEAM_STATUSES } from "@/lib/constants/team-statuses";
import { parseJsonBody } from "@/server/api/request";
import { handleApi } from "@/server/api/response";
import { requireAccessScope } from "@/server/auth/require-auth";
import { createTeam, listTeams } from "@/server/services/teams.service";

const createTeamBodySchema = z.object({
  name: z.string().trim().min(1),
  teamLeadUserId: z.string().optional(),
  status: z.enum(TEAM_STATUSES),
});

export async function GET() {
  return handleApi(async () => {
    const { scope } = await requireAccessScope();
    return listTeams(scope);
  });
}

export async function POST(request: Request) {
  return handleApi(async () => {
    const { user, scope } = await requireAccessScope("ADMIN");
    const body = await parseJsonBody(request, createTeamBodySchema);
    return createTeam(scope, user, body);
  }, request);
}
