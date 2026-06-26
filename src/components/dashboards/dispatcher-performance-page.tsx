"use client";

import { useCallback, useMemo } from "react";

import { PageContentGate } from "@/components/feedback/page-content-gate";
import type { PageContentState } from "@/components/feedback/page-content-gate";
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
import { useApiData } from "@/hooks/use-api-data";
import { useRoleScope } from "@/hooks/use-role-scope";
import { APPROVED } from "@/lib/constants/activity-approval";
import {
  fetchActivities,
  fetchCarriers,
  fetchDispatcherDashboard,
  fetchRankings,
} from "@/lib/api/resources";
import {
  CANCELLED,
  DELIVERED,
  NOT_BOOKED,
  NOT_WORKING,
} from "@/lib/constants/statuses";
import type { DispatcherRanking } from "@/lib/types";
import { formatCurrency } from "@/lib/utils/format-currency";
import { formatRatePerMile } from "@/lib/utils/format-rate-per-mile";

function isDispatcherRanking(row: unknown): row is DispatcherRanking {
  return (
    typeof row === "object" && row !== null && "name" in row && "team" in row
  );
}

export function DispatcherPerformancePage() {
  const { filterActivities, filterCarriers, user } = useRoleScope();

  const loadMetrics = useCallback(() => fetchDispatcherDashboard(), []);
  const loadRankings = useCallback(() => fetchRankings("dispatcher"), []);
  const loadCarriers = useCallback(() => fetchCarriers(), []);
  const loadActivities = useCallback(
    () => fetchActivities({ approvalStatus: APPROVED }),
    [],
  );

  const {
    data: dashboard,
    error: metricsError,
    isLoading: metricsLoading,
    reload: reloadMetrics,
  } = useApiData(loadMetrics, []);
  const {
    data: rankings = [],
    error: rankingsError,
    isLoading: rankingsLoading,
    reload: reloadRankings,
  } = useApiData(loadRankings, []);
  const {
    data: carriers = [],
    error: carriersError,
    isLoading: carriersLoading,
    reload: reloadCarriers,
  } = useApiData(loadCarriers, []);
  const {
    data: activities = [],
    error: activitiesError,
    isLoading: activitiesLoading,
    reload: reloadActivities,
  } = useApiData(loadActivities, []);

  const isLoading =
    metricsLoading || rankingsLoading || carriersLoading || activitiesLoading;
  const error =
    metricsError ?? rankingsError ?? carriersError ?? activitiesError;

  const assignedCarriers = useMemo(
    () => filterCarriers(carriers),
    [carriers, filterCarriers],
  );
  const personalActivities = useMemo(
    () => filterActivities(activities),
    [activities, filterActivities],
  );

  const dispatcherRankings = useMemo(
    () => rankings.filter(isDispatcherRanking),
    [rankings],
  );

  const personalRanking = user.dispatcherId
    ? dispatcherRankings.find((row) => row.id === user.dispatcherId)
    : undefined;

  const deliveredCount = personalActivities.filter(
    (activity) => activity.status === DELIVERED,
  ).length;
  const cancelledCount = personalActivities.filter(
    (activity) => activity.status === CANCELLED,
  ).length;
  const notBookedCount = personalActivities.filter(
    (activity) => activity.status === NOT_BOOKED,
  ).length;
  const notWorkingCount = personalActivities.filter(
    (activity) => activity.status === NOT_WORKING,
  ).length;
  const dispatchFeesTotal = personalActivities.reduce(
    (sum, activity) => sum + (activity.dispatchFee ?? 0),
    0,
  );

  const pageState: PageContentState = isLoading
    ? "loading"
    : error
      ? "error"
      : "ready";

  const reload = useCallback(() => {
    void reloadMetrics();
    void reloadRankings();
    void reloadCarriers();
    void reloadActivities();
  }, [reloadMetrics, reloadRankings, reloadCarriers, reloadActivities]);

  return (
    <PageShell
      title="My Performance"
      description="Personal performance metrics and carrier activity."
    >
      <PageContentGate
        state={pageState}
        onRetry={reload}
        loadingTitle="Loading performance"
        emptyTitle="No performance data"
        emptyDescription="Performance metrics are not available yet."
        errorTitle="Unable to load performance"
        errorDescription={
          error ??
          "Performance data could not be loaded. Try again in a moment."
        }
      >
        <>
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
              value={formatCurrency(
                dashboard?.metrics.personalRevenue ?? null,
                {
                  nullLabel: "—",
                },
              )}
              hint="Month-to-date total"
            />
            <MetricCard
              label="Dispatch Fees"
              value={formatCurrency(dispatchFeesTotal, { nullLabel: "—" })}
              hint="Estimated fees"
            />
            <MetricCard
              label="Avg Rate / Mile"
              value={formatRatePerMile(
                dashboard?.metrics.avgRatePerMile ?? null,
                "—",
              )}
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
                      Rank:{" "}
                      <span className="font-medium">
                        #{personalRanking.rank}
                      </span>
                    </p>
                    <p>
                      Assigned carriers:{" "}
                      <span className="font-medium">
                        {personalRanking.carriers}
                      </span>
                    </p>
                    <p>
                      Team:{" "}
                      <span className="font-medium">
                        {personalRanking.team}
                      </span>
                    </p>
                  </>
                ) : (
                  <p className="text-muted-foreground">
                    No ranking data for this dispatcher.
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Assigned Carriers Preview
                </CardTitle>
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
        </>
      </PageContentGate>
    </PageShell>
  );
}
