"use client";

import { FilterField } from "@/components/filters/filter-field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MOCK_FILTER_ALL, mockFilterTeams } from "@/lib/mock-data";

type TeamFilterProps = {
  value?: string;
  onValueChange?: (value: string | null) => void;
  disabled?: boolean;
};

export function TeamFilter({
  value = MOCK_FILTER_ALL,
  onValueChange,
  disabled = false,
}: TeamFilterProps) {
  return (
    <FilterField label="Team">
      <Select
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
      >
        <SelectTrigger className="w-full" size="sm">
          <SelectValue placeholder="Team" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={MOCK_FILTER_ALL}>All teams</SelectItem>
          {mockFilterTeams.map((team) => (
            <SelectItem key={team.id} value={team.id}>
              {team.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </FilterField>
  );
}
