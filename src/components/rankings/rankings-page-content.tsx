"use client";

import { useCallback, useMemo, useState } from "react";

import { PageContentGate } from "@/components/feedback/page-content-gate";
import type { PageContentState } from "@/components/feedback/page-content-gate";
import { EntityFilterBar } from "@/components/filters/entity-filter-bar";
import { RankingsTable } from "@/components/tables/rankings-table";
import { RoleScopeBanner } from "@/components/layout/role-scope-banner";
import { MetricCard } from "@/components/metric-card";
import { PageShell } from "@/components/layout/page-shell";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useApiData } from "@/hooks/use-api-data";
import { fetchRankings } from "@/lib/api/resources";
import {
  DEFAULT_ENTITY_FILTERS,
  entityFiltersToRankingParams,
  type EntityFilterValues,
} from "@/lib/filters/entity-filter-params";
import type {
  CarrierRanking,
  DispatcherRanking,
  TeamRanking,
} from "@/lib/types";
type RankingTab = "dispatchers" | "carriers" | "teams";

const RANKING_TABS: { id: RankingTab; label: string }[] = [
  { id: "dispatchers", label: "Dispatcher Rankings" },
  { id: "carriers", label: "Carrier Rankings" },
  { id: "teams", label: "Team Rankings" },
];

function isDispatcherRanking(row: unknown): row is DispatcherRanking {
  return (
    typeof row === "object" && row !== null && "name" in row && "team" in row
  );
}

function isCarrierRanking(row: unknown): row is CarrierRanking {
  return (
    typeof row === "object" &&
    row !== null &&
    "carrierName" in row &&
    "dispatcherName" in row
  );
}

function isTeamRanking(row: unknown): row is TeamRanking {
  return typeof row === "object" && row !== null && "teamName" in row;
}

export function RankingsPageContent() {
  const [activeTab, setActiveTab] = useState<RankingTab>("dispatchers");
  const [draftFilters, setDraftFilters] = useState<EntityFilterValues>(
    DEFAULT_ENTITY_FILTERS,
  );
  const [appliedFilters, setAppliedFilters] = useState<EntityFilterValues>(
    DEFAULT_ENTITY_FILTERS,
  );

  const rankingType =
    activeTab === "dispatchers"
      ? "dispatcher"
      : activeTab === "carriers"
        ? "carrier"
        : "team";

  const loadRankings = useCallback(
    () =>
      fetchRankings(rankingType, entityFiltersToRankingParams(appliedFilters)),
    [appliedFilters, rankingType],
  );

  const {
    data: rankings = [],
    error,
    isLoading,
    isEmpty,
    reload,
  } = useApiData(loadRankings, [activeTab, appliedFilters]);

  const dispatcherRankings = useMemo(
    () => rankings.filter(isDispatcherRanking),
    [rankings],
  );
  const carrierRankings = useMemo(
    () => rankings.filter(isCarrierRanking),
    [rankings],
  );
  const teamRankings = useMemo(
    () => rankings.filter(isTeamRanking),
    [rankings],
  );

  const activeRows =
    activeTab === "dispatchers"
      ? dispatcherRankings
      : activeTab === "carriers"
        ? carrierRankings
        : teamRankings;

  const pageState: PageContentState = isLoading
    ? "loading"
    : error
      ? "error"
      : isEmpty
        ? "empty"
        : "ready";

  const activeCount = dispatcherRankings.length;

  return (
    <PageShell
      title="Rankings"
      description="Performance rankings scoped to your role and team access."
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

      <EntityFilterBar
        values={draftFilters}
        onChange={setDraftFilters}
        onApply={() => setAppliedFilters(draftFilters)}
        showDateRange={false}
        showCarrier={false}
        showTruckType={false}
        showStatus={false}
      />

      <PageContentGate
        state={pageState}
        onRetry={reload}
        loadingTitle="Loading rankings"
        emptyTitle="No rankings available"
        emptyDescription="There are no rankings for the selected scope and filters."
        emptyActionLabel="Refresh preview"
        onEmptyAction={reload}
        errorTitle="Unable to load rankings"
        errorDescription={
          error ?? "Rankings could not be loaded. Try again in a moment."
        }
      >
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <MetricCard
              label="Top Performer"
              value={
                activeTab === "dispatchers"
                  ? (dispatcherRankings[0]?.name ?? "—")
                  : activeTab === "carriers"
                    ? (carrierRankings[0]?.carrierName ?? "—")
                    : (teamRankings[0]?.teamName ?? "—")
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
            <RankingsTable type="dispatchers" rows={dispatcherRankings} />
          ) : null}

          {activeTab === "carriers" ? (
            <RankingsTable type="carriers" rows={carrierRankings} />
          ) : null}

          {activeTab === "teams" ? (
            <RankingsTable type="teams" rows={teamRankings} />
          ) : null}
        </>
      </PageContentGate>
    </PageShell>
  );
}
