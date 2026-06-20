import { z } from "zod";

import { parseJsonBody } from "@/server/api/request";
import { handleApi } from "@/server/api/response";
import { submitRegistrationRequest } from "@/server/auth/auth.service";

const registerBodySchema = z.object({
  fullName: z.string().trim().min(1),
  email: z.email(),
  phoneNumber: z.string().trim().min(1),
  preferredTeamId: z.string().optional(),
  preferredTeamName: z.string().optional(),
  notes: z.string().optional(),
});

export async function POST(request: Request) {
  return handleApi(async () => {
    const body = await parseJsonBody(request, registerBodySchema);
    return submitRegistrationRequest(body);
  });
}
