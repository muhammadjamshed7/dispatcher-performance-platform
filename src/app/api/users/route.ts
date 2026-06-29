import { z } from "zod";

import { ACTIVE } from "@/lib/auth/user-statuses";
import { DISPATCHER, TEAM_LEAD } from "@/lib/constants/roles";
import { parseJsonBody } from "@/server/api/request";
import { handleApi } from "@/server/api/response";
import { requireAccessScope } from "@/server/auth/require-auth";
import {
  createManagedUser,
  listManagedUsers,
} from "@/server/services/users.service";

const createManagedUserBodySchema = z
  .object({
    fullName: z.string().trim().min(1),
    email: z.email(),
    phoneNumber: z.string().trim().optional(),
    role: z.enum([DISPATCHER, TEAM_LEAD]),
    teamId: z.string().min(1),
    password: z.string().min(8),
    confirmPassword: z.string().min(1),
    status: z.literal(ACTIVE).optional(),
  })
  .refine((input) => input.password === input.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

export async function GET() {
  return handleApi(async () => {
    const { scope } = await requireAccessScope("ADMIN");
    return listManagedUsers(scope);
  });
}

export async function POST(request: Request) {
  return handleApi(async () => {
    const { user, scope } = await requireAccessScope("ADMIN");
    const body = await parseJsonBody(request, createManagedUserBodySchema);
    return createManagedUser(scope, user, body);
  }, request);
}
