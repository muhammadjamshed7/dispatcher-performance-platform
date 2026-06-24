import { NextResponse } from "next/server";

import { AppError } from "@/lib/errors/app-error";
import { ConfigurationError } from "@/lib/errors/configuration-error";
import { isInfrastructureError } from "@/lib/errors/infrastructure-error";
import { ForbiddenError } from "@/lib/errors/forbidden-error";
import { NotFoundError } from "@/lib/errors/not-found-error";
import { ValidationError } from "@/lib/errors/validation-error";
import { UnauthorizedError } from "@/server/auth/require-auth";
import { assertSameOrigin } from "@/server/utils/request-security";

function isDatabaseConnectionError(error: unknown): boolean {
  return isInfrastructureError(error);
}

export function jsonOk<T>(data: T, init?: ResponseInit) {
  return NextResponse.json({ ok: true, data }, init);
}

export function jsonError(error: unknown) {
  if (error instanceof ValidationError) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 400 },
    );
  }

  if (error instanceof UnauthorizedError) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 401 },
    );
  }

  if (error instanceof ForbiddenError) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 403 },
    );
  }

  if (error instanceof NotFoundError) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 404 },
    );
  }

  if (error instanceof ConfigurationError) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 503 },
    );
  }

  if (error instanceof AppError) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 },
    );
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
          "Database runtime error. Verify Supabase configuration and redeploy.",
      },
      { status: 503 },
    );
  }

  if (process.env.NODE_ENV !== "production") {
    console.error(error);
  }

  const payload: {
    ok: false;
    error: string;
    debug?: { name: string; message: string };
  } = {
    ok: false,
    error: "Internal server error.",
  };

  if (process.env.NODE_ENV !== "production" && error instanceof Error) {
    payload.debug = { name: error.name, message: error.message };
  }

  return NextResponse.json(payload, { status: 500 });
}

export async function handleApi<T>(
  handler: () => Promise<T>,
  request?: Request,
) {
  try {
    if (request) {
      assertSameOrigin(request);
    }

    const data = await handler();
    return jsonOk(data);
  } catch (error) {
    return jsonError(error);
  }
}
