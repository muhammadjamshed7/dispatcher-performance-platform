import { handleApi } from "@/server/api/response";
import { requireAccessScope } from "@/server/auth/require-auth";
import { getTeamLeadMetrics } from "@/server/services/dashboard.service";

export async function GET() {
  return handleApi(async () => {
    const { scope } = await requireAccessScope("TEAM_LEAD");
    return getTeamLeadMetrics(scope);
  });
}
