"use client";

import { useCallback, useMemo } from "react";

import { PageContentGate } from "@/components/feedback/page-content-gate";
import type { PageContentState } from "@/components/feedback/page-content-gate";
import { DataTablePlaceholder } from "@/components/data-table-placeholder";
import { RoleScopeBanner } from "@/components/layout/role-scope-banner";
import { PageShell } from "@/components/layout/page-shell";
import { MetricCard } from "@/components/metric-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useApiData } from "@/hooks/use-api-data";
import { useRoleScope } from "@/hooks/use-role-scope";
import {
  fetchActivities,
  fetchCarriers,
  fetchDispatcherDashboard,
} from "@/lib/api/resources";
import { formatCurrency } from "@/lib/utils/format-currency";
import { formatRatePerMile } from "@/lib/utils/format-rate-per-mile";

export function DispatcherDashboardPage() {
  const { filterActivities, filterCarriers, dispatcherName } = useRoleScope();
  const today = new Date().toISOString().slice(0, 10);

  const loadMetrics = useCallback(() => fetchDispatcherDashboard(), []);
  const loadCarriers = useCallback(() => fetchCarriers(), []);
  const loadActivities = useCallback(() => fetchActivities(), []);

  const {
    data: metrics,
    error: metricsError,
    isLoading: metricsLoading,
    reload: reloadMetrics,
  } = useApiData(loadMetrics, []);
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

  const isLoading = metricsLoading || carriersLoading || activitiesLoading;
  const error = metricsError ?? carriersError ?? activitiesError;

  const assignedCarriers = useMemo(
    () => filterCarriers(carriers),
    [carriers, filterCarriers],
  );
  const personalActivities = useMemo(
    () => filterActivities(activities),
    [activities, filterActivities],
  );
  const todaysActivities = personalActivities.filter(
    (activity) => activity.date === today,
  );
  const loggedCarrierNames = new Set(
    todaysActivities.map((activity) => activity.carrierName),
  );
  const pendingEntries = assignedCarriers.filter(
    (carrier) => !loggedCarrierNames.has(carrier.carrierName),
  );

  const pageState: PageContentState = isLoading
    ? "loading"
    : error
      ? "error"
      : "ready";

  const reload = useCallback(() => {
    void reloadMetrics();
    void reloadCarriers();
    void reloadActivities();
  }, [reloadMetrics, reloadCarriers, reloadActivities]);

  return (
    <PageShell
      title="Dispatcher Dashboard"
      description="Your personal performance metrics and assigned carriers."
    >
      <RoleScopeBanner
        message={
          dispatcherName
            ? `Personal view for ${dispatcherName}`
            : "Dispatcher personal view"
        }
      />

      <PageContentGate
        state={pageState}
        onRetry={reload}
        loadingTitle="Loading dashboard"
        emptyTitle="No dashboard data"
        emptyDescription="Dashboard metrics are not available yet."
        errorTitle="Unable to load dashboard"
        errorDescription={
          error ?? "Dashboard data could not be loaded. Try again in a moment."
        }
      >
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              label="Personal Revenue"
              value={formatCurrency(metrics?.totalRevenue ?? null, { nullLabel: "—" })}
              hint="Month-to-date total"
            />
            <MetricCard
              label="Delivered Loads"
              value={metrics?.deliveredLoads.toString() ?? "—"}
              hint="Completed deliveries"
            />
            <MetricCard
              label="Avg Rate / Mile"
              value={formatRatePerMile(metrics?.avgRatePerMile ?? null, "—")}
              hint="Personal average"
            />
            <MetricCard
              label="Assigned Carriers"
              value={assignedCarriers.length.toString()}
              hint="Under your dispatch"
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Daily Entry Completion</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p>
                <span className="text-muted-foreground">Logged today:</span>{" "}
                {loggedCarrierNames.size} of {assignedCarriers.length} assigned carriers
              </p>
              {pendingEntries.length > 0 ? (
                <p className="text-muted-foreground">
                  Pending entries:{" "}
                  {pendingEntries.map((carrier) => carrier.carrierName).join(", ")}
                </p>
              ) : (
                <p className="text-muted-foreground">
                  All assigned carriers have activity logged for today.
                </p>
              )}
            </CardContent>
          </Card>

          <DataTablePlaceholder
            title="Assigned Carrier Performance Preview"
            columns={["Carrier", "Recent Status", "Load Amount"]}
            rows={personalActivities.slice(0, 5).map((activity) => [
              activity.carrierName,
              activity.status.replaceAll("_", " "),
              formatCurrency(activity.loadAmount, { nullLabel: "—" }),
            ])}
          />
        </>
      </PageContentGate>
    </PageShell>
  );
}
