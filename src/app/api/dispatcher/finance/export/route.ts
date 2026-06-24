import { z } from "zod";

import { STATUSES } from "@/lib/constants/statuses";
import { NotFoundError } from "@/lib/errors/not-found-error";
import { parseJsonBody } from "@/server/api/request";
import { handleApi } from "@/server/api/response";
import { requireAccessScope } from "@/server/auth/require-auth";
import { exportDispatcherFinanceCsv } from "@/server/services/dispatcher-finance.service";

const exportFinanceBodySchema = z.object({
  dateRange: z
    .enum(["today", "this-week", "this-month", "custom"])
    .default("this-month"),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  carrierId: z.string().optional(),
  status: z.enum(STATUSES).optional(),
});

export async function POST(request: Request) {
  return handleApi(async () => {
    const { user, scope } = await requireAccessScope("DISPATCHER");

    if (!scope.dispatcherId) {
      throw new NotFoundError("Dispatcher profile not found.");
    }

    const body = await parseJsonBody(request, exportFinanceBodySchema);
    return exportDispatcherFinanceCsv(scope, user, scope.dispatcherId, body);
  }, request);
}
