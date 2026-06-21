import { z } from "zod";

import { STATUSES } from "@/lib/constants/statuses";
import { TRUCK_TYPES } from "@/lib/constants/truck-types";
import { parseJsonBody, parseSearchParams } from "@/server/api/request";
import { handleApi } from "@/server/api/response";
import { requireAccessScope } from "@/server/auth/require-auth";
import {
  createActivity,
  listActivities,
} from "@/server/services/activities.service";

const activityFiltersSchema = z.object({
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  status: z.enum(STATUSES).optional(),
  teamId: z.string().optional(),
  dispatcherId: z.string().optional(),
  carrierId: z.string().optional(),
  truckType: z.enum(TRUCK_TYPES).optional(),
});

const createActivityBodySchema = z.object({
  activityDate: z.string().min(1),
  carrierId: z.string().min(1),
  status: z.enum(STATUSES),
  notes: z.string().optional(),
  origin: z.string().optional(),
  destination: z.string().optional(),
  totalMiles: z.number().optional(),
  loadAmount: z.number().optional(),
  reason: z.string().optional(),
});

export async function GET(request: Request) {
  return handleApi(async () => {
    const { scope } = await requireAccessScope();
    const url = new URL(request.url);
    const filters = parseSearchParams(url.searchParams, activityFiltersSchema);
    return listActivities(scope, filters);
  });
}

export async function POST(request: Request) {
  return handleApi(async () => {
    const { user, scope } = await requireAccessScope();
    const body = await parseJsonBody(request, createActivityBodySchema);
    return createActivity(scope, user, body);
  });
}
