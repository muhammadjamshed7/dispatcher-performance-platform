"use client";

import { useMemo } from "react";

import { EntityFilterBar } from "@/components/filters/entity-filter-bar";
import { DataTablePlaceholder } from "@/components/data-table-placeholder";
import { RoleScopeBanner } from "@/components/layout/role-scope-banner";
import { PageShell } from "@/components/layout/page-shell";
import { MetricCard } from "@/components/metric-card";
import { useRoleScope } from "@/hooks/use-role-scope";
import {
  mockActivities,
  mockCarriers,
  mockDispatchers,
  mockTeamLeadMetrics,
} from "@/lib/mock-data";
import { formatCurrency } from "@/lib/utils/format-currency";

export function TeamLeadDashboardPage() {
  const { filterActivities, filterCarriers, filterDispatchers, teamName } =
    useRoleScope();

  const teamActivities = useMemo(
    () => filterActivities(mockActivities),
    [filterActivities],
  );
  const teamCarriers = useMemo(
    () => filterCarriers(mockCarriers),
    [filterCarriers],
  );
  const teamDispatchers = useMemo(
    () => filterDispatchers(mockDispatchers),
    [filterDispatchers],
  );

  return (
    <PageShell
      title="Team Lead Dashboard"
      description="Team-level metrics and activity preview using mock data."
    >
      <RoleScopeBanner
        message={teamName ? `Showing data for ${teamName}` : "Team-scoped view"}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Team Revenue"
          value={formatCurrency(mockTeamLeadMetrics.totalRevenue, { nullLabel: "—" })}
          hint="Mock team MTD"
        />
        <MetricCard
          label="Team Loads"
          value={mockTeamLeadMetrics.totalLoads.toString()}
          hint="Team recorded loads"
        />
        <MetricCard
          label="Team Dispatchers"
          value={teamDispatchers.length.toString()}
          hint="Active team members"
        />
        <MetricCard
          label="Team Carriers"
          value={teamCarriers.length.toString()}
          hint="Assigned carriers"
        />
      </div>

      <EntityFilterBar />

      <DataTablePlaceholder
        title="Team Activity Overview"
        columns={["Dispatcher", "Carrier", "Status", "Load Amount"]}
        rows={teamActivities.slice(0, 5).map((activity) => [
          activity.dispatcherName,
          activity.carrierName,
          activity.status.replaceAll("_", " "),
          formatCurrency(activity.loadAmount, { nullLabel: "—" }),
        ])}
      />
    </PageShell>
  );
}
