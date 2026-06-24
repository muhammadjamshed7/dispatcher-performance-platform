import "server-only";

/**
 * Legacy Prisma client — kept for scripts and migrations only.
 * Runtime API/services use Supabase via `@/lib/db/client`.
 */

import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import { PrismaClient } from "@/generated/prisma/client";
import { ConfigurationError } from "@/lib/errors/configuration-error";
import { getServerEnv } from "@/lib/env";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  pgPool: pg.Pool | undefined;
};

function createPgPool(connectionString: string): pg.Pool {
  let normalizedConnectionString: string;

  try {
    const url = new URL(connectionString);
    url.searchParams.delete("sslmode");
    normalizedConnectionString = url.toString();
  } catch {
    throw new ConfigurationError(
      "DATABASE_URL is not a valid PostgreSQL connection string.",
    );
  }

  return new pg.Pool({
    connectionString: normalizedConnectionString,
    ssl: { rejectUnauthorized: false },
    max: process.env.VERCEL ? 1 : 10,
    idleTimeoutMillis: 20_000,
    connectionTimeoutMillis: 10_000,
  });
}

function createPrismaClient(): PrismaClient {
  const { DATABASE_URL } = getServerEnv();
  const pool = globalForPrisma.pgPool ?? createPgPool(DATABASE_URL);
  const adapter = new PrismaPg(pool);
  globalForPrisma.pgPool = pool;

  return new PrismaClient({ adapter });
}

function getPrismaClient(): PrismaClient {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = createPrismaClient();
  }

  return globalForPrisma.prisma;
}

export const db = new Proxy({} as PrismaClient, {
  get(_target, property) {
    const client = getPrismaClient();
    const value = Reflect.get(client, property, client) as unknown;

    if (typeof value === "function") {
      return value.bind(client);
    }

    return value;
  },
}) as PrismaClient;

export type DatabaseClient = typeof db;
