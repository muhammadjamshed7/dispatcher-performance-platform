import { NextResponse } from "next/server";
import pg from "pg";

export const runtime = "nodejs";

function isProductionRuntime() {
  return process.env.NODE_ENV === "production" || process.env.VERCEL === "1";
}

function envFlag(name: string): boolean {
  const value = process.env[name];
  return typeof value === "string" && value.trim().length > 0;
}

export async function GET() {
  const isProduction = isProductionRuntime();
  const configured =
    (envFlag("DATABASE_URL") || envFlag("DIRECT_URL")) &&
    envFlag("NEXT_PUBLIC_SUPABASE_URL") &&
    (envFlag("NEXT_PUBLIC_SUPABASE_ANON_KEY") ||
      envFlag("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY")) &&
    envFlag("SUPABASE_SERVICE_ROLE_KEY");

  if (!configured) {
    return NextResponse.json(
      isProduction
        ? { ok: false, status: "not_ready" }
        : {
            ok: false,
            status: "not_ready",
            error: "Missing required deployment environment variables.",
          },
      { status: 503 },
    );
  }

  const connectionString =
    process.env.DATABASE_URL?.trim() || process.env.DIRECT_URL?.trim();

  if (!connectionString) {
    return NextResponse.json(
      isProduction
        ? { ok: false, status: "not_ready" }
        : { ok: false, status: "not_ready", error: "DATABASE_URL is empty." },
      { status: 503 },
    );
  }

  let pool: pg.Pool | undefined;

  try {
    const url = new URL(connectionString);
    url.searchParams.delete("sslmode");

    pool = new pg.Pool({
      connectionString: url.toString(),
      ssl: { rejectUnauthorized: false },
      max: 1,
      connectionTimeoutMillis: 10_000,
    });

    await pool.query("SELECT 1 AS ok");

    return NextResponse.json({
      ok: true,
      status: "ready",
    });
  } catch {
    return NextResponse.json(
      isProduction
        ? { ok: false, status: "not_ready" }
        : {
            ok: false,
            status: "not_ready",
            error: "Database connection failed.",
          },
      { status: 503 },
    );
  } finally {
    await pool?.end().catch(() => undefined);
  }
}
