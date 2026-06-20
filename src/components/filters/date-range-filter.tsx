"use client";

import { FilterField } from "@/components/filters/filter-field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MOCK_DATE_RANGE_OPTIONS } from "@/lib/mock-data";

type DateRangeFilterProps = {
  value?: string;
  onValueChange?: (value: string | null) => void;
  disabled?: boolean;
};

export function DateRangeFilter({
  value = MOCK_DATE_RANGE_OPTIONS[0]?.value,
  onValueChange,
  disabled = false,
}: DateRangeFilterProps) {
  return (
    <FilterField label="Date Range">
      <Select
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
      >
        <SelectTrigger className="w-full" size="sm">
          <SelectValue placeholder="Date range" />
        </SelectTrigger>
        <SelectContent>
          {MOCK_DATE_RANGE_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </FilterField>
  );
}
