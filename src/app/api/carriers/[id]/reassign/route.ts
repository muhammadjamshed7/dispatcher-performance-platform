import { z } from "zod";

import { idSchema } from "@/lib/validation/common";
import { parseJsonBody } from "@/server/api/request";
import { handleApi } from "@/server/api/response";
import { requireAccessScope } from "@/server/auth/require-auth";
import { reassignCarrier } from "@/server/services/carriers.service";

const reassignCarrierBodySchema = z.object({
  teamId: z.string().min(1),
  dispatcherId: z.string().min(1),
  notes: z.string().optional(),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return handleApi(async () => {
    const { id } = await context.params;
    const carrierId = idSchema.parse(id);
    const { user, scope } = await requireAccessScope();
    const body = await parseJsonBody(request, reassignCarrierBodySchema);
    return reassignCarrier(scope, user, carrierId, body);
  }, request);
}
