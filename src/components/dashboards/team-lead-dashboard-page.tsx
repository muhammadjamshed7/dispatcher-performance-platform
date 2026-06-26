"use client";

import { useCallback, useMemo } from "react";

import { PageContentGate } from "@/components/feedback/page-content-gate";
import type { PageContentState } from "@/components/feedback/page-content-gate";
import { TeamActivityOverviewTable } from "@/components/dashboard/team-lead/team-activity-overview-table";
import { RoleScopeBanner } from "@/components/layout/role-scope-banner";
import { PageShell } from "@/components/layout/page-shell";
import { MetricCard } from "@/components/metric-card";
import { useApiData } from "@/hooks/use-api-data";
import { useRoleScope } from "@/hooks/use-role-scope";
import { APPROVED } from "@/lib/constants/activity-approval";
import {
  fetchActivities,
  fetchCarriers,
  fetchDispatchers,
  fetchTeamLeadDashboard,
} from "@/lib/api/resources";
import { formatCurrency } from "@/lib/utils/format-currency";

export function TeamLeadDashboardPage() {
  const { filterActivities, filterCarriers, filterDispatchers, teamName } =
    useRoleScope();

  const loadMetrics = useCallback(() => fetchTeamLeadDashboard(), []);
  const loadActivities = useCallback(
    () => fetchActivities({ approvalStatus: APPROVED }),
    [],
  );
  const loadCarriers = useCallback(() => fetchCarriers(), []);
  const loadDispatchers = useCallback(() => fetchDispatchers(), []);

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
  const {
    data: carriers = [],
    error: carriersError,
    isLoading: carriersLoading,
    reload: reloadCarriers,
  } = useApiData(loadCarriers, []);
  const {
    data: dispatchers = [],
    error: dispatchersError,
    isLoading: dispatchersLoading,
    reload: reloadDispatchers,
  } = useApiData(loadDispatchers, []);

  const isLoading =
    metricsLoading ||
    activitiesLoading ||
    carriersLoading ||
    dispatchersLoading;
  const error =
    metricsError ?? activitiesError ?? carriersError ?? dispatchersError;

  const teamActivities = useMemo(
    () =>
      filterActivities(activities).filter(
        (activity) => activity.approvalStatus === APPROVED,
      ),
    [activities, filterActivities],
  );
  const teamCarriers = useMemo(
    () => filterCarriers(carriers),
    [carriers, filterCarriers],
  );
  const teamDispatchers = useMemo(
    () => filterDispatchers(dispatchers),
    [dispatchers, filterDispatchers],
  );

  const pageState: PageContentState = isLoading
    ? "loading"
    : error
      ? "error"
      : "ready";

  const reload = useCallback(() => {
    void reloadMetrics();
    void reloadActivities();
    void reloadCarriers();
    void reloadDispatchers();
  }, [reloadMetrics, reloadActivities, reloadCarriers, reloadDispatchers]);

  return (
    <PageShell
      title="Team Lead Dashboard"
      description="Team-level metrics and activity for your assigned team."
    >
      <RoleScopeBanner
        message={teamName ? `Showing data for ${teamName}` : "Team-scoped view"}
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
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              label="Team Revenue"
              value={formatCurrency(metrics?.totalRevenue ?? null, {
                nullLabel: "—",
              })}
              hint="Team month-to-date total"
            />
            <MetricCard
              label="Team Loads"
              value={metrics?.totalLoads.toString() ?? "—"}
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

          <TeamActivityOverviewTable activities={teamActivities} />
        </>
      </PageContentGate>
    </PageShell>
  );
}
