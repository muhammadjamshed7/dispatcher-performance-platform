import { FILTER_ALL } from "@/lib/constants/filters";
import type { DashboardFilterValues } from "@/components/dashboard/admin/dashboard-filter-bar";
import { resolveDateRangePreset } from "@/lib/utils/resolve-date-range-preset";

export function dashboardFiltersToParams(
  filters: DashboardFilterValues,
): Record<string, string> {
  const { dateFrom, dateTo } = resolveDateRangePreset(filters.dateRange);
  const params: Record<string, string> = { dateFrom, dateTo };

  if (filters.teamId !== FILTER_ALL) {
    params.teamId = filters.teamId;
  }
  if (filters.dispatcherId !== FILTER_ALL) {
    params.dispatcherId = filters.dispatcherId;
  }
  if (filters.carrierId !== FILTER_ALL) {
    params.carrierId = filters.carrierId;
  }
  if (filters.truckType !== FILTER_ALL) {
    params.truckType = filters.truckType;
  }
  if (filters.status !== FILTER_ALL) {
    params.status = filters.status;
  }

  return params;
}
