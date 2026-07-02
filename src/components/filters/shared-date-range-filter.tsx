"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type SharedDateRangeOption = {
  value: string;
  label: string;
};

type SharedDateRangeFilterProps = {
  name: string;
  value: string;
  options: SharedDateRangeOption[];
  onChange: (value: string) => void;
  customDateFrom?: string;
  customDateTo?: string;
  onCustomDateFromChange?: (value: string) => void;
  onCustomDateToChange?: (value: string) => void;
};

export function SharedDateRangeFilter({
  name,
  value,
  options,
  onChange,
  customDateFrom,
  customDateTo,
  onCustomDateFromChange,
  onCustomDateToChange,
}: SharedDateRangeFilterProps) {
  const showCustomRange =
    value === "custom" && onCustomDateFromChange && onCustomDateToChange;

  return (
    <section className="space-y-3">
      <h3 className="text-sm font-semibold text-[#0F172A]">Date Range</h3>
      <div className="space-y-2">
        {options.map((option) => (
          <label
            key={option.value}
            className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-2 hover:bg-[#F8FAFC]"
          >
            <input
              type="radio"
              name={name}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
              className="size-4 border-[#CBD5E1] text-[#2563EB] focus:ring-[#2563EB]/30"
            />
            <span className="text-sm text-[#334155]">{option.label}</span>
          </label>
        ))}
      </div>

      {showCustomRange ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label
              htmlFor={`${name}-custom-from`}
              className="text-xs text-[#64748B]"
            >
              From Date
            </Label>
            <Input
              id={`${name}-custom-from`}
              type="date"
              value={customDateFrom ?? ""}
              onChange={(event) => onCustomDateFromChange(event.target.value)}
              className="h-9 rounded-[10px] border-[#E2E8F0] bg-white text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label
              htmlFor={`${name}-custom-to`}
              className="text-xs text-[#64748B]"
            >
              To Date
            </Label>
            <Input
              id={`${name}-custom-to`}
              type="date"
              value={customDateTo ?? ""}
              onChange={(event) => onCustomDateToChange(event.target.value)}
              className="h-9 rounded-[10px] border-[#E2E8F0] bg-white text-sm"
            />
          </div>
        </div>
      ) : null}
    </section>
  );
}
