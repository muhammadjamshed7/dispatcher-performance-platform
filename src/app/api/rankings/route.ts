import { z } from "zod";

import { parseSearchParams } from "@/server/api/request";
import { handleApi } from "@/server/api/response";
import { requireAccessScope } from "@/server/auth/require-auth";
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
