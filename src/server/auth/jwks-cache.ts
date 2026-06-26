import "server-only";

import { getPublicEnv } from "@/lib/env";

/**
 * Minimal JSON Web Key shape (structurally compatible with the Supabase JWK
 * type). Kept local so this module has no hard dependency on auth-js internals.
 */
type Jwk = {
  kty: string;
  key_ops?: string[];
  alg?: string;
  kid?: string;
  [key: string]: unknown;
};

const TTL_MS = 10 * 60 * 1000; // 10 minutes

let cachedKeys: Jwk[] | null = null;
let cachedAt = 0;
let inflight: Promise<Jwk[] | null> | null = null;

async function fetchJwks(): Promise<Jwk[] | null> {
  const { NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY } =
    getPublicEnv();

  if (!NEXT_PUBLIC_SUPABASE_URL || !NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return null;
  }

  try {
    const response = await fetch(
      `${NEXT_PUBLIC_SUPABASE_URL}/auth/v1/.well-known/jwks.json`,
      { headers: { apikey: NEXT_PUBLIC_SUPABASE_ANON_KEY } },
    );

    if (!response.ok) {
      return null;
    }

    const body = (await response.json()) as { keys?: Jwk[] };
    return body.keys ?? [];
  } catch {
    return null;
  }
}

/**
 * Returns the project's JWKS (asymmetric JWT signing keys), cached at module
 * scope so it is fetched at most once per TTL across requests — a fresh
 * Supabase client is created per request, so relying on the client's own
 * per-instance cache would re-fetch the keys on every request.
 *
 * Returns an empty array for projects that still use a symmetric (HS256)
 * signing key, in which case callers should let getClaims() fall back to
 * getUser(). Returns null only when the keys are currently unknown.
 */
export async function getCachedJwks(): Promise<Jwk[] | null> {
  const now = Date.now();

  if (cachedKeys && now - cachedAt < TTL_MS) {
    return cachedKeys;
  }

  if (inflight) {
    return inflight;
  }

  inflight = fetchJwks()
    .then((keys) => {
      if (keys) {
        cachedKeys = keys;
        cachedAt = Date.now();
      }
      // Fall back to whatever we had cached if the refresh failed.
      return cachedKeys;
    })
    .finally(() => {
      inflight = null;
    });

  return inflight;
}
