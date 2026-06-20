"use client";

import { Filter } from "lucide-react";

import { CarrierFilter } from "@/components/filters/carrier-filter";
import { DateRangeFilter } from "@/components/filters/date-range-filter";
import { DispatcherFilter } from "@/components/filters/dispatcher-filter";
import { StatusFilter } from "@/components/filters/status-filter";
import { TeamFilter } from "@/components/filters/team-filter";
import { TruckTypeFilter } from "@/components/filters/truck-type-filter";
import { Card, CardContent } from "@/components/ui/card";

export function EntityFilterBar() {
  return (
    <Card>
      <CardContent className="flex flex-wrap items-center gap-3 py-4">
        <Filter className="size-4 shrink-0 text-muted-foreground" />
        <DateRangeFilter disabled />
        <TeamFilter disabled />
        <DispatcherFilter disabled />
        <CarrierFilter disabled />
        <TruckTypeFilter disabled />
        <StatusFilter disabled />
        <p className="w-full text-xs text-muted-foreground">
          Advanced filters will be connected in a future update. Data is already scoped to your role.
        </p>
      </CardContent>
    </Card>
  );
}
