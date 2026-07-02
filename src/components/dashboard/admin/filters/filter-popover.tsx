"use client";

import { useMemo } from "react";

import { SharedFilterPopover } from "@/components/filters/shared-filter-popover";
import type { AdminDashboardBundle } from "@/lib/types";
import {
  ADMIN_DATE_PRESET_OPTIONS,
  DASHBOARD_STATUS_FILTER_OPTIONS,
  DASHBOARD_TRUCK_TYPE_OPTIONS,
  type AdminDashboardDatePreset,
  type AdminDashboardFilterState,
} from "@/lib/dashboard/admin-dashboard-filters";

type FilterPopoverProps = {
  open: boolean;
  anchorRef: React.RefObject<HTMLElement | null>;
  draftFilters: AdminDashboardFilterState;
  filterOptions: AdminDashboardBundle["filterOptions"];
  onDraftChange: (filters: AdminDashboardFilterState) => void;
  onApply: () => void;
  onReset: () => void;
  onClose: () => void;
};

export function FilterPopover({
  open,
  anchorRef,
  draftFilters,
  filterOptions,
  onDraftChange,
  onApply,
  onReset,
  onClose,
}: FilterPopoverProps) {
  const teamOptions = useMemo(
    () =>
      filterOptions.teams.map((team) => ({ value: team.id, label: team.name })),
    [filterOptions.teams],
  );

  const scopedDispatchers = useMemo(() => {
    if (draftFilters.teamIds.length === 0) {
      return filterOptions.dispatchers;
    }

    return filterOptions.dispatchers.filter((dispatcher) =>
      draftFilters.teamIds.includes(dispatcher.teamId),
    );
  }, [draftFilters.teamIds, filterOptions.dispatchers]);

  const dispatcherOptions = useMemo(
    () =>
      scopedDispatchers.map((dispatcher) => ({
        value: dispatcher.id,
        label: dispatcher.name,
      })),
    [scopedDispatchers],
  );

  const scopedCarriers = useMemo(() => {
    return filterOptions.carriers.filter((carrier) => {
      if (
        draftFilters.teamIds.length > 0 &&
        !draftFilters.teamIds.includes(carrier.teamId)
      ) {
        return false;
      }

      if (
        draftFilters.dispatcherIds.length > 0 &&
        (!carrier.dispatcherId ||
          !draftFilters.dispatcherIds.includes(carrier.dispatcherId))
      ) {
        return false;
      }

      return true;
    });
  }, [
    draftFilters.dispatcherIds,
    draftFilters.teamIds,
    filterOptions.carriers,
  ]);

  const carrierOptions = useMemo(
    () =>
      scopedCarriers.map((carrier) => ({
        value: carrier.id,
        label: carrier.name,
      })),
    [scopedCarriers],
  );

  function patchDraft(next: Partial<AdminDashboardFilterState>) {
    const merged = { ...draftFilters, ...next };

    if (next.teamIds !== undefined || next.dispatcherIds !== undefined) {
      const teamIds = next.teamIds ?? merged.teamIds;
      const dispatcherIds = next.dispatcherIds ?? merged.dispatcherIds;

      const validDispatchers = filterOptions.dispatchers.filter((dispatcher) =>
        teamIds.length === 0 ? true : teamIds.includes(dispatcher.teamId),
      );
      const validDispatcherIds = new Set(
        validDispatchers.map((dispatcher) => dispatcher.id),
      );

      const validCarriers = filterOptions.carriers.filter((carrier) => {
        if (teamIds.length > 0 && !teamIds.includes(carrier.teamId)) {
          return false;
        }
        if (
          dispatcherIds.length > 0 &&
          (!carrier.dispatcherId ||
            !dispatcherIds.includes(carrier.dispatcherId))
        ) {
          return false;
        }
        return true;
      });
      const validCarrierIds = new Set(
        validCarriers.map((carrier) => carrier.id),
      );

      merged.dispatcherIds = dispatcherIds.filter((id) =>
        validDispatcherIds.has(id),
      );
      merged.carrierIds = merged.carrierIds.filter((id) =>
        validCarrierIds.has(id),
      );
    }

    onDraftChange(merged);
  }

  return (
    <SharedFilterPopover
      open={open}
      anchorRef={anchorRef}
      title="Dashboard Filters"
      description="Choose date range and checkbox filters, then apply."
      dateRange={{
        name: "dashboard-date-range",
        value: draftFilters.dateRange,
        options: ADMIN_DATE_PRESET_OPTIONS,
        onChange: (dateRange) =>
          patchDraft({ dateRange: dateRange as AdminDashboardDatePreset }),
        customDateFrom: draftFilters.customDateFrom,
        customDateTo: draftFilters.customDateTo,
        onCustomDateFromChange: (customDateFrom) =>
          patchDraft({ customDateFrom }),
        onCustomDateToChange: (customDateTo) => patchDraft({ customDateTo }),
      }}
      groups={[
        {
          id: "team",
          title: "Team",
          searchPlaceholder: "Search teams...",
          options: teamOptions,
          selectedValues: draftFilters.teamIds,
          onChange: (teamIds) => patchDraft({ teamIds }),
        },
        {
          id: "dispatcher",
          title: "Dispatcher",
          searchPlaceholder: "Search dispatchers...",
          options: dispatcherOptions,
          selectedValues: draftFilters.dispatcherIds,
          onChange: (dispatcherIds) => patchDraft({ dispatcherIds }),
        },
        {
          id: "carrier",
          title: "Carrier",
          searchPlaceholder: "Search carriers...",
          options: carrierOptions,
          selectedValues: draftFilters.carrierIds,
          onChange: (carrierIds) => patchDraft({ carrierIds }),
        },
        {
          id: "truckType",
          title: "Truck Type",
          searchPlaceholder: "Search truck types...",
          options: DASHBOARD_TRUCK_TYPE_OPTIONS.map((option) => ({
            value: option.value,
            label: option.label,
          })),
          selectedValues: draftFilters.truckTypes,
          onChange: (truckTypes) =>
            patchDraft({
              truckTypes: truckTypes as AdminDashboardFilterState["truckTypes"],
            }),
        },
        {
          id: "status",
          title: "Status",
          searchPlaceholder: "Search statuses...",
          options: DASHBOARD_STATUS_FILTER_OPTIONS.map((option) => ({
            value: option.key,
            label: option.label,
          })),
          selectedValues: draftFilters.statusKeys,
          onChange: (statusKeys) => patchDraft({ statusKeys }),
        },
      ]}
      onApply={onApply}
      onReset={onReset}
      onClose={onClose}
    />
  );
}
