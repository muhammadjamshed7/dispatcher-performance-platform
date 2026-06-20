export function calculateDispatchFee(
  loadAmount: number,
  dispatchFeePercentage: number,
): number {
  return loadAmount * (dispatchFeePercentage / 100);
}

/** @deprecated Use calculateDispatchFee */
export const calculateDispatchFeeEarned = calculateDispatchFee;
