"use client";

import { useRef, useState } from "react";

import type { AdminDashboardBundle } from "@/lib/types";
import {
  countActiveFilterGroups,
  DEFAULT_ADMIN_DASHBOARD_FILTERS,
  type AdminDashboardFilterState,
} from "@/lib/dashboard/admin-dashboard-filters";

import { ActiveFilterChips } from "./active-filter-chips";
import { DashboardFilterButton } from "./dashboard-filter-button";
import { FilterPopover } from "./filter-popover";

type AdminDashboardFilterControlsProps = {
  appliedFilters: AdminDashboardFilterState;
  filterOptions: AdminDashboardBundle["filterOptions"];
  onApplyFilters: (filters: AdminDashboardFilterState) => void;
  showChips?: boolean;
};

export function AdminDashboardFilterControls({
  appliedFilters,
  filterOptions,
  onApplyFilters,
  showChips = true,
}: AdminDashboardFilterControlsProps) {
  const buttonRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [draftFilters, setDraftFilters] = useState(appliedFilters);

  const activeCount = countActiveFilterGroups(appliedFilters);

  function openPopover() {
    setDraftFilters(appliedFilters);
    setOpen((current) => !current);
  }

  function handleApply() {
    onApplyFilters(draftFilters);
    setOpen(false);
  }

  function handleReset() {
    const reset = { ...DEFAULT_ADMIN_DASHBOARD_FILTERS };
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

      <FilterPopover
        open={open}
        anchorRef={buttonRef}
        draftFilters={draftFilters}
        filterOptions={filterOptions}
        onDraftChange={setDraftFilters}
        onApply={handleApply}
        onReset={handleReset}
        onClose={() => setOpen(false)}
      />

      {showChips ? (
        <ActiveFilterChips
          filters={appliedFilters}
          filterOptions={filterOptions}
          onChange={onApplyFilters}
        />
      ) : null}
    </>
  );
}
