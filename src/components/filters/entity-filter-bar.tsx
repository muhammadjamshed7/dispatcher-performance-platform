"use client";

import { Filter } from "lucide-react";

import { CarrierFilter } from "@/components/filters/carrier-filter";
import { DateRangeFilter } from "@/components/filters/date-range-filter";
import { DispatcherFilter } from "@/components/filters/dispatcher-filter";
import { StatusFilter } from "@/components/filters/status-filter";
import { TeamFilter } from "@/components/filters/team-filter";
import { TruckTypeFilter } from "@/components/filters/truck-type-filter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export function EntityFilterBar() {
  return (
    <Card>
      <CardContent className="flex flex-wrap items-center gap-3 py-4">
        <Filter className="size-4 shrink-0 text-muted-foreground" />
        <DateRangeFilter />
        <TeamFilter />
        <DispatcherFilter />
        <CarrierFilter />
        <TruckTypeFilter />
        <StatusFilter />
        <Button type="button" variant="outline" size="sm" className="self-end">
          Apply Filters
        </Button>
      </CardContent>
    </Card>
  );
}
