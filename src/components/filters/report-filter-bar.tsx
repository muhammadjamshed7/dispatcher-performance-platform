"use client";

import { Filter } from "lucide-react";

import { CarrierFilter } from "@/components/filters/carrier-filter";
import { DateRangeFilter } from "@/components/filters/date-range-filter";
import { DispatcherFilter } from "@/components/filters/dispatcher-filter";
import { StatusFilter } from "@/components/filters/status-filter";
import { TeamFilter } from "@/components/filters/team-filter";
import { TruckTypeFilter } from "@/components/filters/truck-type-filter";
import { FilterField } from "@/components/filters/filter-field";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { ReportFilterValues } from "@/lib/dashboard/report-filter-params";

type ReportFilterBarProps = {
  values: ReportFilterValues;
  onChange: (values: ReportFilterValues) => void;
  onApply?: () => void;
  showCustomDates?: boolean;
};

export function ReportFilterBar({
  values,
  onChange,
  onApply,
  showCustomDates = false,
}: ReportFilterBarProps) {
  return (
    <Card>
      <CardContent className="flex flex-wrap items-center gap-3 py-4">
        <Filter className="text-muted-foreground size-4 shrink-0" />
        {showCustomDates ? (
          <>
            <FilterField label="Start Date">
              <Input
                type="date"
                value={values.dateFrom}
                onChange={(event) =>
                  onChange({ ...values, dateFrom: event.target.value })
                }
                className="h-8"
              />
            </FilterField>
            <FilterField label="End Date">
              <Input
                type="date"
                value={values.dateTo}
                onChange={(event) =>
                  onChange({ ...values, dateTo: event.target.value })
                }
                className="h-8"
              />
            </FilterField>
          </>
        ) : (
          <DateRangeFilter
            value={values.dateRange}
            onValueChange={(dateRange) => {
              if (dateRange) {
                onChange({ ...values, dateRange });
              }
            }}
          />
        )}
        <TeamFilter
          value={values.teamId}
          onValueChange={(teamId) => {
            if (teamId) {
              onChange({ ...values, teamId });
            }
          }}
        />
        <DispatcherFilter
          value={values.dispatcherId}
          onValueChange={(dispatcherId) => {
            if (dispatcherId) {
              onChange({ ...values, dispatcherId });
            }
          }}
        />
        <CarrierFilter
          value={values.carrierId}
          onValueChange={(carrierId) => {
            if (carrierId) {
              onChange({ ...values, carrierId });
            }
          }}
        />
        <TruckTypeFilter
          value={values.truckType}
          onValueChange={(truckType) => {
            if (truckType) {
              onChange({ ...values, truckType });
            }
          }}
        />
        <StatusFilter
          value={values.status}
          onValueChange={(status) => {
            if (status) {
              onChange({ ...values, status });
            }
          }}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="self-end"
          onClick={onApply}
        >
          Apply Filters
        </Button>
      </CardContent>
    </Card>
  );
}
