"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { CheckboxFilterGroup } from "@/components/dashboard/admin/filters/checkbox-filter-group";
import { DashboardFilterButton } from "@/components/dashboard/admin/filters/dashboard-filter-button";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useEntityOptions } from "@/hooks/use-entity-options";
import type { TeamStatus } from "@/lib/constants/team-statuses";
import type { TruckType } from "@/lib/constants/truck-types";
import {
  CARRIER_STATUS_OPTIONS,
  CARRIER_TRUCK_TYPE_OPTIONS,
  DEFAULT_CARRIER_EXCEL_FILTERS,
  countActiveCarrierExcelFilters,
  type CarrierExcelFilterState,
} from "@/lib/filters/carrier-excel-filter-params";
import { cn } from "@/lib/utils";

type CarriersExcelFilterControlsProps = {
  appliedFilters: CarrierExcelFilterState;
  onApplyFilters: (filters: CarrierExcelFilterState) => void;
};

type CarriersExcelFilterPopoverProps = {
  open: boolean;
  anchorRef: React.RefObject<HTMLElement | null>;
  draftFilters: CarrierExcelFilterState;
  isLoadingOptions: boolean;
  teamOptions: Array<{ value: string; label: string }>;
  dispatcherOptions: Array<{ value: string; label: string }>;
  onDraftChange: (filters: CarrierExcelFilterState) => void;
  onApply: () => void;
  onReset: () => void;
  onClose: () => void;
};

function CarriersExcelFilterPopover({
  open,
  anchorRef,
  draftFilters,
  isLoadingOptions,
  teamOptions,
  dispatcherOptions,
  onDraftChange,
  onApply,
  onReset,
  onClose,
}: CarriersExcelFilterPopoverProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ top: 80, right: 16 });

  useLayoutEffect(() => {
    if (!open) {
      return;
    }

    const anchorRect = anchorRef.current?.getBoundingClientRect();
    setPosition({
      top: anchorRect ? anchorRect.bottom + 8 : 80,
      right: anchorRect
        ? Math.max(16, window.innerWidth - anchorRect.right)
        : 16,
    });
  }, [anchorRef, open]);

  useEffect(() => {
    if (!open) {
      return;
    }

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

  function patchDraft(next: Partial<CarrierExcelFilterState>) {
    onDraftChange({ ...draftFilters, ...next });
  }

  if (!open || typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div
      ref={panelRef}
      style={{ top: position.top, right: position.right }}
      className={cn(
        "fixed z-50 flex max-h-[70vh] w-[min(400px,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white shadow-[0_20px_50px_rgba(15,23,42,0.15)]",
      )}
    >
      <div className="border-b border-[#F1F5F9] px-5 py-4">
        <h2 className="text-base font-semibold text-[#0F172A]">Filters</h2>
        <p className="mt-1 text-xs text-[#64748B]">
          Refine carriers by team, dispatcher, truck type, or status.
        </p>
      </div>

      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-4">
        {isLoadingOptions && teamOptions.length === 0 ? (
          <p className="py-4 text-center text-xs text-[#94A3B8]">
            Loading filter options...
          </p>
        ) : (
          <>
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
              title="Truck Type"
              searchPlaceholder="Search truck types..."
              options={CARRIER_TRUCK_TYPE_OPTIONS}
              selectedValues={draftFilters.truckTypes}
              onChange={(truckTypes) =>
                patchDraft({ truckTypes: truckTypes as TruckType[] })
              }
            />
            <Separator className="bg-[#F1F5F9]" />

            <CheckboxFilterGroup
              title="Status"
              searchPlaceholder="Search statuses..."
              options={CARRIER_STATUS_OPTIONS}
              selectedValues={draftFilters.statuses}
              onChange={(statuses) =>
                patchDraft({ statuses: statuses as TeamStatus[] })
              }
            />
          </>
        )}
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

export function CarriersExcelFilterControls({
  appliedFilters,
  onApplyFilters,
}: CarriersExcelFilterControlsProps) {
  const buttonRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [draftFilters, setDraftFilters] = useState(appliedFilters);
  const { teams, dispatchers, isLoading } = useEntityOptions();

  const teamOptions = useMemo(
    () => teams.map((team) => ({ value: team.id, label: team.name })),
    [teams],
  );

  const dispatcherOptions = useMemo(
    () =>
      dispatchers.map((dispatcher) => ({
        value: dispatcher.id,
        label: dispatcher.fullName,
      })),
    [dispatchers],
  );

  const activeCount = countActiveCarrierExcelFilters(appliedFilters);

  function openPopover() {
    setDraftFilters(appliedFilters);
    setOpen((current) => !current);
  }

  function handleApply() {
    onApplyFilters(draftFilters);
    setOpen(false);
  }

  function handleReset() {
    const reset = { ...DEFAULT_CARRIER_EXCEL_FILTERS };
    setDraftFilters(reset);
    onApplyFilters(reset);
    setOpen(false);
  }

  return (
    <>
      <div ref={buttonRef}>
        <DashboardFilterButton
          activeCount={activeCount}
          open={open}
          onClick={openPopover}
        />
      </div>

      <CarriersExcelFilterPopover
        open={open}
        anchorRef={buttonRef}
        draftFilters={draftFilters}
        isLoadingOptions={isLoading}
        teamOptions={teamOptions}
        dispatcherOptions={dispatcherOptions}
        onDraftChange={setDraftFilters}
        onApply={handleApply}
        onReset={handleReset}
        onClose={() => setOpen(false)}
      />
    </>
  );
}
