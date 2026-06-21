import { z } from "zod";

import { idSchema } from "@/lib/validation/common";
import { parseJsonBody } from "@/server/api/request";
import { handleApi } from "@/server/api/response";
import { requireAccessScope } from "@/server/auth/require-auth";
import { rejectRegistrationRequest } from "@/server/services/users.service";

const rejectRegistrationBodySchema = z.object({
  reason: z.string().trim().min(1),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return handleApi(async () => {
    const { id } = await context.params;
    const requestId = idSchema.parse(id);
    const { user, scope } = await requireAccessScope("ADMIN");
    const body = await parseJsonBody(request, rejectRegistrationBodySchema);
    return rejectRegistrationRequest(scope, user, requestId, body);
  }, request);
}
