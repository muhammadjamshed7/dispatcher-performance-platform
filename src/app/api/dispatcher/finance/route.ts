import { z } from "zod";

import { STATUSES } from "@/lib/constants/statuses";
import { NotFoundError } from "@/lib/errors/not-found-error";
import { parseSearchParams } from "@/server/api/request";
import { handleApi } from "@/server/api/response";
import { requireAccessScope } from "@/server/auth/require-auth";
import { getDispatcherFinanceBundle } from "@/server/services/dispatcher-finance.service";

const financeFiltersSchema = z.object({
  dateRange: z
    .enum(["today", "this-week", "this-month", "custom"])
    .default("this-month"),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  carrierId: z.string().optional(),
  status: z.enum(STATUSES).optional(),
});

export async function GET(request: Request) {
  return handleApi(async () => {
    const { scope } = await requireAccessScope("DISPATCHER");

    if (!scope.dispatcherId) {
      throw new NotFoundError("Dispatcher profile not found.");
    }

    const url = new URL(request.url);
    const filters = parseSearchParams(url.searchParams, financeFiltersSchema);
    return getDispatcherFinanceBundle(scope, scope.dispatcherId, filters);
  });
}
