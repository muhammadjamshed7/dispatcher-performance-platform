"use client";

import { useMemo } from "react";

import { DataTablePlaceholder } from "@/components/data-table-placeholder";
import { RoleScopeBanner } from "@/components/layout/role-scope-banner";
import { PageShell } from "@/components/layout/page-shell";
import { MetricCard } from "@/components/metric-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useRoleScope } from "@/hooks/use-role-scope";
import {
  mockActivities,
  mockCarriers,
  mockDispatcherMetrics,
} from "@/lib/mock-data";
import { formatCurrency } from "@/lib/utils/format-currency";
import { formatRatePerMile } from "@/lib/utils/format-rate-per-mile";

export function DispatcherDashboardPage() {
  const { filterActivities, filterCarriers, dispatcherName } = useRoleScope();
  const today = new Date().toISOString().slice(0, 10);

  const assignedCarriers = useMemo(
    () => filterCarriers(mockCarriers),
    [filterCarriers],
  );
  const personalActivities = useMemo(
    () => filterActivities(mockActivities),
    [filterActivities],
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

  return (
    <PageShell
      title="Dispatcher Dashboard"
      description="Personal performance preview using mock data."
    >
      <RoleScopeBanner
        message={
          dispatcherName
            ? `Personal view for ${dispatcherName}`
            : "Dispatcher personal view"
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Personal Revenue"
          value={formatCurrency(mockDispatcherMetrics.totalRevenue, { nullLabel: "—" })}
          hint="Mock MTD total"
        />
        <MetricCard
          label="Delivered Loads"
          value={mockDispatcherMetrics.deliveredLoads.toString()}
          hint="Completed deliveries"
        />
        <MetricCard
          label="Avg Rate / Mile"
          value={formatRatePerMile(mockDispatcherMetrics.avgRatePerMile, "—")}
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
              All assigned carriers have activity logged for today (mock).
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
    </PageShell>
  );
}
