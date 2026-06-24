"use client";

import { useCallback, useMemo, useState } from "react";
import { DateRangeFilter } from "@/components/filters/date-range-filter";
import { DispatcherFilter } from "@/components/filters/dispatcher-filter";
import { StatusFilter } from "@/components/filters/status-filter";
import { MetricCard } from "@/components/metric-card";
import { StatusBadge } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { LoadingState } from "@/components/feedback/loading-state";
import { useApiData } from "@/hooks/use-api-data";
import { fetchActivities } from "@/lib/api/resources";
import { FILTER_ALL } from "@/lib/constants/filters";
import {
  CANCELLED,
  DELIVERED,
  NOT_BOOKED,
  NOT_WORKING,
} from "@/lib/constants/statuses";
import type { Carrier, DailyActivity } from "@/lib/types";
import { TEAM_STATUS_ACTIVE } from "@/lib/constants/team-statuses";
import { formatActivityDate, formatDateShort } from "@/lib/utils/format-date";
import { formatCurrency } from "@/lib/utils/format-currency";
import {
  formatNullableNumber,
  formatNullableText,
} from "@/lib/utils/format-display";
import { formatPercent } from "@/lib/utils/format-percent";
import { formatRatePerMile } from "@/lib/utils/format-rate-per-mile";
import { computeAverageRatePerMile } from "@/lib/utils/compute-finance-metrics";
import { resolveDateRangePreset } from "@/lib/utils/resolve-date-range-preset";

type CarrierDetailFilters = {
  dateRange: string;
  status: string;
  dispatcherId: string;
};

const DEFAULT_CARRIER_DETAIL_FILTERS: CarrierDetailFilters = {
  dateRange: "last-30-days",
  status: FILTER_ALL,
  dispatcherId: FILTER_ALL,
};

function filtersToActivityParams(
  carrierId: string,
  filters: CarrierDetailFilters,
): Record<string, string> {
  const { dateFrom, dateTo } = resolveDateRangePreset(filters.dateRange);
  const params: Record<string, string> = {
    carrierId,
    dateFrom,
    dateTo,
  };

  if (filters.status !== FILTER_ALL) {
    params.status = filters.status;
  }

  if (filters.dispatcherId !== FILTER_ALL) {
    params.dispatcherId = filters.dispatcherId;
  }

  return params;
}

function computePerformanceSummary(activities: DailyActivity[]) {
  const delivered = activities.filter((row) => row.status === DELIVERED);
  const totalRevenue = delivered.reduce(
    (sum, row) => sum + (row.loadAmount ?? 0),
    0,
  );
  const dispatchFeeEarned = delivered.reduce(
    (sum, row) => sum + (row.dispatchFee ?? 0),
    0,
  );
  const averageRatePerMile = computeAverageRatePerMile(
    activities.map((row) => ({
      status: row.status,
      loadAmount: row.loadAmount,
      miles: row.miles,
    })),
  );

  return {
    totalActivities: activities.length,
    deliveredLoads: delivered.length,
    cancelledLoads: activities.filter((row) => row.status === CANCELLED).length,
    notBookedLoads: activities.filter((row) => row.status === NOT_BOOKED)
      .length,
    notWorkingLoads: activities.filter((row) => row.status === NOT_WORKING)
      .length,
    totalRevenue,
    dispatchFeeEarned,
    averageRatePerMile,
  };
}

function formatTruckTypeLabel(value: string): string {
  return value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

type CarrierDetailViewProps = {
  carrier: Carrier;
};

export function CarrierDetailView({ carrier }: CarrierDetailViewProps) {
  const [draftFilters, setDraftFilters] = useState<CarrierDetailFilters>(
    DEFAULT_CARRIER_DETAIL_FILTERS,
  );
  const [appliedFilters, setAppliedFilters] = useState<CarrierDetailFilters>(
    DEFAULT_CARRIER_DETAIL_FILTERS,
  );

  const loadActivities = useCallback(
    () => fetchActivities(filtersToActivityParams(carrier.id, appliedFilters)),
    [appliedFilters, carrier.id],
  );

  const {
    data: activities = [],
    isLoading,
    error,
  } = useApiData(loadActivities, [carrier.id, appliedFilters]);

  const summary = useMemo(
    () => computePerformanceSummary(activities),
    [activities],
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Carrier Profile</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
          <ProfileField
            label="Carrier Name"
            value={carrier.carrierName}
            emphasize
          />
          <ProfileField label="Driver Name" value={carrier.driverName} />
          <ProfileField label="MC Number" value={carrier.mcNumber} />
          <ProfileField
            label="Truck Type"
            value={formatTruckTypeLabel(carrier.truckType)}
          />
          <ProfileField
            label="Assigned Team"
            value={carrier.assignedTeamName}
          />
          <ProfileField
            label="Assigned Dispatcher"
            value={carrier.assignedDispatcherName}
          />
          <ProfileField
            label="Dispatch Fee %"
            value={formatPercent(carrier.dispatchFeePercentage, 0, "—")}
          />
          <div className="space-y-1">
            <p className="text-muted-foreground">Status</p>
            <Badge
              variant={
                carrier.status === TEAM_STATUS_ACTIVE ? "default" : "secondary"
              }
            >
              {carrier.status.replaceAll("_", " ")}
            </Badge>
          </div>
          <ProfileField
            label="Created Date"
            value={formatDateShort(carrier.createdAt)}
          />
          {carrier.notes ? (
            <div className="space-y-1 sm:col-span-2 lg:col-span-3">
              <p className="text-muted-foreground">Notes</p>
              <p className="font-medium">{carrier.notes}</p>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Activity Filters</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <DateRangeFilter
            value={draftFilters.dateRange}
            onValueChange={(value) => {
              if (value) {
                setDraftFilters((current) => ({
                  ...current,
                  dateRange: value,
                }));
              }
            }}
          />
          <StatusFilter
            value={draftFilters.status}
            onValueChange={(value) => {
              if (value) {
                setDraftFilters((current) => ({ ...current, status: value }));
              }
            }}
          />
          <DispatcherFilter
            value={draftFilters.dispatcherId}
            onValueChange={(value) => {
              if (value) {
                setDraftFilters((current) => ({
                  ...current,
                  dispatcherId: value,
                }));
              }
            }}
          />
          <Button
            type="button"
            size="sm"
            className="mb-0.5"
            onClick={() => setAppliedFilters(draftFilters)}
          >
            Apply filters
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Total Activities"
          value={summary.totalActivities.toLocaleString()}
        />
        <MetricCard
          label="Delivered Loads"
          value={summary.deliveredLoads.toLocaleString()}
        />
        <MetricCard
          label="Cancelled Loads"
          value={summary.cancelledLoads.toLocaleString()}
        />
        <MetricCard
          label="Not Booked"
          value={summary.notBookedLoads.toLocaleString()}
        />
        <MetricCard
          label="Not Working"
          value={summary.notWorkingLoads.toLocaleString()}
        />
        <MetricCard
          label="Total Revenue"
          value={formatCurrency(summary.totalRevenue, { nullLabel: "$0" })}
        />
        <MetricCard
          label="Dispatch Fee Earned"
          value={formatCurrency(summary.dispatchFeeEarned, { nullLabel: "$0" })}
        />
        <MetricCard
          label="Average Rate Per Mile"
          value={formatRatePerMile(summary.averageRatePerMile, "—")}
        />
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Daily Activity History</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {isLoading ? (
            <LoadingState title="Loading activity history" rows={4} />
          ) : error ? (
            <p className="text-destructive py-8 text-center text-sm">
              Unable to load activity history.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Dispatcher</TableHead>
                  <TableHead>Team</TableHead>
                  <TableHead>Origin</TableHead>
                  <TableHead>Destination</TableHead>
                  <TableHead>Miles</TableHead>
                  <TableHead>Load Amount</TableHead>
                  <TableHead>Rate Per Mile</TableHead>
                  <TableHead>Dispatch Fee</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activities.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={12}
                      className="text-muted-foreground py-10 text-center"
                    >
                      No activity found for this carrier.
                    </TableCell>
                  </TableRow>
                ) : (
                  activities.map((activity) => (
                    <TableRow key={activity.id}>
                      <TableCell>{formatActivityDate(activity.date)}</TableCell>
                      <TableCell>
                        <StatusBadge status={activity.status} />
                      </TableCell>
                      <TableCell>{activity.dispatcherName}</TableCell>
                      <TableCell>{activity.teamName}</TableCell>
                      <TableCell>
                        {formatNullableText(activity.origin)}
                      </TableCell>
                      <TableCell>
                        {formatNullableText(activity.destination)}
                      </TableCell>
                      <TableCell>
                        {formatNullableNumber(activity.miles)}
                      </TableCell>
                      <TableCell>
                        {formatCurrency(activity.loadAmount, {
                          nullLabel: "—",
                        })}
                      </TableCell>
                      <TableCell>
                        {formatRatePerMile(activity.ratePerMile, "—")}
                      </TableCell>
                      <TableCell>
                        {formatCurrency(activity.dispatchFee, {
                          nullLabel: "—",
                        })}
                      </TableCell>
                      <TableCell>
                        {formatNullableText(activity.reason)}
                      </TableCell>
                      <TableCell className="max-w-[220px] whitespace-normal">
                        {formatNullableText(activity.notes)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ProfileField({
  label,
  value,
  emphasize = false,
}: {
  label: string;
  value: string;
  emphasize?: boolean;
}) {
  return (
    <div className="space-y-1">
      <p className="text-muted-foreground">{label}</p>
      <p className={emphasize ? "text-base font-semibold" : "font-medium"}>
        {value}
      </p>
    </div>
  );
}
