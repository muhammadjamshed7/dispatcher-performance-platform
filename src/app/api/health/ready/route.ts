import { NextResponse } from "next/server";

import { jsonError } from "@/server/api/response";

function envFlag(name: string): boolean {
  const value = process.env[name];
  return typeof value === "string" && value.trim().length > 0;
}

export async function GET() {
  const checks = {
    databaseUrl: envFlag("DATABASE_URL") || envFlag("DIRECT_URL"),
    supabaseUrl: envFlag("NEXT_PUBLIC_SUPABASE_URL"),
    supabaseAnonKey:
      envFlag("NEXT_PUBLIC_SUPABASE_ANON_KEY") ||
      envFlag("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"),
    serviceRoleKey: envFlag("SUPABASE_SERVICE_ROLE_KEY"),
  };

  const missing = Object.entries(checks)
    .filter(([, configured]) => !configured)
    .map(([name]) => name);

  if (missing.length > 0) {
    return NextResponse.json(
      {
        ok: false,
        status: "not_ready",
        error:
          "Missing deployment environment variables. Add them in Vercel → Settings → Environment Variables, then redeploy.",
        missing,
        checks,
      },
      { status: 503 },
    );
  }

  try {
    const { db } = await import("@/lib/db/prisma");
    await db.$queryRaw`SELECT 1`;

    return NextResponse.json({
      ok: true,
      status: "ready",
      checks,
      database: true,
      supabase: true,
    });
  } catch (error) {
    return jsonError(error);
  }
}
