import type { Status } from "@/lib/constants/statuses";
import type { TruckType } from "@/lib/constants/truck-types";
import { TRUCK_TYPES } from "@/lib/constants/truck-types";
import { formatDateRangeLabel } from "@/lib/utils/resolve-date-range-preset";

export type AdminDashboardDatePreset =
  | "today"
  | "this-week"
  | "last-7-days"
  | "this-month"
  | "last-month"
  | "custom";

export type AdminDashboardFilterState = {
  dateRange: AdminDashboardDatePreset;
  customDateFrom: string;
  customDateTo: string;
  teamIds: string[];
  dispatcherIds: string[];
  carrierIds: string[];
  truckTypes: TruckType[];
  statusKeys: string[];
};

export type DashboardStatusFilterOption = {
  key: string;
  label: string;
  statuses: Status[];
};

export const DEFAULT_ADMIN_DASHBOARD_FILTERS: AdminDashboardFilterState = {
  dateRange: "this-month",
  customDateFrom: "",
  customDateTo: "",
  teamIds: [],
  dispatcherIds: [],
  carrierIds: [],
  truckTypes: [],
  statusKeys: [],
};

export const ADMIN_DATE_PRESET_OPTIONS: {
  value: AdminDashboardDatePreset;
  label: string;
}[] = [
  { value: "today", label: "Today" },
  { value: "this-week", label: "This Week" },
  { value: "last-7-days", label: "Last 7 Days" },
  { value: "this-month", label: "This Month" },
  { value: "last-month", label: "Last Month" },
  { value: "custom", label: "Custom Range" },
];

export const DASHBOARD_STATUS_FILTER_OPTIONS: DashboardStatusFilterOption[] = [
  { key: "DELIVERED", label: "Delivered", statuses: ["DELIVERED"] },
  { key: "IN_TRANSIT", label: "In Transit", statuses: ["NOT_WORKING"] },
  { key: "PENDING", label: "Pending", statuses: ["NOT_BOOKED"] },
  { key: "CANCELED", label: "Canceled", statuses: ["CANCELLED"] },
  { key: "BOOKED", label: "Booked", statuses: ["NOT_WORKING"] },
  { key: "NOT_BOOKED", label: "Not Booked", statuses: ["NOT_BOOKED"] },
  {
    key: "BOOKED_BUT_CANCELED",
    label: "Booked but Canceled",
    statuses: [],
  },
];

export const DASHBOARD_TRUCK_TYPE_OPTIONS = TRUCK_TYPES.map((type) => ({
  value: type,
  label: type
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase()),
}));

function formatDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function resolveAdminDateRange(filters: AdminDashboardFilterState): {
  dateFrom: string;
  dateTo: string;
} {
  const now = new Date();
  const dateTo = formatDateKey(now);

  switch (filters.dateRange) {
    case "today":
      return { dateFrom: dateTo, dateTo };
    case "this-week": {
      const start = new Date(now);
      const weekday = now.getUTCDay();
      const mondayOffset = weekday === 0 ? 6 : weekday - 1;
      start.setUTCDate(now.getUTCDate() - mondayOffset);
      return { dateFrom: formatDateKey(start), dateTo };
    }
    case "last-7-days": {
      const start = new Date(now);
      start.setUTCDate(now.getUTCDate() - 6);
      return { dateFrom: formatDateKey(start), dateTo };
    }
    case "last-month": {
      const start = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1),
      );
      const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0));
      return { dateFrom: formatDateKey(start), dateTo: formatDateKey(end) };
    }
    case "custom": {
      if (filters.customDateFrom && filters.customDateTo) {
        return {
          dateFrom: filters.customDateFrom,
          dateTo: filters.customDateTo,
        };
      }
      return {
        dateFrom: filters.customDateFrom || dateTo,
        dateTo: filters.customDateTo || dateTo,
      };
    }
    case "this-month":
    default: {
      const start = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
      );
      return { dateFrom: formatDateKey(start), dateTo };
    }
  }
}

export function resolveStatusKeysToBackend(statusKeys: string[]): Status[] {
  const statuses = new Set<Status>();

  for (const key of statusKeys) {
    const option = DASHBOARD_STATUS_FILTER_OPTIONS.find((item) => item.key === key);
    if (!option) continue;
    for (const status of option.statuses) {
      statuses.add(status);
    }
  }

  return [...statuses];
}

export function dashboardFiltersToParams(
  filters: AdminDashboardFilterState,
): Record<string, string> {
  const { dateFrom, dateTo } = resolveAdminDateRange(filters);
  const params: Record<string, string> = {
    dateFrom,
    dateTo,
    dateRange: filters.dateRange,
  };

  if (filters.dateRange === "custom") {
    if (filters.customDateFrom) params.customDateFrom = filters.customDateFrom;
    if (filters.customDateTo) params.customDateTo = filters.customDateTo;
  }

  if (filters.teamIds.length > 0) {
    params.teamIds = filters.teamIds.join(",");
  }
  if (filters.dispatcherIds.length > 0) {
    params.dispatcherIds = filters.dispatcherIds.join(",");
  }
  if (filters.carrierIds.length > 0) {
    params.carrierIds = filters.carrierIds.join(",");
  }
  if (filters.truckTypes.length > 0) {
    params.truckTypes = filters.truckTypes.join(",");
  }

  const statuses = resolveStatusKeysToBackend(filters.statusKeys);
  if (filters.statusKeys.length > 0) {
    params.statusKeys = filters.statusKeys.join(",");
    if (statuses.length > 0) {
      params.statuses = statuses.join(",");
    }
  }

  return params;
}

function parseCsv(value: string | null): string[] {
  if (!value?.trim()) return [];
  return [...new Set(value.split(",").map((part) => part.trim()).filter(Boolean))];
}

export function parseAdminDashboardFiltersFromSearchParams(
  params: URLSearchParams,
): AdminDashboardFilterState {
  const dateRange = (params.get("dateRange") ??
    "this-month") as AdminDashboardDatePreset;

  const truckTypes = parseCsv(params.get("truckTypes")).filter((value): value is TruckType =>
    TRUCK_TYPES.includes(value as TruckType),
  );

  return {
    dateRange: ADMIN_DATE_PRESET_OPTIONS.some((option) => option.value === dateRange)
      ? dateRange
      : "this-month",
    customDateFrom: params.get("customDateFrom") ?? "",
    customDateTo: params.get("customDateTo") ?? "",
    teamIds: parseCsv(params.get("teams") ?? params.get("teamIds")),
    dispatcherIds: parseCsv(params.get("dispatchers") ?? params.get("dispatcherIds")),
    carrierIds: parseCsv(params.get("carriers") ?? params.get("carrierIds")),
    truckTypes,
    statusKeys: parseCsv(params.get("statuses") ?? params.get("statusKeys")),
  };
}

export function adminDashboardFiltersToSearchParams(
  filters: AdminDashboardFilterState,
): URLSearchParams {
  const params = new URLSearchParams();

  if (filters.dateRange !== DEFAULT_ADMIN_DASHBOARD_FILTERS.dateRange) {
    params.set("dateRange", filters.dateRange);
  }

  if (filters.dateRange === "custom") {
    if (filters.customDateFrom) params.set("customDateFrom", filters.customDateFrom);
    if (filters.customDateTo) params.set("customDateTo", filters.customDateTo);
  }

  if (filters.teamIds.length > 0) {
    params.set("teams", filters.teamIds.join(","));
  }
  if (filters.dispatcherIds.length > 0) {
    params.set("dispatchers", filters.dispatcherIds.join(","));
  }
  if (filters.carrierIds.length > 0) {
    params.set("carriers", filters.carrierIds.join(","));
  }
  if (filters.truckTypes.length > 0) {
    params.set("truckTypes", filters.truckTypes.join(","));
  }
  if (filters.statusKeys.length > 0) {
    params.set("statuses", filters.statusKeys.join(","));
  }

  return params;
}

export function countActiveFilterGroups(filters: AdminDashboardFilterState): number {
  let count = 0;

  if (filters.dateRange !== DEFAULT_ADMIN_DASHBOARD_FILTERS.dateRange) {
    count += 1;
  }
  if (filters.teamIds.length > 0) count += 1;
  if (filters.dispatcherIds.length > 0) count += 1;
  if (filters.carrierIds.length > 0) count += 1;
  if (filters.truckTypes.length > 0) count += 1;
  if (filters.statusKeys.length > 0) count += 1;

  return count;
}

export function isDefaultAdminDashboardFilters(
  filters: AdminDashboardFilterState,
): boolean {
  return countActiveFilterGroups(filters) === 0;
}

export function getDateFilterChipLabel(filters: AdminDashboardFilterState): string {
  const { dateFrom, dateTo } = resolveAdminDateRange(filters);
  return formatDateRangeLabel(dateFrom, dateTo);
}

export function getStatusFilterChipLabel(statusKeys: string[]): string {
  const labels = statusKeys
    .map(
      (key) =>
        DASHBOARD_STATUS_FILTER_OPTIONS.find((option) => option.key === key)?.label,
    )
    .filter(Boolean);

  if (labels.length <= 2) {
    return labels.join(", ");
  }

  return `${labels.slice(0, 2).join(", ")} +${labels.length - 2}`;
}
