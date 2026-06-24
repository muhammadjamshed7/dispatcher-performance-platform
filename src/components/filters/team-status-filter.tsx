"use client";

import { FilterField } from "@/components/filters/filter-field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TEAM_STATUSES } from "@/lib/constants/team-statuses";
import { FILTER_ALL } from "@/lib/constants/filters";

type TeamStatusFilterProps = {
  value?: string;
  onValueChange?: (value: string | null) => void;
  disabled?: boolean;
};

export function TeamStatusFilter({
  value = FILTER_ALL,
  onValueChange,
  disabled = false,
}: TeamStatusFilterProps) {
  return (
    <FilterField label="Status">
      <Select value={value} onValueChange={onValueChange} disabled={disabled}>
        <SelectTrigger className="w-full" size="sm">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={FILTER_ALL}>All statuses</SelectItem>
          {TEAM_STATUSES.map((status) => (
            <SelectItem key={status} value={status}>
              {status.replaceAll("_", " ")}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </FilterField>
  );
}
