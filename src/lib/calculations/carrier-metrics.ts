export type CarrierMetrics = {
  totalLoads: number;
  revenue: number;
};

export function calculateCarrierMetrics(): CarrierMetrics {
  return {
    totalLoads: 0,
    revenue: 0,
  };
}
