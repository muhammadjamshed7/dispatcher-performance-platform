"use client";

import { useCallback, useMemo, useState } from "react";

import { PageContentGate } from "@/components/feedback/page-content-gate";
import { EntityFilterBar } from "@/components/filters/entity-filter-bar";
import { DataTablePlaceholder } from "@/components/data-table-placeholder";
import { RoleScopeBanner } from "@/components/layout/role-scope-banner";
import { MetricCard } from "@/components/metric-card";
import { PageShell } from "@/components/layout/page-shell";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useMockPageState } from "@/hooks/use-mock-page-state";
import { useRoleScope } from "@/hooks/use-role-scope";
import {
  mockCarrierRankings,
  mockDispatcherRankings,
  mockDispatchers,
  mockTeamRankings,
} from "@/lib/mock-data";
import { TEAM_STATUS_ACTIVE } from "@/lib/constants/team-statuses";
import { formatCurrencyCompact } from "@/lib/utils/format-currency";

type RankingTab = "dispatchers" | "carriers" | "teams";

const RANKING_TABS: { id: RankingTab; label: string }[] = [
  { id: "dispatchers", label: "Dispatcher Rankings" },
  { id: "carriers", label: "Carrier Rankings" },
  { id: "teams", label: "Team Rankings" },
];

export function RankingsPageContent() {
  const [activeTab, setActiveTab] = useState<RankingTab>("dispatchers");
  const { filterDispatchers, isCompanyWide, teamName, dispatcherName } =
    useRoleScope();

  const scopedDispatchers = useMemo(
    () => filterDispatchers(mockDispatchers),
    [filterDispatchers],
  );

  const scopedDispatcherRankings = useMemo(() => {
    const names = new Set(scopedDispatchers.map((item) => item.fullName));
    return mockDispatcherRankings.filter((row) => names.has(row.name));
  }, [scopedDispatchers]);

  const scopedCarrierRankings = useMemo(() => {
    if (isCompanyWide) {
      return mockCarrierRankings;
    }

    if (dispatcherName) {
      return mockCarrierRankings.filter(
        (row) => row.dispatcherName === dispatcherName,
      );
    }

    if (teamName) {
      return mockCarrierRankings.filter((row) =>
        scopedDispatchers.some(
          (dispatcher) => dispatcher.fullName === row.dispatcherName,
        ),
      );
    }

    return mockCarrierRankings;
  }, [dispatcherName, isCompanyWide, scopedDispatchers, teamName]);

  const scopedTeamRankings = useMemo(() => {
    if (isCompanyWide) {
      return mockTeamRankings;
    }

    if (teamName) {
      return mockTeamRankings.filter((row) => row.teamName === teamName);
    }

    return mockTeamRankings;
  }, [isCompanyWide, teamName]);

  const activeRows =
    activeTab === "dispatchers"
      ? scopedDispatcherRankings
      : activeTab === "carriers"
        ? scopedCarrierRankings
        : scopedTeamRankings;

  const isEmpty = activeRows.length === 0;
  const { state, retry } = useMockPageState({ isEmpty, resetKey: activeTab });

  const handleEmptyAction = useCallback(() => {
    retry();
  }, [retry]);

  const activeCount = scopedDispatchers.filter(
    (dispatcher) => dispatcher.status === TEAM_STATUS_ACTIVE,
  ).length;

  return (
    <PageShell
      title="Rankings"
      description="Performance rankings preview using mock data and role-based scope."
    >
      <RoleScopeBanner />

      <div className="flex flex-wrap gap-2">
        {RANKING_TABS.map((tab) => (
          <Button
            key={tab.id}
            type="button"
            variant={activeTab === tab.id ? "default" : "outline"}
            size="sm"
            className={cn(activeTab === tab.id && "shadow-sm")}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </Button>
        ))}
      </div>

      <EntityFilterBar />

      <PageContentGate
        state={state}
        onRetry={retry}
        loadingTitle="Loading rankings"
        emptyTitle="No rankings available"
        emptyDescription="There are no rankings for the selected scope and filters."
        emptyActionLabel="Refresh preview"
        onEmptyAction={handleEmptyAction}
        errorTitle="Unable to load rankings"
        errorDescription="Rankings could not be loaded. Try again in a moment."
      >
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <MetricCard
              label="Top Performer"
              value={
                activeTab === "dispatchers"
                  ? (scopedDispatcherRankings[0]?.name ?? "—")
                  : activeTab === "carriers"
                    ? (scopedCarrierRankings[0]?.carrierName ?? "—")
                    : (scopedTeamRankings[0]?.teamName ?? "—")
              }
            />
            <MetricCard
              label="Ranked Items"
              value={activeRows.length.toString()}
            />
            <MetricCard
              label="Active Dispatchers"
              value={activeCount.toString()}
            />
          </div>

          {activeTab === "dispatchers" ? (
            <DataTablePlaceholder
              title="Dispatcher Rankings"
              columns={["Rank", "Dispatcher", "Team", "Assigned Carriers"]}
              rows={scopedDispatcherRankings.map((row) => [
                row.rank.toString(),
                row.name,
                row.team,
                row.carriers.toString(),
              ])}
            />
          ) : null}

          {activeTab === "carriers" ? (
            <DataTablePlaceholder
              title="Carrier Rankings"
              columns={["Rank", "Carrier", "Dispatcher", "Activity Score"]}
              rows={scopedCarrierRankings.map((row) => [
                row.rank.toString(),
                row.carrierName,
                row.dispatcherName,
                row.activityScore.toString(),
              ])}
            />
          ) : null}

          {activeTab === "teams" ? (
            <DataTablePlaceholder
              title="Team Rankings"
              columns={["Rank", "Team", "Team Lead", "Revenue"]}
              rows={scopedTeamRankings.map((row) => [
                row.rank.toString(),
                row.teamName,
                row.teamLeadName,
                formatCurrencyCompact(row.revenue),
              ])}
            />
          ) : null}
        </>
      </PageContentGate>
    </PageShell>
  );
}
