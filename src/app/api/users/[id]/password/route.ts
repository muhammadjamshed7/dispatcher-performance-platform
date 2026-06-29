import { z } from "zod";

import { idSchema } from "@/lib/validation/common";
import { parseJsonBody } from "@/server/api/request";
import { handleApi } from "@/server/api/response";
import { requireAccessScope } from "@/server/auth/require-auth";
import { resetManagedUserPassword } from "@/server/services/users.service";

const resetManagedUserPasswordBodySchema = z
  .object({
    password: z.string().min(8),
    confirmPassword: z.string().min(1),
  })
  .refine((input) => input.password === input.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return handleApi(async () => {
    const { id } = await context.params;
    const userId = idSchema.parse(id);
    const { user, scope } = await requireAccessScope("ADMIN");
    const body = await parseJsonBody(
      request,
      resetManagedUserPasswordBodySchema,
    );
    return resetManagedUserPassword(scope, user, userId, body);
  }, request);
}
