import { FILTER_ALL } from "@/lib/constants/filters";
import { resolveFinanceDateRange } from "@/lib/utils/resolve-finance-date-range";

export type FinanceFilterValues = {
  dateRange: string;
  dateFrom: string;
  dateTo: string;
  carrierId: string;
  status: string;
};

export const DEFAULT_FINANCE_FILTERS: FinanceFilterValues = {
  dateRange: "this-month",
  dateFrom: "",
  dateTo: "",
  carrierId: FILTER_ALL,
  status: FILTER_ALL,
};

export function financeFiltersToParams(
  filters: FinanceFilterValues,
): Record<string, string> {
  const { dateFrom, dateTo } = resolveFinanceDateRange(
    filters.dateRange,
    filters.dateFrom,
    filters.dateTo,
  );
  const params: Record<string, string> = {
    dateRange: filters.dateRange,
    dateFrom,
    dateTo,
  };

  if (filters.carrierId !== FILTER_ALL) {
    params.carrierId = filters.carrierId;
  }

  if (filters.status !== FILTER_ALL) {
    params.status = filters.status;
  }

  return params;
}
