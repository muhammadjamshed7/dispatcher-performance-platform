import { T, db } from "@/lib/db/client";
import { assertDb } from "@/lib/db/utils";
import { handleApi } from "@/server/api/response";

export async function GET() {
  return handleApi(async () => {
    const organizationResult = await db()
      .from(T.Organization)
      .select("id")
      .is("deletedAt", null)
      .order("createdAt", { ascending: true })
      .limit(1)
      .maybeSingle();

    const organization = organizationResult.data;

    if (!organization) {
      return [];
    }

    const teamsResult = await db()
      .from(T.Team)
      .select("id, name")
      .eq("organizationId", organization.id)
      .is("deletedAt", null)
      .eq("status", "ACTIVE")
      .order("name", { ascending: true });

    return assertDb(teamsResult);
  });
}
