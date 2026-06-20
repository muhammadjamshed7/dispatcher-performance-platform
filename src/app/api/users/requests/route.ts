import { handleApi } from "@/server/api/response";
import { requireAccessScope } from "@/server/auth/require-auth";
import { listRegistrationRequests } from "@/server/services/users.service";

export async function GET() {
  return handleApi(async () => {
    const { scope } = await requireAccessScope("ADMIN");
    return listRegistrationRequests(scope);
  });
}
