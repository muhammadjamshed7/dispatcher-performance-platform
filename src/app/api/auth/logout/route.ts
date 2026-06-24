import { clearSessionRoleCookie } from "@/lib/auth/session-role-cookie";
import { jsonError, jsonOk } from "@/server/api/response";
import { signOutUser } from "@/server/auth/auth.service";
import { assertSameOrigin } from "@/server/utils/request-security";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    await signOutUser();
    const response = jsonOk({ success: true });
    clearSessionRoleCookie(response);
    return response;
  } catch (error) {
    return jsonError(error);
  }
}
