import { handleApi } from "@/server/api/response";
import { getSessionUser } from "@/server/auth/auth.service";

export async function GET() {
  return handleApi(() => getSessionUser());
}
