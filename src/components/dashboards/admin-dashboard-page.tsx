"use client";

import dynamic from "next/dynamic";
import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Truck } from "lucide-react";

import { AdminDashboardFilterControls } from "@/components/dashboard/admin/filters/admin-dashboard-filter-controls";
import { ActiveFilterChips } from "@/components/dashboard/admin/filters/active-filter-chips";
import { AdminDashboardHeader } from "@/components/dashboard/admin/admin-dashboard-header";
import { DashboardSecondaryMetricCard } from "@/components/dashboard/admin/dashboard-secondary-metric-card";
import { RecentActivitiesTable } from "@/components/dashboard/admin/recent-activities-table";
import { TopPerformersCard } from "@/components/dashboard/admin/top-performers-card";
import { PageContentGate } from "@/components/feedback/page-content-gate";
import type { PageContentState } from "@/components/feedback/page-content-gate";
import { useApiData } from "@/hooks/use-api-data";
import { fetchAdminDashboard } from "@/lib/api/resources";
import {
  adminDashboardFiltersToSearchParams,
  dashboardFiltersToParams,
  parseAdminDashboardFiltersFromSearchParams,
  type AdminDashboardFilterState,
} from "@/lib/dashboard/dashboard-filter-params";
import { formatGrowthLabel } from "@/lib/utils/resolve-date-range-preset";

const AdminKpiSection = dynamic(
  () =>
    import("@/components/dashboard/admin/admin-kpi-section").then(
      (module) => module.AdminKpiSection,
    ),
  { ssr: false },
);

const MonthlyGrowthMetricCard = dynamic(
  () =>
    import("@/components/dashboard/admin/monthly-growth-metric-card").then(
      (module) => module.MonthlyGrowthMetricCard,
    ),
  { ssr: false },
);

const RevenueTrendChart = dynamic(
  () =>
    import("@/components/dashboard/admin/revenue-trend-chart").then(
      (module) => module.RevenueTrendChart,
    ),
  { ssr: false },
);

const LoadsByTeamChart = dynamic(
  () =>
    import("@/components/dashboard/admin/loads-by-team-chart").then(
      (module) => module.LoadsByTeamChart,
    ),
  { ssr: false },
);

const LoadStatusDonutChart = dynamic(
  () =>
    import("@/components/dashboard/admin/load-status-donut-chart").then(
      (module) => module.LoadStatusDonutChart,
    ),
  { ssr: false },
);

function AdminDashboardPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [appliedFilters, setAppliedFilters] = useState<AdminDashboardFilterState>(() =>
    parseAdminDashboardFiltersFromSearchParams(searchParams),
  );

  useEffect(() => {
    setAppliedFilters(parseAdminDashboardFiltersFromSearchParams(searchParams));
  }, [searchParams]);

  const loadDashboard = useCallback(
    () => fetchAdminDashboard(dashboardFiltersToParams(appliedFilters)),
    [appliedFilters],
  );

  const {
    data: dashboard,
    error,
    isLoading,
    reload,
  } = useApiData(loadDashboard, [appliedFilters]);

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

  function handleApplyFilters(nextFilters: AdminDashboardFilterState) {
    setAppliedFilters(nextFilters);
    const params = adminDashboardFiltersToSearchParams(nextFilters);
    const query = params.toString();
    router.replace(query ? `/admin/dashboard?${query}` : "/admin/dashboard", {
      scroll: false,
    });
  }

  return (
    <div className="space-y-6">
      <AdminDashboardHeader
        onRefresh={reload}
        isRefreshing={isLoading}
        filterAction={
          <AdminDashboardFilterControls
            appliedFilters={appliedFilters}
            filterOptions={filterOptions}
            onApplyFilters={handleApplyFilters}
            showChips={false}
          />
        }
        filterChips={
          <ActiveFilterChips
            filters={appliedFilters}
            filterOptions={filterOptions}
            onChange={handleApplyFilters}
          />
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

export function AdminDashboardPage() {
  return (
    <Suspense fallback={<div className="py-10 text-sm text-[#64748B]">Loading dashboard...</div>}>
      <AdminDashboardPageContent />
    </Suspense>
  );
}
