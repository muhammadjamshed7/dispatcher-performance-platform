import { handleApi } from "@/server/api/response";
import { requireAccessScope } from "@/server/auth/require-auth";
import {
  countUnreadNotifications,
  listNotifications,
} from "@/server/services/notifications.service";

export async function GET() {
  return handleApi(async () => {
    const { user, scope } = await requireAccessScope();
    const [notifications, unreadCount] = await Promise.all([
      listNotifications(scope, user.id),
      countUnreadNotifications(scope, user.id),
    ]);
    return { notifications, unreadCount };
  });
}
