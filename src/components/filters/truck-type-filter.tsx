"use client";

import { FilterField } from "@/components/filters/filter-field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TRUCK_TYPES } from "@/lib/constants/truck-types";
import { FILTER_ALL } from "@/lib/constants/filters";

type TruckTypeFilterProps = {
  value?: string;
  onValueChange?: (value: string | null) => void;
  disabled?: boolean;
};

export function TruckTypeFilter({
  value = FILTER_ALL,
  onValueChange,
  disabled = false,
}: TruckTypeFilterProps) {
  return (
    <FilterField label="Truck Type">
      <Select value={value} onValueChange={onValueChange} disabled={disabled}>
        <SelectTrigger className="w-full" size="sm">
          <SelectValue placeholder="Truck type" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={FILTER_ALL}>All types</SelectItem>
          {TRUCK_TYPES.map((truckType) => (
            <SelectItem key={truckType} value={truckType}>
              {truckType.replaceAll("_", " ")}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </FilterField>
  );
}
