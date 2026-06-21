import { z } from "zod";

import { STATUSES } from "@/lib/constants/statuses";
import { TRUCK_TYPES } from "@/lib/constants/truck-types";
import { REPORT_PERIODS } from "@/lib/constants/report-periods";
import { parseJsonBody } from "@/server/api/request";
import { handleApi } from "@/server/api/response";
import { requireAccessScope } from "@/server/auth/require-auth";
import { exportReportCsv } from "@/server/services/reports.service";

const exportReportBodySchema = z.object({
  period: z.enum(REPORT_PERIODS),
  teamId: z.string().optional(),
  dispatcherId: z.string().optional(),
  carrierId: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  status: z.enum(STATUSES).optional(),
  truckType: z.enum(TRUCK_TYPES).optional(),
});

export async function POST(request: Request) {
  return handleApi(async () => {
    const { user, scope } = await requireAccessScope();
    const body = await parseJsonBody(request, exportReportBodySchema);
    const { period, ...filters } = body;
    return exportReportCsv(scope, user, period, filters);
  }, request);
}
