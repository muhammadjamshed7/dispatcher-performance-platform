import { handleApi } from "@/server/api/response";
import { requireAccessScope } from "@/server/auth/require-auth";
import { markAllNotificationsRead } from "@/server/services/notifications.service";

export async function POST(request: Request) {
  return handleApi(async () => {
    const { user, scope } = await requireAccessScope();
    await markAllNotificationsRead(scope, user.id);
    return { success: true };
  }, request);
}
