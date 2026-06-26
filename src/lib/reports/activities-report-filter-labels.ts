import { ACTIVITY_APPROVAL_LABELS } from "@/lib/constants/activity-approval";
import { DATE_RANGE_OPTIONS } from "@/lib/constants/date-ranges";
import { FILTER_ALL } from "@/lib/constants/filters";
import { getLoadActivityStatusLabel } from "@/lib/constants/status-labels";
import type { ActivityExcelFilterState } from "@/lib/filters/activity-excel-filter-params";
import type { EntityFilterValues } from "@/lib/filters/entity-filter-params";
import type { Carrier, Dispatcher, Team } from "@/lib/types";
import { getCarrierDisplayName } from "@/lib/utils/carrier-display";
import {
  formatDateRangeLabel,
  resolveDateRangePreset,
} from "@/lib/utils/resolve-date-range-preset";

export type ActivitiesReportFilterContext = {
  mode: "entity" | "excel";
  entityFilters: EntityFilterValues;
  excelFilters: ActivityExcelFilterState;
  teams: Team[];
  dispatchers: Dispatcher[];
  carriers: Carrier[];
};

type EntityLookupContext = Pick<
  ActivitiesReportFilterContext,
  "teams" | "dispatchers" | "carriers"
>;

export function buildActivitiesReportDateRangeLabel(dateRange: string): string {
  const preset = DATE_RANGE_OPTIONS.find((option) => option.value === dateRange);
  const { dateFrom, dateTo } = resolveDateRangePreset(dateRange);
  const rangeLabel = formatDateRangeLabel(dateFrom, dateTo);

  return preset ? `${preset.label} (${rangeLabel})` : rangeLabel;
}

function resolveTeamLabel(id: string, context: EntityLookupContext): string {
  return context.teams.find((team) => team.id === id)?.name ?? id;
}

function resolveDispatcherLabel(
  id: string,
  context: EntityLookupContext,
): string {
  return (
    context.dispatchers.find((dispatcher) => dispatcher.id === id)?.fullName ??
    id
  );
}

function resolveCarrierLabel(
  id: string,
  context: EntityLookupContext,
): string {
  const carrier = context.carriers.find((item) => item.id === id);
  return carrier ? getCarrierDisplayName(carrier) : id;
}

function formatTruckTypeLabel(value: string): string {
  return value.replaceAll("_", " ");
}

export function buildEntityFilterSummaryLines(
  filters: EntityFilterValues,
  context: EntityLookupContext,
): string[] {
  const lines = [
    `Date Range: ${buildActivitiesReportDateRangeLabel(filters.dateRange)}`,
  ];

  if (filters.teamId !== FILTER_ALL) {
    lines.push(`Team: ${resolveTeamLabel(filters.teamId, context)}`);
  }

  if (filters.dispatcherId !== FILTER_ALL) {
    lines.push(
      `Dispatcher: ${resolveDispatcherLabel(filters.dispatcherId, context)}`,
    );
  }

  if (filters.carrierId !== FILTER_ALL) {
    lines.push(`Carrier: ${resolveCarrierLabel(filters.carrierId, context)}`);
  }

  if (filters.truckType !== FILTER_ALL) {
    lines.push(`Truck Type: ${formatTruckTypeLabel(filters.truckType)}`);
  }

  if (filters.status !== FILTER_ALL) {
    lines.push(
      `Status: ${getLoadActivityStatusLabel(filters.status as never)}`,
    );
  }

  if (filters.q?.trim()) {
    lines.push(`Search: ${filters.q.trim()}`);
  }

  if (filters.activityId?.trim()) {
    lines.push(`Activity ID: ${filters.activityId.trim()}`);
  }

  return lines;
}

export function buildExcelFilterSummaryLines(
  filters: ActivityExcelFilterState,
  context: EntityLookupContext,
): string[] {
  const lines = [
    `Date Range: ${buildActivitiesReportDateRangeLabel(filters.dateRange)}`,
  ];

  if (filters.teamIds.length > 0) {
    lines.push(
      `Teams: ${filters.teamIds
        .map((id) => resolveTeamLabel(id, context))
        .join(", ")}`,
    );
  }

  if (filters.dispatcherIds.length > 0) {
    lines.push(
      `Dispatchers: ${filters.dispatcherIds
        .map((id) => resolveDispatcherLabel(id, context))
        .join(", ")}`,
    );
  }

  if (filters.carrierIds.length > 0) {
    lines.push(
      `Carriers: ${filters.carrierIds
        .map((id) => resolveCarrierLabel(id, context))
        .join(", ")}`,
    );
  }

  if (filters.truckTypes.length > 0) {
    lines.push(
      `Truck Types: ${filters.truckTypes
        .map((value) => formatTruckTypeLabel(value))
        .join(", ")}`,
    );
  }

  if (filters.statuses.length > 0) {
    lines.push(
      `Statuses: ${filters.statuses
        .map((status) => getLoadActivityStatusLabel(status))
        .join(", ")}`,
    );
  }

  if (filters.approvalStatuses.length > 0) {
    lines.push(
      `Approval: ${filters.approvalStatuses
        .map((status) => ACTIVITY_APPROVAL_LABELS[status])
        .join(", ")}`,
    );
  }

  return lines;
}

export function buildActivitiesReportFilterLines(
  context: ActivitiesReportFilterContext,
): string[] {
  if (context.mode === "excel") {
    return buildExcelFilterSummaryLines(context.excelFilters, context);
  }

  return buildEntityFilterSummaryLines(context.entityFilters, context);
}
