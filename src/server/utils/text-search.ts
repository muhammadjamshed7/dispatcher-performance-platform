import "server-only";

export function escapeIlikePattern(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

export function buildIlikeOr(columns: string[], query: string): string {
  const pattern = `%${escapeIlikePattern(query)}%`;
  const needsQuotes = /[,.()]/.test(query);
  const formatted = needsQuotes ? `"${pattern}"` : pattern;

  return columns.map((column) => `${column}.ilike.${formatted}`).join(",");
}
