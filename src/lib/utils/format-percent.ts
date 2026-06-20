export function formatPercent(
  value: number | null | undefined,
  fractionDigits = 1,
  nullLabel = "N/A",
): string {
  if (value === null || value === undefined) {
    return nullLabel;
  }

  return `${value.toFixed(fractionDigits)}%`;
}
