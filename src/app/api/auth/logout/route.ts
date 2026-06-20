import { handleApi } from "@/server/api/response";
import { signOutUser } from "@/server/auth/auth.service";

export async function POST() {
  return handleApi(async () => {
    await signOutUser();
    return { success: true };
  });
}
