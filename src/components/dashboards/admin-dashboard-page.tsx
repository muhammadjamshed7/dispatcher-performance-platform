"use client";

import { useCallback, useMemo, useState } from "react";
import {
  DollarSign,
  Package,
  PackageCheck,
  TrendingUp,
  Truck,
  Users,
} from "lucide-react";

import { AdminDashboardHeader } from "@/components/dashboard/admin/admin-dashboard-header";
import {
  DashboardFilterBar,
  DEFAULT_DASHBOARD_FILTERS,
  type DashboardFilterValues,
} from "@/components/dashboard/admin/dashboard-filter-bar";
import { DashboardMetricCard } from "@/components/dashboard/admin/dashboard-metric-card";
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
import { formatCurrencyCompact } from "@/lib/utils/format-currency";
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

  const metricCards = useMemo(
    () => [
      {
        label: "Total Revenue",
        value: formatCurrencyCompact(metrics?.totalRevenue ?? 0, "$0"),
        helper: "Month-to-date",
        growth: formatGrowthLabel(growth?.revenue),
        accent: "#2563EB",
        iconBackground: "#DBEAFE",
        icon: DollarSign,
        sparklineData: metrics?.sparklines.revenue ?? [],
      },
      {
        label: "Total Loads",
        value: (metrics?.totalLoads ?? 0).toLocaleString(),
        helper: "All received loads",
        growth: formatGrowthLabel(growth?.loads),
        accent: "#8B5CF6",
        iconBackground: "#F3E8FF",
        icon: Package,
        sparklineData: metrics?.sparklines.loads ?? [],
      },
      {
        label: "Delivered Loads",
        value: (metrics?.deliveredLoads ?? 0).toLocaleString(),
        helper: "Completed deliveries",
        growth: formatGrowthLabel(growth?.delivered),
        accent: "#22C55E",
        iconBackground: "#DCFCE7",
        icon: PackageCheck,
        sparklineData: metrics?.sparklines.delivered ?? [],
      },
      {
        label: "Active Dispatchers",
        value: (metrics?.activeDispatchers ?? 0).toLocaleString(),
        helper: "Across all teams",
        growth: null,
        accent: "#F97316",
        iconBackground: "#FFEDD5",
        icon: Users,
        sparklineData: [],
      },
      {
        label: "On-Time Rate",
        value: `${metrics?.onTimeRate ?? 0}%`,
        helper: "Deliveries on time",
        growth: formatGrowthLabel(growth?.onTimeRate),
        accent: "#2563EB",
        iconBackground: "#DBEAFE",
        icon: Truck,
        sparklineData: [],
      },
      {
        label: "Monthly Growth",
        value: `${metrics?.monthlyGrowth ?? 0}%`,
        helper: "Revenue growth",
        growth: formatGrowthLabel(growth?.monthlyGrowth),
        accent: "#14B8A6",
        iconBackground: "#CCFBF1",
        icon: TrendingUp,
        sparklineData: [],
      },
    ],
    [metrics, growth],
  );

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
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
            {metricCards.map((card) => (
              <DashboardMetricCard key={card.label} {...card} />
            ))}
          </div>

          <DashboardFilterBar
            values={filters}
            filterOptions={filterOptions}
            onChange={setFilters}
            onReset={() => setFilters(DEFAULT_DASHBOARD_FILTERS)}
          />

          <div className="grid gap-4 xl:grid-cols-6">
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
