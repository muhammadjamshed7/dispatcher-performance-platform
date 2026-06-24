import { FILTER_ALL } from "@/lib/constants/filters";
import { resolveDateRangePreset } from "@/lib/utils/resolve-date-range-preset";

export type EntityFilterValues = {
  dateRange: string;
  teamId: string;
  dispatcherId: string;
  carrierId: string;
  truckType: string;
  status: string;
  q?: string;
  activityId?: string;
};

export const DEFAULT_ENTITY_FILTERS: EntityFilterValues = {
  dateRange: "last-30-days",
  teamId: FILTER_ALL,
  dispatcherId: FILTER_ALL,
  carrierId: FILTER_ALL,
  truckType: FILTER_ALL,
  status: FILTER_ALL,
};

function appendFilter(
  params: Record<string, string>,
  key: string,
  value: string,
): void {
  if (value !== FILTER_ALL) {
    params[key] = value;
  }
}

function appendSearchParam(
  params: Record<string, string>,
  value?: string,
): void {
  const trimmed = value?.trim();

  if (trimmed) {
    params.q = trimmed;
  }
}

type SearchParamReader = Pick<URLSearchParams, "get">;

function readFilterParam(
  params: SearchParamReader,
  key: keyof EntityFilterValues,
): string {
  return params.get(key)?.trim() || FILTER_ALL;
}

function readOptionalParam(
  params: SearchParamReader,
  key: keyof EntityFilterValues,
): string | undefined {
  return params.get(key)?.trim() || undefined;
}

export function parseEntityFiltersFromSearchParams(
  params: SearchParamReader,
): EntityFilterValues {
  return {
    dateRange:
      params.get("dateRange")?.trim() || DEFAULT_ENTITY_FILTERS.dateRange,
    teamId: readFilterParam(params, "teamId"),
    dispatcherId: readFilterParam(params, "dispatcherId"),
    carrierId: readFilterParam(params, "carrierId"),
    truckType: readFilterParam(params, "truckType"),
    status: readFilterParam(params, "status"),
    q: readOptionalParam(params, "q"),
    activityId: readOptionalParam(params, "activityId"),
  };
}

export function entityFiltersToActivityParams(
  filters: EntityFilterValues,
): Record<string, string> {
  if (filters.activityId) {
    return { activityId: filters.activityId };
  }

  const { dateFrom, dateTo } = resolveDateRangePreset(filters.dateRange);
  const params: Record<string, string> = { dateFrom, dateTo };

  appendFilter(params, "teamId", filters.teamId);
  appendFilter(params, "dispatcherId", filters.dispatcherId);
  appendFilter(params, "carrierId", filters.carrierId);
  appendFilter(params, "truckType", filters.truckType);
  appendFilter(params, "status", filters.status);
  appendSearchParam(params, filters.q);

  return params;
}

export function entityFiltersToCarrierParams(
  filters: EntityFilterValues,
): Record<string, string> {
  const params: Record<string, string> = {};

  appendFilter(params, "teamId", filters.teamId);
  appendFilter(params, "dispatcherId", filters.dispatcherId);
  appendFilter(params, "carrierId", filters.carrierId);
  appendFilter(params, "truckType", filters.truckType);
  appendFilter(params, "status", filters.status);
  appendSearchParam(params, filters.q);

  return params;
}

export function entityFiltersToRankingParams(
  filters: EntityFilterValues,
): Record<string, string> {
  const params: Record<string, string> = {};

  appendFilter(params, "teamId", filters.teamId);
  appendFilter(params, "dispatcherId", filters.dispatcherId);

  return params;
}

export function entityFiltersToDispatcherParams(
  filters: EntityFilterValues,
): Record<string, string> {
  const params: Record<string, string> = {};
  appendFilter(params, "teamId", filters.teamId);
  appendFilter(params, "dispatcherId", filters.dispatcherId);
  appendSearchParam(params, filters.q);
  return params;
}
