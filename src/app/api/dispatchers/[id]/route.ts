import { z } from "zod";

import { DISPATCHER_ROLES } from "@/lib/validation/dispatcher-form";
import { TEAM_STATUSES } from "@/lib/constants/team-statuses";
import { idSchema } from "@/lib/validation/common";
import { parseJsonBody } from "@/server/api/request";
import { handleApi } from "@/server/api/response";
import { requireAccessScope } from "@/server/auth/require-auth";
import {
  activateDispatcher,
  deactivateDispatcher,
  updateDispatcher,
} from "@/server/services/dispatchers.service";

const updateDispatcherBodySchema = z
  .object({
    fullName: z.string().trim().min(1),
    email: z.email(),
    phoneNumber: z.string().trim().optional(),
    teamId: z.string().min(1),
    role: z.enum(DISPATCHER_ROLES),
    status: z.enum(TEAM_STATUSES),
  })
  .partial();

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return handleApi(async () => {
    const { id } = await context.params;
    const dispatcherId = idSchema.parse(id);
    const { user, scope } = await requireAccessScope();
    const body = await parseJsonBody(request, updateDispatcherBodySchema);
    return updateDispatcher(scope, user, dispatcherId, body);
  });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return handleApi(async () => {
    const { id } = await context.params;
    const dispatcherId = idSchema.parse(id);
    const { user, scope } = await requireAccessScope();
    const body = await parseJsonBody(
      request,
      z.object({ action: z.enum(["activate", "deactivate"]) }),
    );

    if (body.action === "activate") {
      return activateDispatcher(scope, user, dispatcherId);
    }

    return deactivateDispatcher(scope, user, dispatcherId);
  });
}
