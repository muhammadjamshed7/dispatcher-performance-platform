"use client";

import { useCallback, useState } from "react";
import { Truck } from "lucide-react";

import { AdminDashboardHeader } from "@/components/dashboard/admin/admin-dashboard-header";
import { AdminKpiSection } from "@/components/dashboard/admin/admin-kpi-section";
import {
  DashboardFilterBar,
  DEFAULT_DASHBOARD_FILTERS,
  type DashboardFilterValues,
} from "@/components/dashboard/admin/dashboard-filter-bar";
import { DashboardSecondaryMetricCard } from "@/components/dashboard/admin/dashboard-secondary-metric-card";
import { MonthlyGrowthMetricCard } from "@/components/dashboard/admin/monthly-growth-metric-card";
import { LoadStatusDonutChart } from "@/components/dashboard/admin/load-status-donut-chart";
import { LoadsByTeamChart } from "@/components/dashboard/admin/loads-by-team-chart";
import { RecentActivitiesTable } from "@/components/dashboard/admin/recent-activities-table";
import { RevenueTrendChart } from "@/components/dashboard/admin/revenue-trend-chart";
import { TopPerformersCard } from "@/components/dashboard/admin/top-performers-card";
import { PageContentGate } from "@/components/feedback/page-content-gate";
import type { PageContentState } from "@/components/feedback/page-content-gate";
import { useApiData } from "@/hooks/use-api-data";
import { fetchAdminDashboard } from "@/lib/api/resources";
import { dashboardFiltersToParams } from "@/lib/dashboard/dashboard-filter-params";
import { formatGrowthLabel } from "@/lib/utils/resolve-date-range-preset";

export function AdminDashboardPage() {
  const [filters, setFilters] = useState<DashboardFilterValues>(
    DEFAULT_DASHBOARD_FILTERS,
  );

  const loadDashboard = useCallback(
    () => fetchAdminDashboard(dashboardFiltersToParams(filters)),
    [filters],
  );

  const {
    data: dashboard,
    error,
    isLoading,
    reload,
  } = useApiData(loadDashboard, [filters]);

  const pageState: PageContentState = isLoading
    ? "loading"
    : error
      ? "error"
      : "ready";

  const metrics = dashboard?.metrics;
  const growth = metrics?.growth;

  const filterOptions = dashboard?.filterOptions ?? {
    teams: [],
    dispatchers: [],
    carriers: [],
    truckTypes: [],
    statuses: [],
  };

  return (
    <div className="space-y-6">
      <AdminDashboardHeader onRefresh={reload} isRefreshing={isLoading} />

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
          <DashboardFilterBar
            values={filters}
            filterOptions={filterOptions}
            onChange={setFilters}
            onReset={() => setFilters(DEFAULT_DASHBOARD_FILTERS)}
          />

          {metrics && dashboard ? (
            <AdminKpiSection
              metrics={metrics}
              filterOptions={filterOptions}
              appliedFilters={dashboard.filters}
            />
          ) : null}

          {metrics ? (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <DashboardSecondaryMetricCard
                label="On-Time Rate"
                value={`${metrics.onTimeRate}%`}
                helper="Deliveries on time"
                growth={formatGrowthLabel(growth?.onTimeRate)}
                accent="#2563EB"
                iconBackground="#DBEAFE"
                icon={Truck}
              />
              <MonthlyGrowthMetricCard
                monthlyGrowth={metrics.monthlyGrowth}
                monthlyGrowthTrend={metrics.monthlyGrowthTrend}
                growthLabel={formatGrowthLabel(growth?.monthlyGrowth)}
              />
            </div>
          ) : null}

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <RevenueTrendChart data={dashboard?.revenueTrend ?? []} />
            <LoadsByTeamChart data={dashboard?.loadsByTeam ?? []} />
            <LoadStatusDonutChart
              data={dashboard?.statusBreakdown ?? []}
              totalLoads={metrics?.totalLoads ?? 0}
            />
            <TopPerformersCard performers={dashboard?.topPerformers ?? []} />
          </div>

          <RecentActivitiesTable rows={dashboard?.recentActivities ?? []} />
        </>
      </PageContentGate>
    </div>
  );
}
