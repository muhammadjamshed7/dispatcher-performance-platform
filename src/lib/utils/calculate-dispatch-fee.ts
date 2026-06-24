export type CalculateDispatchFeeOptions = {
  minimumFee?: number;
  roundToNearestDollar?: boolean;
};

export function calculateDispatchFee(
  loadAmount: number,
  dispatchFeePercentage: number,
  options: CalculateDispatchFeeOptions = {},
): number {
  const percentageFee = loadAmount * (dispatchFeePercentage / 100);
  const fee = Math.max(percentageFee, options.minimumFee ?? 0);

  if (options.roundToNearestDollar) {
    return Math.round(fee);
  }

  return Math.round(fee * 100) / 100;
}
