"use client";

import type { ReactNode } from "react";
import { useCallback, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { LucideIcon } from "lucide-react";
import {
  Filter,
  MoreHorizontal,
  Plus,
  Trophy,
  Truck,
  UserRound,
  UsersRound,
} from "lucide-react";

import { PageContentGate } from "@/components/feedback/page-content-gate";
import type { PageContentState } from "@/components/feedback/page-content-gate";
import { AppToast } from "@/components/feedback/app-toast";
import { CarrierFilter } from "@/components/filters/carrier-filter";
import { DateRangeFilter } from "@/components/filters/date-range-filter";
import { DispatcherFilter } from "@/components/filters/dispatcher-filter";
import { TeamFilter } from "@/components/filters/team-filter";
import { TeamStatusFilter } from "@/components/filters/team-status-filter";
import { TeamModal, type TeamModalMode } from "@/components/modals/team-modal";
import {
  TeamsTable,
  type TeamRowAction,
  type TeamTableMetrics,
} from "@/components/tables/teams-table";
import { PageShell } from "@/components/layout/page-shell";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useApiData } from "@/hooks/use-api-data";
import { useRealtimeRefresh } from "@/hooks/use-realtime-refresh";
import { ApiClientError } from "@/lib/api/client";
import {
  createTeamRequest,
  fetchActivities,
  fetchCarriers,
  fetchDispatchers,
  fetchTeams,
  updateTeamRequest,
} from "@/lib/api/resources";
import { APPROVED } from "@/lib/constants/activity-approval";
import { DATE_RANGE_OPTIONS } from "@/lib/constants/date-ranges";
import { FILTER_ALL } from "@/lib/constants/filters";
import { DELIVERED } from "@/lib/constants/statuses";
import {
  TEAM_STATUS_ACTIVE,
  TEAM_STATUS_INACTIVE,
} from "@/lib/constants/team-statuses";
import type { Carrier, DailyActivity, Dispatcher, Team } from "@/lib/types";
import { formatCurrency } from "@/lib/utils/format-currency";
import { resolveDateRangePreset } from "@/lib/utils/resolve-date-range-preset";
import type { TeamFormValues } from "@/lib/validation/team-form";

const TEAM_COLORS = [
  "#2563EB",
  "#22C55E",
  "#F97316",
  "#8B5CF6",
  "#06B6D4",
  "#EAB308",
  "#EC4899",
  "#64748B",
];

const METRIC_COLORS = {
  dispatchers: "#2563EB",
  carriers: "#22C55E",
  deliveredLoads: "#8B5CF6",
  revenue: "#F97316",
} as const;

type TeamsDashboardFilters = {
  dateRange: string;
  teamId: string;
  teamLeadName: string;
  status: string;
  dispatcherId: string;
  carrierId: string;
};

type TeamAnalyticsRow = {
  id: string;
  name: string;
  teamLeadName: string;
  status: string;
  dispatchers: number;
  carriers: number;
  deliveredLoads: number;
  revenue: number;
  revenueK: number;
  score: number;
  initials: string;
  color: string;
  createdAt: string;
  memberNames: string[];
};

type TeamsAnalytics = {
  totalTeams: number;
  totalDispatchers: number;
  totalCarriers: number;
  topTeamName: string;
  topTeamScore: number;
  rows: TeamAnalyticsRow[];
};

const DEFAULT_FILTERS: TeamsDashboardFilters = {
  dateRange: "this-month",
  teamId: FILTER_ALL,
  teamLeadName: FILTER_ALL,
  status: FILTER_ALL,
  dispatcherId: FILTER_ALL,
  carrierId: FILTER_ALL,
};

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof ApiClientError ? error.message : fallback;
}

function getPeriodLabel(dateRange: string): string {
  return (
    DATE_RANGE_OPTIONS.find((option) => option.value === dateRange)?.label ??
    "This month"
  );
}

function getInitials(name: string): string {
  const words = name.replaceAll("/", " ").split(/\s+/).filter(Boolean);

  if (words.length === 0) return "TM";
  if (words.length === 1) return words[0]!.slice(0, 2).toUpperCase();

  return `${words[0]![0]}${words[1]![0]}`.toUpperCase();
}

function formatRevenueShort(value: number): string {
  if (value >= 1000) {
    return `${Math.round(value / 1000)}K`;
  }

  return Math.round(value).toString();
}

function formatRevenueLabel(value: unknown): string {
  const numericValue = Number(value ?? 0);
  return formatRevenueShort(Number.isFinite(numericValue) ? numericValue : 0);
}

function buildActivityParams(
  filters: TeamsDashboardFilters,
): Record<string, string> {
  const { dateFrom, dateTo } = resolveDateRangePreset(filters.dateRange);
  const params: Record<string, string> = {
    dateFrom,
    dateTo,
    approvalStatus: APPROVED,
  };

  if (filters.teamId !== FILTER_ALL) params.teamId = filters.teamId;
  if (filters.dispatcherId !== FILTER_ALL) {
    params.dispatcherId = filters.dispatcherId;
  }
  if (filters.carrierId !== FILTER_ALL) params.carrierId = filters.carrierId;

  return params;
}

function filterTeams(
  teams: Team[],
  dispatchers: Dispatcher[],
  carriers: Carrier[],
  filters: TeamsDashboardFilters,
): Team[] {
  const selectedDispatcher =
    filters.dispatcherId === FILTER_ALL
      ? null
      : dispatchers.find(
          (dispatcher) => dispatcher.id === filters.dispatcherId,
        );
  const selectedCarrier =
    filters.carrierId === FILTER_ALL
      ? null
      : carriers.find((carrier) => carrier.id === filters.carrierId);

  return teams.filter((team) => {
    if (filters.teamId !== FILTER_ALL && team.id !== filters.teamId) {
      return false;
    }

    if (
      filters.teamLeadName !== FILTER_ALL &&
      team.teamLeadName !== filters.teamLeadName
    ) {
      return false;
    }

    if (filters.status !== FILTER_ALL && team.status !== filters.status) {
      return false;
    }

    if (selectedDispatcher && selectedDispatcher.teamName !== team.name) {
      return false;
    }

    if (
      selectedCarrier &&
      selectedCarrier.assignedTeamId !== team.id &&
      selectedCarrier.assignedTeamName !== team.name
    ) {
      return false;
    }

    return true;
  });
}

function calculatePerformanceScore(input: {
  status: string;
  dispatchers: number;
  carriers: number;
  deliveredLoads: number;
  revenue: number;
}): number {
  const raw =
    (input.status === TEAM_STATUS_ACTIVE ? 10 : 0) +
    input.dispatchers * 8 +
    input.carriers * 5 +
    input.deliveredLoads * 1.5 +
    Math.min(input.revenue / 1000, 30);

  return Math.round(Math.min(100, raw) * 10) / 10;
}

function buildTeamsAnalytics({
  teams,
  dispatchers,
  carriers,
  activities,
}: {
  teams: Team[];
  dispatchers: Dispatcher[];
  carriers: Carrier[];
  activities: DailyActivity[];
}): TeamsAnalytics {
  const rows = teams.map((team, index) => {
    const teamDispatchers = dispatchers.filter(
      (dispatcher) => dispatcher.teamName === team.name,
    );
    const teamCarriers = carriers.filter(
      (carrier) =>
        carrier.assignedTeamId === team.id ||
        carrier.assignedTeamName === team.name,
    );
    const teamActivities = activities.filter(
      (activity) =>
        activity.teamId === team.id || activity.teamName === team.name,
    );
    const deliveredLoads = teamActivities.filter(
      (activity) => activity.status === DELIVERED,
    ).length;
    const revenue = teamActivities.reduce(
      (total, activity) =>
        total +
        (activity.status === DELIVERED ? (activity.loadAmount ?? 0) : 0),
      0,
    );
    const dispatchersCount = teamDispatchers.length;
    const carriersCount = teamCarriers.length;
    const score = calculatePerformanceScore({
      status: team.status,
      dispatchers: dispatchersCount,
      carriers: carriersCount,
      deliveredLoads,
      revenue,
    });

    return {
      id: team.id,
      name: team.name,
      teamLeadName: team.teamLeadName || "Unassigned",
      status: team.status,
      dispatchers: dispatchersCount,
      carriers: carriersCount,
      deliveredLoads,
      revenue,
      revenueK: Math.round(revenue / 100) / 10,
      score,
      initials: getInitials(team.name),
      color: TEAM_COLORS[index % TEAM_COLORS.length]!,
      createdAt: team.createdAt,
      memberNames: teamDispatchers.map((dispatcher) => dispatcher.fullName),
    } satisfies TeamAnalyticsRow;
  });
  const topTeam = [...rows].sort((left, right) => right.score - left.score)[0];

  return {
    totalTeams: rows.length,
    totalDispatchers: rows.reduce((total, row) => total + row.dispatchers, 0),
    totalCarriers: rows.reduce((total, row) => total + row.carriers, 0),
    topTeamName: topTeam?.name ?? "No team",
    topTeamScore: topTeam?.score ?? 0,
    rows,
  };
}

function buildMetricsByTeamId(
  rows: TeamAnalyticsRow[],
): Record<string, TeamTableMetrics> {
  return Object.fromEntries(
    rows.map((row) => [
      row.id,
      {
        score: row.score,
        color: row.color,
        initials: row.initials,
      },
    ]),
  );
}

export function TeamsPageContent() {
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<TeamModalMode>("create");
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [draftFilters, setDraftFilters] =
    useState<TeamsDashboardFilters>(DEFAULT_FILTERS);
  const [appliedFilters, setAppliedFilters] =
    useState<TeamsDashboardFilters>(DEFAULT_FILTERS);

  const loadTeams = useCallback(() => fetchTeams(), []);
  const loadDispatchers = useCallback(() => fetchDispatchers(), []);
  const loadCarriers = useCallback(() => fetchCarriers(), []);
  const loadActivities = useCallback(
    () => fetchActivities(buildActivityParams(appliedFilters)),
    [appliedFilters],
  );
  const {
    data: teams = [],
    error,
    isLoading,
    isEmpty,
    reload,
  } = useApiData(loadTeams, []);
  const {
    data: dispatchers = [],
    error: dispatchersError,
    isLoading: dispatchersLoading,
    reload: reloadDispatchers,
  } = useApiData(loadDispatchers, []);
  const {
    data: carriers = [],
    error: carriersError,
    isLoading: carriersLoading,
    reload: reloadCarriers,
  } = useApiData(loadCarriers, []);
  const {
    data: activities = [],
    error: activitiesError,
    isLoading: activitiesLoading,
    reload: reloadActivities,
  } = useApiData(loadActivities, [appliedFilters]);

  const refreshDashboard = useCallback(async () => {
    await Promise.all([
      reload(),
      reloadDispatchers(),
      reloadCarriers(),
      reloadActivities(),
    ]);
  }, [reload, reloadActivities, reloadCarriers, reloadDispatchers]);

  const teamRealtimeTables = useMemo(
    () => ["Team", "User", "Carrier", "DailyActivity"] as const,
    [],
  );

  useRealtimeRefresh(teamRealtimeTables, refreshDashboard);

  const visibleTeams = useMemo(
    () => filterTeams(teams, dispatchers, carriers, appliedFilters),
    [appliedFilters, carriers, dispatchers, teams],
  );
  const visibleTeamIds = useMemo(
    () => new Set(visibleTeams.map((team) => team.id)),
    [visibleTeams],
  );
  const visibleTeamNames = useMemo(
    () => new Set(visibleTeams.map((team) => team.name)),
    [visibleTeams],
  );
  const scopedDispatchers = useMemo(
    () =>
      dispatchers.filter((dispatcher) => {
        if (!visibleTeamNames.has(dispatcher.teamName)) return false;
        if (
          appliedFilters.dispatcherId !== FILTER_ALL &&
          dispatcher.id !== appliedFilters.dispatcherId
        ) {
          return false;
        }
        return true;
      }),
    [appliedFilters.dispatcherId, dispatchers, visibleTeamNames],
  );
  const scopedCarriers = useMemo(
    () =>
      carriers.filter((carrier) => {
        if (
          !visibleTeamIds.has(carrier.assignedTeamId) &&
          !visibleTeamNames.has(carrier.assignedTeamName)
        ) {
          return false;
        }
        if (
          appliedFilters.carrierId !== FILTER_ALL &&
          carrier.id !== appliedFilters.carrierId
        ) {
          return false;
        }
        if (
          appliedFilters.dispatcherId !== FILTER_ALL &&
          carrier.assignedDispatcherId !== appliedFilters.dispatcherId
        ) {
          return false;
        }
        return true;
      }),
    [
      appliedFilters.carrierId,
      appliedFilters.dispatcherId,
      carriers,
      visibleTeamIds,
      visibleTeamNames,
    ],
  );
  const scopedActivities = useMemo(
    () =>
      activities.filter(
        (activity) =>
          visibleTeamIds.has(activity.teamId) ||
          visibleTeamNames.has(activity.teamName),
      ),
    [activities, visibleTeamIds, visibleTeamNames],
  );
  const analytics = useMemo(
    () =>
      buildTeamsAnalytics({
        teams: visibleTeams,
        dispatchers: scopedDispatchers,
        carriers: scopedCarriers,
        activities: scopedActivities,
      }),
    [scopedActivities, scopedCarriers, scopedDispatchers, visibleTeams],
  );
  const metricsByTeamId = useMemo(
    () => buildMetricsByTeamId(analytics.rows),
    [analytics.rows],
  );
  const teamLeadOptions = useMemo(
    () =>
      [...new Set(teams.map((team) => team.teamLeadName || "Unassigned"))].sort(
        (left, right) => left.localeCompare(right),
      ),
    [teams],
  );
  const periodLabel = getPeriodLabel(appliedFilters.dateRange);

  const pageState: PageContentState =
    isLoading || dispatchersLoading || carriersLoading || activitiesLoading
      ? "loading"
      : error || dispatchersError || carriersError || activitiesError
        ? "error"
        : isEmpty
          ? "empty"
          : "ready";

  const showToast = useCallback((message: string) => {
    setToastMessage(message);
  }, []);

  function openModal(mode: TeamModalMode, team: Team | null = null) {
    setSelectedTeam(team);
    setModalMode(mode);
    setModalOpen(true);
  }

  function handleRowAction(team: Team, action: TeamRowAction) {
    if (action === "toggle-status") {
      openModal(
        team.status === TEAM_STATUS_ACTIVE ? "deactivate" : "activate",
        team,
      );
      return;
    }

    openModal(action, team);
  }

  async function handleCreate(values: TeamFormValues) {
    try {
      await createTeamRequest({
        name: values.name,
        status: values.status,
      });
      showToast(`Team "${values.name}" created successfully.`);
      await refreshDashboard();
    } catch (err) {
      showToast(getErrorMessage(err, "Failed to create team."));
    }
  }

  async function handleEdit(values: TeamFormValues) {
    if (!selectedTeam) {
      return;
    }

    try {
      await updateTeamRequest(selectedTeam.id, {
        name: values.name,
        status: values.status,
      });
      showToast(`Team "${values.name}" updated successfully.`);
      await refreshDashboard();
    } catch (err) {
      showToast(getErrorMessage(err, "Failed to update team."));
    }
  }

  async function handleToggleStatus(team: Team) {
    const isActive = team.status === TEAM_STATUS_ACTIVE;
    const nextStatus = isActive ? TEAM_STATUS_INACTIVE : TEAM_STATUS_ACTIVE;

    try {
      await updateTeamRequest(team.id, { status: nextStatus });
      showToast(
        `Team "${team.name}" ${isActive ? "deactivated" : "activated"}.`,
      );
      await refreshDashboard();
    } catch (err) {
      showToast(getErrorMessage(err, "Failed to update team status."));
    }
  }

  return (
    <>
      <PageShell
        title="Teams"
        description="Compare team performance, dispatcher capacity, and carrier coverage."
        actions={
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              className="h-9 rounded-lg border-[#CBD5E1] bg-white px-3 text-[#334155] shadow-sm hover:bg-[#F8FAFC]"
              onClick={() => setFiltersOpen((open) => !open)}
            >
              <Filter className="size-4" />
              Filters
            </Button>
            <Button
              type="button"
              className="h-9 rounded-lg bg-[#1D4ED8] px-4 font-semibold text-white shadow-sm hover:bg-[#1E40AF]"
              onClick={() => openModal("create")}
            >
              <Plus className="size-4" />
              Create Team
            </Button>
          </div>
        }
      >
        <div className="-m-4 space-y-6 bg-[#F6F8FB] p-4 md:-m-6 md:p-6 lg:-m-8 lg:p-8">
          {filtersOpen ? (
            <TeamsFilterPanel
              values={draftFilters}
              teamLeadOptions={teamLeadOptions}
              onChange={setDraftFilters}
              onApply={() => {
                setAppliedFilters(draftFilters);
                setFiltersOpen(false);
              }}
              onReset={() => {
                setDraftFilters(DEFAULT_FILTERS);
                setAppliedFilters(DEFAULT_FILTERS);
              }}
            />
          ) : null}

          <PageContentGate
            state={pageState}
            onRetry={refreshDashboard}
            loadingTitle="Loading teams dashboard"
            emptyTitle="No teams found"
            emptyDescription="Create a team to organize dispatchers and carriers."
            emptyActionLabel="Create Team"
            onEmptyAction={() => openModal("create")}
            errorTitle="Unable to load teams dashboard"
            errorDescription={
              error ??
              dispatchersError ??
              carriersError ??
              activitiesError ??
              "Team records could not be loaded. Try again in a moment."
            }
          >
            <TeamsKpiGrid analytics={analytics} />
            <TeamsCharts analytics={analytics} periodLabel={periodLabel} />
            <TeamDirectory
              rows={analytics.rows}
              onViewTeam={(teamId) => {
                const team = visibleTeams.find((item) => item.id === teamId);
                if (team) openModal("view", team);
              }}
            />
            <TeamsTable
              teams={visibleTeams}
              metricsByTeamId={metricsByTeamId}
              onAction={handleRowAction}
            />
          </PageContentGate>
        </div>
      </PageShell>

      <TeamModal
        open={modalOpen}
        mode={modalMode}
        team={selectedTeam}
        onOpenChange={setModalOpen}
        onCreate={handleCreate}
        onEdit={handleEdit}
        onToggleStatus={handleToggleStatus}
      />

      <AppToast
        message={toastMessage}
        onDismiss={() => setToastMessage(null)}
      />
    </>
  );
}

function TeamsFilterPanel({
  values,
  teamLeadOptions,
  onChange,
  onApply,
  onReset,
}: {
  values: TeamsDashboardFilters;
  teamLeadOptions: string[];
  onChange: (values: TeamsDashboardFilters) => void;
  onApply: () => void;
  onReset: () => void;
}) {
  function updateField<K extends keyof TeamsDashboardFilters>(
    field: K,
    value: TeamsDashboardFilters[K],
  ) {
    onChange({ ...values, [field]: value });
  }

  return (
    <section className="rounded-2xl border border-[#E2E8F0] bg-white p-4 shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-[#0F172A]">Filters</h2>
          <p className="mt-1 text-xs text-[#64748B]">
            Refine team metrics, charts, directory cards and table records.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onReset}>
            Reset
          </Button>
          <Button
            type="button"
            size="sm"
            className="bg-[#1D4ED8] text-white hover:bg-[#1E40AF]"
            onClick={onApply}
          >
            Apply filters
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <DateRangeFilter
          value={values.dateRange}
          onValueChange={(value) => {
            if (value) updateField("dateRange", value);
          }}
        />
        <TeamFilter
          value={values.teamId}
          onValueChange={(value) => {
            if (value) updateField("teamId", value);
          }}
        />
        <div>
          <p className="mb-1 text-xs font-medium text-[#64748B]">Team Lead</p>
          <Select
            value={values.teamLeadName}
            onValueChange={(value) => {
              if (value) updateField("teamLeadName", value);
            }}
          >
            <SelectTrigger className="w-full" size="sm">
              <SelectValue placeholder="Team lead" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={FILTER_ALL}>All team leads</SelectItem>
              {teamLeadOptions.map((teamLeadName) => (
                <SelectItem key={teamLeadName} value={teamLeadName}>
                  {teamLeadName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <TeamStatusFilter
          value={values.status}
          onValueChange={(value) => {
            if (value) updateField("status", value);
          }}
        />
        <DispatcherFilter
          value={values.dispatcherId}
          onValueChange={(value) => {
            if (value) updateField("dispatcherId", value);
          }}
        />
        <CarrierFilter
          value={values.carrierId}
          onValueChange={(value) => {
            if (value) updateField("carrierId", value);
          }}
        />
      </div>
    </section>
  );
}

function TeamsKpiGrid({ analytics }: { analytics: TeamsAnalytics }) {
  return (
    <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
      <KpiCard
        title="Total Teams"
        value={analytics.totalTeams.toLocaleString()}
        helper="- 0% vs last month"
        helperTone="neutral"
        icon={UsersRound}
        accent="#2563EB"
        iconBackground="#DBEAFE"
      />
      <KpiCard
        title="Total Dispatchers"
        value={analytics.totalDispatchers.toLocaleString()}
        helper="+ 10% vs last month"
        helperTone="positive"
        icon={UserRound}
        accent="#16A34A"
        iconBackground="#DCFCE7"
      />
      <KpiCard
        title="Total Carriers"
        value={analytics.totalCarriers.toLocaleString()}
        helper="+ 12% vs last month"
        helperTone="positive"
        icon={Truck}
        accent="#F97316"
        iconBackground="#FFEDD5"
      />
      <KpiCard
        title="Top Performing Team"
        value={analytics.topTeamName}
        helper={`Score ${analytics.topTeamScore.toFixed(1)} / 100`}
        helperTone="positive"
        icon={Trophy}
        accent="#7C3AED"
        iconBackground="#F3E8FF"
      />
    </section>
  );
}

function KpiCard({
  title,
  value,
  helper,
  helperTone,
  icon: Icon,
  accent,
  iconBackground,
}: {
  title: string;
  value: string;
  helper: string;
  helperTone: "positive" | "neutral";
  icon: LucideIcon;
  accent: string;
  iconBackground: string;
}) {
  return (
    <article className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.05)] transition hover:-translate-y-0.5 hover:shadow-[0_16px_36px_rgba(15,23,42,0.08)]">
      <div className="flex items-center gap-4">
        <div
          className="flex size-12 shrink-0 items-center justify-center rounded-2xl"
          style={{ backgroundColor: iconBackground, color: accent }}
        >
          <Icon className="size-5" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[#334155]">{title}</p>
          <p className="mt-1 truncate text-2xl font-bold tracking-tight text-[#0F172A]">
            {value}
          </p>
          <p
            className={
              helperTone === "positive"
                ? "mt-2 text-xs font-semibold text-[#16A34A]"
                : "mt-2 text-xs font-medium text-[#64748B]"
            }
          >
            {helper}
          </p>
        </div>
      </div>
    </article>
  );
}

function TeamsCharts({
  analytics,
  periodLabel,
}: {
  analytics: TeamsAnalytics;
  periodLabel: string;
}) {
  return (
    <section className="space-y-4">
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <ChartCard
          title="Dispatcher Comparison by Team"
          periodLabel={periodLabel}
        >
          <DispatcherComparisonChart rows={analytics.rows} />
        </ChartCard>
        <ChartCard title="Team Share (by Carriers)" periodLabel={periodLabel}>
          <TeamShareDonut
            rows={analytics.rows}
            total={analytics.totalCarriers}
          />
        </ChartCard>
      </div>
      <ChartCard
        title="Team Performance Overview"
        periodLabel={periodLabel}
        showOptions
      >
        <TeamPerformanceChart rows={analytics.rows} />
      </ChartCard>
    </section>
  );
}

function ChartCard({
  title,
  periodLabel,
  showOptions = false,
  children,
}: {
  title: string;
  periodLabel: string;
  showOptions?: boolean;
  children: ReactNode;
}) {
  return (
    <article className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-[#0F172A]">{title}</h2>
        <div className="flex items-center gap-2">
          <span className="rounded-lg border border-[#E2E8F0] bg-white px-3 py-1.5 text-xs font-semibold text-[#334155] shadow-sm">
            {periodLabel}
          </span>
          {showOptions ? (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={`${title} options`}
            >
              <MoreHorizontal className="size-4" />
            </Button>
          ) : null}
        </div>
      </div>
      {children}
    </article>
  );
}

function EmptyChart({ label }: { label: string }) {
  return (
    <div className="flex h-[280px] items-center justify-center rounded-xl border border-dashed border-[#CBD5E1] bg-[#F8FAFC] text-sm text-[#64748B]">
      {label}
    </div>
  );
}

type TooltipPayload<T> = Array<{ payload: T; value?: number; name?: string }>;

function ChartTooltipShell({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="min-w-48 rounded-xl border border-[#E2E8F0] bg-white p-3 text-xs shadow-xl">
      <p className="mb-2 font-semibold text-[#0F172A]">{title}</p>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function TooltipLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-5 text-[#475569]">
      <span>{label}</span>
      <span className="font-semibold text-[#0F172A]">{value}</span>
    </div>
  );
}

function DispatcherComparisonTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: TooltipPayload<TeamAnalyticsRow>;
}) {
  const row = payload?.[0]?.payload;
  if (!active || !row) return null;

  return (
    <ChartTooltipShell title={row.name}>
      <TooltipLine
        label="Dispatchers"
        value={row.dispatchers.toLocaleString()}
      />
      <TooltipLine label="Carriers" value={row.carriers.toLocaleString()} />
      <TooltipLine label="Team Lead" value={row.teamLeadName} />
    </ChartTooltipShell>
  );
}

function TeamShareTooltip({
  active,
  payload,
  total,
}: {
  active?: boolean;
  payload?: TooltipPayload<TeamAnalyticsRow>;
  total: number;
}) {
  const row = payload?.[0]?.payload;
  if (!active || !row) return null;
  const percent = total > 0 ? (row.carriers / total) * 100 : 0;

  return (
    <ChartTooltipShell title={row.name}>
      <TooltipLine label="Carriers" value={row.carriers.toLocaleString()} />
      <TooltipLine label="Share" value={`${percent.toFixed(1)}%`} />
    </ChartTooltipShell>
  );
}

function TeamPerformanceTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: TooltipPayload<TeamAnalyticsRow>;
  label?: string;
}) {
  const row = payload?.[0]?.payload;
  if (!active || !row) return null;

  return (
    <ChartTooltipShell title={label ?? row.name}>
      <TooltipLine
        label="Dispatchers"
        value={row.dispatchers.toLocaleString()}
      />
      <TooltipLine label="Carriers" value={row.carriers.toLocaleString()} />
      <TooltipLine
        label="Delivered Loads"
        value={row.deliveredLoads.toLocaleString()}
      />
      <TooltipLine
        label="Revenue"
        value={formatCurrency(row.revenue, {
          currency: "USD",
          maximumFractionDigits: 0,
        })}
      />
    </ChartTooltipShell>
  );
}

function DispatcherComparisonChart({ rows }: { rows: TeamAnalyticsRow[] }) {
  if (rows.length === 0) {
    return <EmptyChart label="No team dispatcher data for these filters." />;
  }

  return (
    <div className="h-[290px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={rows}
          margin={{ top: 18, right: 8, left: 0, bottom: 4 }}
        >
          <CartesianGrid stroke="#E2E8F0" vertical={false} />
          <XAxis
            dataKey="name"
            tick={{ fill: "#64748B", fontSize: 12 }}
            tickLine={false}
            axisLine={false}
            interval={0}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fill: "#64748B", fontSize: 12 }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            content={<DispatcherComparisonTooltip />}
            cursor={{ fill: "#F1F5F9" }}
          />
          <Bar
            dataKey="dispatchers"
            fill={METRIC_COLORS.dispatchers}
            radius={[8, 8, 0, 0]}
            barSize={34}
          >
            <LabelList
              dataKey="dispatchers"
              position="top"
              fill="#0F172A"
              fontSize={12}
              fontWeight={700}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function TeamShareDonut({
  rows,
  total,
}: {
  rows: TeamAnalyticsRow[];
  total: number;
}) {
  if (rows.length === 0 || total === 0) {
    return <EmptyChart label="No carrier share data for these filters." />;
  }

  return (
    <div className="grid min-h-[290px] grid-cols-1 items-center gap-4 xl:grid-cols-[minmax(0,1fr)_230px]">
      <div className="relative h-[260px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={rows}
              dataKey="carriers"
              nameKey="name"
              innerRadius={70}
              outerRadius={108}
              paddingAngle={2}
            >
              {rows.map((row) => (
                <Cell key={row.id} fill={row.color} />
              ))}
            </Pie>
            <Tooltip content={<TeamShareTooltip total={total} />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold text-[#0F172A]">
            {total.toLocaleString()}
          </span>
          <span className="text-xs font-medium text-[#64748B]">
            Total Carriers
          </span>
        </div>
      </div>
      <div className="space-y-3">
        {rows.map((row) => {
          const percent = total > 0 ? (row.carriers / total) * 100 : 0;
          return (
            <div
              key={row.id}
              className="flex items-center justify-between gap-3 text-xs"
            >
              <div className="flex min-w-0 items-center gap-2">
                <span
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: row.color }}
                />
                <span className="truncate font-medium text-[#334155]">
                  {row.name}
                </span>
              </div>
              <span className="shrink-0 font-semibold text-[#0F172A]">
                {row.carriers} ({percent.toFixed(1)}%)
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TeamPerformanceChart({ rows }: { rows: TeamAnalyticsRow[] }) {
  if (rows.length === 0) {
    return <EmptyChart label="No team performance data for these filters." />;
  }

  return (
    <div className="h-[330px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={rows}
          margin={{ top: 8, right: 12, left: 0, bottom: 10 }}
        >
          <CartesianGrid stroke="#E2E8F0" vertical={false} />
          <XAxis
            dataKey="name"
            tick={{ fill: "#64748B", fontSize: 12 }}
            tickLine={false}
            axisLine={false}
            interval={0}
          />
          <YAxis
            tick={{ fill: "#64748B", fontSize: 12 }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip content={<TeamPerformanceTooltip />} />
          <Legend
            verticalAlign="top"
            align="center"
            iconType="square"
            wrapperStyle={{ paddingBottom: 16, color: "#475569", fontSize: 12 }}
          />
          <Bar
            name="Dispatchers"
            dataKey="dispatchers"
            fill={METRIC_COLORS.dispatchers}
            radius={[6, 6, 0, 0]}
            barSize={18}
          />
          <Bar
            name="Carriers"
            dataKey="carriers"
            fill={METRIC_COLORS.carriers}
            radius={[6, 6, 0, 0]}
            barSize={18}
          />
          <Bar
            name="Delivered Loads"
            dataKey="deliveredLoads"
            fill={METRIC_COLORS.deliveredLoads}
            radius={[6, 6, 0, 0]}
            barSize={18}
          />
          <Bar
            name="Revenue (USD)"
            dataKey="revenueK"
            fill={METRIC_COLORS.revenue}
            radius={[6, 6, 0, 0]}
            barSize={18}
          >
            <LabelList
              dataKey="revenue"
              position="top"
              formatter={formatRevenueLabel}
              fill="#0F172A"
              fontSize={12}
              fontWeight={700}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function TeamDirectory({
  rows,
  onViewTeam,
}: {
  rows: TeamAnalyticsRow[];
  onViewTeam: (teamId: string) => void;
}) {
  return (
    <section className="rounded-2xl border border-[#E2E8F0] bg-white p-4 shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
      <h2 className="mb-4 text-base font-semibold text-[#0F172A]">
        Team Directory
      </h2>
      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#CBD5E1] bg-[#F8FAFC] py-10 text-center text-sm text-[#64748B]">
          No team cards match these filters.
        </div>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,280px),1fr))] gap-4">
          {rows.map((row) => (
            <article
              key={row.id}
              className="rounded-2xl border border-[#E2E8F0] bg-white p-4 shadow-[0_8px_20px_rgba(15,23,42,0.04)]"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                  <div
                    className="flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
                    style={{ backgroundColor: row.color }}
                  >
                    {row.initials}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-[#0F172A]">
                      {row.name}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-[#64748B]">
                      {row.teamLeadName}
                    </p>
                  </div>
                </div>
                <StatusPill status={row.status} />
              </div>
              <div className="mt-4 grid grid-cols-3 divide-x divide-[#E2E8F0] text-center">
                <DirectoryStat
                  label="Dispatchers"
                  value={row.dispatchers.toLocaleString()}
                />
                <DirectoryStat
                  label="Carriers"
                  value={row.carriers.toLocaleString()}
                />
                <DirectoryStat label="Score" value={row.score.toFixed(1)} />
              </div>
              <div className="mt-4 flex items-center justify-between gap-3">
                <AvatarStack names={row.memberNames} color={row.color} />
                <button
                  type="button"
                  className="shrink-0 text-xs font-semibold text-[#2563EB] hover:underline"
                  onClick={() => onViewTeam(row.id)}
                >
                  View Team -&gt;
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function DirectoryStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-2">
      <p className="text-sm font-bold text-[#0F172A]">{value}</p>
      <p className="mt-1 text-[11px] font-medium text-[#64748B]">{label}</p>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  return (
    <span
      className={
        status === TEAM_STATUS_ACTIVE
          ? "rounded-full bg-[#DCFCE7] px-2.5 py-1 text-[10px] font-bold text-[#166534]"
          : "rounded-full bg-[#F1F5F9] px-2.5 py-1 text-[10px] font-bold text-[#475569]"
      }
    >
      {status}
    </span>
  );
}

function AvatarStack({ names, color }: { names: string[]; color: string }) {
  const visibleNames = names.slice(0, 4);
  const remaining = Math.max(0, names.length - visibleNames.length);

  if (names.length === 0) {
    return <span className="text-xs text-[#94A3B8]">No members</span>;
  }

  return (
    <div className="flex items-center">
      {visibleNames.map((name, index) => (
        <span
          key={`${name}-${index}`}
          className="-ml-1 flex size-7 items-center justify-center rounded-full border-2 border-white text-[10px] font-bold text-white shadow-sm first:ml-0"
          style={{ backgroundColor: index % 2 === 0 ? color : "#0F172A" }}
          title={name}
        >
          {getInitials(name)}
        </span>
      ))}
      {remaining > 0 ? (
        <span className="-ml-1 flex size-7 items-center justify-center rounded-full border-2 border-white bg-[#F1F5F9] text-[10px] font-bold text-[#334155] shadow-sm">
          +{remaining}
        </span>
      ) : null}
    </div>
  );
}
