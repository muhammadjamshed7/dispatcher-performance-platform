import { FILTER_ALL } from "@/lib/constants/filters";
import { resolveDateRangePreset } from "@/lib/utils/resolve-date-range-preset";

export type DispatcherDashboardFilterValues = {
  dateRange: string;
  carrierId: string;
  truckType: string;
  status: string;
};

export const DEFAULT_DISPATCHER_DASHBOARD_FILTERS: DispatcherDashboardFilterValues =
  {
    dateRange: "this-month",
    carrierId: FILTER_ALL,
    truckType: FILTER_ALL,
    status: FILTER_ALL,
  };

export function dispatcherDashboardFiltersToParams(
  filters: DispatcherDashboardFilterValues,
): Record<string, string> {
  const { dateFrom, dateTo } = resolveDateRangePreset(filters.dateRange);
  const params: Record<string, string> = { dateFrom, dateTo };

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
