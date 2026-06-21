"use client";

import { useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import type { AdminDashboardBundle } from "@/lib/types";
import {
  DASHBOARD_STATUS_FILTER_OPTIONS,
  DASHBOARD_TRUCK_TYPE_OPTIONS,
  type AdminDashboardFilterState,
} from "@/lib/dashboard/admin-dashboard-filters";
import { cn } from "@/lib/utils";

import { CheckboxFilterGroup } from "./checkbox-filter-group";
import { DateRangeFilter } from "./date-range-filter";

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
  const panelRef = useRef<HTMLDivElement>(null);

  const teamOptions = useMemo(
    () => filterOptions.teams.map((team) => ({ value: team.id, label: team.name })),
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
  }, [draftFilters.dispatcherIds, draftFilters.teamIds, filterOptions.carriers]);

  const carrierOptions = useMemo(
    () =>
      scopedCarriers.map((carrier) => ({
        value: carrier.id,
        label: carrier.name,
      })),
    [scopedCarriers],
  );

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (panelRef.current?.contains(target)) return;
      if (anchorRef.current?.contains(target)) return;
      onClose();
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [anchorRef, onClose, open]);

  if (!open || typeof document === "undefined") {
    return null;
  }

  const anchorRect = anchorRef.current?.getBoundingClientRect();
  const top = anchorRect ? anchorRect.bottom + 8 : 80;
  const right = anchorRect
    ? Math.max(16, window.innerWidth - anchorRect.right)
    : 16;

  function patchDraft(next: Partial<AdminDashboardFilterState>) {
    const merged = { ...draftFilters, ...next };

    if (next.teamIds !== undefined || next.dispatcherIds !== undefined) {
      const teamIds = next.teamIds ?? merged.teamIds;
      const dispatcherIds = next.dispatcherIds ?? merged.dispatcherIds;

      const validDispatchers = filterOptions.dispatchers.filter((dispatcher) =>
        teamIds.length === 0 ? true : teamIds.includes(dispatcher.teamId),
      );
      const validDispatcherIds = new Set(validDispatchers.map((dispatcher) => dispatcher.id));

      const validCarriers = filterOptions.carriers.filter((carrier) => {
        if (teamIds.length > 0 && !teamIds.includes(carrier.teamId)) return false;
        if (
          dispatcherIds.length > 0 &&
          (!carrier.dispatcherId || !dispatcherIds.includes(carrier.dispatcherId))
        ) {
          return false;
        }
        return true;
      });
      const validCarrierIds = new Set(validCarriers.map((carrier) => carrier.id));

      merged.dispatcherIds = dispatcherIds.filter((id) => validDispatcherIds.has(id));
      merged.carrierIds = merged.carrierIds.filter((id) => validCarrierIds.has(id));
    }

    onDraftChange(merged);
  }

  return createPortal(
    <div
      ref={panelRef}
      style={{ top, right }}
      className={cn(
        "fixed z-50 flex w-[min(400px,calc(100vw-2rem))] max-h-[70vh] flex-col overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white shadow-[0_20px_50px_rgba(15,23,42,0.15)]",
      )}
    >
      <div className="border-b border-[#F1F5F9] px-5 py-4">
        <h2 className="text-base font-semibold text-[#0F172A]">Dashboard Filters</h2>
        <p className="mt-1 text-xs text-[#64748B]">
          Choose date range and checkbox filters, then apply.
        </p>
      </div>

      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-4">
        <DateRangeFilter value={draftFilters} onChange={patchDraft} />
        <Separator className="bg-[#F1F5F9]" />

        <CheckboxFilterGroup
          title="Team"
          searchPlaceholder="Search teams..."
          options={teamOptions}
          selectedValues={draftFilters.teamIds}
          onChange={(teamIds) => patchDraft({ teamIds })}
        />
        <Separator className="bg-[#F1F5F9]" />

        <CheckboxFilterGroup
          title="Dispatcher"
          searchPlaceholder="Search dispatchers..."
          options={dispatcherOptions}
          selectedValues={draftFilters.dispatcherIds}
          onChange={(dispatcherIds) => patchDraft({ dispatcherIds })}
        />
        <Separator className="bg-[#F1F5F9]" />

        <CheckboxFilterGroup
          title="Carrier"
          searchPlaceholder="Search carriers..."
          options={carrierOptions}
          selectedValues={draftFilters.carrierIds}
          onChange={(carrierIds) => patchDraft({ carrierIds })}
        />
        <Separator className="bg-[#F1F5F9]" />

        <CheckboxFilterGroup
          title="Truck Type"
          searchPlaceholder="Search truck types..."
          options={DASHBOARD_TRUCK_TYPE_OPTIONS.map((option) => ({
            value: option.value,
            label: option.label,
          }))}
          selectedValues={draftFilters.truckTypes}
          onChange={(truckTypes) =>
            patchDraft({ truckTypes: truckTypes as AdminDashboardFilterState["truckTypes"] })
          }
        />
        <Separator className="bg-[#F1F5F9]" />

        <CheckboxFilterGroup
          title="Status"
          searchPlaceholder="Search statuses..."
          options={DASHBOARD_STATUS_FILTER_OPTIONS.map((option) => ({
            value: option.key,
            label: option.label,
          }))}
          selectedValues={draftFilters.statusKeys}
          onChange={(statusKeys) => patchDraft({ statusKeys })}
        />
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-[#F1F5F9] px-5 py-4">
        <Button
          type="button"
          variant="ghost"
          className="text-[#64748B] hover:bg-[#F8FAFC] hover:text-[#334155]"
          onClick={onReset}
        >
          Reset All
        </Button>
        <Button
          type="button"
          className="rounded-[10px] bg-[#2563EB] text-white hover:bg-[#1D4ED8]"
          onClick={onApply}
        >
          Apply Filters
        </Button>
      </div>
    </div>,
    document.body,
  );
}
