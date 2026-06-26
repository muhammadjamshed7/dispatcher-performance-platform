"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { CheckboxFilterGroup } from "@/components/dashboard/admin/filters/checkbox-filter-group";
import { DashboardFilterButton } from "@/components/dashboard/admin/filters/dashboard-filter-button";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useEntityOptions } from "@/hooks/use-entity-options";
import type { Status } from "@/lib/constants/statuses";
import type { TruckType } from "@/lib/constants/truck-types";
import {
  ACTIVITY_APPROVAL_STATUS_OPTIONS,
  ACTIVITY_DATE_RANGE_OPTIONS,
  ACTIVITY_STATUS_OPTIONS,
  ACTIVITY_TRUCK_TYPE_OPTIONS,
  DEFAULT_ACTIVITY_EXCEL_FILTERS,
  countActiveActivityExcelFilters,
  type ActivityExcelFilterState,
} from "@/lib/filters/activity-excel-filter-params";
import type { ActivityApprovalStatus } from "@/lib/constants/activity-approval";
import { getCarrierDisplayName } from "@/lib/utils/carrier-display";
import { cn } from "@/lib/utils";

type ActivitiesExcelFilterControlsProps = {
  appliedFilters: ActivityExcelFilterState;
  onApplyFilters: (filters: ActivityExcelFilterState) => void;
};

type ActivitiesExcelFilterPopoverProps = {
  open: boolean;
  anchorRef: React.RefObject<HTMLElement | null>;
  draftFilters: ActivityExcelFilterState;
  isLoadingOptions: boolean;
  teamOptions: Array<{ value: string; label: string }>;
  dispatcherOptions: Array<{ value: string; label: string }>;
  carrierOptions: Array<{ value: string; label: string }>;
  onDraftChange: (filters: ActivityExcelFilterState) => void;
  onApply: () => void;
  onReset: () => void;
  onClose: () => void;
};

function ActivityDateRangeFilter({
  value,
  onChange,
}: {
  value: string;
  onChange: (dateRange: string) => void;
}) {
  return (
    <section className="space-y-3">
      <h3 className="text-sm font-semibold text-[#0F172A]">Date Range</h3>
      <div className="space-y-1">
        {ACTIVITY_DATE_RANGE_OPTIONS.map((option) => (
          <label
            key={option.value}
            className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-2 hover:bg-[#F8FAFC]"
          >
            <input
              type="radio"
              name="activity-date-range"
              checked={value === option.value}
              onChange={() => onChange(option.value)}
              className="size-4 border-[#CBD5E1] text-[#2563EB] focus:ring-[#2563EB]/30"
            />
            <span className="text-sm text-[#334155]">{option.label}</span>
          </label>
        ))}
      </div>
    </section>
  );
}

function ActivitiesExcelFilterPopover({
  open,
  anchorRef,
  draftFilters,
  isLoadingOptions,
  teamOptions,
  dispatcherOptions,
  carrierOptions,
  onDraftChange,
  onApply,
  onReset,
  onClose,
}: ActivitiesExcelFilterPopoverProps) {
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

  function patchDraft(next: Partial<ActivityExcelFilterState>) {
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
          Refine activities by date, team, dispatcher, carrier, truck type,
          status, or approval status.
        </p>
      </div>

      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-4">
        <ActivityDateRangeFilter
          value={draftFilters.dateRange}
          onChange={(dateRange) => patchDraft({ dateRange })}
        />
        <Separator className="bg-[#F1F5F9]" />

        {isLoadingOptions &&
        teamOptions.length === 0 &&
        dispatcherOptions.length === 0 &&
        carrierOptions.length === 0 ? (
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
              options={ACTIVITY_TRUCK_TYPE_OPTIONS}
              selectedValues={draftFilters.truckTypes}
              onChange={(truckTypes) =>
                patchDraft({ truckTypes: truckTypes as TruckType[] })
              }
            />
            <Separator className="bg-[#F1F5F9]" />

            <CheckboxFilterGroup
              title="Status"
              searchPlaceholder="Search statuses..."
              options={ACTIVITY_STATUS_OPTIONS}
              selectedValues={draftFilters.statuses}
              onChange={(statuses) =>
                patchDraft({ statuses: statuses as Status[] })
              }
            />
            <Separator className="bg-[#F1F5F9]" />

            <CheckboxFilterGroup
              title="Approval Status"
              searchPlaceholder="Search approval statuses..."
              options={ACTIVITY_APPROVAL_STATUS_OPTIONS}
              selectedValues={draftFilters.approvalStatuses}
              onChange={(approvalStatuses) =>
                patchDraft({
                  approvalStatuses:
                    approvalStatuses as ActivityApprovalStatus[],
                })
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

export function ActivitiesExcelFilterControls({
  appliedFilters,
  onApplyFilters,
}: ActivitiesExcelFilterControlsProps) {
  const buttonRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [draftFilters, setDraftFilters] = useState(appliedFilters);
  const { teams, dispatchers, carriers, isLoading } = useEntityOptions();

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

  const carrierOptions = useMemo(
    () =>
      carriers.map((carrier) => ({
        value: carrier.id,
        label: getCarrierDisplayName(carrier),
      })),
    [carriers],
  );

  const activeCount = countActiveActivityExcelFilters(appliedFilters);

  function openPopover() {
    setDraftFilters(appliedFilters);
    setOpen((current) => !current);
  }

  function handleApply() {
    onApplyFilters(draftFilters);
    setOpen(false);
  }

  function handleReset() {
    const reset = { ...DEFAULT_ACTIVITY_EXCEL_FILTERS };
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

      <ActivitiesExcelFilterPopover
        open={open}
        anchorRef={buttonRef}
        draftFilters={draftFilters}
        isLoadingOptions={isLoading}
        teamOptions={teamOptions}
        dispatcherOptions={dispatcherOptions}
        carrierOptions={carrierOptions}
        onDraftChange={setDraftFilters}
        onApply={handleApply}
        onReset={handleReset}
        onClose={() => setOpen(false)}
      />
    </>
  );
}
