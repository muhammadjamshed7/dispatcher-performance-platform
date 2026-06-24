import { FILTER_ALL } from "@/lib/constants/filters";
import { resolveDateRangePreset } from "@/lib/utils/resolve-date-range-preset";

export type ReportFilterValues = {
  dateRange: string;
  dateFrom: string;
  dateTo: string;
  teamId: string;
  dispatcherId: string;
  carrierId: string;
  truckType: string;
  status: string;
};

export const DEFAULT_REPORT_FILTERS: ReportFilterValues = {
  dateRange: "today",
  dateFrom: "",
  dateTo: "",
  teamId: FILTER_ALL,
  dispatcherId: FILTER_ALL,
  carrierId: FILTER_ALL,
  truckType: FILTER_ALL,
  status: FILTER_ALL,
};

export function reportFiltersToParams(
  period: string,
  filters: ReportFilterValues,
): Record<string, string> {
  const params: Record<string, string> = { period };

  if (period === "CUSTOM") {
    const { dateFrom, dateTo } =
      filters.dateFrom && filters.dateTo
        ? { dateFrom: filters.dateFrom, dateTo: filters.dateTo }
        : resolveDateRangePreset("this-month");
    params.dateFrom = dateFrom;
    params.dateTo = dateTo;
  }

  if (filters.teamId !== FILTER_ALL) params.teamId = filters.teamId;
  if (filters.dispatcherId !== FILTER_ALL)
    params.dispatcherId = filters.dispatcherId;
  if (filters.carrierId !== FILTER_ALL) params.carrierId = filters.carrierId;
  if (filters.truckType !== FILTER_ALL) params.truckType = filters.truckType;
  if (filters.status !== FILTER_ALL) params.status = filters.status;

  return params;
}
