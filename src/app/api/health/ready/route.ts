import { NextResponse } from "next/server";

import { db } from "@/lib/db/prisma";
import { getPublicEnv, getServerEnv } from "@/lib/env";
import { jsonError } from "@/server/api/response";

export async function GET() {
  try {
    getServerEnv();
    getPublicEnv();

    await db.$queryRaw`SELECT 1`;

    return NextResponse.json({
      status: "ready",
      database: true,
      supabase: true,
    });
  } catch (error) {
    return jsonError(error);
  }
}
