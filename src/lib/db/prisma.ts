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
  });
}

function createPrismaClient(): PrismaClient {
  const { DATABASE_URL } = getServerEnv();
  const pool = globalForPrisma.pgPool ?? createPgPool(DATABASE_URL);
  const adapter = new PrismaPg(pool);

  if (process.env.NODE_ENV !== "production") {
    globalForPrisma.pgPool = pool;
  }

  return new PrismaClient({ adapter });
}

export const db = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}

export type DatabaseClient = typeof db;
