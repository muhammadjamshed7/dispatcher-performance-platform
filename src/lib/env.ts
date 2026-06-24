import { z } from "zod";

import { ConfigurationError } from "@/lib/errors/configuration-error";

const emptyToUndefined = (value: unknown) =>
  value === "" || value === undefined ? undefined : value;

function isProductionRuntime() {
  return process.env.NODE_ENV === "production" || process.env.VERCEL === "1";
}

function resolveSupabaseAnonKey(): string | undefined {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  );
}

export const publicEnvSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.preprocess(
    emptyToUndefined,
    z.url().default("http://localhost:3000"),
  ),
  NEXT_PUBLIC_APP_NAME: z.preprocess(
    emptyToUndefined,
    z.string().min(1).default("Dispatcher Performance Platform"),
  ),
  NEXT_PUBLIC_SUPABASE_URL: z.preprocess(emptyToUndefined, z.url().optional()),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.preprocess(
    emptyToUndefined,
    z.string().min(1).optional(),
  ),
});

export type PublicEnv = z.infer<typeof publicEnvSchema>;

export function getPublicEnv(): PublicEnv {
  const env = publicEnvSchema.parse({
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: resolveSupabaseAnonKey(),
  });

  if (isProductionRuntime()) {
    if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      throw new ConfigurationError(
        "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.",
      );
    }
  }

  return env;
}

export const publicEnv = getPublicEnv();

const localDatabaseUrl = "postgresql://localhost:5432/postgres";

const serverEnvSchema = z.object({
  DATABASE_URL: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  DIRECT_URL: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  SUPABASE_SERVICE_ROLE_KEY: z.preprocess(
    emptyToUndefined,
    z.string().optional(),
  ),
});

export type ServerEnv = {
  DATABASE_URL: string;
  DIRECT_URL: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
};

function assertServerRuntime() {
  if (typeof window !== "undefined") {
    throw new Error(
      "Server environment variables cannot be accessed in browser code.",
    );
  }
}

export function getServerEnv(): ServerEnv {
  assertServerRuntime();

  const parsed = serverEnvSchema.parse({
    DATABASE_URL: process.env.DATABASE_URL,
    DIRECT_URL: process.env.DIRECT_URL,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  });

  const databaseUrl = parsed.DATABASE_URL ?? parsed.DIRECT_URL;
  const directUrl = parsed.DIRECT_URL ?? parsed.DATABASE_URL;

  if (isProductionRuntime()) {
    if (!databaseUrl) {
      throw new ConfigurationError(
        "Database is not configured. Set DATABASE_URL on your deployment.",
      );
    }

    if (!parsed.SUPABASE_SERVICE_ROLE_KEY) {
      throw new ConfigurationError(
        "Supabase service role key is not configured. Set SUPABASE_SERVICE_ROLE_KEY.",
      );
    }
  }

  return {
    DATABASE_URL: databaseUrl ?? localDatabaseUrl,
    DIRECT_URL: directUrl ?? localDatabaseUrl,
    SUPABASE_SERVICE_ROLE_KEY: parsed.SUPABASE_SERVICE_ROLE_KEY,
  };
}
