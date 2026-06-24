import { z } from "zod";

import { STATUSES } from "@/lib/constants/statuses";
import { TRUCK_TYPES } from "@/lib/constants/truck-types";
import { parseSearchParams } from "@/server/api/request";
import { handleApi } from "@/server/api/response";
import { requireAccessScope } from "@/server/auth/require-auth";
import { getAdminDashboardBundle } from "@/server/services/admin-dashboard.service";

const adminDashboardFiltersSchema = z.object({
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  dateRange: z.string().optional(),
  customDateFrom: z.string().optional(),
  customDateTo: z.string().optional(),
  status: z.enum(STATUSES).optional(),
  statuses: z.string().optional(),
  statusKeys: z.string().optional(),
  teamId: z.string().optional(),
  teamIds: z.string().optional(),
  dispatcherId: z.string().optional(),
  dispatcherIds: z.string().optional(),
  carrierId: z.string().optional(),
  carrierIds: z.string().optional(),
  truckType: z.enum(TRUCK_TYPES).optional(),
  truckTypes: z.string().optional(),
});

export async function GET(request: Request) {
  return handleApi(async () => {
    const { scope } = await requireAccessScope("ADMIN");
    const url = new URL(request.url);
    const filters = parseSearchParams(
      url.searchParams,
      adminDashboardFiltersSchema,
    );
    return getAdminDashboardBundle(scope, filters);
  });
}
