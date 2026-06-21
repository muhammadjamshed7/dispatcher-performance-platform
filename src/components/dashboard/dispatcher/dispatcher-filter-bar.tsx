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
import type { DispatcherDashboardFilterValues } from "@/lib/dashboard/dispatcher-filter-params";
import type { DispatcherDashboardBundle } from "@/lib/types";
import {
  formatDateRangeLabel,
  resolveDateRangePreset,
} from "@/lib/utils/resolve-date-range-preset";

export type { DispatcherDashboardFilterValues } from "@/lib/dashboard/dispatcher-filter-params";
export { DEFAULT_DISPATCHER_DASHBOARD_FILTERS as DEFAULT_DISPATCHER_FILTERS } from "@/lib/dashboard/dispatcher-filter-params";

type DispatcherFilterBarProps = {
  values: DispatcherDashboardFilterValues;
  filterOptions: DispatcherDashboardBundle["filterOptions"];
  onChange: (values: DispatcherDashboardFilterValues) => void;
  onReset: () => void;
};

const selectTriggerClassName =
  "flex h-11 w-full items-center justify-between rounded-[10px] border border-[#E2E8F0] bg-white px-3 text-sm text-[#334155] shadow-none";

function FilterSelect({
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

export function DispatcherFilterBar({
  values,
  filterOptions,
  onChange,
  onReset,
}: DispatcherFilterBarProps) {
  const { dateFrom, dateTo } = resolveDateRangePreset(values.dateRange);
  const dateRangeLabel = formatDateRangeLabel(dateFrom, dateTo);

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

  function patch(next: Partial<DispatcherDashboardFilterValues>) {
    onChange({ ...values, ...next });
  }

  return (
    <div className="rounded-2xl border border-[#E5E7EB] bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.05)]">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <FilterSelect
          label="Date Range"
          value={values.dateRange}
          displayValue={dateRangeLabel}
          onValueChange={(dateRange) => patch({ dateRange })}
        >
          {DATE_RANGE_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </FilterSelect>

        <FilterSelect
          label="Carrier"
          value={values.carrierId}
          displayValue={carrierLabel}
          onValueChange={(carrierId) => patch({ carrierId })}
        >
          <SelectItem value={FILTER_ALL}>All Carriers</SelectItem>
          {filterOptions.carriers.map((carrier) => (
            <SelectItem key={carrier.id} value={carrier.id}>
              {carrier.name}
            </SelectItem>
          ))}
        </FilterSelect>

        <FilterSelect
          label="Status"
          value={values.status}
          displayValue={statusLabel}
          onValueChange={(status) => patch({ status })}
        >
          <SelectItem value={FILTER_ALL}>All Status</SelectItem>
          {filterOptions.statuses.map((status) => (
            <SelectItem key={status.value} value={status.value}>
              {status.label}
            </SelectItem>
          ))}
        </FilterSelect>

        <FilterSelect
          label="Truck Type"
          value={values.truckType}
          displayValue={truckTypeLabel}
          onValueChange={(truckType) => patch({ truckType })}
        >
          <SelectItem value={FILTER_ALL}>All Types</SelectItem>
          {filterOptions.truckTypes.map((type) => (
            <SelectItem key={type.value} value={type.value}>
              {type.label}
            </SelectItem>
          ))}
        </FilterSelect>

        <div className="flex items-end">
          <Button
            type="button"
            variant="outline"
            className="h-11 w-full rounded-[10px] border-[#E2E8F0] bg-white text-[#334155] hover:bg-[#F8FAFC] sm:w-auto sm:min-w-[140px]"
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
