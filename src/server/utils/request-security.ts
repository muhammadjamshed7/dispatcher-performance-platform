import "server-only";

import { ForbiddenError } from "@/lib/errors/forbidden-error";

const MUTATION_METHODS = new Set(["POST", "PATCH", "PUT", "DELETE"]);

export function assertSameOrigin(request: Request): void {
  if (!MUTATION_METHODS.has(request.method.toUpperCase())) {
    return;
  }

  const origin = request.headers.get("origin");
  if (!origin) {
    return;
  }

  const host = request.headers.get("host");
  if (!host) {
    return;
  }

  try {
    const originHost = new URL(origin).host;
    if (originHost !== host) {
      throw new ForbiddenError("Cross-origin request blocked.");
    }
  } catch {
    throw new ForbiddenError("Invalid request origin.");
  }
}
