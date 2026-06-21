import { z } from "zod";

import { STATUSES } from "@/lib/constants/statuses";
import { parseSearchParams } from "@/server/api/request";
import { handleApi } from "@/server/api/response";
import { requireAccessScope } from "@/server/auth/require-auth";
import { getAdminDailyReportBundle } from "@/server/services/admin-daily-report.service";

const dailyReportQuerySchema = z.object({
  date: z.string().optional(),
  teamId: z.string().optional(),
  dispatcherId: z.string().optional(),
  status: z.enum(STATUSES).optional(),
});

export async function GET(request: Request) {
  return handleApi(async () => {
    const { scope } = await requireAccessScope("ADMIN");
    const url = new URL(request.url);
    const filters = parseSearchParams(url.searchParams, dailyReportQuerySchema);
    return getAdminDailyReportBundle(scope, filters);
  });
}
