import {
  resolveDateRange,
  resolveDateRangeStrict,
} from "@/lib/utils/resolve-date-range";

export function resolveFinanceDateRange(
  preset: string,
  customDateFrom?: string,
  customDateTo?: string,
  timezone?: string,
): { dateFrom: string; dateTo: string } {
  return resolveDateRange(preset, {
    customDateFrom,
    customDateTo,
    weekStart: "sunday",
    timezone,
  });
}

export function resolveFinanceDateRangeStrict(
  preset: string,
  customDateFrom?: string,
  customDateTo?: string,
  timezone?: string,
): { dateFrom: string; dateTo: string } {
  return resolveDateRangeStrict(preset, customDateFrom, customDateTo, {
    weekStart: "sunday",
    timezone,
  });
}
