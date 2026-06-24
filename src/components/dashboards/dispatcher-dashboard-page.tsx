"use client";

import { useCallback, useMemo, useState } from "react";
import { DollarSign, PackageCheck, Route, Truck } from "lucide-react";

import { DashboardMetricCard } from "@/components/dashboard/admin/dashboard-metric-card";
import { AssignedCarrierPerformanceTable } from "@/components/dashboard/dispatcher/assigned-carrier-performance-table";
import { DispatcherDashboardHeader } from "@/components/dashboard/dispatcher/dispatcher-dashboard-header";
import {
  DEFAULT_DISPATCHER_FILTERS,
  DispatcherFilterBar,
} from "@/components/dashboard/dispatcher/dispatcher-filter-bar";
import { DispatcherLoadStatusChart } from "@/components/dashboard/dispatcher/dispatcher-load-status-chart";
import { DispatcherRecentActivitiesTable } from "@/components/dashboard/dispatcher/dispatcher-recent-activities-table";
import { PendingCarrierEntriesCard } from "@/components/dashboard/dispatcher/pending-carrier-entries-card";
import { PersonalRevenueTrendChart } from "@/components/dashboard/dispatcher/personal-revenue-trend-chart";
import { TodayEntryCompletionCard } from "@/components/dashboard/dispatcher/today-entry-completion-card";
import { PageContentGate } from "@/components/feedback/page-content-gate";
import type { PageContentState } from "@/components/feedback/page-content-gate";
import { useApiData } from "@/hooks/use-api-data";
import { fetchDispatcherDashboard } from "@/lib/api/resources";
import { dispatcherDashboardFiltersToParams } from "@/lib/dashboard/dispatcher-filter-params";
import type { DispatcherDashboardFilterValues } from "@/lib/dashboard/dispatcher-filter-params";
import { formatCurrencyCompact } from "@/lib/utils/format-currency";
import { formatRatePerMile } from "@/lib/utils/format-rate-per-mile";

export function DispatcherDashboardPage() {
  const [filters, setFilters] = useState<DispatcherDashboardFilterValues>(
    DEFAULT_DISPATCHER_FILTERS,
  );

  const loadDashboard = useCallback(
    () => fetchDispatcherDashboard(dispatcherDashboardFiltersToParams(filters)),
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
  const filterOptions = dashboard?.filterOptions ?? {
    carriers: [],
    truckTypes: [],
    statuses: [],
  };

  const totalFilteredLoads = useMemo(() => {
    return (
      dashboard?.statusBreakdown.reduce((sum, item) => sum + item.value, 0) ?? 0
    );
  }, [dashboard?.statusBreakdown]);

  const metricCards = useMemo(
    () => [
      {
        label: "Personal Revenue",
        value: formatCurrencyCompact(metrics?.personalRevenue ?? 0, "$0"),
        helper: "Month-to-date delivered revenue",
        growth: null,
        accent: "#2563EB",
        iconBackground: "#DBEAFE",
        icon: DollarSign,
        sparklineData: [],
      },
      {
        label: "Delivered Loads",
        value: (metrics?.deliveredLoads ?? 0).toLocaleString(),
        helper: "Completed deliveries this month",
        growth: null,
        accent: "#22C55E",
        iconBackground: "#DCFCE7",
        icon: PackageCheck,
        sparklineData: [],
      },
      {
        label: "Avg Rate / Mile",
        value: formatRatePerMile(metrics?.avgRatePerMile ?? 0, "$0.00/mi"),
        helper: "Average across delivered loads",
        growth: null,
        accent: "#8B5CF6",
        iconBackground: "#F3E8FF",
        icon: Route,
        sparklineData: [],
      },
      {
        label: "Assigned Carriers",
        value: (metrics?.assignedCarriers ?? 0).toLocaleString(),
        helper: "Active carriers under your dispatch",
        growth: null,
        accent: "#F97316",
        iconBackground: "#FFEDD5",
        icon: Truck,
        sparklineData: [],
      },
    ],
    [metrics],
  );

  return (
    <div className="space-y-6">
      <DispatcherDashboardHeader
        onRefresh={reload}
        isRefreshing={isLoading}
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
          {dashboard?.todayCompletion ? (
            <TodayEntryCompletionCard completion={dashboard.todayCompletion} />
          ) : null}

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {metricCards.map((card) => (
              <DashboardMetricCard key={card.label} {...card} />
            ))}
          </div>

          <PendingCarrierEntriesCard
            carriers={dashboard?.pendingCarriers ?? []}
          />

          <DispatcherFilterBar
            values={filters}
            filterOptions={filterOptions}
            onChange={setFilters}
            onReset={() => setFilters(DEFAULT_DISPATCHER_FILTERS)}
          />

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <PersonalRevenueTrendChart data={dashboard?.revenueTrend ?? []} />
            <DispatcherLoadStatusChart
              data={dashboard?.statusBreakdown ?? []}
              totalLoads={totalFilteredLoads}
            />
          </div>

          <AssignedCarrierPerformanceTable
            rows={dashboard?.assignedCarrierPerformance ?? []}
          />

          <DispatcherRecentActivitiesTable
            rows={dashboard?.recentActivities ?? []}
          />
        </>
      </PageContentGate>
    </div>
  );
}
