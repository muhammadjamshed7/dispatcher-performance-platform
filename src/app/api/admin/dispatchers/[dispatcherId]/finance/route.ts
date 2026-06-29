import { z } from "zod";

import { STATUSES } from "@/lib/constants/statuses";
import { parseSearchParams } from "@/server/api/request";
import { handleApi } from "@/server/api/response";
import { requireAccessScope } from "@/server/auth/require-auth";
import { viewDispatcherFinanceBundle } from "@/server/services/dispatcher-finance.service";

const financeFiltersSchema = z.object({
  dateRange: z
    .enum(["today", "this-week", "this-month", "custom"])
    .default("this-month"),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  carrierId: z.string().optional(),
  status: z.enum(STATUSES).optional(),
});

type RouteContext = {
  params: Promise<{ dispatcherId: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  return handleApi(async () => {
    const { user, scope } = await requireAccessScope("ADMIN");
    const { dispatcherId } = await context.params;
    const url = new URL(request.url);
    const filters = parseSearchParams(url.searchParams, financeFiltersSchema);
    return viewDispatcherFinanceBundle(scope, user, dispatcherId, filters);
  });
}
