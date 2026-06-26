import { z } from "zod";

import { TRUCK_TYPES } from "@/lib/constants/truck-types";
import { parseJsonBody } from "@/server/api/request";
import { handleApi } from "@/server/api/response";
import { requireAccessScope } from "@/server/auth/require-auth";
import {
  getSettings,
  updateSettings,
} from "@/server/services/settings.service";

const updateSettingsBodySchema = z
  .object({
    dispatchFeeMethod: z.literal("percentage"),
    defaultDispatchFeePercent: z.number().min(0).max(100),
    minimumDispatchFee: z.number().min(0),
    roundToNearestDollar: z.boolean(),
    allowedTruckTypes: z.array(z.enum(TRUCK_TYPES)),
    timezone: z.string().trim().min(1),
    currency: z.string().trim().length(3),
    csvIncludeHeaders: z.boolean(),
    csvDateFormat: z.string().trim().min(1),
    csvMaxRows: z.number().int().positive(),
    csvFileNamePrefix: z.string().trim().min(1),
    directAdminApprovalMode: z.boolean(),
    allowedStatusReasons: z.array(z.string().trim().min(1)),
  })
  .partial();

export async function GET() {
  return handleApi(async () => {
    const { scope } = await requireAccessScope("ADMIN");
    return getSettings(scope);
  });
}

export async function PATCH(request: Request) {
  return handleApi(async () => {
    const { user, scope } = await requireAccessScope("ADMIN");
    const body = await parseJsonBody(request, updateSettingsBodySchema);
    return updateSettings(scope, user, body);
  }, request);
}
