"use client";

import { useEffect, useMemo, useState } from "react";
import { Bell, DollarSign, Package, PackageCheck, Users } from "lucide-react";

import { KpiDispatchersPanel } from "@/components/dashboard/admin/kpi-dispatchers-panel";
import { KpiLoadsBarChart } from "@/components/dashboard/admin/kpi-loads-bar-chart";
import { KpiRevenueChart } from "@/components/dashboard/admin/kpi-revenue-chart";
import { KpiStatusTrendChart } from "@/components/dashboard/admin/kpi-status-trend-chart";
import { KpiStatCardShell } from "@/components/dashboard/admin/kpi-stat-card-shell";
import { TopPerformersCard } from "@/components/dashboard/admin/top-performers-card";
import { Badge } from "@/components/ui/badge";
import { fetchNotifications } from "@/lib/api/resources";
import type { AdminDashboardBundle, AppNotification } from "@/lib/types";
import { cn } from "@/lib/utils";
import { formatCurrencyCompact } from "@/lib/utils/format-currency";
import { formatGrowthLabel } from "@/lib/utils/resolve-date-range-preset";

type AdminKpiSectionProps = {
  metrics: AdminDashboardBundle["metrics"];
  filterOptions: AdminDashboardBundle["filterOptions"];
  appliedFilters: AdminDashboardBundle["filters"];
  dispatcherRevenue: AdminDashboardBundle["dispatcherRevenue"];
  dispatcherLoads: AdminDashboardBundle["dispatcherLoads"];
  topPerformers: AdminDashboardBundle["topPerformers"];
};

export function AdminKpiSection({
  metrics,
  filterOptions,
  appliedFilters,
  dispatcherRevenue,
  dispatcherLoads,
  topPerformers,
}: AdminKpiSectionProps) {
  const growth = metrics.growth;

  const scopedDispatchers = useMemo(() => {
    let dispatchers = filterOptions.dispatchers;

    if (appliedFilters.teamIds.length > 0) {
      dispatchers = dispatchers.filter((dispatcher) =>
        appliedFilters.teamIds.includes(dispatcher.teamId),
      );
    }

    if (appliedFilters.dispatcherIds.length > 0) {
      dispatchers = dispatchers.filter((dispatcher) =>
        appliedFilters.dispatcherIds.includes(dispatcher.id),
      );
    }

    return dispatchers;
  }, [
    appliedFilters.dispatcherIds,
    appliedFilters.teamIds,
    filterOptions.dispatchers,
  ]);

  const dispatchersByTeam = useMemo(() => {
    const teamNames = new Map(
      filterOptions.teams.map((team) => [team.id, team.name]),
    );
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
    const assigned = scopedDispatchers.filter(
      (dispatcher) => dispatcher.teamId,
    ).length;
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
    <section className="space-y-6">
      <div className="grid grid-cols-1">
        <KpiStatCardShell
          label="Total Revenue"
          value={formatCurrencyCompact(metrics.totalRevenue, "$0")}
          helper="Approved revenue in selected range"
          growth={formatGrowthLabel(growth.revenue)}
          accent="#2563EB"
          iconBackground="#DBEAFE"
          icon={DollarSign}
        >
          <KpiRevenueChart data={dispatcherRevenue} />
        </KpiStatCardShell>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        <KpiStatCardShell
          label="Number of Loads"
          value={metrics.totalLoads.toLocaleString()}
          helper="Approved loads in selected range"
          growth={formatGrowthLabel(growth.loads)}
          accent="#8B5CF6"
          iconBackground="#F3E8FF"
          icon={Package}
        >
          <KpiLoadsBarChart data={dispatcherLoads} />
        </KpiStatCardShell>

        <DashboardNotificationsCard />

        <TopPerformersCard
          performers={topPerformers}
          className="min-h-[430px] md:col-span-2 lg:col-span-1"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <KpiStatCardShell
          label="Load Status Trend"
          value={metrics.deliveredLoads.toLocaleString()}
          helper={`Delivered loads - ${trendWindowLabel.toLowerCase()}`}
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
            appliedFilters.teamIds.length > 0 ||
            appliedFilters.dispatcherIds.length > 0
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
      </div>
    </section>
  );
}

function sortNotifications(notifications: AppNotification[]) {
  return [...notifications].sort((a, b) => {
    const unreadDelta = Number(a.readAt !== null) - Number(b.readAt !== null);
    if (unreadDelta !== 0) return unreadDelta;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
}

function formatNotificationTime(value: string) {
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function DashboardNotificationsCard({ className }: { className?: string }) {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadNotifications() {
      try {
        const result = await fetchNotifications();
        if (!active) return;
        setNotifications(sortNotifications(result.notifications));
        setUnreadCount(result.unreadCount);
        setError(null);
      } catch {
        if (!active) return;
        setError("Unable to load notifications.");
      }
    }

    loadNotifications();
    const intervalId = window.setInterval(loadNotifications, 10000);

    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, []);

  const latest = notifications.slice(0, 5);

  return (
    <article
      className={cn(
        "flex min-h-[430px] min-w-0 flex-col overflow-hidden rounded-[18px] border border-[#E5E7EB] bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.05)]",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-[#DBEAFE] text-[#2563EB]">
            <Bell className="size-5" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-medium text-[#64748B]">Notifications</p>
              {unreadCount > 0 ? (
                <Badge className="rounded-full bg-[#EF4444] px-2 py-0 text-xs text-white">
                  {unreadCount} unread
                </Badge>
              ) : null}
            </div>
            <p className="mt-1 text-[28px] leading-none font-semibold tracking-tight text-[#0F172A]">
              {unreadCount.toLocaleString()}
            </p>
            <p className="mt-2 text-xs text-[#64748B]">
              Auto-refreshes every 10 seconds
            </p>
          </div>
        </div>
      </div>

      <div className="mt-5 flex min-h-0 flex-1 flex-col">
        {error ? (
          <div className="flex min-h-[240px] flex-1 items-center justify-center rounded-xl border border-dashed border-[#FCA5A5] bg-[#FEF2F2] px-4 text-center text-sm text-[#B91C1C]">
            {error}
          </div>
        ) : unreadCount === 0 ? (
          <div className="flex min-h-[240px] flex-1 flex-col items-center justify-center rounded-xl border border-dashed border-[#E2E8F0] bg-[#F8FAFC] px-4 text-center">
            <Bell className="mb-3 size-8 text-[#94A3B8]" />
            <p className="font-medium text-[#0F172A]">No new notifications</p>
            <p className="mt-1 text-xs text-[#64748B]">
              You are all caught up.
            </p>
          </div>
        ) : (
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
            {latest.map((notification) => (
              <div
                key={notification.id}
                className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="line-clamp-1 text-sm font-semibold text-[#0F172A]">
                    {notification.title}
                  </p>
                  {!notification.readAt ? (
                    <span className="mt-1 size-2 shrink-0 rounded-full bg-[#2563EB]" />
                  ) : null}
                </div>
                <p className="mt-1 line-clamp-2 text-xs text-[#64748B]">
                  {notification.message}
                </p>
                <p className="mt-2 text-[11px] text-[#94A3B8]">
                  {formatNotificationTime(notification.createdAt)}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </article>
  );
}
