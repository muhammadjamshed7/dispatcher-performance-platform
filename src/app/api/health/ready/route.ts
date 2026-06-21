import { NextResponse } from "next/server";
import pg from "pg";

export const runtime = "nodejs";

function envFlag(name: string): boolean {
  const value = process.env[name];
  return typeof value === "string" && value.trim().length > 0;
}

function formatError(error: unknown) {
  if (error instanceof AggregateError) {
    return {
      message: error.message,
      details: error.errors.map((nested) =>
        nested instanceof Error ? nested.message : String(nested),
      ),
    };
  }

  if (error instanceof Error) {
    return { message: error.message, name: error.name };
  }

  return { message: String(error) };
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

  const connectionString =
    process.env.DATABASE_URL?.trim() || process.env.DIRECT_URL?.trim();

  if (!connectionString) {
    return NextResponse.json(
      {
        ok: false,
        status: "not_ready",
        error: "DATABASE_URL is empty.",
        checks,
      },
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

    const result = await pool.query("SELECT 1 AS ok");

    return NextResponse.json({
      ok: true,
      status: "ready",
      checks,
      database: true,
      query: result.rows[0],
    });
  } catch (error) {
    const formatted = formatError(error);
    const isDirectSupabaseHost =
      connectionString.includes("db.") &&
      connectionString.includes(".supabase.co:5432");
    const isEnoNotFound = formatted.message.toLowerCase().includes("enotfound");

    return NextResponse.json(
      {
        ok: false,
        status: "not_ready",
        error: formatted.message,
        details: formatted.details,
        checks,
        hint:
          isDirectSupabaseHost && isEnoNotFound
            ? "Vercel cannot use the direct Supabase URL (IPv6 only). In Supabase Dashboard → Connect → copy the Transaction pooler URI (port 6543) into Vercel DATABASE_URL, then redeploy."
            : "Copy DATABASE_URL from Supabase Dashboard → Connect → Transaction pooler (port 6543). Do not use the direct db.*.supabase.co URL on Vercel.",
      },
      { status: 503 },
    );
  } finally {
    await pool?.end().catch(() => undefined);
  }
}
