import { z } from "zod";

import { STATUSES } from "@/lib/constants/statuses";
import { idSchema } from "@/lib/validation/common";
import { parseJsonBody } from "@/server/api/request";
import { handleApi } from "@/server/api/response";
import { requireAccessScope } from "@/server/auth/require-auth";
import { updateActivity } from "@/server/services/activities.service";

const updateActivityBodySchema = z
  .object({
    activityDate: z.string().min(1),
    status: z.enum(STATUSES),
    notes: z.string().optional(),
    origin: z.string().optional(),
    destination: z.string().optional(),
    totalMiles: z.number().optional(),
    loadAmount: z.number().optional(),
    reason: z.string().optional(),
  })
  .partial();

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return handleApi(async () => {
    const { id } = await context.params;
    const activityId = idSchema.parse(id);
    const { user, scope } = await requireAccessScope();
    const body = await parseJsonBody(request, updateActivityBodySchema);
    return updateActivity(scope, user, activityId, body);
  });
}
