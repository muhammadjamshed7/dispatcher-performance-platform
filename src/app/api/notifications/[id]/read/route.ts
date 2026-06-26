import { handleApi } from "@/server/api/response";
import { requireAccessScope } from "@/server/auth/require-auth";
import { markNotificationRead } from "@/server/services/notifications.service";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return handleApi(async () => {
    const { user, scope } = await requireAccessScope();
    const { id } = await context.params;
    await markNotificationRead(scope, user.id, id);
    return { success: true };
  }, request);
}
