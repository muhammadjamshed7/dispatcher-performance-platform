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

type DispatcherFilterProps = {
  value?: string;
  onValueChange?: (value: string | null) => void;
  disabled?: boolean;
};

export function DispatcherFilter({
  value = FILTER_ALL,
  onValueChange,
  disabled = false,
}: DispatcherFilterProps) {
  const { dispatchers } = useEntityOptions({
    teams: false,
    dispatchers: true,
    carriers: false,
  });

  return (
    <FilterField label="Dispatcher">
      <Select value={value} onValueChange={onValueChange} disabled={disabled}>
        <SelectTrigger className="w-full" size="sm">
          <SelectValue placeholder="Dispatcher" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={FILTER_ALL}>All dispatchers</SelectItem>
          {dispatchers.map((dispatcher) => (
            <SelectItem key={dispatcher.id} value={dispatcher.id}>
              {dispatcher.fullName}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </FilterField>
  );
}
