import { handleApi } from "@/server/api/response";
import { requireAccessScope } from "@/server/auth/require-auth";
import { getDispatcherMetrics } from "@/server/services/dashboard.service";

export async function GET() {
  return handleApi(async () => {
    const { scope } = await requireAccessScope("DISPATCHER");
    return getDispatcherMetrics(scope);
  });
}
