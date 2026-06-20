import type { CurrentUser } from "@/lib/auth/get-current-user";

export async function requireUser(): Promise<NonNullable<CurrentUser>> {
  throw new Error("Authentication is not configured yet.");
}
