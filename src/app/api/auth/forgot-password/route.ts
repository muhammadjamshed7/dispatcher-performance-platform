import { z } from "zod";

import { parseJsonBody } from "@/server/api/request";
import { handleApi } from "@/server/api/response";
import { requestPasswordReset } from "@/server/auth/auth.service";
import { assertRateLimit } from "@/server/utils/rate-limit";

const forgotPasswordBodySchema = z.object({
  email: z.email(),
});

export async function POST(request: Request) {
  return handleApi(async () => {
    assertRateLimit(request, "auth:forgot-password");
    const body = await parseJsonBody(request, forgotPasswordBodySchema);
    return requestPasswordReset(body.email);
  }, request);
}
