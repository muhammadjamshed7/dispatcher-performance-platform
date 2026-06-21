"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
    <section className="space-y-3">
      <h3 className="text-sm font-semibold text-[#0F172A]">Date Range</h3>
      <div className="space-y-2">
        {ADMIN_DATE_PRESET_OPTIONS.map((option) => (
          <label
            key={option.value}
            className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-2 hover:bg-[#F8FAFC]"
          >
            <input
              type="radio"
              name="dashboard-date-range"
              checked={value.dateRange === option.value}
              onChange={() =>
                onChange({ dateRange: option.value as AdminDashboardDatePreset })
              }
              className="size-4 border-[#CBD5E1] text-[#2563EB] focus:ring-[#2563EB]/30"
            />
            <span className="text-sm text-[#334155]">{option.label}</span>
          </label>
        ))}
      </div>

      {value.dateRange === "custom" ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="dashboard-custom-from" className="text-xs text-[#64748B]">
              From Date
            </Label>
            <Input
              id="dashboard-custom-from"
              type="date"
              value={value.customDateFrom}
              onChange={(event) => onChange({ customDateFrom: event.target.value })}
              className="h-9 rounded-[10px] border-[#E2E8F0] bg-white text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="dashboard-custom-to" className="text-xs text-[#64748B]">
              To Date
            </Label>
            <Input
              id="dashboard-custom-to"
              type="date"
              value={value.customDateTo}
              onChange={(event) => onChange({ customDateTo: event.target.value })}
              className="h-9 rounded-[10px] border-[#E2E8F0] bg-white text-sm"
            />
          </div>
        </div>
      ) : null}
    </section>
  );
}
