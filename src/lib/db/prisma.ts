import "server-only";

import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import { PrismaClient } from "@/generated/prisma/client";
import { getServerEnv } from "@/lib/env";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  pgPool: pg.Pool | undefined;
};

function createPgPool(connectionString: string): pg.Pool {
  const url = new URL(connectionString);
  url.searchParams.delete("sslmode");

  return new pg.Pool({
    connectionString: url.toString(),
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

export const db = globalForPrisma.prisma ?? createPrismaClient();
globalForPrisma.prisma = db;

export type DatabaseClient = typeof db;
