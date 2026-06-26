import { z } from "zod";

import { STATUSES } from "@/lib/constants/statuses";
import { TRUCK_TYPES } from "@/lib/constants/truck-types";
import { REPORT_PERIODS } from "@/lib/constants/report-periods";
import { parseSearchParams } from "@/server/api/request";
import { handleApi } from "@/server/api/response";
import { requireAdminOrTeamLeadScope } from "@/server/auth/require-auth";
import { getReportBundle } from "@/server/services/reports.service";

const reportQuerySchema = z.object({
  period: z.enum(REPORT_PERIODS),
  teamId: z.string().optional(),
  dispatcherId: z.string().optional(),
  carrierId: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  status: z.enum(STATUSES).optional(),
  truckType: z.enum(TRUCK_TYPES).optional(),
});

export async function GET(request: Request) {
  return handleApi(async () => {
    const { scope } = await requireAdminOrTeamLeadScope();
    const url = new URL(request.url);
    const query = parseSearchParams(url.searchParams, reportQuerySchema);
    const { period, ...filters } = query;
    return getReportBundle(scope, period, filters);
  });
}
