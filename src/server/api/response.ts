import { NextResponse } from "next/server";
import { AppError } from "@/lib/errors/app-error";
import { ConfigurationError } from "@/lib/errors/configuration-error";
import { ForbiddenError } from "@/lib/errors/forbidden-error";
import { NotFoundError } from "@/lib/errors/not-found-error";
import { ValidationError } from "@/lib/errors/validation-error";
import { UnauthorizedError } from "@/server/auth/require-auth";

function isDatabaseConnectionError(error: unknown): boolean {
  if (error instanceof AggregateError) {
    return error.errors.some((nested) => isDatabaseConnectionError(nested));
  }

  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();
  const code = "code" in error ? String(error.code) : "";

  return (
    code === "ECONNREFUSED" ||
    code === "ENOTFOUND" ||
    code === "ETIMEDOUT" ||
    code === "ECONNRESET" ||
    message.includes("connect econnrefused") ||
    message.includes("connection terminated") ||
    message.includes("password authentication failed") ||
    message.includes("getaddrinfo") ||
    message.includes("self-signed certificate") ||
    message.includes("timeout expired")
  );
}

export function jsonOk<T>(data: T, init?: ResponseInit) {
  return NextResponse.json({ ok: true, data }, init);
}

export function jsonError(error: unknown) {
  if (error instanceof ValidationError) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  }

  if (error instanceof UnauthorizedError) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 401 });
  }

  if (error instanceof ForbiddenError) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 403 });
  }

  if (error instanceof NotFoundError) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 404 });
  }

  if (error instanceof ConfigurationError) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 503 });
  }

  if (error instanceof AppError) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  if (isDatabaseConnectionError(error)) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Database connection failed. Verify DATABASE_URL on your deployment (use the Supabase pooler URL on Vercel).",
      },
      { status: 503 },
    );
  }

  if (error instanceof Error && error.message.includes("query_compiler")) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Prisma runtime files are missing on the server. Redeploy after updating next.config.ts outputFileTracingIncludes.",
      },
      { status: 503 },
    );
  }

  console.error(error);
  return NextResponse.json(
    {
      ok: false,
      error: "Internal server error.",
      ...(error instanceof Error
        ? { debug: { name: error.name, message: error.message } }
        : {}),
    },
    { status: 500 },
  );
}

export async function handleApi<T>(handler: () => Promise<T>) {
  try {
    const data = await handler();
    return jsonOk(data);
  } catch (error) {
    return jsonError(error);
  }
}
