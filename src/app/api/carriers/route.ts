import { z } from "zod";

import { TRUCK_TYPES } from "@/lib/constants/truck-types";
import { TEAM_STATUSES } from "@/lib/constants/team-statuses";
import { parseJsonBody } from "@/server/api/request";
import { handleApi } from "@/server/api/response";
import { requireAccessScope } from "@/server/auth/require-auth";
import { createCarrier, listCarriers } from "@/server/services/carriers.service";

const createCarrierBodySchema = z.object({
  carrierName: z.string().trim().min(1),
  driverName: z.string().trim().min(1),
  mcNumber: z.string().trim().min(1),
  dispatchFeePercentage: z.number().min(0).max(100),
  truckType: z.enum(TRUCK_TYPES),
  teamId: z.string().min(1),
  dispatcherId: z.string().min(1),
  status: z.enum(TEAM_STATUSES).default("ACTIVE"),
  notes: z.string().optional(),
});

export async function GET() {
  return handleApi(async () => {
    const { scope } = await requireAccessScope();
    return listCarriers(scope);
  });
}

export async function POST(request: Request) {
  return handleApi(async () => {
    const { user, scope } = await requireAccessScope();
    const body = await parseJsonBody(request, createCarrierBodySchema);
    return createCarrier(scope, user, body);
  });
}
