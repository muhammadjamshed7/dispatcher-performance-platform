"use client";

import { SharedDateRangeFilter } from "@/components/filters/shared-date-range-filter";
import {
  ADMIN_DATE_PRESET_OPTIONS,
  type AdminDashboardDatePreset,
  type AdminDashboardFilterState,
} from "@/lib/dashboard/admin-dashboard-filters";

type DateRangeFilterProps = {
  value: AdminDashboardFilterState;
  onChange: (next: Partial<AdminDashboardFilterState>) => void;
};

export function DateRangeFilter({ value, onChange }: DateRangeFilterProps) {
  return (
    <SharedDateRangeFilter
      name="dashboard-date-range"
      value={value.dateRange}
      options={ADMIN_DATE_PRESET_OPTIONS}
      onChange={(dateRange) =>
        onChange({ dateRange: dateRange as AdminDashboardDatePreset })
      }
      customDateFrom={value.customDateFrom}
      customDateTo={value.customDateTo}
      onCustomDateFromChange={(customDateFrom) => onChange({ customDateFrom })}
      onCustomDateToChange={(customDateTo) => onChange({ customDateTo })}
    />
  );
}
