"use client";

import { FilterField } from "@/components/filters/filter-field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MOCK_FILTER_ALL, mockFilterDispatchers } from "@/lib/mock-data";

type DispatcherFilterProps = {
  value?: string;
  onValueChange?: (value: string | null) => void;
  disabled?: boolean;
};

export function DispatcherFilter({
  value = MOCK_FILTER_ALL,
  onValueChange,
  disabled = false,
}: DispatcherFilterProps) {
  return (
    <FilterField label="Dispatcher">
      <Select
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
      >
        <SelectTrigger className="w-full" size="sm">
          <SelectValue placeholder="Dispatcher" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={MOCK_FILTER_ALL}>All dispatchers</SelectItem>
          {mockFilterDispatchers.map((dispatcher) => (
            <SelectItem key={dispatcher.id} value={dispatcher.id}>
              {dispatcher.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </FilterField>
  );
}
