export function safeRedirectPath(next: string | null | undefined): string {
  if (!next || typeof next !== "string") {
    return "/";
  }

  const trimmed = next.trim();

  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) {
    return "/";
  }

  if (trimmed.includes("\\") || trimmed.includes(":")) {
    return "/";
  }

  return trimmed;
}
