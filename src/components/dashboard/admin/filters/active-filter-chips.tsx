"use client";

import { X } from "lucide-react";

import type { AdminDashboardBundle } from "@/lib/types";
import {
  DASHBOARD_TRUCK_TYPE_OPTIONS,
  DEFAULT_ADMIN_DASHBOARD_FILTERS,
  getDateFilterChipLabel,
  getStatusFilterChipLabel,
  type AdminDashboardFilterState,
} from "@/lib/dashboard/admin-dashboard-filters";

type ActiveFilterChipsProps = {
  filters: AdminDashboardFilterState;
  filterOptions: AdminDashboardBundle["filterOptions"];
  onChange: (filters: AdminDashboardFilterState) => void;
};

function FilterChip({
  label,
  onRemove,
}: {
  label: string;
  onRemove: () => void;
}) {
  return (
    <span className="inline-flex max-w-full items-center gap-1 rounded-full border border-[#E2E8F0] bg-white px-3 py-1 text-xs text-[#334155] shadow-sm">
      <span className="truncate">{label}</span>
      <button
        type="button"
        onClick={onRemove}
        className="rounded-full p-0.5 text-[#94A3B8] hover:bg-[#F8FAFC] hover:text-[#475569]"
        aria-label={`Remove ${label}`}
      >
        <X className="size-3.5" />
      </button>
    </span>
  );
}

export function ActiveFilterChips({
  filters,
  filterOptions,
  onChange,
}: ActiveFilterChipsProps) {
  const chips: { key: string; label: string; onRemove: () => void }[] = [];

  if (filters.dateRange !== DEFAULT_ADMIN_DASHBOARD_FILTERS.dateRange) {
    chips.push({
      key: "date",
      label: `Date: ${getDateFilterChipLabel(filters)}`,
      onRemove: () =>
        onChange({
          ...filters,
          dateRange: DEFAULT_ADMIN_DASHBOARD_FILTERS.dateRange,
          customDateFrom: "",
          customDateTo: "",
        }),
    });
  }

  if (filters.teamIds.length > 0) {
    chips.push({
      key: "teams",
      label:
        filters.teamIds.length === 1
          ? `Team: ${
              filterOptions.teams.find((team) => team.id === filters.teamIds[0])
                ?.name ?? "Selected"
            }`
          : `Teams: ${filters.teamIds.length} selected`,
      onRemove: () => onChange({ ...filters, teamIds: [] }),
    });
  }

  if (filters.dispatcherIds.length > 0) {
    chips.push({
      key: "dispatchers",
      label:
        filters.dispatcherIds.length === 1
          ? `Dispatcher: ${
              filterOptions.dispatchers.find(
                (dispatcher) => dispatcher.id === filters.dispatcherIds[0],
              )?.name ?? "Selected"
            }`
          : `Dispatchers: ${filters.dispatcherIds.length} selected`,
      onRemove: () => onChange({ ...filters, dispatcherIds: [] }),
    });
  }

  if (filters.carrierIds.length > 0) {
    chips.push({
      key: "carriers",
      label:
        filters.carrierIds.length === 1
          ? `Carrier: ${
              filterOptions.carriers.find(
                (carrier) => carrier.id === filters.carrierIds[0],
              )?.name ?? "Selected"
            }`
          : `Carriers: ${filters.carrierIds.length} selected`,
      onRemove: () => onChange({ ...filters, carrierIds: [] }),
    });
  }

  if (filters.truckTypes.length > 0) {
    const labels = filters.truckTypes.map(
      (type) =>
        DASHBOARD_TRUCK_TYPE_OPTIONS.find((option) => option.value === type)
          ?.label ?? type,
    );
    chips.push({
      key: "trucks",
      label:
        labels.length <= 2
          ? `Truck: ${labels.join(", ")}`
          : `Truck Types: ${labels.length} selected`,
      onRemove: () => onChange({ ...filters, truckTypes: [] }),
    });
  }

  if (filters.statusKeys.length > 0) {
    chips.push({
      key: "status",
      label: `Status: ${getStatusFilterChipLabel(filters.statusKeys)}`,
      onRemove: () => onChange({ ...filters, statusKeys: [] }),
    });
  }

  if (chips.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {chips.map((chip) => (
        <FilterChip
          key={chip.key}
          label={chip.label}
          onRemove={chip.onRemove}
        />
      ))}
      <button
        type="button"
        onClick={() => onChange({ ...DEFAULT_ADMIN_DASHBOARD_FILTERS })}
        className="text-xs font-medium text-[#2563EB] hover:text-[#1D4ED8]"
      >
        Clear all
      </button>
    </div>
  );
}
