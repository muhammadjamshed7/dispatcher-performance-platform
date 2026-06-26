import { z } from "zod";

import { parseSearchParams } from "@/server/api/request";
import { handleApi } from "@/server/api/response";
import { requireAccessScope } from "@/server/auth/require-auth";
import { ForbiddenError } from "@/lib/errors/forbidden-error";
import { ADMIN, TEAM_LEAD } from "@/lib/constants/roles";
import { assertFilterAccess } from "@/server/utils/activity-filters";
import {
  getCarrierRankings,
  getDispatcherRankings,
  getTeamRankings,
} from "@/server/services/rankings.service";
import { sanitizeFilterId } from "@/lib/constants/filters";

const rankingsQuerySchema = z.object({
  type: z.enum(["dispatcher", "carrier", "team"]),
  teamId: z.string().optional(),
  dispatcherId: z.string().optional(),
});

export async function GET(request: Request) {
  return handleApi(async () => {
    const { scope } = await requireAccessScope();
    const url = new URL(request.url);
    const { type, teamId, dispatcherId } = parseSearchParams(
      url.searchParams,
      rankingsQuerySchema,
    );

    // Carrier and team rankings remain admin/team-lead only. Dispatcher
    // rankings are allowed for all roles; the rankings service scopes a
    // dispatcher's results to their own record via dispatcherScopeFilter.
    const isPrivileged = scope.role === ADMIN || scope.role === TEAM_LEAD;

    if (type !== "dispatcher" && !isPrivileged) {
      throw new ForbiddenError("Admin or team lead access is required.");
    }
    const filters = {
      teamId: sanitizeFilterId(teamId),
      dispatcherId: sanitizeFilterId(dispatcherId),
    };

    await assertFilterAccess(scope, {
      teamId: filters.teamId,
      dispatcherId: filters.dispatcherId,
    });

    switch (type) {
      case "dispatcher":
        return getDispatcherRankings(scope, filters);
      case "carrier":
        return getCarrierRankings(scope, filters);
      case "team":
        return getTeamRankings(scope, filters);
    }
  });
}
