"use client";

import { EntityFilterBar } from "@/components/filters/entity-filter-bar";
import { DataTablePlaceholder } from "@/components/data-table-placeholder";
import { RoleScopeBanner } from "@/components/layout/role-scope-banner";
import { PageShell } from "@/components/layout/page-shell";
import { MetricCard } from "@/components/metric-card";
import { mockActivities, mockAdminMetrics } from "@/lib/mock-data";
import { formatCurrency } from "@/lib/utils/format-currency";

export function AdminDashboardPage() {
  return (
    <PageShell
      title="Admin Dashboard"
      description="Organization-wide performance preview using mock data."
    >
      <RoleScopeBanner message="Company-wide admin view" />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Total Revenue"
          value={formatCurrency(mockAdminMetrics.totalRevenue, { nullLabel: "—" })}
          hint="Mock MTD total"
        />
        <MetricCard
          label="Total Loads"
          value={mockAdminMetrics.totalLoads.toString()}
          hint="All recorded loads"
        />
        <MetricCard
          label="Delivered Loads"
          value={mockAdminMetrics.deliveredLoads.toString()}
          hint="Completed deliveries"
        />
        <MetricCard
          label="Active Dispatchers"
          value={mockAdminMetrics.activeDispatchers.toString()}
          hint="Across all teams"
        />
      </div>

      <EntityFilterBar />

      <DataTablePlaceholder
        title="Recent Daily Activities"
        columns={["Dispatcher", "Carrier", "Status", "Load Amount"]}
        rows={mockActivities.slice(0, 5).map((activity) => [
          activity.dispatcherName,
          activity.carrierName,
          activity.status.replaceAll("_", " "),
          formatCurrency(activity.loadAmount, { nullLabel: "—" }),
        ])}
      />
    </PageShell>
  );
}
