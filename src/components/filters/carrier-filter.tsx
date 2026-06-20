"use client";

import { FilterField } from "@/components/filters/filter-field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MOCK_FILTER_ALL, mockFilterCarriers } from "@/lib/mock-data";

type CarrierFilterProps = {
  value?: string;
  onValueChange?: (value: string | null) => void;
  disabled?: boolean;
};

export function CarrierFilter({
  value = MOCK_FILTER_ALL,
  onValueChange,
  disabled = false,
}: CarrierFilterProps) {
  return (
    <FilterField label="Carrier">
      <Select
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
      >
        <SelectTrigger className="w-full" size="sm">
          <SelectValue placeholder="Carrier" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={MOCK_FILTER_ALL}>All carriers</SelectItem>
          {mockFilterCarriers.map((carrier) => (
            <SelectItem key={carrier.id} value={carrier.id}>
              {carrier.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </FilterField>
  );
}
