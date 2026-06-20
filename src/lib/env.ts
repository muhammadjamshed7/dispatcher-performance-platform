import { z } from "zod";

const emptyToUndefined = (value: unknown) =>
  value === "" || value === undefined ? undefined : value;

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
  return publicEnvSchema.parse({
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  });
}

export const publicEnv = getPublicEnv();

const serverEnvSchema = z.object({
  DATABASE_URL: z.preprocess(
    emptyToUndefined,
    z.string().min(1).default("postgresql://localhost:5432/postgres"),
  ),
  DIRECT_URL: z.preprocess(
    emptyToUndefined,
    z.string().min(1).default("postgresql://localhost:5432/postgres"),
  ),
  SUPABASE_SERVICE_ROLE_KEY: z.preprocess(emptyToUndefined, z.string().optional()),
  SESSION_COOKIE_NAME: z.preprocess(
    emptyToUndefined,
    z.string().min(1).default("dpp_session"),
  ),
  AUTH_REDIRECT_URL: z.preprocess(
    emptyToUndefined,
    z.url().default("http://localhost:3000/dashboard"),
  ),
  APP_ENCRYPTION_KEY: z.preprocess(emptyToUndefined, z.string().optional()),
  CSRF_SECRET: z.preprocess(emptyToUndefined, z.string().optional()),
  REPORT_EXPORT_MAX_ROWS: z.preprocess(
    emptyToUndefined,
    z.coerce.number().int().positive().default(10_000),
  ),
  REPORT_EXPORT_STORAGE_BUCKET: z.preprocess(
    emptyToUndefined,
    z.string().default("report-exports"),
  ),
  DEFAULT_TIMEZONE: z.preprocess(
    emptyToUndefined,
    z.string().default("America/Chicago"),
  ),
  DEFAULT_CURRENCY: z.preprocess(emptyToUndefined, z.string().default("USD")),
  RESEND_API_KEY: z.preprocess(emptyToUndefined, z.string().optional()),
  FROM_EMAIL: z.preprocess(emptyToUndefined, z.string().email().optional()),
  SENTRY_DSN: z.preprocess(emptyToUndefined, z.url().optional()),
  LOG_LEVEL: z.preprocess(
    emptyToUndefined,
    z.enum(["debug", "info", "warn", "error"]).default("info"),
  ),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

function assertServerRuntime() {
  if (typeof window !== "undefined") {
    throw new Error(
      "Server environment variables cannot be accessed in browser code.",
    );
  }
}

export function getServerEnv(): ServerEnv {
  assertServerRuntime();

  return serverEnvSchema.parse({
    DATABASE_URL: process.env.DATABASE_URL,
    DIRECT_URL: process.env.DIRECT_URL,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    SESSION_COOKIE_NAME: process.env.SESSION_COOKIE_NAME,
    AUTH_REDIRECT_URL: process.env.AUTH_REDIRECT_URL,
    APP_ENCRYPTION_KEY: process.env.APP_ENCRYPTION_KEY,
    CSRF_SECRET: process.env.CSRF_SECRET,
    REPORT_EXPORT_MAX_ROWS: process.env.REPORT_EXPORT_MAX_ROWS,
    REPORT_EXPORT_STORAGE_BUCKET: process.env.REPORT_EXPORT_STORAGE_BUCKET,
    DEFAULT_TIMEZONE: process.env.DEFAULT_TIMEZONE,
    DEFAULT_CURRENCY: process.env.DEFAULT_CURRENCY,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    FROM_EMAIL: process.env.FROM_EMAIL,
    SENTRY_DSN: process.env.SENTRY_DSN,
    LOG_LEVEL: process.env.LOG_LEVEL,
  });
}
