"use client";

import { useMemo } from "react";

import { RoleScopeBanner } from "@/components/layout/role-scope-banner";
import { PageShell } from "@/components/layout/page-shell";
import { MetricCard } from "@/components/metric-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useRoleScope } from "@/hooks/use-role-scope";
import {
  mockActivities,
  mockCarriers,
  mockDailyReport,
  mockDispatcherMetrics,
  mockDispatcherRankings,
} from "@/lib/mock-data";
import { formatCurrency } from "@/lib/utils/format-currency";
import { formatRatePerMile } from "@/lib/utils/format-rate-per-mile";

export function DispatcherPerformancePage() {
  const { filterActivities, filterCarriers, dispatcherName } = useRoleScope();

  const assignedCarriers = useMemo(
    () => filterCarriers(mockCarriers),
    [filterCarriers],
  );
  const personalActivities = useMemo(
    () => filterActivities(mockActivities),
    [filterActivities],
  );

  const personalRanking = mockDispatcherRankings.find(
    (row) => row.name === dispatcherName,
  );

  const personalReport = mockDailyReport.dispatchers.find(
    (row) => row.dispatcherName === dispatcherName,
  );

  const deliveredCount = personalActivities.filter(
    (activity) => activity.status === "DELIVERED",
  ).length;
  const cancelledCount = personalActivities.filter(
    (activity) => activity.status === "CANCELLED",
  ).length;
  const notBookedCount = personalActivities.filter(
    (activity) => activity.status === "NOT_BOOKED",
  ).length;
  const notWorkingCount = personalActivities.filter(
    (activity) => activity.status === "NOT_WORKING",
  ).length;

  return (
    <PageShell
      title="My Performance"
      description="Personal performance metrics and carrier preview (mock data)."
    >
      <RoleScopeBanner
        message={
          dispatcherName
            ? `Performance view for ${dispatcherName}`
            : "Dispatcher performance view"
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Assigned Carriers"
          value={assignedCarriers.length.toString()}
          hint="Under your dispatch"
        />
        <MetricCard
          label="Delivered Loads"
          value={deliveredCount.toString()}
          hint="Completed deliveries"
        />
        <MetricCard
          label="Cancelled Loads"
          value={cancelledCount.toString()}
          hint="Cancelled entries"
        />
        <MetricCard
          label="Not Booked"
          value={notBookedCount.toString()}
          hint="Loads not booked"
        />
        <MetricCard
          label="Not Working"
          value={notWorkingCount.toString()}
          hint="Non-working days"
        />
        <MetricCard
          label="Revenue Generated"
          value={formatCurrency(mockDispatcherMetrics.totalRevenue, { nullLabel: "—" })}
          hint="Mock MTD total"
        />
        <MetricCard
          label="Dispatch Fees"
          value={formatCurrency(personalReport?.dispatchFees ?? null, { nullLabel: "—" })}
          hint="Estimated fees"
        />
        <MetricCard
          label="Avg Rate / Mile"
          value={formatRatePerMile(mockDispatcherMetrics.avgRatePerMile, "—")}
          hint="Personal average"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Ranking Preview</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {personalRanking ? (
              <>
                <p>
                  Rank: <span className="font-medium">#{personalRanking.rank}</span>
                </p>
                <p>
                  Assigned carriers:{" "}
                  <span className="font-medium">{personalRanking.carriers}</span>
                </p>
                <p>
                  Team: <span className="font-medium">{personalRanking.team}</span>
                </p>
              </>
            ) : (
              <p className="text-muted-foreground">No ranking data for this dispatcher.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Assigned Carriers Preview</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Carrier</TableHead>
                  <TableHead>Driver</TableHead>
                  <TableHead>Truck</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {assignedCarriers.slice(0, 5).map((carrier) => (
                  <TableRow key={carrier.id}>
                    <TableCell>{carrier.carrierName}</TableCell>
                    <TableCell>{carrier.driverName}</TableCell>
                    <TableCell>{carrier.truckType}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </PageShell>
  );
}
