"use client";

import { useCallback, useMemo } from "react";

import { PageContentGate } from "@/components/feedback/page-content-gate";
import type { PageContentState } from "@/components/feedback/page-content-gate";
import { EntityFilterBar } from "@/components/filters/entity-filter-bar";
import { DataTablePlaceholder } from "@/components/data-table-placeholder";
import { RoleScopeBanner } from "@/components/layout/role-scope-banner";
import { PageShell } from "@/components/layout/page-shell";
import { MetricCard } from "@/components/metric-card";
import { useApiData } from "@/hooks/use-api-data";
import { fetchActivities, fetchAdminDashboard } from "@/lib/api/resources";
import { formatCurrency } from "@/lib/utils/format-currency";

export function AdminDashboardPage() {
  const loadMetrics = useCallback(() => fetchAdminDashboard(), []);
  const loadActivities = useCallback(() => fetchActivities(), []);

  const {
    data: metrics,
    error: metricsError,
    isLoading: metricsLoading,
    reload: reloadMetrics,
  } = useApiData(loadMetrics, []);
  const {
    data: activities = [],
    error: activitiesError,
    isLoading: activitiesLoading,
    reload: reloadActivities,
  } = useApiData(loadActivities, []);

  const isLoading = metricsLoading || activitiesLoading;
  const error = metricsError ?? activitiesError;

  const pageState: PageContentState = isLoading
    ? "loading"
    : error
      ? "error"
      : "ready";

  const recentActivities = useMemo(() => activities.slice(0, 5), [activities]);

  const reload = useCallback(() => {
    void reloadMetrics();
    void reloadActivities();
  }, [reloadMetrics, reloadActivities]);

  return (
    <PageShell
      title="Admin Dashboard"
      description="Organization-wide performance metrics and activity."
    >
      <RoleScopeBanner message="Company-wide admin view" />

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
              label="Total Revenue"
              value={formatCurrency(metrics?.totalRevenue ?? null, { nullLabel: "—" })}
              hint="Month-to-date total"
            />
            <MetricCard
              label="Total Loads"
              value={metrics?.totalLoads.toString() ?? "—"}
              hint="All recorded loads"
            />
            <MetricCard
              label="Delivered Loads"
              value={metrics?.deliveredLoads.toString() ?? "—"}
              hint="Completed deliveries"
            />
            <MetricCard
              label="Active Dispatchers"
              value={metrics?.activeDispatchers.toString() ?? "—"}
              hint="Across all teams"
            />
          </div>

          <EntityFilterBar />

          <DataTablePlaceholder
            title="Recent Daily Activities"
            columns={["Dispatcher", "Carrier", "Status", "Load Amount"]}
            rows={recentActivities.map((activity) => [
              activity.dispatcherName,
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
