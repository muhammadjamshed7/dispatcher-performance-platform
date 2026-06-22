const SUPABASE_AUTH_COOKIE_PATTERN = /(?:^|;\s*)sb-[^=]+-auth-token(?:\.\d+)?=/;

export function hasSupabaseAuthCookieHeader(cookieHeader: string): boolean {
  return SUPABASE_AUTH_COOKIE_PATTERN.test(cookieHeader);
}

export function hasSupabaseAuthCookiesFromList(
  cookies: ReadonlyArray<{ name: string }>,
): boolean {
  return cookies.some(
    (cookie) =>
      cookie.name.startsWith("sb-") && cookie.name.includes("auth-token"),
  );
}

export function hasSupabaseAuthCookiesInDocument(): boolean {
  if (typeof document === "undefined") {
    return false;
  }

  return hasSupabaseAuthCookieHeader(document.cookie);
}
