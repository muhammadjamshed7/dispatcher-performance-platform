import { format } from "date-fns";

export function formatDate(
  value: Date | string | null | undefined,
  pattern = "PPP",
  nullLabel = "N/A",
): string {
  if (!value) {
    return nullLabel;
  }

  const date = typeof value === "string" ? new Date(value) : value;
  return format(date, pattern);
}

export function formatDateShort(
  value: Date | string | null | undefined,
  nullLabel = "—",
): string {
  return formatDate(value, "MMM d, yyyy", nullLabel);
}

export function formatActivityDate(
  value: string | null | undefined,
  nullLabel = "—",
): string {
  if (!value) {
    return nullLabel;
  }

  return value;
}
