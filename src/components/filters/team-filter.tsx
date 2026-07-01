"use client";

import { FilterField } from "@/components/filters/filter-field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useEntityOptions } from "@/hooks/use-entity-options";
import { FILTER_ALL } from "@/lib/constants/filters";

type TeamFilterProps = {
  value?: string;
  onValueChange?: (value: string | null) => void;
  disabled?: boolean;
};

export function TeamFilter({
  value = FILTER_ALL,
  onValueChange,
  disabled = false,
}: TeamFilterProps) {
  const { teams } = useEntityOptions({
    teams: true,
    dispatchers: false,
    carriers: false,
  });

  return (
    <FilterField label="Team">
      <Select value={value} onValueChange={onValueChange} disabled={disabled}>
        <SelectTrigger className="w-full" size="sm">
          <SelectValue placeholder="Team" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={FILTER_ALL}>All teams</SelectItem>
          {teams.map((team) => (
            <SelectItem key={team.id} value={team.id}>
              {team.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </FilterField>
  );
}
