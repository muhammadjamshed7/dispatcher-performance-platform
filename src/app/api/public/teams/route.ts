import { db } from "@/lib/db/prisma";
import { handleApi } from "@/server/api/response";

export async function GET() {
  return handleApi(async () => {
    const organization = await db.organization.findFirst({
      where: { deletedAt: null },
      orderBy: { createdAt: "asc" },
    });

    if (!organization) {
      return [];
    }

    return db.team.findMany({
      where: {
        organizationId: organization.id,
        deletedAt: null,
        status: "ACTIVE",
      },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });
  });
}
