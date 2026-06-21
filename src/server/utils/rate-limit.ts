import "server-only";

import { ValidationError } from "@/lib/errors/validation-error";

type Bucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Bucket>();

const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 20;

function getClientKey(request: Request, suffix: string): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() ?? "unknown";
  return `${suffix}:${ip}`;
}

export function assertRateLimit(request: Request, action: string): void {
  const key = getClientKey(request, action);
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || now >= bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return;
  }

  if (bucket.count >= MAX_ATTEMPTS) {
    throw new ValidationError(
      "Too many attempts. Please wait a few minutes and try again.",
    );
  }

  bucket.count += 1;
}
