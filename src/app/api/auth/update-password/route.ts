import { z } from "zod";

import { parseJsonBody } from "@/server/api/request";
import { handleApi } from "@/server/api/response";
import { updatePassword } from "@/server/auth/auth.service";
import { requireUser } from "@/server/auth/require-auth";

const updatePasswordBodySchema = z.object({
  password: z.string().min(8),
});

export async function POST(request: Request) {
  return handleApi(async () => {
    await requireUser();
    const body = await parseJsonBody(request, updatePasswordBodySchema);
    return updatePassword(body.password);
  }, request);
}
