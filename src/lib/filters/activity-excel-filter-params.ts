import {
  ACTIVITY_APPROVAL_LABELS,
  ACTIVITY_APPROVAL_STATUSES,
  type ActivityApprovalStatus,
} from "@/lib/constants/activity-approval";
import { FILTER_ALL } from "@/lib/constants/filters";
import { DATE_RANGE_OPTIONS } from "@/lib/constants/date-ranges";
import { getLoadActivityStatusLabel } from "@/lib/constants/status-labels";
import { STATUSES, type Status } from "@/lib/constants/statuses";
import { TRUCK_TYPES, type TruckType } from "@/lib/constants/truck-types";
import { CARRIER_TRUCK_TYPE_OPTIONS } from "@/lib/filters/carrier-excel-filter-params";
import { resolveDateRangePreset } from "@/lib/utils/resolve-date-range-preset";

export type ActivityExcelFilterState = {
  dateRange: string;
  teamIds: string[];
  dispatcherIds: string[];
  carrierIds: string[];
  truckTypes: TruckType[];
  statuses: Status[];
  approvalStatuses: ActivityApprovalStatus[];
};

export const DEFAULT_ACTIVITY_EXCEL_FILTERS: ActivityExcelFilterState = {
  dateRange: "last-30-days",
  teamIds: [],
  dispatcherIds: [],
  carrierIds: [],
  truckTypes: [],
  statuses: [],
  approvalStatuses: [],
};

function parseCsv(value: string | null | undefined): string[] {
  if (!value?.trim()) {
    return [];
  }

  return [
    ...new Set(
      value
        .split(",")
        .map((part) => part.trim())
        .filter((part) => part && part !== FILTER_ALL),
    ),
  ];
}

export function parseActivityExcelFiltersFromSearchParams(
  params: Pick<URLSearchParams, "get">,
): ActivityExcelFilterState {
  const legacyTeamId = params.get("teamId")?.trim();
  const legacyDispatcherId = params.get("dispatcherId")?.trim();
  const legacyCarrierId = params.get("carrierId")?.trim();
  const legacyTruckType = params.get("truckType")?.trim();
  const legacyStatus = params.get("status")?.trim();

  const teamIds = [
    ...parseCsv(params.get("teamIds") ?? params.get("teams")),
    ...(legacyTeamId && legacyTeamId !== FILTER_ALL ? [legacyTeamId] : []),
  ];
  const dispatcherIds = [
    ...parseCsv(params.get("dispatcherIds") ?? params.get("dispatchers")),
    ...(legacyDispatcherId && legacyDispatcherId !== FILTER_ALL
      ? [legacyDispatcherId]
      : []),
  ];
  const carrierIds = [
    ...parseCsv(params.get("carrierIds") ?? params.get("carriers")),
    ...(legacyCarrierId && legacyCarrierId !== FILTER_ALL
      ? [legacyCarrierId]
      : []),
  ];
  const truckTypes = [
    ...parseCsv(params.get("truckTypes")),
    ...(legacyTruckType && legacyTruckType !== FILTER_ALL
      ? [legacyTruckType]
      : []),
  ].filter((value): value is TruckType =>
    TRUCK_TYPES.includes(value as TruckType),
  );
  const statuses = [
    ...parseCsv(params.get("statuses")),
    ...(legacyStatus && legacyStatus !== FILTER_ALL ? [legacyStatus] : []),
  ].filter((value): value is Status => STATUSES.includes(value as Status));

  const legacyApprovalStatus = params.get("approvalStatus")?.trim();
  const approvalStatuses = [
    ...parseCsv(params.get("approvalStatuses")),
    ...(legacyApprovalStatus && legacyApprovalStatus !== FILTER_ALL
      ? [legacyApprovalStatus]
      : []),
  ].filter((value): value is ActivityApprovalStatus =>
    ACTIVITY_APPROVAL_STATUSES.includes(value as ActivityApprovalStatus),
  );

  const dateRange =
    params.get("dateRange")?.trim() || DEFAULT_ACTIVITY_EXCEL_FILTERS.dateRange;

  return {
    dateRange: DATE_RANGE_OPTIONS.some((option) => option.value === dateRange)
      ? dateRange
      : DEFAULT_ACTIVITY_EXCEL_FILTERS.dateRange,
    teamIds: [...new Set(teamIds)],
    dispatcherIds: [...new Set(dispatcherIds)],
    carrierIds: [...new Set(carrierIds)],
    truckTypes: [...new Set(truckTypes)],
    statuses: [...new Set(statuses)],
    approvalStatuses: [...new Set(approvalStatuses)],
  };
}

export function activityExcelFiltersToParams(
  filters: ActivityExcelFilterState,
): Record<string, string> {
  const { dateFrom, dateTo } = resolveDateRangePreset(filters.dateRange);
  const params: Record<string, string> = {
    dateFrom,
    dateTo,
    dateRange: filters.dateRange,
  };

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
  if (filters.statuses.length > 0) {
    params.statuses = filters.statuses.join(",");
  }
  if (filters.approvalStatuses.length > 0) {
    params.approvalStatuses = filters.approvalStatuses.join(",");
  }

  return params;
}

export function countActiveActivityExcelFilters(
  filters: ActivityExcelFilterState,
): number {
  let count = 0;

  if (filters.dateRange !== DEFAULT_ACTIVITY_EXCEL_FILTERS.dateRange) {
    count += 1;
  }
  if (filters.teamIds.length > 0) count += 1;
  if (filters.dispatcherIds.length > 0) count += 1;
  if (filters.carrierIds.length > 0) count += 1;
  if (filters.truckTypes.length > 0) count += 1;
  if (filters.statuses.length > 0) count += 1;
  if (filters.approvalStatuses.length > 0) count += 1;

  return count;
}

export const ACTIVITY_DATE_RANGE_OPTIONS = DATE_RANGE_OPTIONS;

export const ACTIVITY_STATUS_OPTIONS = STATUSES.map((value) => ({
  value,
  label: getLoadActivityStatusLabel(value),
}));

export const ACTIVITY_APPROVAL_STATUS_OPTIONS = ACTIVITY_APPROVAL_STATUSES.map(
  (value) => ({
    value,
    label: ACTIVITY_APPROVAL_LABELS[value],
  }),
);

export { CARRIER_TRUCK_TYPE_OPTIONS as ACTIVITY_TRUCK_TYPE_OPTIONS };
