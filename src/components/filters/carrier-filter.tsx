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

type CarrierFilterProps = {
  value?: string;
  onValueChange?: (value: string | null) => void;
  disabled?: boolean;
};

export function CarrierFilter({
  value = FILTER_ALL,
  onValueChange,
  disabled = false,
}: CarrierFilterProps) {
  const { carriers } = useEntityOptions();

  return (
    <FilterField label="Carrier">
      <Select value={value} onValueChange={onValueChange} disabled={disabled}>
        <SelectTrigger className="w-full" size="sm">
          <SelectValue placeholder="Carrier" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={FILTER_ALL}>All carriers</SelectItem>
          {carriers.map((carrier) => (
            <SelectItem key={carrier.id} value={carrier.id}>
              {carrier.carrierName}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </FilterField>
  );
}
