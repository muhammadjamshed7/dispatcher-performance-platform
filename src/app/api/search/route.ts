import { z } from "zod";

import { parseSearchParams } from "@/server/api/request";
import { handleApi } from "@/server/api/response";
import { requireAccessScope } from "@/server/auth/require-auth";
import { searchOrganization } from "@/server/services/search.service";

const searchQuerySchema = z.object({
  q: z.string().trim().min(2).max(100),
});

export async function GET(request: Request) {
  return handleApi(async () => {
    const { scope } = await requireAccessScope();
    const url = new URL(request.url);
    const { q } = parseSearchParams(url.searchParams, searchQuerySchema);
    return searchOrganization(scope, q);
  });
}
