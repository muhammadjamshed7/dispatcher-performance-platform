import { z } from "zod";

import { ADMIN, DISPATCHER, TEAM_LEAD } from "@/lib/constants/roles";
import { parseJsonBody } from "@/server/api/request";
import { handleApi } from "@/server/api/response";
import { signInWithRole } from "@/server/auth/auth.service";
import { assertRateLimit } from "@/server/utils/rate-limit";

const loginBodySchema = z.object({
  email: z.email(),
  password: z.string().min(1),
  expectedRole: z.enum([ADMIN, TEAM_LEAD, DISPATCHER]),
});

export async function POST(request: Request) {
  return handleApi(async () => {
    assertRateLimit(request, "auth:login");
    const body = await parseJsonBody(request, loginBodySchema);
    return signInWithRole(body);
  }, request);
}
