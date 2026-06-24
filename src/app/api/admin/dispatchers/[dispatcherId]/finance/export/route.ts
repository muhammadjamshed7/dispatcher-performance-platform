import { z } from "zod";

import { STATUSES } from "@/lib/constants/statuses";
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

type RouteContext = {
  params: Promise<{ dispatcherId: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  return handleApi(async () => {
    const { user, scope } = await requireAccessScope("ADMIN");
    const { dispatcherId } = await context.params;
    const body = await parseJsonBody(request, exportFinanceBodySchema);
    return exportDispatcherFinanceCsv(scope, user, dispatcherId, body);
  }, request);
}
