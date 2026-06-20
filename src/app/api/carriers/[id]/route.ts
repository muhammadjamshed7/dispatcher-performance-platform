import { z } from "zod";

import { TRUCK_TYPES } from "@/lib/constants/truck-types";
import { TEAM_STATUSES } from "@/lib/constants/team-statuses";
import { idSchema } from "@/lib/validation/common";
import { parseJsonBody } from "@/server/api/request";
import { handleApi } from "@/server/api/response";
import { requireAccessScope } from "@/server/auth/require-auth";
import { updateCarrier } from "@/server/services/carriers.service";

const updateCarrierBodySchema = z
  .object({
    carrierName: z.string().trim().min(1),
    driverName: z.string().trim().min(1),
    mcNumber: z.string().trim().min(1),
    dispatchFeePercentage: z.number().min(0).max(100),
    truckType: z.enum(TRUCK_TYPES),
    status: z.enum(TEAM_STATUSES),
    notes: z.string().optional(),
  })
  .partial();

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return handleApi(async () => {
    const { id } = await context.params;
    const carrierId = idSchema.parse(id);
    const { user, scope } = await requireAccessScope();
    const body = await parseJsonBody(request, updateCarrierBodySchema);
    return updateCarrier(scope, user, carrierId, body);
  });
}
