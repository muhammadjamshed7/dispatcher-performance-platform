"use client";

import { Filter } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DATE_RANGE_OPTIONS } from "@/lib/constants/date-ranges";
import { FILTER_ALL } from "@/lib/constants/filters";
import type { AdminDashboardBundle } from "@/lib/types";
import {
  formatDateRangeLabel,
  resolveDateRangePreset,
} from "@/lib/utils/resolve-date-range-preset";

export type DashboardFilterValues = {
  dateRange: string;
  teamId: string;
  dispatcherId: string;
  carrierId: string;
  truckType: string;
  status: string;
};

type DashboardFilterBarProps = {
  values: DashboardFilterValues;
  filterOptions: AdminDashboardBundle["filterOptions"];
  onChange: (values: DashboardFilterValues) => void;
  onReset: () => void;
};

const selectTriggerClassName =
  "flex h-11 w-full items-center justify-between rounded-[10px] border border-[#E2E8F0] bg-white px-3 text-sm text-[#334155] shadow-none";

function DashboardFilterSelect({
  label,
  value,
  displayValue,
  onValueChange,
  children,
}: {
  label: string;
  value: string;
  displayValue?: string;
  onValueChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <label className="text-xs font-medium text-[#64748B]">{label}</label>
      <Select
        value={value}
        onValueChange={(nextValue) => {
          if (nextValue) {
            onValueChange(nextValue);
          }
        }}
      >
        <SelectTrigger className={selectTriggerClassName}>
          <SelectValue placeholder={displayValue ?? label}>
            {displayValue}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>{children}</SelectContent>
      </Select>
    </div>
  );
}

export function DashboardFilterBar({
  values,
  filterOptions,
  onChange,
  onReset,
}: DashboardFilterBarProps) {
  const { dateFrom, dateTo } = resolveDateRangePreset(values.dateRange);
  const dateRangeLabel = formatDateRangeLabel(dateFrom, dateTo);

  const teamLabel =
    values.teamId === FILTER_ALL
      ? "All Teams"
      : (filterOptions.teams.find((team) => team.id === values.teamId)?.name ??
        "All Teams");

  const dispatcherLabel =
    values.dispatcherId === FILTER_ALL
      ? "All Dispatchers"
      : (filterOptions.dispatchers.find(
          (dispatcher) => dispatcher.id === values.dispatcherId,
        )?.name ?? "All Dispatchers");

  const carrierLabel =
    values.carrierId === FILTER_ALL
      ? "All Carriers"
      : (filterOptions.carriers.find((carrier) => carrier.id === values.carrierId)
          ?.name ?? "All Carriers");

  const truckTypeLabel =
    values.truckType === FILTER_ALL
      ? "All Types"
      : (filterOptions.truckTypes.find((type) => type.value === values.truckType)
          ?.label ?? "All Types");

  const statusLabel =
    values.status === FILTER_ALL
      ? "All Status"
      : (filterOptions.statuses.find((status) => status.value === values.status)
          ?.label ?? "All Status");

  const filteredDispatchers =
    values.teamId === FILTER_ALL
      ? filterOptions.dispatchers
      : filterOptions.dispatchers.filter(
          (dispatcher) => dispatcher.teamId === values.teamId,
        );

  const filteredCarriers = filterOptions.carriers.filter((carrier) => {
    if (values.teamId !== FILTER_ALL && carrier.teamId !== values.teamId) {
      return false;
    }

    if (
      values.dispatcherId !== FILTER_ALL &&
      carrier.dispatcherId !== values.dispatcherId
    ) {
      return false;
    }

    return true;
  });

  function patch(next: Partial<DashboardFilterValues>) {
    const merged = { ...values, ...next };

    if (next.teamId !== undefined) {
      const teamDispatchers =
        merged.teamId === FILTER_ALL
          ? filterOptions.dispatchers
          : filterOptions.dispatchers.filter(
              (dispatcher) => dispatcher.teamId === merged.teamId,
            );

      if (
        merged.dispatcherId !== FILTER_ALL &&
        !teamDispatchers.some((dispatcher) => dispatcher.id === merged.dispatcherId)
      ) {
        merged.dispatcherId = FILTER_ALL;
      }
    }

    const visibleCarriers = filterOptions.carriers.filter((carrier) => {
      if (merged.teamId !== FILTER_ALL && carrier.teamId !== merged.teamId) {
        return false;
      }

      if (
        merged.dispatcherId !== FILTER_ALL &&
        carrier.dispatcherId !== merged.dispatcherId
      ) {
        return false;
      }

      return true;
    });

    if (
      merged.carrierId !== FILTER_ALL &&
      !visibleCarriers.some((carrier) => carrier.id === merged.carrierId)
    ) {
      merged.carrierId = FILTER_ALL;
    }

    onChange(merged);
  }

  return (
    <div className="rounded-2xl border border-[#E5E7EB] bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.05)]">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3">
        <DashboardFilterSelect
          label="Date Range"
          value={values.dateRange}
          displayValue={dateRangeLabel}
          onValueChange={(dateRange) => {
            if (dateRange) patch({ dateRange });
          }}
        >
          {DATE_RANGE_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </DashboardFilterSelect>

        <DashboardFilterSelect
          label="Team"
          value={values.teamId}
          displayValue={teamLabel}
          onValueChange={(teamId) => {
            if (teamId) patch({ teamId });
          }}
        >
          <SelectItem value={FILTER_ALL}>All Teams</SelectItem>
          {filterOptions.teams.map((team) => (
            <SelectItem key={team.id} value={team.id}>
              {team.name}
            </SelectItem>
          ))}
        </DashboardFilterSelect>

        <DashboardFilterSelect
          label="Dispatcher"
          value={values.dispatcherId}
          displayValue={dispatcherLabel}
          onValueChange={(dispatcherId) => {
            if (dispatcherId) patch({ dispatcherId });
          }}
        >
          <SelectItem value={FILTER_ALL}>All Dispatchers</SelectItem>
          {filteredDispatchers.map((dispatcher) => (
            <SelectItem key={dispatcher.id} value={dispatcher.id}>
              {dispatcher.name}
            </SelectItem>
          ))}
        </DashboardFilterSelect>

        <DashboardFilterSelect
          label="Carrier"
          value={values.carrierId}
          displayValue={carrierLabel}
          onValueChange={(carrierId) => {
            if (carrierId) patch({ carrierId });
          }}
        >
          <SelectItem value={FILTER_ALL}>All Carriers</SelectItem>
          {filteredCarriers.map((carrier) => (
            <SelectItem key={carrier.id} value={carrier.id}>
              {carrier.name}
            </SelectItem>
          ))}
        </DashboardFilterSelect>

        <DashboardFilterSelect
          label="Truck Type"
          value={values.truckType}
          displayValue={truckTypeLabel}
          onValueChange={(truckType) => {
            if (truckType) patch({ truckType });
          }}
        >
          <SelectItem value={FILTER_ALL}>All Types</SelectItem>
          {filterOptions.truckTypes.map((type) => (
            <SelectItem key={type.value} value={type.value}>
              {type.label}
            </SelectItem>
          ))}
        </DashboardFilterSelect>

        <DashboardFilterSelect
          label="Status"
          value={values.status}
          displayValue={statusLabel}
          onValueChange={(status) => {
            if (status) patch({ status });
          }}
        >
          <SelectItem value={FILTER_ALL}>All Status</SelectItem>
          {filterOptions.statuses.map((status) => (
            <SelectItem key={status.value} value={status.value}>
              {status.label}
            </SelectItem>
          ))}
        </DashboardFilterSelect>

        <div className="flex items-end sm:col-span-2 lg:col-span-1">
          <Button
            type="button"
            variant="outline"
            className="h-11 w-full max-w-none rounded-[10px] border-[#E2E8F0] bg-white text-[#334155] hover:bg-[#F8FAFC] sm:w-auto sm:min-w-[160px]"
            onClick={onReset}
          >
            <Filter className="size-4" />
            Reset Filters
          </Button>
        </div>
      </div>
    </div>
  );
}

export const DEFAULT_DASHBOARD_FILTERS: DashboardFilterValues = {
  dateRange: "this-month",
  teamId: FILTER_ALL,
  dispatcherId: FILTER_ALL,
  carrierId: FILTER_ALL,
  truckType: FILTER_ALL,
  status: FILTER_ALL,
};
