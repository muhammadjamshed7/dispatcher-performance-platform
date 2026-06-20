import "server-only";

import { z } from "zod";

import { ValidationError } from "@/lib/errors/validation-error";

export async function parseJsonBody<T extends z.ZodType>(
  request: Request,
  schema: T,
): Promise<z.infer<T>> {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    throw new ValidationError("Invalid JSON body.");
  }

  const result = schema.safeParse(body);

  if (!result.success) {
    throw new ValidationError(
      result.error.issues[0]?.message ?? "Validation failed.",
    );
  }

  return result.data;
}

export function parseSearchParams<T extends z.ZodType>(
  searchParams: URLSearchParams,
  schema: T,
): z.infer<T> {
  const params: Record<string, string> = {};

  searchParams.forEach((value, key) => {
    params[key] = value;
  });

  const result = schema.safeParse(params);

  if (!result.success) {
    throw new ValidationError(
      result.error.issues[0]?.message ?? "Invalid query parameters.",
    );
  }

  return result.data;
}
