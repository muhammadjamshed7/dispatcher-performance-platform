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
  status: z.enum(STATUSES).optional(),
  teamId: z.string().optional(),
  dispatcherId: z.string().optional(),
  carrierId: z.string().optional(),
  truckType: z.enum(TRUCK_TYPES).optional(),
});

export async function GET(request: Request) {
  return handleApi(async () => {
    const { scope } = await requireAccessScope("ADMIN");
    const url = new URL(request.url);
    const filters = parseSearchParams(url.searchParams, adminDashboardFiltersSchema);
    return getAdminDashboardBundle(scope, filters);
  });
}
