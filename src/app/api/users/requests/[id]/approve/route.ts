import { z } from "zod";

import { DISPATCHER, TEAM_LEAD } from "@/lib/constants/roles";
import { idSchema } from "@/lib/validation/common";
import { parseJsonBody } from "@/server/api/request";
import { handleApi } from "@/server/api/response";
import { requireAccessScope } from "@/server/auth/require-auth";
import { approveRegistrationRequest } from "@/server/services/users.service";

const approveRegistrationBodySchema = z.object({
  role: z.enum([DISPATCHER, TEAM_LEAD]),
  teamId: z.string().min(1),
  temporaryPassword: z.string().min(8),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return handleApi(async () => {
    const { id } = await context.params;
    const requestId = idSchema.parse(id);
    const { user, scope } = await requireAccessScope("ADMIN");
    const body = await parseJsonBody(request, approveRegistrationBodySchema);
    return approveRegistrationRequest(scope, user, requestId, body);
  });
}
