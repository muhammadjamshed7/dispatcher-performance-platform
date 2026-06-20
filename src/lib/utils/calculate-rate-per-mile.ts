export function calculateRatePerMile(
  loadAmount: number,
  totalMiles: number,
): number {
  if (totalMiles <= 0) {
    return 0;
  }

  return loadAmount / totalMiles;
}
