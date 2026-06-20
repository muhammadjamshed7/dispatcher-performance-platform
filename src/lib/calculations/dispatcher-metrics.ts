export type DispatcherMetrics = {
  totalLoads: number;
  revenue: number;
};

export function calculateDispatcherMetrics(): DispatcherMetrics {
  return {
    totalLoads: 0,
    revenue: 0,
  };
}
