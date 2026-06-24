import { handleApi } from "@/server/api/response";
import { requireAccessScope } from "@/server/auth/require-auth";
import { getAllowedStatusReasons } from "@/server/services/settings.service";

export async function GET() {
  return handleApi(async () => {
    const { scope } = await requireAccessScope();
    return getAllowedStatusReasons(scope);
  });
}
