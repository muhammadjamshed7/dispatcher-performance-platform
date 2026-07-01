"use client";

import type { ReactNode } from "react";
import { Suspense, useCallback, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  BadgeDollarSign,
  CircleDollarSign,
  Filter,
  Info,
  MoreHorizontal,
  Plus,
  Route,
  Trophy,
} from "lucide-react";

import { PageContentGate } from "@/components/feedback/page-content-gate";
import type { PageContentState } from "@/components/feedback/page-content-gate";
import { AppToast } from "@/components/feedback/app-toast";
import { CarrierFilter } from "@/components/filters/carrier-filter";
import { DateRangeFilter } from "@/components/filters/date-range-filter";
import { DispatcherFilter } from "@/components/filters/dispatcher-filter";
import { TeamFilter } from "@/components/filters/team-filter";
import { TeamStatusFilter } from "@/components/filters/team-status-filter";
import { TruckTypeFilter } from "@/components/filters/truck-type-filter";
import { RoleScopeBanner } from "@/components/layout/role-scope-banner";
import {
  CarrierModal,
  type CarrierModalMode,
} from "@/components/modals/carrier-modal";
import {
  CarriersTable,
  type CarrierRowAction,
} from "@/components/tables/carriers-table";
import { PageShell } from "@/components/layout/page-shell";
import { Button } from "@/components/ui/button";
import { useApiData } from "@/hooks/use-api-data";
import { useRealtimeRefresh } from "@/hooks/use-realtime-refresh";
import { useRoleScope } from "@/hooks/use-role-scope";
import { ApiClientError } from "@/lib/api/client";
import {  entityFiltersToCarrierParams,
  DEFAULT_ENTITY_FILTERS,
  parseEntityFiltersFromSearchParams,
  type EntityFilterValues,
} from "@/lib/filters/entity-filter-params";
import {
  createCarrierRequest,
  fetchActivities,
  fetchCarriers,
  recordAuditExportEvent,
  reassignCarrierRequest,
  updateCarrierRequest,
} from "@/lib/api/resources";
import { exportCarrierActivityPdf } from "@/lib/reports/export-carrier-activity-pdf";
import { useEntityOptions } from "@/hooks/use-entity-options";
import {
  TEAM_STATUS_ACTIVE,
  TEAM_STATUS_INACTIVE,
} from "@/lib/constants/team-statuses";
import { ADMIN, DISPATCHER } from "@/lib/constants/roles";
import {
  CANCELLED,
  DELIVERED,
  NOT_BOOKED,
  NOT_WORKING,
} from "@/lib/constants/statuses";
import { APPROVED } from "@/lib/constants/activity-approval";
import { FILTER_ALL } from "@/lib/constants/filters";
import type { Carrier, DailyActivity } from "@/lib/types";
import {
  formatCurrency,
  formatCurrencyCompact,
} from "@/lib/utils/format-currency";
import {
  formatDateRangeLabel,
  resolveDateRangePreset,
} from "@/lib/utils/resolve-date-range-preset";
import type {
  CarrierFormValues,
  CarrierReassignValues,
} from "@/lib/validation/carrier-form";

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof ApiClientError ? error.message : fallback;
}

const STATUS_META = {
  DELIVERED: { label: "Delivered", color: "#22C55E" },
  IN_TRANSIT: { label: "In Transit", color: "#2563EB" },
  NOT_BOOKED: { label: "Not Booked", color: "#F59E0B" },
  CANCELLED: { label: "Cancelled", color: "#EF4444" },
  NOT_WORKING: { label: "Not Working", color: "#94A3B8" },
} as const;

const CARRIER_BAR_COLORS = [
  "#2563EB",
  "#22C55E",
  "#F97316",
  "#8B5CF6",
  "#06B6D4",
  "#EAB308",
  "#EC4899",
  "#38BDF8",
];

const DISPATCHER_COLORS = [
  "#2563EB",
  "#22C55E",
  "#F97316",
  "#8B5CF6",
  "#06B6D4",
  "#EAB308",
  "#EC4899",
  "#64748B",
];

type StatusKey = keyof typeof STATUS_META;

type CarrierRevenueRow = {
  id: string;
  name: string;
  revenue: number;
  miles: number;
  loads: number;
  dispatchFee: number;
  dispatcher: string;
  fill: string;
};

type StatusBreakdownRow = {
  status: StatusKey;
  name: string;
  value: number;
  percent: number;
  fill: string;
};

type DispatcherRevenueRow = {
  id: string;
  name: string;
  revenue: number;
  loads: number;
  percent: number;
  fill: string;
};

type CarrierPerformanceRow = {
  id: string;
  name: string;
  delivered: number;
  inTransit: number;
  notBooked: number;
  cancelled: number;
  notWorking: number;
  total: number;
  revenue: number;
};

type SalesAnalytics = {
  totalRevenue: number;
  totalMiles: number;
  totalDispatchFee: number;
  totalLoads: number;
  topCarrierName: string;
  topCarrierRevenue: number;
  revenueGrowth: number | null;
  milesGrowth: number | null;
  dispatchFeeGrowth: number | null;
  topCarriers: CarrierRevenueRow[];
  statusBreakdown: StatusBreakdownRow[];
  dispatcherRevenue: DispatcherRevenueRow[];
  carrierPerformance: CarrierPerformanceRow[];
};

type CarriersPageContentProps = {
  showScopeBanner?: boolean;
  compact?: boolean;
};

function appendFilter(
  params: Record<string, string>,
  key: string,
  value: string,
): void {
  if (value !== FILTER_ALL) {
    params[key] = value;
  }
}

function getPreviousDateRange(dateRange: string) {
  const { dateFrom, dateTo } = resolveDateRangePreset(dateRange);
  const from = new Date(`${dateFrom}T00:00:00Z`);
  const to = new Date(`${dateTo}T00:00:00Z`);
  const dayMs = 24 * 60 * 60 * 1000;
  const spanDays = Math.max(
    1,
    Math.round((to.getTime() - from.getTime()) / dayMs) + 1,
  );
  const previousTo = new Date(from.getTime() - dayMs);
  const previousFrom = new Date(previousTo.getTime() - (spanDays - 1) * dayMs);

  return {
    dateFrom: previousFrom.toISOString().slice(0, 10),
    dateTo: previousTo.toISOString().slice(0, 10),
  };
}

function salesActivityParams(
  filters: EntityFilterValues,
  dateRangeOverride?: { dateFrom: string; dateTo: string },
): Record<string, string> {
  const range = dateRangeOverride ?? resolveDateRangePreset(filters.dateRange);
  const params: Record<string, string> = {
    dateFrom: range.dateFrom,
    dateTo: range.dateTo,
    approvalStatus: APPROVED,
  };

  appendFilter(params, "teamId", filters.teamId);
  appendFilter(params, "dispatcherId", filters.dispatcherId);
  appendFilter(params, "carrierId", filters.carrierId);
  appendFilter(params, "truckType", filters.truckType);

  if (filters.q?.trim()) {
    params.q = filters.q.trim();
  }

  return params;
}

function calculateGrowth(current: number, previous: number): number | null {
  if (previous === 0) {
    return current === 0 ? null : 100;
  }

  return Math.round(((current - previous) / previous) * 1000) / 10;
}

function formatGrowth(growth: number | null): string {
  if (growth === null) {
    return "No previous period data";
  }

  const sign = growth >= 0 ? "+" : "-";
  return `${sign}${Math.abs(growth).toFixed(1)}% vs previous period`;
}

function sumDeliveredRevenue(activities: DailyActivity[]): number {
  return activities.reduce(
    (total, activity) =>
      total + (activity.status === DELIVERED ? (activity.loadAmount ?? 0) : 0),
    0,
  );
}

function sumMiles(activities: DailyActivity[]): number {
  return activities.reduce(
    (total, activity) => total + (activity.miles ?? 0),
    0,
  );
}

function sumDispatchFee(activities: DailyActivity[]): number {
  return activities.reduce(
    (total, activity) => total + (activity.dispatchFee ?? 0),
    0,
  );
}

function buildSalesAnalytics(
  carriers: Carrier[],
  activities: DailyActivity[],
  previousActivities: DailyActivity[],
): SalesAnalytics {
  const carrierLookup = new Map(
    carriers.map((carrier) => [carrier.id, carrier]),
  );
  const totalRevenue = sumDeliveredRevenue(activities);
  const totalMiles = sumMiles(activities);
  const totalDispatchFee = sumDispatchFee(activities);
  const statusCounts = new Map<StatusKey, number>([
    ["DELIVERED", 0],
    ["IN_TRANSIT", 0],
    ["NOT_BOOKED", 0],
    ["CANCELLED", 0],
    ["NOT_WORKING", 0],
  ]);
  const carrierRows = new Map<string, CarrierRevenueRow>();
  const dispatcherRows = new Map<string, DispatcherRevenueRow>();
  const performanceRows = new Map<string, CarrierPerformanceRow>();

  for (const activity of activities) {
    const carrier = carrierLookup.get(activity.carrierId);
    if (!carrier) {
      continue;
    }

    const revenue =
      activity.status === DELIVERED ? (activity.loadAmount ?? 0) : 0;
    const miles = activity.miles ?? 0;
    const dispatchFee = activity.dispatchFee ?? 0;
    const status = activity.status as StatusKey;

    statusCounts.set(status, (statusCounts.get(status) ?? 0) + 1);

    const carrierRow =
      carrierRows.get(activity.carrierId) ??
      ({
        id: activity.carrierId,
        name: activity.carrierName,
        revenue: 0,
        miles: 0,
        loads: 0,
        dispatchFee: 0,
        dispatcher: activity.dispatcherName,
        fill: CARRIER_BAR_COLORS[carrierRows.size % CARRIER_BAR_COLORS.length],
      } satisfies CarrierRevenueRow);
    carrierRow.revenue += revenue;
    carrierRow.miles += miles;
    carrierRow.loads += 1;
    carrierRow.dispatchFee += dispatchFee;
    carrierRows.set(activity.carrierId, carrierRow);

    const dispatcherRow =
      dispatcherRows.get(activity.dispatcherId) ??
      ({
        id: activity.dispatcherId,
        name: activity.dispatcherName,
        revenue: 0,
        loads: 0,
        percent: 0,
        fill: DISPATCHER_COLORS[dispatcherRows.size % DISPATCHER_COLORS.length],
      } satisfies DispatcherRevenueRow);
    dispatcherRow.revenue += revenue;
    dispatcherRow.loads += 1;
    dispatcherRows.set(activity.dispatcherId, dispatcherRow);

    const performanceRow =
      performanceRows.get(activity.carrierId) ??
      ({
        id: activity.carrierId,
        name: activity.carrierName,
        delivered: 0,
        inTransit: 0,
        notBooked: 0,
        cancelled: 0,
        notWorking: 0,
        total: 0,
        revenue: 0,
      } satisfies CarrierPerformanceRow);

    if (activity.status === DELIVERED) performanceRow.delivered += 1;
    if (activity.status === NOT_BOOKED) performanceRow.notBooked += 1;
    if (activity.status === CANCELLED) performanceRow.cancelled += 1;
    if (activity.status === NOT_WORKING) performanceRow.notWorking += 1;
    performanceRow.total += 1;
    performanceRow.revenue += revenue;
    performanceRows.set(activity.carrierId, performanceRow);
  }

  const topCarriers = [...carrierRows.values()]
    .sort((left, right) => right.revenue - left.revenue)
    .slice(0, 8);
  const topCarrier = topCarriers[0];
  const statusTotal = [...statusCounts.values()].reduce(
    (total, count) => total + count,
    0,
  );
  const statusBreakdown = (
    [...statusCounts.entries()] as Array<[StatusKey, number]>
  ).map(([status, value]) => ({
    status,
    name: STATUS_META[status].label,
    value,
    percent:
      statusTotal > 0 ? Math.round((value / statusTotal) * 1000) / 10 : 0,
    fill: STATUS_META[status].color,
  }));
  const dispatcherRevenue = [...dispatcherRows.values()]
    .map((row) => ({
      ...row,
      percent:
        totalRevenue > 0
          ? Math.round((row.revenue / totalRevenue) * 1000) / 10
          : 0,
    }))
    .sort((left, right) => right.revenue - left.revenue);

  return {
    totalRevenue,
    totalMiles,
    totalDispatchFee,
    totalLoads: activities.length,
    topCarrierName: topCarrier?.name ?? "No carrier",
    topCarrierRevenue: topCarrier?.revenue ?? 0,
    revenueGrowth: calculateGrowth(
      totalRevenue,
      sumDeliveredRevenue(previousActivities),
    ),
    milesGrowth: calculateGrowth(totalMiles, sumMiles(previousActivities)),
    dispatchFeeGrowth: calculateGrowth(
      totalDispatchFee,
      sumDispatchFee(previousActivities),
    ),
    topCarriers,
    statusBreakdown,
    dispatcherRevenue,
    carrierPerformance: [...performanceRows.values()]
      .sort((left, right) => right.total - left.total)
      .slice(0, 10),
  };
}

function CarriersPageContentInner({
  showScopeBanner = true,
  compact = false,
}: CarriersPageContentProps) {
  const searchParams = useSearchParams();
  const searchParamKey = searchParams.toString();
  const urlEntityFilters = useMemo(
    () =>
      parseEntityFiltersFromSearchParams(new URLSearchParams(searchParamKey)),
    [searchParamKey],
  );

  return (
    <CarriersPageState
      key={searchParamKey}
      initialEntityFilters={urlEntityFilters}
      showScopeBanner={showScopeBanner && !compact}
    />
  );
}

function CarriersPageState({
  initialEntityFilters,
  showScopeBanner,
}: {
  initialEntityFilters: EntityFilterValues;
  showScopeBanner: boolean;
}) {
  const { role } = useRoleScope();
  const canManageCarriers = role !== DISPATCHER;
  const canExportCarrier = role === ADMIN;
  const [draftFilters, setDraftFilters] =
    useState<EntityFilterValues>(initialEntityFilters);
  const [appliedFilters, setAppliedFilters] =
    useState<EntityFilterValues>(initialEntityFilters);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<CarrierModalMode>("create");
  const [selectedCarrier, setSelectedCarrier] = useState<Carrier | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const loadCarriers = useCallback(() => {
    return fetchCarriers(entityFiltersToCarrierParams(appliedFilters));
  }, [appliedFilters]);

  const loadActivities = useCallback(() => {
    return fetchActivities(salesActivityParams(appliedFilters));
  }, [appliedFilters]);

  const loadPreviousActivities = useCallback(() => {
    return fetchActivities(
      salesActivityParams(
        appliedFilters,
        getPreviousDateRange(appliedFilters.dateRange),
      ),
    );
  }, [appliedFilters]);

  const {
    data: carriers = [],
    error,
    isLoading,
    isEmpty,
    reload,
  } = useApiData(loadCarriers, [appliedFilters]);
  const {
    data: activities = [],
    error: activitiesError,
    isLoading: activitiesLoading,
    reload: reloadActivities,
  } = useApiData(loadActivities, [appliedFilters]);
  const { data: previousActivities = [], reload: reloadPreviousActivities } =
    useApiData(loadPreviousActivities, [appliedFilters]);
  const {
    teams,
    dispatchers,
    reload: reloadEntityOptions,
  } = useEntityOptions({
    teams: true,
    dispatchers: true,
    carriers: false,
  });

  const refreshCarriers = useCallback(async () => {
    await Promise.all([
      reload(),
      reloadActivities(),
      reloadPreviousActivities(),
      reloadEntityOptions(),
    ]);
  }, [reload, reloadActivities, reloadEntityOptions, reloadPreviousActivities]);

  const carrierRealtimeTables = useMemo(() => ["Carrier"] as const, []);

  useRealtimeRefresh(carrierRealtimeTables, refreshCarriers);

  const visibleCarriers = carriers;

  const filteredCarrierIds = useMemo(
    () => new Set(visibleCarriers.map((carrier) => carrier.id)),
    [visibleCarriers],
  );
  const filteredActivities = useMemo(
    () =>
      activities.filter((activity) =>
        filteredCarrierIds.has(activity.carrierId),
      ),
    [activities, filteredCarrierIds],
  );
  const filteredPreviousActivities = useMemo(
    () =>
      previousActivities.filter((activity) =>
        filteredCarrierIds.has(activity.carrierId),
      ),
    [filteredCarrierIds, previousActivities],
  );
  const analytics = useMemo(
    () =>
      buildSalesAnalytics(
        visibleCarriers,
        filteredActivities,
        filteredPreviousActivities,
      ),
    [filteredActivities, filteredPreviousActivities, visibleCarriers],
  );
  const activeRange = useMemo(
    () => resolveDateRangePreset(appliedFilters.dateRange),
    [appliedFilters.dateRange],
  );
  const periodLabel = formatDateRangeLabel(
    activeRange.dateFrom,
    activeRange.dateTo,
  );

  const pageState: PageContentState =
    isLoading || activitiesLoading
      ? "loading"
      : error || activitiesError
        ? "error"
        : isEmpty || visibleCarriers.length === 0
          ? "empty"
          : "ready";

  const showToast = useCallback((message: string) => {
    setToastMessage(message);
  }, []);

  function resolveTeamAndDispatcher(values: {
    assignedTeam: string;
    assignedDispatcher: string;
  }) {
    const teamId = teams.find((team) => team.name === values.assignedTeam)?.id;
    const dispatcherId = dispatchers.find(
      (dispatcher) => dispatcher.fullName === values.assignedDispatcher,
    )?.id;

    return { teamId, dispatcherId };
  }

  function openModal(mode: CarrierModalMode, carrier: Carrier | null = null) {
    setSelectedCarrier(carrier);
    setModalMode(mode);
    setModalOpen(true);
  }

  async function handleExportCarrier(carrier: Carrier) {
    try {
      showToast(`Generating report for "${carrier.carrierName}"...`);
      const activities = await fetchActivities({ carrierId: carrier.id });
      await exportCarrierActivityPdf({ carrier, activities });
      await recordAuditExportEvent({
        action: "CARRIER_EXPORTED",
        entityType: "Carrier",
        entityId: carrier.id,
        entityName: carrier.carrierName,
        format: "pdf",
        rowCount: activities.length,
        filters: {
          carrierId: carrier.id,
        },
        metadata: {
          carrierName: carrier.carrierName,
          mcNumber: carrier.mcNumber,
        },
      }).catch((auditError) => {
        console.error("Failed to record carrier PDF export audit event", {
          auditError,
        });
      });
      showToast(`Report for "${carrier.carrierName}" downloaded.`);
    } catch (err) {
      showToast(getErrorMessage(err, "Failed to export carrier report."));
    }
  }

  function handleRowAction(carrier: Carrier, action: CarrierRowAction) {
    if (action === "toggle-status") {
      openModal(
        carrier.status === TEAM_STATUS_ACTIVE ? "deactivate" : "activate",
        carrier,
      );
      return;
    }

    if (action === "export") {
      void handleExportCarrier(carrier);
      return;
    }

    openModal(action, carrier);
  }

  async function handleCreate(values: CarrierFormValues) {
    const { teamId, dispatcherId } = resolveTeamAndDispatcher(values);
    if (!teamId || !dispatcherId) {
      showToast("Selected team or dispatcher not found.");
      throw new Error("Selected team or dispatcher not found.");
    }

    try {
      await createCarrierRequest({
        carrierName: values.carrierName,
        driverName: values.driverName,
        mcNumber: values.mcNumber,
        dispatchFeePercentage: values.dispatchFeePercentage,
        truckType: values.truckType,
        teamId,
        dispatcherId,
        status: values.status,
        notes: values.notes,
      });
      showToast(`Carrier "${values.carrierName}" created successfully.`);
      await reload();
    } catch (err) {
      showToast(getErrorMessage(err, "Failed to create carrier."));
      throw err;
    }
  }

  async function handleEdit(values: CarrierFormValues) {
    if (!selectedCarrier) {
      return;
    }

    try {
      await updateCarrierRequest(selectedCarrier.id, {
        carrierName: values.carrierName,
        driverName: values.driverName,
        mcNumber: values.mcNumber,
        dispatchFeePercentage: values.dispatchFeePercentage,
        truckType: values.truckType,
        status: values.status,
        notes: values.notes,
      });
      showToast(`Carrier "${values.carrierName}" updated successfully.`);
      await reload();
    } catch (err) {
      showToast(getErrorMessage(err, "Failed to update carrier."));
      throw err;
    }
  }

  async function handleReassign(values: CarrierReassignValues) {
    if (!selectedCarrier) {
      return;
    }

    const { teamId, dispatcherId } = resolveTeamAndDispatcher(values);
    if (!teamId || !dispatcherId) {
      showToast("Selected team or dispatcher not found.");
      return;
    }

    try {
      await reassignCarrierRequest(selectedCarrier.id, {
        teamId,
        dispatcherId,
      });
      showToast(
        `Carrier "${selectedCarrier.carrierName}" reassigned to ${values.assignedDispatcher}.`,
      );
      await reload();
    } catch (err) {
      showToast(getErrorMessage(err, "Failed to reassign carrier."));
    }
  }

  async function handleToggleStatus(carrier: Carrier) {
    const nextStatus =
      carrier.status === TEAM_STATUS_ACTIVE
        ? TEAM_STATUS_INACTIVE
        : TEAM_STATUS_ACTIVE;

    try {
      await updateCarrierRequest(carrier.id, { status: nextStatus });
      showToast(
        `Carrier "${carrier.carrierName}" ${
          nextStatus === TEAM_STATUS_ACTIVE ? "activated" : "deactivated"
        }.`,
      );
      await reload();
    } catch (err) {
      showToast(getErrorMessage(err, "Failed to update carrier status."));
    }
  }

  return (
    <>
      <PageShell
        title="Sales"
        description="Overview of performance, revenue and carrier activity."
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
            {canManageCarriers ? (
              <Button
                type="button"
                className="h-9 rounded-lg bg-[#1D4ED8] px-4 font-semibold text-white shadow-sm hover:bg-[#1E40AF]"
                onClick={() => openModal("create")}
              >
                <Plus className="size-4" />
                Create Carrier
              </Button>
            ) : null}
          </div>
        }
      >
        <div className="-m-4 space-y-6 bg-[#F6F8FB] p-4 md:-m-6 md:p-6 lg:-m-8 lg:p-8">
          {showScopeBanner ? <RoleScopeBanner /> : null}

          {filtersOpen ? (
            <SalesFilterPanel
              values={draftFilters}
              onChange={setDraftFilters}
              onApply={() => {
                setAppliedFilters(draftFilters);
                setFiltersOpen(false);
              }}
              onReset={() => {
                setDraftFilters(DEFAULT_ENTITY_FILTERS);
                setAppliedFilters(DEFAULT_ENTITY_FILTERS);
              }}
            />
          ) : null}

          <PageContentGate
            state={pageState}
            onRetry={refreshCarriers}
            loadingTitle="Loading sales dashboard"
            emptyTitle="No sales records found"
            emptyDescription="Create a carrier profile to manage assignments, activity and dispatch fees."
            emptyActionLabel={canManageCarriers ? "Create Carrier" : undefined}
            onEmptyAction={
              canManageCarriers ? () => openModal("create") : undefined
            }
            errorTitle="Unable to load sales dashboard"
            errorDescription={
              error ??
              activitiesError ??
              "Sales records could not be loaded. Try again in a moment."
            }
          >
            <SalesKpiGrid analytics={analytics} />
            <SalesChartGrid analytics={analytics} periodLabel={periodLabel} />
            <CarriersTable
              carriers={visibleCarriers}
              readOnly={!canManageCarriers}
              canExport={canExportCarrier}
              onAction={handleRowAction}
            />
          </PageContentGate>
        </div>
      </PageShell>

      <CarrierModal
        open={modalOpen}
        mode={modalMode}
        carrier={selectedCarrier}
        onOpenChange={setModalOpen}
        onCreate={handleCreate}
        onEdit={handleEdit}
        onReassign={handleReassign}
        onToggleStatus={handleToggleStatus}
      />

      <AppToast
        message={toastMessage}
        onDismiss={() => setToastMessage(null)}
      />
    </>
  );
}

function SalesFilterPanel({
  values,
  onChange,
  onApply,
  onReset,
}: {
  values: EntityFilterValues;
  onChange: (values: EntityFilterValues) => void;
  onApply: () => void;
  onReset: () => void;
}) {
  function updateField<K extends keyof EntityFilterValues>(
    field: K,
    value: EntityFilterValues[K],
  ) {
    onChange({
      ...values,
      activityId: undefined,
      q: undefined,
      [field]: value,
    });
  }

  return (
    <section className="rounded-2xl border border-[#E2E8F0] bg-white p-4 shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-[#0F172A]">Filters</h2>
          <p className="mt-1 text-xs text-[#64748B]">
            Refine Sales metrics, charts and table results.
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
        <TeamStatusFilter
          value={values.status}
          onValueChange={(value) => {
            if (value) updateField("status", value);
          }}
        />
        <TruckTypeFilter
          value={values.truckType}
          onValueChange={(value) => {
            if (value) updateField("truckType", value);
          }}
        />
      </div>
    </section>
  );
}

function SalesKpiGrid({ analytics }: { analytics: SalesAnalytics }) {
  return (
    <section className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
      <SalesKpiCard
        title="Total Revenue"
        value={formatCurrencyCompact(analytics.totalRevenue, "$0")}
        helper={formatGrowth(analytics.revenueGrowth)}
        accent="#16A34A"
        iconBackground="#DCFCE7"
        icon={CircleDollarSign}
      />
      <SalesKpiCard
        title="Total Miles"
        value={Math.round(analytics.totalMiles).toLocaleString()}
        helper={formatGrowth(analytics.milesGrowth)}
        accent="#2563EB"
        iconBackground="#DBEAFE"
        icon={Route}
      />
      <SalesKpiCard
        title="Total Dispatch Fee"
        value={formatCurrencyCompact(analytics.totalDispatchFee, "$0")}
        helper={formatGrowth(analytics.dispatchFeeGrowth)}
        accent="#F97316"
        iconBackground="#FFEDD5"
        icon={BadgeDollarSign}
      />
      <SalesKpiCard
        title="Top Carrier"
        value={analytics.topCarrierName}
        helper={`${formatCurrencyCompact(analytics.topCarrierRevenue, "$0")} revenue`}
        accent="#8B5CF6"
        iconBackground="#F3E8FF"
        icon={Trophy}
      />
    </section>
  );
}

function SalesKpiCard({
  title,
  value,
  helper,
  accent,
  iconBackground,
  icon: Icon,
}: {
  title: string;
  value: string;
  helper: string;
  accent: string;
  iconBackground: string;
  icon: typeof CircleDollarSign;
}) {
  return (
    <article className="group rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.05)] transition hover:-translate-y-0.5 hover:shadow-[0_16px_36px_rgba(15,23,42,0.08)]">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <div
            className="flex size-11 shrink-0 items-center justify-center rounded-full"
            style={{ backgroundColor: iconBackground, color: accent }}
          >
            <Icon className="size-5" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-[#64748B]">{title}</p>
            <p className="mt-2 truncate text-2xl font-semibold tracking-tight text-[#0F172A]">
              {value}
            </p>
          </div>
        </div>
        <Info className="size-4 shrink-0 text-[#94A3B8]" />
      </div>
      <p className="mt-4 text-xs font-medium text-[#16A34A]">{helper}</p>
    </article>
  );
}

function SalesChartGrid({
  analytics,
  periodLabel,
}: {
  analytics: SalesAnalytics;
  periodLabel: string;
}) {
  return (
    <section className="space-y-4">
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,360px),1fr))] gap-4 2xl:grid-cols-[minmax(0,1.4fr)_minmax(340px,0.9fr)_minmax(340px,0.9fr)]">
        <ChartCard title="Top Carriers by Revenue" periodLabel={periodLabel}>
          <TopCarriersBarChart rows={analytics.topCarriers} />
        </ChartCard>
        <ChartCard title="Load Status Breakdown" periodLabel={periodLabel}>
          <LoadStatusDonut
            rows={analytics.statusBreakdown}
            total={analytics.totalLoads}
          />
        </ChartCard>
        <ChartCard
          title="Revenue Share by Dispatcher"
          periodLabel={periodLabel}
        >
          <DispatcherRevenuePie rows={analytics.dispatcherRevenue} />
        </ChartCard>
      </div>
      <ChartCard title="Carrier Performance" periodLabel={periodLabel}>
        <CarrierPerformanceChart rows={analytics.carrierPerformance} />
      </ChartCard>
    </section>
  );
}

function ChartCard({
  title,
  periodLabel,
  children,
}: {
  title: string;
  periodLabel: string;
  children: ReactNode;
}) {
  return (
    <article className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-[#0F172A]">{title}</h2>
        <div className="flex items-center gap-2">
          <span className="rounded-full border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-1 text-xs font-medium text-[#475569]">
            {periodLabel}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={`${title} options`}
          >
            <MoreHorizontal className="size-4" />
          </Button>
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

function TopCarriersTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: TooltipPayload<CarrierRevenueRow>;
}) {
  const row = payload?.[0]?.payload;
  if (!active || !row) return null;

  return (
    <ChartTooltipShell title={row.name}>
      <TooltipLine label="Revenue" value={formatCurrency(row.revenue)} />
      <TooltipLine
        label="Miles"
        value={Math.round(row.miles).toLocaleString()}
      />
      <TooltipLine label="Loads" value={row.loads.toLocaleString()} />
      <TooltipLine
        label="Dispatch Fee"
        value={formatCurrency(row.dispatchFee)}
      />
      <TooltipLine label="Dispatcher" value={row.dispatcher || "Unassigned"} />
    </ChartTooltipShell>
  );
}

function DispatcherTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: TooltipPayload<DispatcherRevenueRow>;
}) {
  const row = payload?.[0]?.payload;
  if (!active || !row) return null;

  return (
    <ChartTooltipShell title={row.name}>
      <TooltipLine label="Revenue" value={formatCurrency(row.revenue)} />
      <TooltipLine label="Share" value={`${row.percent.toFixed(1)}%`} />
      <TooltipLine label="Loads" value={row.loads.toLocaleString()} />
    </ChartTooltipShell>
  );
}

function CarrierPerformanceTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: TooltipPayload<CarrierPerformanceRow>;
  label?: string;
}) {
  const row = payload?.[0]?.payload;
  if (!active || !row) return null;

  return (
    <ChartTooltipShell title={label ?? row.name}>
      <TooltipLine label="Delivered" value={row.delivered.toLocaleString()} />
      <TooltipLine label="Cancelled" value={row.cancelled.toLocaleString()} />
      <TooltipLine label="Not Booked" value={row.notBooked.toLocaleString()} />
      <TooltipLine
        label="Not Working"
        value={row.notWorking.toLocaleString()}
      />
      <TooltipLine label="In Transit" value={row.inTransit.toLocaleString()} />
      <TooltipLine label="Total Loads" value={row.total.toLocaleString()} />
      <TooltipLine label="Revenue" value={formatCurrency(row.revenue)} />
    </ChartTooltipShell>
  );
}

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

function TopCarriersBarChart({ rows }: { rows: CarrierRevenueRow[] }) {
  if (rows.length === 0) {
    return <EmptyChart label="No revenue data for this period." />;
  }

  return (
    <div className="h-[320px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={rows}
          margin={{ top: 18, right: 8, left: 0, bottom: 8 }}
        >
          <CartesianGrid stroke="#E2E8F0" vertical={false} />
          <XAxis
            dataKey="name"
            tick={{ fill: "#64748B", fontSize: 12 }}
            tickLine={false}
            axisLine={false}
            interval={0}
            angle={-16}
            textAnchor="end"
            height={60}
          />
          <YAxis
            tick={{ fill: "#64748B", fontSize: 12 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(value) => `$${Number(value) / 1000}k`}
          />
          <Tooltip
            content={<TopCarriersTooltip />}
            cursor={{ fill: "#F1F5F9" }}
          />
          <Bar dataKey="revenue" radius={[8, 8, 0, 0]} barSize={32}>
            {rows.map((row) => (
              <Cell key={row.id} fill={row.fill} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function LoadStatusDonut({
  rows,
  total,
}: {
  rows: StatusBreakdownRow[];
  total: number;
}) {
  if (total === 0) {
    return <EmptyChart label="No load activity for this period." />;
  }

  return (
    <div className="grid min-h-[300px] grid-cols-1 items-center gap-4 2xl:grid-cols-[minmax(0,1fr)_150px]">
      <div className="relative h-[250px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={rows}
              dataKey="value"
              nameKey="name"
              innerRadius={68}
              outerRadius={100}
              paddingAngle={3}
            >
              {rows.map((row) => (
                <Cell key={row.status} fill={row.fill} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value, name) => [
                `${Number(value).toLocaleString()} loads`,
                name,
              ]}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xs text-[#64748B]">Total Loads</span>
          <span className="text-2xl font-semibold text-[#0F172A]">
            {total.toLocaleString()}
          </span>
        </div>
      </div>
      <StatusLegend rows={rows} />
    </div>
  );
}

function StatusLegend({ rows }: { rows: StatusBreakdownRow[] }) {
  return (
    <div className="space-y-3">
      {rows.map((row) => (
        <div
          key={row.status}
          className="flex items-center justify-between gap-3"
        >
          <div className="flex min-w-0 items-center gap-2">
            <span
              className="size-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: row.fill }}
            />
            <span className="truncate text-xs font-medium text-[#475569]">
              {row.name}
            </span>
          </div>
          <span className="text-right text-xs font-semibold text-[#0F172A]">
            {row.value} / {row.percent.toFixed(1)}%
          </span>
        </div>
      ))}
    </div>
  );
}

function DispatcherRevenuePie({ rows }: { rows: DispatcherRevenueRow[] }) {
  if (rows.length === 0) {
    return <EmptyChart label="No dispatcher revenue for this period." />;
  }

  return (
    <div className="grid min-h-[300px] grid-cols-1 items-center gap-4 2xl:grid-cols-[minmax(0,1fr)_150px]">
      <div className="h-[250px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={rows}
              dataKey="revenue"
              nameKey="name"
              innerRadius={0}
              outerRadius={98}
              paddingAngle={2}
            >
              {rows.map((row) => (
                <Cell key={row.id} fill={row.fill} />
              ))}
            </Pie>
            <Tooltip content={<DispatcherTooltip />} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="space-y-3">
        {rows.slice(0, 6).map((row) => (
          <div key={row.id} className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <span
                className="size-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: row.fill }}
              />
              <span className="truncate text-xs font-medium text-[#475569]">
                {row.name}
              </span>
            </div>
            <span className="text-xs font-semibold text-[#0F172A]">
              {row.percent.toFixed(1)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function CarrierPerformanceChart({ rows }: { rows: CarrierPerformanceRow[] }) {
  if (rows.length === 0) {
    return <EmptyChart label="No carrier performance data for this period." />;
  }

  return (
    <div className="h-[360px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={rows}
          margin={{ top: 8, right: 8, left: 0, bottom: 16 }}
        >
          <CartesianGrid stroke="#E2E8F0" vertical={false} />
          <XAxis
            dataKey="name"
            tick={{ fill: "#64748B", fontSize: 12 }}
            tickLine={false}
            axisLine={false}
            interval={0}
            angle={-14}
            textAnchor="end"
            height={60}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fill: "#64748B", fontSize: 12 }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip content={<CarrierPerformanceTooltip />} />
          <Legend
            verticalAlign="top"
            align="left"
            iconType="circle"
            wrapperStyle={{ paddingBottom: 16, color: "#475569", fontSize: 12 }}
          />
          <Bar
            name="Delivered"
            dataKey="delivered"
            stackId="status"
            fill={STATUS_META.DELIVERED.color}
            radius={[0, 0, 0, 0]}
          />
          <Bar
            name="Cancelled"
            dataKey="cancelled"
            stackId="status"
            fill={STATUS_META.CANCELLED.color}
          />
          <Bar
            name="Not Booked"
            dataKey="notBooked"
            stackId="status"
            fill={STATUS_META.NOT_BOOKED.color}
          />
          <Bar
            name="Not Working"
            dataKey="notWorking"
            stackId="status"
            fill={STATUS_META.NOT_WORKING.color}
          />
          <Bar
            name="In Transit"
            dataKey="inTransit"
            stackId="status"
            fill={STATUS_META.IN_TRANSIT.color}
            radius={[8, 8, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function CarriersPageContent({
  showScopeBanner = true,
  compact = false,
}: CarriersPageContentProps = {}) {
  return (
    <Suspense
      fallback={
        <div className="py-10 text-sm text-[#64748B]">Loading carriers...</div>
      }
    >
      <CarriersPageContentInner
        showScopeBanner={showScopeBanner}
        compact={compact}
      />
    </Suspense>
  );
}
