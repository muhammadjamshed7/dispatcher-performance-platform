import { FILTER_ALL } from "@/lib/constants/filters";
import {
  TEAM_STATUSES,
  type TeamStatus,
} from "@/lib/constants/team-statuses";
import { TRUCK_TYPES, type TruckType } from "@/lib/constants/truck-types";

export type CarrierExcelFilterState = {
  teamIds: string[];
  dispatcherIds: string[];
  truckTypes: TruckType[];
  statuses: TeamStatus[];
};

export const DEFAULT_CARRIER_EXCEL_FILTERS: CarrierExcelFilterState = {
  teamIds: [],
  dispatcherIds: [],
  truckTypes: [],
  statuses: [],
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

export function parseCarrierExcelFiltersFromSearchParams(
  params: Pick<URLSearchParams, "get">,
): CarrierExcelFilterState {
  const legacyTeamId = params.get("teamId")?.trim();
  const legacyDispatcherId = params.get("dispatcherId")?.trim();
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
  ].filter((value): value is TeamStatus =>
    TEAM_STATUSES.includes(value as TeamStatus),
  );

  return {
    teamIds: [...new Set(teamIds)],
    dispatcherIds: [...new Set(dispatcherIds)],
    truckTypes: [...new Set(truckTypes)],
    statuses: [...new Set(statuses)],
  };
}

export function carrierExcelFiltersToParams(
  filters: CarrierExcelFilterState,
): Record<string, string> {
  const params: Record<string, string> = {};

  if (filters.teamIds.length > 0) {
    params.teamIds = filters.teamIds.join(",");
  }
  if (filters.dispatcherIds.length > 0) {
    params.dispatcherIds = filters.dispatcherIds.join(",");
  }
  if (filters.truckTypes.length > 0) {
    params.truckTypes = filters.truckTypes.join(",");
  }
  if (filters.statuses.length > 0) {
    params.statuses = filters.statuses.join(",");
  }

  return params;
}

export function carrierExcelFiltersToSearchParams(
  filters: CarrierExcelFilterState,
): URLSearchParams {
  const params = new URLSearchParams();

  if (filters.teamIds.length > 0) {
    params.set("teamIds", filters.teamIds.join(","));
  }
  if (filters.dispatcherIds.length > 0) {
    params.set("dispatcherIds", filters.dispatcherIds.join(","));
  }
  if (filters.truckTypes.length > 0) {
    params.set("truckTypes", filters.truckTypes.join(","));
  }
  if (filters.statuses.length > 0) {
    params.set("statuses", filters.statuses.join(","));
  }

  return params;
}

export function countActiveCarrierExcelFilters(
  filters: CarrierExcelFilterState,
): number {
  let count = 0;

  if (filters.teamIds.length > 0) count += 1;
  if (filters.dispatcherIds.length > 0) count += 1;
  if (filters.truckTypes.length > 0) count += 1;
  if (filters.statuses.length > 0) count += 1;

  return count;
}

export function formatTruckTypeLabel(value: TruckType): string {
  return value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export const CARRIER_TRUCK_TYPE_OPTIONS = TRUCK_TYPES.map((value) => ({
  value,
  label: formatTruckTypeLabel(value),
}));

export const CARRIER_STATUS_OPTIONS = TEAM_STATUSES.map((value) => ({
  value,
  label: value.replaceAll("_", " "),
}));
