import { z } from "zod";

import { parseSearchParams } from "@/server/api/request";
import { handleApi } from "@/server/api/response";
import { requireAccessScope } from "@/server/auth/require-auth";
import {
  getCarrierRankings,
  getDispatcherRankings,
  getTeamRankings,
} from "@/server/services/rankings.service";

const rankingsQuerySchema = z.object({
  type: z.enum(["dispatcher", "carrier", "team"]),
});

export async function GET(request: Request) {
  return handleApi(async () => {
    const { scope } = await requireAccessScope();
    const url = new URL(request.url);
    const { type } = parseSearchParams(url.searchParams, rankingsQuerySchema);

    switch (type) {
      case "dispatcher":
        return getDispatcherRankings(scope);
      case "carrier":
        return getCarrierRankings(scope);
      case "team":
        return getTeamRankings(scope);
    }
  });
}
