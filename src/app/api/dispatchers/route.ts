import { z } from "zod";

import { DISPATCHER_ROLES } from "@/lib/validation/dispatcher-form";
import { TEAM_STATUSES } from "@/lib/constants/team-statuses";
import { parseJsonBody } from "@/server/api/request";
import { handleApi } from "@/server/api/response";
import { requireAccessScope } from "@/server/auth/require-auth";
import {
  createDispatcher,
  listDispatchers,
} from "@/server/services/dispatchers.service";

const createDispatcherBodySchema = z.object({
  fullName: z.string().trim().min(1),
  email: z.email(),
  phoneNumber: z.string().trim().optional(),
  teamId: z.string().min(1),
  role: z.enum(DISPATCHER_ROLES),
  status: z.enum(TEAM_STATUSES),
});

export async function GET() {
  return handleApi(async () => {
    const { scope } = await requireAccessScope();
    return listDispatchers(scope);
  });
}

export async function POST(request: Request) {
  return handleApi(async () => {
    const { user, scope } = await requireAccessScope();
    const body = await parseJsonBody(request, createDispatcherBodySchema);
    return createDispatcher(scope, user, body);
  }, request);
}
