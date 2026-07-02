import { FILTER_ALL } from "@/lib/constants/filters";
import { resolveDateRange } from "@/lib/utils/resolve-date-range";

export type DispatcherDashboardFilterValues = {
  dateRange: string;
  customDateFrom?: string;
  customDateTo?: string;
  carrierId: string;
  truckType: string;
  status: string;
};

export const DEFAULT_DISPATCHER_DASHBOARD_FILTERS: DispatcherDashboardFilterValues =
  {
    dateRange: "today",
    customDateFrom: "",
    customDateTo: "",
    carrierId: FILTER_ALL,
    truckType: FILTER_ALL,
    status: FILTER_ALL,
  };

export function dispatcherDashboardFiltersToParams(
  filters: DispatcherDashboardFilterValues,
): Record<string, string> {
  const { dateFrom, dateTo } = resolveDateRange(filters.dateRange, {
    customDateFrom: filters.customDateFrom,
    customDateTo: filters.customDateTo,
    customIncompleteFallback: "partial",
  });
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
