"use client";

import { useMemo } from "react";
import { DollarSign, Package, PackageCheck, Users } from "lucide-react";

import { KpiDispatchersPanel } from "@/components/dashboard/admin/kpi-dispatchers-panel";
import { KpiLoadsBarChart } from "@/components/dashboard/admin/kpi-loads-bar-chart";
import { KpiRevenueChart } from "@/components/dashboard/admin/kpi-revenue-chart";
import { KpiStatusTrendChart } from "@/components/dashboard/admin/kpi-status-trend-chart";
import { KpiStatCardShell } from "@/components/dashboard/admin/kpi-stat-card-shell";
import { buildTrendChartData } from "@/lib/dashboard/kpi-chart-utils";
import type { AdminDashboardBundle } from "@/lib/types";
import { formatCurrencyCompact } from "@/lib/utils/format-currency";
import { formatGrowthLabel } from "@/lib/utils/resolve-date-range-preset";

type AdminKpiSectionProps = {
  metrics: AdminDashboardBundle["metrics"];
  filterOptions: AdminDashboardBundle["filterOptions"];
  appliedFilters: AdminDashboardBundle["filters"];
};

export function AdminKpiSection({
  metrics,
  filterOptions,
  appliedFilters,
}: AdminKpiSectionProps) {
  const growth = metrics.growth;

  const revenueChartData = useMemo(
    () => buildTrendChartData(metrics.trendDates, metrics.sparklines.revenue),
    [metrics.trendDates, metrics.sparklines.revenue],
  );
  const loadsChartData = useMemo(
    () => buildTrendChartData(metrics.trendDates, metrics.sparklines.loads),
    [metrics.trendDates, metrics.sparklines.loads],
  );

  const scopedDispatchers = useMemo(() => {
    let dispatchers = filterOptions.dispatchers;

    if (appliedFilters.teamId) {
      dispatchers = dispatchers.filter(
        (dispatcher) => dispatcher.teamId === appliedFilters.teamId,
      );
    }

    if (appliedFilters.dispatcherId) {
      dispatchers = dispatchers.filter(
        (dispatcher) => dispatcher.id === appliedFilters.dispatcherId,
      );
    }

    return dispatchers;
  }, [
    appliedFilters.dispatcherId,
    appliedFilters.teamId,
    filterOptions.dispatchers,
  ]);

  const dispatchersByTeam = useMemo(() => {
    const teamNames = new Map(filterOptions.teams.map((team) => [team.id, team.name]));
    const counts = new Map<string, number>();

    for (const dispatcher of scopedDispatchers) {
      const teamName = teamNames.get(dispatcher.teamId) ?? "Unassigned";
      counts.set(teamName, (counts.get(teamName) ?? 0) + 1);
    }

    return [...counts.entries()]
      .map(([team, count]) => ({ team, count }))
      .sort((a, b) => b.count - a.count);
  }, [filterOptions.teams, scopedDispatchers]);

  const utilization = useMemo(() => {
    const assigned = scopedDispatchers.filter((dispatcher) => dispatcher.teamId).length;
    const unassigned = Math.max(scopedDispatchers.length - assigned, 0);
    const total = Math.max(metrics.activeDispatchers, scopedDispatchers.length);

    if (total === 0) {
      return { slices: [], activePercent: 0 };
    }

    const activePercent = Math.round((assigned / total) * 100);
    const inactivePercent = Math.max(100 - activePercent, 0);

    return {
      activePercent,
      slices: [
        {
          name: "Active",
          value: assigned,
          color: "#F97316",
          percent: activePercent,
        },
        {
          name: "Inactive",
          value: unassigned,
          color: "#FDBA74",
          percent: inactivePercent,
        },
      ],
    };
  }, [metrics.activeDispatchers, scopedDispatchers]);

  const trendWindowLabel =
    metrics.trendDates.length === 1
      ? "Selected period trend"
      : `Last ${metrics.trendDates.length} days of selected range`;

  return (
    <section className="grid grid-cols-1 gap-6 xl:grid-cols-2">
      <KpiStatCardShell
        label="Total Revenue"
        value={formatCurrencyCompact(metrics.totalRevenue, "$0")}
        helper="Selected date range"
        growth={formatGrowthLabel(growth.revenue)}
        accent="#2563EB"
        iconBackground="#DBEAFE"
        icon={DollarSign}
      >
        <KpiRevenueChart data={revenueChartData} />
      </KpiStatCardShell>

      <KpiStatCardShell
        label="Total Loads"
        value={metrics.totalLoads.toLocaleString()}
        helper="All received loads in range"
        growth={formatGrowthLabel(growth.loads)}
        accent="#8B5CF6"
        iconBackground="#F3E8FF"
        icon={Package}
      >
        <KpiLoadsBarChart data={loadsChartData} />
      </KpiStatCardShell>

      <KpiStatCardShell
        label="Load Status Trend"
        value={metrics.deliveredLoads.toLocaleString()}
        helper={`Delivered loads · ${trendWindowLabel.toLowerCase()}`}
        growth={formatGrowthLabel(growth.delivered)}
        accent="#22C55E"
        iconBackground="#DCFCE7"
        icon={PackageCheck}
        className="min-h-[480px]"
      >
        <KpiStatusTrendChart data={metrics.statusTrend} />
      </KpiStatCardShell>

      <KpiStatCardShell
        label="Active Dispatchers"
        value={metrics.activeDispatchers.toLocaleString()}
        helper={
          appliedFilters.teamId || appliedFilters.dispatcherId
            ? "Matching current filters"
            : "Across all teams"
        }
        growth={formatGrowthLabel(growth.dispatchers)}
        accent="#F97316"
        iconBackground="#FFEDD5"
        icon={Users}
      >
        <KpiDispatchersPanel
          byTeam={dispatchersByTeam}
          utilization={utilization.slices}
          activePercent={utilization.activePercent}
        />
      </KpiStatCardShell>
    </section>
  );
}
