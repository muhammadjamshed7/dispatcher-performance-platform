export function formatNullableText(
  value: string | null | undefined,
  nullLabel = "N/A",
): string {
  if (!value?.trim()) {
    return nullLabel;
  }

  return value;
}

export function formatNullableNumber(
  value: number | null | undefined,
  nullLabel = "N/A",
): string {
  if (value === null || value === undefined) {
    return nullLabel;
  }

  return value.toString();
}
