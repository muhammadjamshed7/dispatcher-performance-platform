export function formatRatePerMile(
  rate: number | null | undefined,
  nullLabel = "N/A",
): string {
  if (rate === null || rate === undefined) {
    return nullLabel;
  }

  return `$${rate.toFixed(2)}/mi`;
}
