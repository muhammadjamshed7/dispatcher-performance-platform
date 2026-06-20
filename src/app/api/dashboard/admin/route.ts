import { handleApi } from "@/server/api/response";
import { requireAccessScope } from "@/server/auth/require-auth";
import { getAdminMetrics } from "@/server/services/dashboard.service";

export async function GET() {
  return handleApi(async () => {
    const { scope } = await requireAccessScope("ADMIN");
    return getAdminMetrics(scope);
  });
}
