"use client";

import { Filter } from "lucide-react";

import { CarrierFilter } from "@/components/filters/carrier-filter";
import { DateRangeFilter } from "@/components/filters/date-range-filter";
import { DispatcherFilter } from "@/components/filters/dispatcher-filter";
import { StatusFilter } from "@/components/filters/status-filter";
import { TeamStatusFilter } from "@/components/filters/team-status-filter";
import { TeamFilter } from "@/components/filters/team-filter";
import { TruckTypeFilter } from "@/components/filters/truck-type-filter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { EntityFilterValues } from "@/lib/filters/entity-filter-params";

type EntityFilterBarProps = {
  values: EntityFilterValues;
  onChange: (values: EntityFilterValues) => void;
  onApply: () => void;
  showDateRange?: boolean;
  showCarrier?: boolean;
  showTruckType?: boolean;
  showStatus?: boolean;
  statusMode?: "activity" | "carrier";
};

export function EntityFilterBar({
  values,
  onChange,
  onApply,
  showDateRange = false,
  showCarrier = true,
  showTruckType = true,
  showStatus = true,
  statusMode = "activity",
}: EntityFilterBarProps) {
  function updateField<K extends keyof EntityFilterValues>(
    field: K,
    value: EntityFilterValues[K],
  ) {
    onChange({ ...values, activityId: undefined, q: undefined, [field]: value });
  }

  return (
    <Card>
      <CardContent className="flex flex-wrap items-end gap-3 py-4">
        <Filter className="text-muted-foreground mb-2 size-4 shrink-0" />
        {showDateRange ? (
          <DateRangeFilter
            value={values.dateRange}
            onValueChange={(value) => {
              if (value) {
                updateField("dateRange", value);
              }
            }}
          />
        ) : null}
        <TeamFilter
          value={values.teamId}
          onValueChange={(value) => {
            if (value) {
              updateField("teamId", value);
            }
          }}
        />
        <DispatcherFilter
          value={values.dispatcherId}
          onValueChange={(value) => {
            if (value) {
              updateField("dispatcherId", value);
            }
          }}
        />
        {showCarrier ? (
          <CarrierFilter
            value={values.carrierId}
            onValueChange={(value) => {
              if (value) {
                updateField("carrierId", value);
              }
            }}
          />
        ) : null}
        {showTruckType ? (
          <TruckTypeFilter
            value={values.truckType}
            onValueChange={(value) => {
              if (value) {
                updateField("truckType", value);
              }
            }}
          />
        ) : null}
        {showStatus ? (
          statusMode === "carrier" ? (
            <TeamStatusFilter
              value={values.status}
              onValueChange={(value) => {
                if (value) {
                  updateField("status", value);
                }
              }}
            />
          ) : (
            <StatusFilter
              value={values.status}
              onValueChange={(value) => {
                if (value) {
                  updateField("status", value);
                }
              }}
            />
          )
        ) : null}
        <Button type="button" size="sm" className="mb-0.5" onClick={onApply}>
          Apply filters
        </Button>
      </CardContent>
    </Card>
  );
}
