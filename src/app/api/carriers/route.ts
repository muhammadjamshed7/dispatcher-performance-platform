import { z } from "zod";

import { TRUCK_TYPES } from "@/lib/constants/truck-types";
import { TEAM_STATUSES } from "@/lib/constants/team-statuses";
import { parseJsonBody, parseSearchParams } from "@/server/api/request";
import { handleApi } from "@/server/api/response";
import { requireAccessScope } from "@/server/auth/require-auth";
import {
  createCarrier,
  listCarriers,
} from "@/server/services/carriers.service";

const carrierFiltersSchema = z.object({
  q: z.string().trim().min(1).max(100).optional(),
  teamId: z.string().optional(),
  teamIds: z.string().optional(),
  dispatcherId: z.string().optional(),
  dispatcherIds: z.string().optional(),
  carrierId: z.string().optional(),
  truckType: z.enum(TRUCK_TYPES).optional(),
  truckTypes: z.string().optional(),
  status: z.enum(TEAM_STATUSES).optional(),
  statuses: z.string().optional(),
});

const createCarrierBodySchema = z.object({
  carrierName: z.string().trim().min(1),
  driverName: z.string().trim().min(1),
  mcNumber: z.string().trim().min(1),
  dispatchFeePercentage: z.number().min(0).max(100).optional(),
  truckType: z.enum(TRUCK_TYPES),
  teamId: z.string().min(1),
  dispatcherId: z.string().min(1),
  status: z.enum(TEAM_STATUSES).default("INACTIVE"),
  notes: z.string().optional(),
});

export async function GET(request: Request) {
  return handleApi(async () => {
    const { scope } = await requireAccessScope();
    const url = new URL(request.url);
    const filters = parseSearchParams(url.searchParams, carrierFiltersSchema);
    return listCarriers(scope, filters);
  });
}

export async function POST(request: Request) {
  return handleApi(async () => {
    const { user, scope } = await requireAccessScope();
    const body = await parseJsonBody(request, createCarrierBodySchema);
    return createCarrier(scope, user, body);
  }, request);
}
