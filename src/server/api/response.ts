import { NextResponse } from "next/server";
import { AppError } from "@/lib/errors/app-error";
import { ForbiddenError } from "@/lib/errors/forbidden-error";
import { NotFoundError } from "@/lib/errors/not-found-error";
import { ValidationError } from "@/lib/errors/validation-error";
import { UnauthorizedError } from "@/server/auth/require-auth";

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

  if (error instanceof AppError) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  console.error(error);
  return NextResponse.json({ ok: false, error: "Internal server error." }, { status: 500 });
}

export async function handleApi<T>(handler: () => Promise<T>) {
  try {
    const data = await handler();
    return jsonOk(data);
  } catch (error) {
    return jsonError(error);
  }
}
