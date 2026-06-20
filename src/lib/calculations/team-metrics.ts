export type TeamMetrics = {
  totalLoads: number;
  revenue: number;
};

export function calculateTeamMetrics(): TeamMetrics {
  return {
    totalLoads: 0,
    revenue: 0,
  };
}
