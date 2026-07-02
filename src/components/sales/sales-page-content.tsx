"use client";

import type { ReactNode } from "react";
import { Suspense, useCallback, useMemo, useRef, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  CheckCircle2,
  Clock3,
  DollarSign,
  Download,
  Gauge,
  Hourglass,
  MoreHorizontal,
  PauseCircle,
  Plus,
  Route,
  TrendingUp,
  Trophy,
  XCircle,
} from "lucide-react";

import { AppToast } from "@/components/feedback/app-toast";
import { PageContentGate } from "@/components/feedback/page-content-gate";
import type { PageContentState } from "@/components/feedback/page-content-gate";
import { SharedFilterButton } from "@/components/filters/shared-filter-button";
import { SharedFilterPopover } from "@/components/filters/shared-filter-popover";
import { PageShell } from "@/components/layout/page-shell";
import {
  CarrierModal,
  type CarrierModalMode,
} from "@/components/modals/carrier-modal";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useApiData } from "@/hooks/use-api-data";
import { useEntityOptions } from "@/hooks/use-entity-options";
import { useRealtimeRefresh } from "@/hooks/use-realtime-refresh";
import { useRoleScope } from "@/hooks/use-role-scope";
import {
  createCarrierRequest,
  fetchActivities,
  fetchCarriers,
} from "@/lib/api/resources";
import { ApiClientError } from "@/lib/api/client";
import { APPROVED } from "@/lib/constants/activity-approval";
import { FILTER_ALL } from "@/lib/constants/filters";
import { ADMIN, DISPATCHER, TEAM_LEAD } from "@/lib/constants/roles";
import { DELIVERED } from "@/lib/constants/statuses";
import {
  TEAM_STATUSES,
  TEAM_STATUS_ACTIVE,
} from "@/lib/constants/team-statuses";
import { TRUCK_TYPES } from "@/lib/constants/truck-types";
import { isValidCarrierAutoActivityStatus } from "@/lib/carriers/activity-based-status";
import type { Carrier, DailyActivity } from "@/lib/types";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils/format-currency";
import { formatDate, formatDateShort } from "@/lib/utils/format-date";
import {
  formatDateRangeLabel,
  resolveDateRangePreset,
} from "@/lib/utils/resolve-date-range-preset";
import type { CarrierFormValues } from "@/lib/validation/carrier-form";

const ACTIVATION_WINDOW_HOURS = 72;
const PAGE_SIZE = 5;

const LIFECYCLE_META = {
  Processing: {
    label: "Processing",
    color: "#2563EB",
    soft: "#DBEAFE",
    text: "#1D4ED8",
  },
  Active: {
    label: "Active",
    color: "#22C55E",
    soft: "#DCFCE7",
    text: "#166534",
  },
  Inactive: {
    label: "Inactive",
    color: "#F97316",
    soft: "#FFEDD5",
    text: "#C2410C",
  },
  Dead: {
    label: "Dead",
    color: "#F43F5E",
    soft: "#FFE4E6",
    text: "#BE123C",
  },
} as const;

const REQUEST_META = {
  Pending: "border-[#E9D5FF] bg-[#F3E8FF] text-[#7E22CE]",
  Approved: "border-[#BBF7D0] bg-[#DCFCE7] text-[#166534]",
  Rejected: "border-[#FECACA] bg-[#FEE2E2] text-[#B91C1C]",
} as const;

type LifecycleStatus = keyof typeof LIFECYCLE_META;
type ExtensionStatus = keyof typeof REQUEST_META;

type SalesFilters = {
  dateRange: string;
  teamId: string;
  dispatcherId: string;
  carrierId: string;
  truckType: string;
  status: string;
  lifecycleStatus: string;
  extensionStatus: string;
  createdBy: string;
};

type ExtensionRequest = {
  id: string;
  carrierId: string;
  carrierName: string;
  dispatcherName: string;
  teamName: string;
  requestedAt: string;
  requestedExtension: "24 hours" | "48 hours" | "72 hours";
  reason: string;
  status: ExtensionStatus;
  decidedBy?: string;
  decidedAt?: string;
};

type PipelineRow = {
  carrier: Carrier;
  status: LifecycleStatus;
  createdAt: Date;
  deadline: Date;
  deadlineState: "normal" | "soon" | "overdue";
  activatedAt: string | null;
  inactiveAt: string | null;
  revenue: number;
  dispatchFee: number;
  miles: number;
  ratePerMile: number | null;
};

type RankedPerson = {
  id: string;
  name: string;
  team: string;
  activeCarriers: number;
  conversionRate: number;
  revenue: number;
};

type RankedTeam = {
  id: string;
  name: string;
  activeCarriers: number;
  totalCarriers: number;
  conversionRate: number;
  revenue: number;
};

type SalesAnalytics = {
  rows: PipelineRow[];
  lifecycleRows: { status: LifecycleStatus; value: number; percent: number }[];
  processingCount: number;
  activeCount: number;
  inactiveCount: number;
  deadCount: number;
  conversionRate: number;
  teamRows: RankedTeam[];
  dispatcherRows: RankedPerson[];
  revenueRows: PipelineRow[];
  highestDispatchFee: PipelineRow | null;
  mostMiles: PipelineRow | null;
  bestRatePerMile: PipelineRow | null;
  mostValuable: PipelineRow | null;
};

function getDefaultSalesFilters(): SalesFilters {
  return {
    dateRange: "last-30-days",
    teamId: FILTER_ALL,
    dispatcherId: FILTER_ALL,
    carrierId: FILTER_ALL,
    truckType: FILTER_ALL,
    status: FILTER_ALL,
    lifecycleStatus: FILTER_ALL,
    extensionStatus: FILTER_ALL,
    createdBy: FILTER_ALL,
  };
}

function filterValueToSelection(value: string): string[] {
  return value === FILTER_ALL ? [] : [value];
}

function selectionToFilterValue(values: string[]): string {
  return values[0] ?? FILTER_ALL;
}

function formatOptionLabel(value: string): string {
  return value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof ApiClientError ? error.message : fallback;
}

function addHours(date: Date, hours: number): Date {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
}

function parseDate(value: string): Date {
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed : new Date();
}

function getActivityTime(activity: DailyActivity): number {
  return Date.parse(`${activity.date}T12:00:00`);
}

function isInRange(date: Date, dateFrom: string, dateTo: string): boolean {
  const key = date.toISOString().slice(0, 10);
  return key >= dateFrom && key <= dateTo;
}

function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

function compactNumber(value: number): string {
  return Math.round(value).toLocaleString();
}

function buildPipelineRows(
  carriers: Carrier[],
  activities: DailyActivity[],
  now = new Date(),
): PipelineRow[] {
  const activitiesByCarrier = new Map<string, DailyActivity[]>();
  for (const activity of activities) {
    const list = activitiesByCarrier.get(activity.carrierId) ?? [];
    list.push(activity);
    activitiesByCarrier.set(activity.carrierId, list);
  }

  return carriers.map((carrier) => {
    const carrierActivities = activitiesByCarrier.get(carrier.id) ?? [];
    const validActivities = carrierActivities
      .filter(
        (activity) =>
          activity.approvalStatus === APPROVED &&
          isValidCarrierAutoActivityStatus(activity.status),
      )
      .sort((left, right) => getActivityTime(left) - getActivityTime(right));
    const createdAt = parseDate(carrier.createdAt);
    const deadline = addHours(createdAt, ACTIVATION_WINDOW_HOURS);
    const activationActivity = validActivities.find(
      (activity) => getActivityTime(activity) <= deadline.getTime(),
    );
    const deliveredActivities = carrierActivities.filter(
      (activity) => activity.approvalStatus === APPROVED,
    );
    const revenue = deliveredActivities.reduce(
      (total, activity) =>
        total +
        (activity.status === DELIVERED ? (activity.loadAmount ?? 0) : 0),
      0,
    );
    const dispatchFee = deliveredActivities.reduce(
      (total, activity) => total + (activity.dispatchFee ?? 0),
      0,
    );
    const miles = deliveredActivities.reduce(
      (total, activity) => total + (activity.miles ?? 0),
      0,
    );
    const ratePerMile = miles > 0 ? revenue / miles : null;
    const isActive =
      Boolean(activationActivity) ||
      (carrier.status === TEAM_STATUS_ACTIVE && validActivities.length > 0);
    const status: LifecycleStatus = isActive
      ? "Active"
      : now.getTime() <= deadline.getTime()
        ? "Processing"
        : "Inactive";
    const hoursRemaining =
      (deadline.getTime() - now.getTime()) / (60 * 60 * 1000);
    const deadlineState =
      status === "Active"
        ? "normal"
        : hoursRemaining < 0
          ? "overdue"
          : hoursRemaining <= 12
            ? "soon"
            : "normal";

    return {
      carrier,
      status,
      createdAt,
      deadline,
      deadlineState,
      activatedAt: activationActivity?.date ?? null,
      inactiveAt: status === "Inactive" ? deadline.toISOString() : null,
      revenue,
      dispatchFee,
      miles,
      ratePerMile,
    };
  });
}

function buildSalesAnalytics(
  carriers: Carrier[],
  activities: DailyActivity[],
): SalesAnalytics {
  const rows = buildPipelineRows(carriers, activities);
  const total = Math.max(rows.length, 1);
  const lifecycleRows = (Object.keys(LIFECYCLE_META) as LifecycleStatus[]).map(
    (status) => {
      const value = rows.filter((row) => row.status === status).length;
      return {
        status,
        value,
        percent: (value / total) * 100,
      };
    },
  );
  const processingCount =
    lifecycleRows.find((row) => row.status === "Processing")?.value ?? 0;
  const activeCount =
    lifecycleRows.find((row) => row.status === "Active")?.value ?? 0;
  const inactiveCount =
    lifecycleRows.find((row) => row.status === "Inactive")?.value ?? 0;
  const deadCount =
    lifecycleRows.find((row) => row.status === "Dead")?.value ?? 0;
  const conversionRate =
    rows.length > 0 ? (activeCount / rows.length) * 100 : 0;

  const teamMap = new Map<string, RankedTeam>();
  const dispatcherMap = new Map<string, RankedPerson & { total: number }>();

  for (const row of rows) {
    const teamId = row.carrier.assignedTeamId;
    const team =
      teamMap.get(teamId) ??
      ({
        id: teamId,
        name: row.carrier.assignedTeamName,
        activeCarriers: 0,
        totalCarriers: 0,
        conversionRate: 0,
        revenue: 0,
      } satisfies RankedTeam);
    team.totalCarriers += 1;
    team.revenue += row.revenue;
    if (row.status === "Active") team.activeCarriers += 1;
    team.conversionRate =
      team.totalCarriers > 0
        ? (team.activeCarriers / team.totalCarriers) * 100
        : 0;
    teamMap.set(teamId, team);

    const dispatcherId = row.carrier.assignedDispatcherId ?? "unassigned";
    const dispatcher =
      dispatcherMap.get(dispatcherId) ??
      ({
        id: dispatcherId,
        name: row.carrier.assignedDispatcherName || "Unassigned",
        team: row.carrier.assignedTeamName,
        activeCarriers: 0,
        total: 0,
        conversionRate: 0,
        revenue: 0,
      } satisfies RankedPerson & { total: number });
    dispatcher.total += 1;
    dispatcher.revenue += row.revenue;
    if (row.status === "Active") dispatcher.activeCarriers += 1;
    dispatcher.conversionRate =
      dispatcher.total > 0
        ? (dispatcher.activeCarriers / dispatcher.total) * 100
        : 0;
    dispatcherMap.set(dispatcherId, dispatcher);
  }

  const byValue =
    (selector: (row: PipelineRow) => number | null) =>
    (left: PipelineRow, right: PipelineRow) =>
      (selector(right) ?? 0) - (selector(left) ?? 0);

  const revenueRows = [...rows].sort(byValue((row) => row.revenue)).slice(0, 5);

  return {
    rows,
    lifecycleRows,
    processingCount,
    activeCount,
    inactiveCount,
    deadCount,
    conversionRate,
    teamRows: [...teamMap.values()].sort(
      (left, right) =>
        right.activeCarriers - left.activeCarriers ||
        right.conversionRate - left.conversionRate,
    ),
    dispatcherRows: [...dispatcherMap.values()]
      .sort(
        (left, right) =>
          right.activeCarriers - left.activeCarriers ||
          right.conversionRate - left.conversionRate,
      )
      .map((row) => ({
        id: row.id,
        name: row.name,
        team: row.team,
        activeCarriers: row.activeCarriers,
        conversionRate: row.conversionRate,
        revenue: row.revenue,
      })),
    revenueRows,
    highestDispatchFee:
      [...rows].sort(byValue((row) => row.dispatchFee))[0] ?? null,
    mostMiles: [...rows].sort(byValue((row) => row.miles))[0] ?? null,
    bestRatePerMile:
      [...rows]
        .filter((row) => row.ratePerMile !== null)
        .sort(byValue((row) => row.ratePerMile))[0] ?? null,
    mostValuable: revenueRows[0] ?? null,
  };
}

function SalesPageContentInner() {
  const { role, user } = useRoleScope();
  const canManageCarriers = role !== DISPATCHER;
  const canReviewExtensions = role === ADMIN || role === TEAM_LEAD;
  const filterButtonRef = useRef<HTMLDivElement>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filters, setFilters] = useState<SalesFilters>(getDefaultSalesFilters);
  const [draftFilters, setDraftFilters] = useState<SalesFilters>(
    getDefaultSalesFilters,
  );
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<CarrierModalMode>("create");
  const [selectedCarrier, setSelectedCarrier] = useState<Carrier | null>(null);
  const [profileCarrier, setProfileCarrier] = useState<PipelineRow | null>(
    null,
  );
  const [requestCarrier, setRequestCarrier] = useState<PipelineRow | null>(
    null,
  );
  const [extensionHours, setExtensionHours] =
    useState<ExtensionRequest["requestedExtension"]>("72 hours");
  const [extensionReason, setExtensionReason] = useState("");
  const [extensionRequests, setExtensionRequests] = useState<
    ExtensionRequest[]
  >([]);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const activeRange = useMemo(
    () => resolveDateRangePreset(filters.dateRange),
    [filters.dateRange],
  );
  const periodLabel = formatDateRangeLabel(
    activeRange.dateFrom,
    activeRange.dateTo,
  );

  const carrierParams = useMemo(() => {
    const params: Record<string, string> = {};
    if (filters.teamId !== FILTER_ALL) params.teamId = filters.teamId;
    if (filters.dispatcherId !== FILTER_ALL) {
      params.dispatcherId = filters.dispatcherId;
    }
    if (filters.carrierId !== FILTER_ALL) params.carrierId = filters.carrierId;
    if (filters.truckType !== FILTER_ALL) params.truckType = filters.truckType;
    if (filters.status !== FILTER_ALL) params.status = filters.status;
    return params;
  }, [
    filters.carrierId,
    filters.dispatcherId,
    filters.status,
    filters.teamId,
    filters.truckType,
  ]);

  const activityParams = useMemo(() => {
    const params: Record<string, string> = {
      dateFrom: activeRange.dateFrom,
      dateTo: activeRange.dateTo,
      approvalStatus: APPROVED,
    };
    if (filters.teamId !== FILTER_ALL) params.teamId = filters.teamId;
    if (filters.dispatcherId !== FILTER_ALL) {
      params.dispatcherId = filters.dispatcherId;
    }
    if (filters.carrierId !== FILTER_ALL) params.carrierId = filters.carrierId;
    if (filters.truckType !== FILTER_ALL) params.truckType = filters.truckType;
    if (filters.status !== FILTER_ALL) params.status = filters.status;
    return params;
  }, [
    activeRange.dateFrom,
    activeRange.dateTo,
    filters.carrierId,
    filters.dispatcherId,
    filters.status,
    filters.teamId,
    filters.truckType,
  ]);

  const loadCarriers = useCallback(() => {
    return fetchCarriers(carrierParams);
  }, [carrierParams]);

  const loadActivities = useCallback(() => {
    return fetchActivities(activityParams);
  }, [activityParams]);

  const {
    data: carriers = [],
    error: carriersError,
    isLoading: carriersLoading,
    isEmpty,
    reload: reloadCarriers,
  } = useApiData(loadCarriers, [loadCarriers]);
  const {
    data: activities = [],
    error: activitiesError,
    isLoading: activitiesLoading,
    reload: reloadActivities,
  } = useApiData(loadActivities, [loadActivities]);
  const {
    teams,
    dispatchers,
    reload: reloadEntityOptions,
  } = useEntityOptions({ teams: true, dispatchers: true, carriers: false });

  const refresh = useCallback(async () => {
    await Promise.all([
      reloadCarriers(),
      reloadActivities(),
      reloadEntityOptions(),
    ]);
  }, [reloadActivities, reloadCarriers, reloadEntityOptions]);

  const realtimeTables = useMemo(
    () => ["Carrier", "DailyActivity"] as const,
    [],
  );

  useRealtimeRefresh(realtimeTables, refresh);

  const dateScopedCarriers = useMemo(
    () =>
      carriers.filter((carrier) =>
        isInRange(
          parseDate(carrier.createdAt),
          activeRange.dateFrom,
          activeRange.dateTo,
        ),
      ),
    [activeRange.dateFrom, activeRange.dateTo, carriers],
  );

  const analytics = useMemo(
    () => buildSalesAnalytics(dateScopedCarriers, activities),
    [activities, dateScopedCarriers],
  );

  const visibleRows = useMemo(() => {
    const extensionCarrierIds = new Set(
      extensionRequests
        .filter(
          (request) =>
            filters.extensionStatus === FILTER_ALL ||
            request.status === filters.extensionStatus,
        )
        .map((request) => request.carrierId),
    );

    return analytics.rows.filter((row) => {
      if (
        filters.lifecycleStatus !== FILTER_ALL &&
        row.status !== filters.lifecycleStatus
      ) {
        return false;
      }

      if (
        filters.extensionStatus !== FILTER_ALL &&
        !extensionCarrierIds.has(row.carrier.id)
      ) {
        return false;
      }

      return true;
    });
  }, [
    analytics.rows,
    extensionRequests,
    filters.extensionStatus,
    filters.lifecycleStatus,
  ]);

  const totalPages = Math.max(1, Math.ceil(visibleRows.length / PAGE_SIZE));
  const visiblePage = Math.min(page, totalPages);
  const pagedRows = visibleRows.slice(
    (visiblePage - 1) * PAGE_SIZE,
    visiblePage * PAGE_SIZE,
  );

  const extensionCount = extensionRequests.length;
  const pendingExtensionCount = extensionRequests.filter(
    (request) => request.status === "Pending",
  ).length;
  const activeFilterCount = useMemo(() => {
    const defaults = getDefaultSalesFilters();
    return (Object.keys(defaults) as Array<keyof SalesFilters>).reduce(
      (count, key) => count + (filters[key] !== defaults[key] ? 1 : 0),
      0,
    );
  }, [filters]);
  const salesFilterGroups = useMemo(() => {
    const scopedDispatchers =
      draftFilters.teamId === FILTER_ALL
        ? dispatchers
        : dispatchers.filter(
            (dispatcher) =>
              dispatcher.teamName ===
              teams.find((team) => team.id === draftFilters.teamId)?.name,
          );
    const scopedCarriers = carriers.filter((carrier) => {
      if (
        draftFilters.teamId !== FILTER_ALL &&
        carrier.assignedTeamId !== draftFilters.teamId
      ) {
        return false;
      }

      if (
        draftFilters.dispatcherId !== FILTER_ALL &&
        carrier.assignedDispatcherId !== draftFilters.dispatcherId
      ) {
        return false;
      }

      return true;
    });

    return [
      {
        id: "team",
        title: "Team",
        searchPlaceholder: "Search teams...",
        options: teams.map((team) => ({ value: team.id, label: team.name })),
        selectedValues: filterValueToSelection(draftFilters.teamId),
        onChange: (values: string[]) =>
          setDraftFilters((current) => ({
            ...current,
            teamId: selectionToFilterValue(values),
            dispatcherId: FILTER_ALL,
            carrierId: FILTER_ALL,
          })),
      },
      {
        id: "dispatcher",
        title: "Dispatcher",
        searchPlaceholder: "Search dispatchers...",
        options: scopedDispatchers.map((dispatcher) => ({
          value: dispatcher.id,
          label: dispatcher.fullName,
        })),
        selectedValues: filterValueToSelection(draftFilters.dispatcherId),
        onChange: (values: string[]) =>
          setDraftFilters((current) => ({
            ...current,
            dispatcherId: selectionToFilterValue(values),
            carrierId: FILTER_ALL,
          })),
      },
      {
        id: "carrier",
        title: "Carrier",
        searchPlaceholder: "Search carriers...",
        options: scopedCarriers.map((carrier) => ({
          value: carrier.id,
          label: carrier.carrierName,
        })),
        selectedValues: filterValueToSelection(draftFilters.carrierId),
        onChange: (values: string[]) =>
          setDraftFilters((current) => ({
            ...current,
            carrierId: selectionToFilterValue(values),
          })),
      },
      {
        id: "truckType",
        title: "Truck Type",
        searchPlaceholder: "Search truck types...",
        options: TRUCK_TYPES.map((truckType) => ({
          value: truckType,
          label: formatOptionLabel(truckType),
        })),
        selectedValues: filterValueToSelection(draftFilters.truckType),
        onChange: (values: string[]) =>
          setDraftFilters((current) => ({
            ...current,
            truckType: selectionToFilterValue(values),
          })),
      },
      {
        id: "status",
        title: "Status",
        searchPlaceholder: "Search statuses...",
        options: TEAM_STATUSES.map((status) => ({
          value: status,
          label: formatOptionLabel(status),
        })),
        selectedValues: filterValueToSelection(draftFilters.status),
        onChange: (values: string[]) =>
          setDraftFilters((current) => ({
            ...current,
            status: selectionToFilterValue(values),
          })),
      },
      {
        id: "lifecycle",
        title: "Lifecycle",
        searchPlaceholder: "Search lifecycle statuses...",
        options: (Object.keys(LIFECYCLE_META) as LifecycleStatus[]).map(
          (status) => ({
            value: status,
            label: status,
          }),
        ),
        selectedValues: filterValueToSelection(draftFilters.lifecycleStatus),
        onChange: (values: string[]) =>
          setDraftFilters((current) => ({
            ...current,
            lifecycleStatus: selectionToFilterValue(values),
          })),
      },
      {
        id: "extensionStatus",
        title: "Extension Status",
        searchPlaceholder: "Search extension statuses...",
        options: (Object.keys(REQUEST_META) as ExtensionStatus[]).map(
          (status) => ({
            value: status,
            label: status,
          }),
        ),
        selectedValues: filterValueToSelection(draftFilters.extensionStatus),
        onChange: (values: string[]) =>
          setDraftFilters((current) => ({
            ...current,
            extensionStatus: selectionToFilterValue(values),
          })),
      },
    ];
  }, [carriers, dispatchers, draftFilters, teams]);

  const pageState: PageContentState =
    carriersLoading || activitiesLoading
      ? "loading"
      : carriersError || activitiesError
        ? "error"
        : isEmpty || carriers.length === 0
          ? "empty"
          : "ready";

  function showToast(message: string) {
    setToastMessage(message);
  }

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

  function openCreateCarrierModal() {
    setSelectedCarrier(null);
    setModalMode("create");
    setModalOpen(true);
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
      showToast(`Carrier "${values.carrierName}" added.`);
      await refresh();
    } catch (err) {
      showToast(getErrorMessage(err, "Failed to add carrier."));
      throw err;
    }
  }

  function handleExport() {
    const headers = [
      "Carrier Name",
      "Team",
      "Dispatcher",
      "Status",
      "Created Date",
      "Deadline",
      "Revenue",
      "Dispatch Fee",
      "Miles",
    ];
    const rows = visibleRows.map((row) => [
      row.carrier.carrierName,
      row.carrier.assignedTeamName,
      row.carrier.assignedDispatcherName,
      row.status,
      row.createdAt.toISOString(),
      row.deadline.toISOString(),
      String(row.revenue),
      String(row.dispatchFee),
      String(row.miles),
    ]);
    const csv = [headers, ...rows]
      .map((line) =>
        line.map((value) => `"${value.replaceAll('"', '""')}"`).join(","),
      )
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `sales-carrier-pipeline-${activeRange.dateFrom}-${activeRange.dateTo}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
    showToast("Sales pipeline exported.");
  }

  function submitExtensionRequest() {
    if (!requestCarrier || !extensionReason.trim()) {
      showToast("Add a short reason before requesting an extension.");
      return;
    }

    const request: ExtensionRequest = {
      id: crypto.randomUUID(),
      carrierId: requestCarrier.carrier.id,
      carrierName: requestCarrier.carrier.carrierName,
      dispatcherName: requestCarrier.carrier.assignedDispatcherName,
      teamName: requestCarrier.carrier.assignedTeamName,
      requestedAt: new Date().toISOString(),
      requestedExtension: extensionHours,
      reason: extensionReason.trim(),
      status: "Pending",
    };

    setExtensionRequests((requests) => [request, ...requests]);
    setExtensionReason("");
    setExtensionHours("72 hours");
    setRequestCarrier(null);
    showToast(`Extension requested for ${request.carrierName}.`);
  }

  function decideExtensionRequest(id: string, status: "Approved" | "Rejected") {
    setExtensionRequests((requests) =>
      requests.map((request) =>
        request.id === id
          ? {
              ...request,
              status,
              decidedBy: user.fullName,
              decidedAt: new Date().toISOString(),
            }
          : request,
      ),
    );
    showToast(`Extension request ${status.toLowerCase()}.`);
  }

  function openFilterPopover() {
    setDraftFilters(filters);
    setFiltersOpen((open) => !open);
  }

  function applyDraftFilters() {
    setFilters(draftFilters);
    setPage(1);
    setFiltersOpen(false);
  }

  function resetFilters() {
    const reset = getDefaultSalesFilters();
    setDraftFilters(reset);
    setFilters(reset);
    setPage(1);
    setFiltersOpen(false);
  }

  return (
    <>
      <PageShell
        title="Sales"
        description="Track carrier lifecycle, activation performance, extensions, and revenue impact."
        actions={
          <div className="flex w-full flex-wrap items-center justify-end gap-2 lg:w-auto">
            <div ref={filterButtonRef}>
              <SharedFilterButton
                activeCount={activeFilterCount}
                open={filtersOpen}
                onClick={openFilterPopover}
                className="h-10 rounded-xl border-[#D9E2EF] px-4 text-[#0F172A] shadow-sm"
              />
            </div>
            <Button
              type="button"
              variant="outline"
              className="h-10 rounded-xl border-[#D9E2EF] bg-white px-4 text-[#0F172A] shadow-sm"
              onClick={handleExport}
            >
              <Download className="size-4" />
              Export
            </Button>
            {canManageCarriers ? (
              <Button
                type="button"
                className="h-10 rounded-xl bg-[#2563EB] px-4 font-semibold text-white shadow-sm hover:bg-[#1D4ED8]"
                onClick={openCreateCarrierModal}
              >
                <Plus className="size-4" />
                Add Carrier
              </Button>
            ) : null}
          </div>
        }
      >
        <div className="-m-4 space-y-4 bg-[#F6F8FB] p-4 md:-m-6 md:space-y-5 md:p-6 lg:-m-8 lg:p-8">
          <PageContentGate
            state={pageState}
            onRetry={refresh}
            loadingTitle="Loading sales dashboard"
            emptyTitle="No carriers found"
            emptyDescription="Add carriers to start tracking lifecycle, activation and sales performance."
            emptyActionLabel={canManageCarriers ? "Add Carrier" : undefined}
            onEmptyAction={
              canManageCarriers ? openCreateCarrierModal : undefined
            }
            errorTitle="Unable to load sales dashboard"
            errorDescription={
              carriersError ??
              activitiesError ??
              "Sales metrics could not be loaded. Try again in a moment."
            }
          >
            <SalesKpiRow
              analytics={analytics}
              extensionCount={extensionCount}
              pendingExtensionCount={pendingExtensionCount}
            />

            <section>
              <SalesCard title="Carrier Lifecycle Breakdown">
                <LifecycleDonut
                  rows={analytics.lifecycleRows}
                  total={analytics.rows.length}
                />
              </SalesCard>
            </section>

            <section className="grid grid-cols-1 gap-5 lg:grid-cols-[repeat(auto-fit,minmax(420px,1fr))]">
              <div className="min-w-0">
                <SalesCard title="Activation by Team" info>
                  <ActivationBarChart
                    data={analytics.teamRows.slice(0, 5).map((team) => ({
                      name: team.name,
                      value: team.activeCarriers,
                      conversionRate: team.conversionRate,
                      revenue: team.revenue,
                    }))}
                    yLabel="Activated Carriers"
                  />
                </SalesCard>
              </div>
              <div className="min-w-0">
                <SalesCard title="Activation by Dispatcher" info>
                  <ActivationBarChart
                    data={analytics.dispatcherRows
                      .slice(0, 5)
                      .map((dispatcher) => ({
                        name: dispatcher.name,
                        value: dispatcher.activeCarriers,
                        team: dispatcher.team,
                        conversionRate: dispatcher.conversionRate,
                        revenue: dispatcher.revenue,
                      }))}
                    yLabel="Activated Carriers"
                  />
                </SalesCard>
              </div>
            </section>

            <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <SalesCard title="Top Carriers by Revenue" info>
                <RevenueBarChart rows={analytics.revenueRows} />
              </SalesCard>
              <SalesCard title="Top Carrier Metrics" info>
                <TopCarrierMetrics analytics={analytics} />
              </SalesCard>
              <SalesCard title="Extension Requests">
                <ExtensionRequestsCard
                  requests={extensionRequests}
                  canReview={canReviewExtensions}
                  onApprove={(id) => decideExtensionRequest(id, "Approved")}
                  onReject={(id) => decideExtensionRequest(id, "Rejected")}
                />
              </SalesCard>
              <SalesCard title="Top Sales Teams">
                <TopSalesTeams rows={analytics.teamRows.slice(0, 4)} />
              </SalesCard>
            </section>

            <SalesPipelineTable
              rows={pagedRows}
              totalRows={visibleRows.length}
              page={visiblePage}
              totalPages={totalPages}
              periodLabel={periodLabel}
              onPageChange={setPage}
              onView={setProfileCarrier}
              onRequestExtension={setRequestCarrier}
            />
          </PageContentGate>
        </div>
      </PageShell>

      <SharedFilterPopover
        open={filtersOpen}
        anchorRef={filterButtonRef}
        title="Sales Filters"
        description="Choose lifecycle, assignment, equipment, and date filters, then apply."
        dateRange={{
          name: "sales-date-range",
          value: draftFilters.dateRange,
          options: [
            { value: "today", label: "Today" },
            { value: "this-week", label: "This Week" },
            { value: "this-month", label: "This Month" },
            { value: "last-30-days", label: "Last 30 Days" },
          ],
          onChange: (dateRange) =>
            setDraftFilters((current) => ({ ...current, dateRange })),
        }}
        groups={salesFilterGroups}
        onApply={applyDraftFilters}
        onReset={resetFilters}
        onClose={() => setFiltersOpen(false)}
      />

      <CarrierModal
        open={modalOpen}
        mode={modalMode}
        carrier={selectedCarrier}
        onOpenChange={setModalOpen}
        onCreate={handleCreate}
        onEdit={async () => undefined}
        onReassign={async () => undefined}
        onToggleStatus={async () => undefined}
      />

      <CarrierProfileDialog
        row={profileCarrier}
        requests={extensionRequests.filter(
          (request) => request.carrierId === profileCarrier?.carrier.id,
        )}
        onOpenChange={(open) => {
          if (!open) setProfileCarrier(null);
        }}
      />

      <ExtensionRequestDialog
        row={requestCarrier}
        hours={extensionHours}
        reason={extensionReason}
        onHoursChange={setExtensionHours}
        onReasonChange={setExtensionReason}
        onSubmit={submitExtensionRequest}
        onOpenChange={(open) => {
          if (!open) setRequestCarrier(null);
        }}
      />

      <AppToast
        message={toastMessage}
        onDismiss={() => setToastMessage(null)}
      />
    </>
  );
}

function SalesKpiRow({
  analytics,
  extensionCount,
  pendingExtensionCount,
}: {
  analytics: SalesAnalytics;
  extensionCount: number;
  pendingExtensionCount: number;
}) {
  return (
    <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
      <KpiCard
        title="Processing Carriers"
        value={analytics.processingCount.toLocaleString()}
        helper="Within 72-hour window"
        icon={Hourglass}
        color="#2563EB"
        soft="#DBEAFE"
      />
      <KpiCard
        title="Active Carriers"
        value={analytics.activeCount.toLocaleString()}
        helper="Activated by valid loads"
        icon={CheckCircle2}
        color="#22C55E"
        soft="#DCFCE7"
      />
      <KpiCard
        title="Inactive Carriers"
        value={analytics.inactiveCount.toLocaleString()}
        helper="No valid load in 72 hours"
        icon={PauseCircle}
        color="#F97316"
        soft="#FFEDD5"
      />
      <KpiCard
        title="Dead Carriers"
        value={analytics.deadCount.toLocaleString()}
        helper="Manually marked dead"
        icon={XCircle}
        color="#F43F5E"
        soft="#FFE4E6"
      />
      <KpiCard
        title="Extension Requests"
        value={extensionCount.toLocaleString()}
        helper={`${pendingExtensionCount.toLocaleString()} pending approval`}
        icon={Clock3}
        color="#8B5CF6"
        soft="#F3E8FF"
      />
      <KpiCard
        title="Conversion Rate"
        value={formatPercent(analytics.conversionRate)}
        helper="Active ÷ total new carriers"
        icon={TrendingUp}
        color="#2563EB"
        soft="#DBEAFE"
      />
    </section>
  );
}

function KpiCard({
  title,
  value,
  helper,
  icon: Icon,
  color,
  soft,
}: {
  title: string;
  value: string;
  helper: string;
  icon: LucideIcon;
  color: string;
  soft: string;
}) {
  return (
    <article className="rounded-2xl border border-[#E1E8F0] bg-white p-5 shadow-[0_12px_32px_rgba(15,23,42,0.05)]">
      <div className="flex items-center gap-4">
        <div
          className="flex size-12 shrink-0 items-center justify-center rounded-full"
          style={{ backgroundColor: soft, color }}
        >
          <Icon className="size-6" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold text-[#0F172A]">
            {title}
          </p>
          <p className="mt-1 text-2xl font-bold tracking-normal text-[#0B1220]">
            {value}
          </p>
          <p className="mt-2 truncate text-xs text-[#64748B]">{helper}</p>
        </div>
      </div>
    </article>
  );
}

function SalesCard({
  title,
  info = false,
  children,
}: {
  title: string;
  info?: boolean;
  children: ReactNode;
}) {
  return (
    <article className="min-w-0 rounded-2xl border border-[#E1E8F0] bg-white p-4 shadow-[0_12px_32px_rgba(15,23,42,0.05)] md:p-5">
      <div className="mb-4 flex items-center gap-2">
        <h2 className="text-base font-semibold text-[#0F172A]">{title}</h2>
        {info ? (
          <span className="flex size-4 items-center justify-center rounded-full border border-[#CBD5E1] text-[10px] font-semibold text-[#64748B]">
            i
          </span>
        ) : null}
      </div>
      {children}
    </article>
  );
}

function LifecycleDonut({
  rows,
  total,
}: {
  rows: SalesAnalytics["lifecycleRows"];
  total: number;
}) {
  return (
    <div className="grid min-h-[250px] grid-cols-1 items-center gap-4 md:grid-cols-[1fr_180px] xl:grid-cols-1 2xl:grid-cols-[1fr_180px]">
      <div className="relative h-[230px] min-w-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={rows}
              dataKey="value"
              nameKey="status"
              innerRadius={62}
              outerRadius={96}
              paddingAngle={1}
            >
              {rows.map((row) => (
                <Cell
                  key={row.status}
                  fill={LIFECYCLE_META[row.status].color}
                />
              ))}
            </Pie>
            <Tooltip
              formatter={(value, name) => [
                `${Number(value).toLocaleString()} carriers`,
                name,
              ]}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-bold text-[#0B1220]">
            {total.toLocaleString()}
          </span>
          <span className="text-sm font-medium text-[#475569]">Total</span>
        </div>
      </div>
      <div className="space-y-3">
        {rows.map((row) => (
          <div
            key={row.status}
            className="flex items-center justify-between gap-3"
          >
            <div className="flex min-w-0 items-center gap-2">
              <span
                className="size-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: LIFECYCLE_META[row.status].color }}
              />
              <span className="truncate text-sm font-medium text-[#334155]">
                {row.status}
              </span>
            </div>
            <span className="text-sm font-semibold text-[#0F172A]">
              {row.value} ({formatPercent(row.percent)})
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

type BarDatum = {
  name: string;
  value: number;
  team?: string;
  conversionRate?: number;
  revenue?: number;
};

function ActivationBarChart({
  data,
  yLabel,
}: {
  data: BarDatum[];
  yLabel: string;
}) {
  if (data.length === 0) {
    return <EmptyChart label="No activation data in this period." />;
  }

  return (
    <div className="h-[250px] min-w-0">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{ top: 18, right: 12, left: 0, bottom: 18 }}
        >
          <CartesianGrid stroke="#E5E7EB" vertical={false} />
          <XAxis
            dataKey="name"
            tick={{ fill: "#0F172A", fontSize: 11, fontWeight: 600 }}
            tickLine={false}
            axisLine={false}
            interval={0}
            angle={-12}
            textAnchor="end"
            height={62}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fill: "#64748B", fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            label={{
              value: yLabel,
              angle: -90,
              position: "insideLeft",
              fill: "#334155",
              fontSize: 11,
            }}
          />
          <Tooltip content={<SalesBarTooltip />} cursor={{ fill: "#F1F5F9" }} />
          <Bar
            dataKey="value"
            fill="#2563EB"
            radius={[5, 5, 0, 0]}
            barSize={36}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function SalesBarTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: BarDatum }>;
}) {
  const row = payload?.[0]?.payload;
  if (!active || !row) return null;

  return (
    <TooltipShell title={row.name}>
      <TooltipLine
        label="Activated carriers"
        value={row.value.toLocaleString()}
      />
      {row.team ? <TooltipLine label="Team" value={row.team} /> : null}
      {row.conversionRate !== undefined ? (
        <TooltipLine
          label="Conversion"
          value={formatPercent(row.conversionRate)}
        />
      ) : null}
      {row.revenue !== undefined ? (
        <TooltipLine
          label="Revenue"
          value={formatCurrency(row.revenue, { maximumFractionDigits: 0 })}
        />
      ) : null}
    </TooltipShell>
  );
}

function RevenueBarChart({ rows }: { rows: PipelineRow[] }) {
  if (rows.length === 0) {
    return <EmptyChart label="No carrier revenue in this period." />;
  }

  const data = rows.map((row) => ({
    name: row.carrier.carrierName,
    revenue: row.revenue,
    dispatcher: row.carrier.assignedDispatcherName,
    team: row.carrier.assignedTeamName,
    miles: row.miles,
    dispatchFee: row.dispatchFee,
    ratePerMile: row.ratePerMile,
  }));
  const colors = ["#2563EB", "#22C55E", "#F97316", "#8B5CF6", "#F43F5E"];

  return (
    <div className="h-[255px] min-w-0">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 8, right: 16, left: 8, bottom: 8 }}
        >
          <CartesianGrid stroke="#E5E7EB" horizontal={false} />
          <XAxis
            type="number"
            tick={{ fill: "#64748B", fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(value) => `$${Number(value) / 1000}K`}
          />
          <YAxis
            type="category"
            dataKey="name"
            width={116}
            tick={{ fill: "#0F172A", fontSize: 11, fontWeight: 600 }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip content={<RevenueTooltip />} cursor={{ fill: "#F1F5F9" }} />
          <Bar dataKey="revenue" radius={[0, 6, 6, 0]} barSize={18}>
            {data.map((row, index) => (
              <Cell key={row.name} fill={colors[index % colors.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function RevenueTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{
    payload: {
      name: string;
      revenue: number;
      dispatcher: string;
      team: string;
      miles: number;
      dispatchFee: number;
      ratePerMile: number | null;
    };
  }>;
}) {
  const row = payload?.[0]?.payload;
  if (!active || !row) return null;

  return (
    <TooltipShell title={row.name}>
      <TooltipLine
        label="Revenue"
        value={formatCurrency(row.revenue, { maximumFractionDigits: 0 })}
      />
      <TooltipLine label="Dispatcher" value={row.dispatcher || "Unassigned"} />
      <TooltipLine label="Team" value={row.team} />
      <TooltipLine label="Miles" value={`${compactNumber(row.miles)} mi`} />
      <TooltipLine
        label="Dispatch fee"
        value={formatCurrency(row.dispatchFee, { maximumFractionDigits: 0 })}
      />
      <TooltipLine
        label="Rate per mile"
        value={row.ratePerMile ? formatCurrency(row.ratePerMile) : "N/A"}
      />
    </TooltipShell>
  );
}

function TopCarrierMetrics({ analytics }: { analytics: SalesAnalytics }) {
  const items = [
    {
      label: "Highest Dispatch Fee",
      row: analytics.highestDispatchFee,
      value: analytics.highestDispatchFee
        ? formatCurrency(analytics.highestDispatchFee.dispatchFee, {
            maximumFractionDigits: 0,
          })
        : "N/A",
      icon: DollarSign,
      color: "#22C55E",
      soft: "#DCFCE7",
    },
    {
      label: "Most Miles",
      row: analytics.mostMiles,
      value: analytics.mostMiles
        ? `${compactNumber(analytics.mostMiles.miles)} mi`
        : "N/A",
      icon: Route,
      color: "#2563EB",
      soft: "#DBEAFE",
    },
    {
      label: "Best Rate per Mile",
      row: analytics.bestRatePerMile,
      value: analytics.bestRatePerMile?.ratePerMile
        ? formatCurrency(analytics.bestRatePerMile.ratePerMile)
        : "N/A",
      icon: Gauge,
      color: "#8B5CF6",
      soft: "#F3E8FF",
    },
    {
      label: "Most Valuable Carrier",
      row: analytics.mostValuable,
      value: analytics.mostValuable
        ? formatCurrency(analytics.mostValuable.revenue, {
            maximumFractionDigits: 0,
          })
        : "N/A",
      icon: Trophy,
      color: "#F97316",
      soft: "#FFEDD5",
    },
  ];

  return (
    <div className="space-y-4 pt-1">
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-3">
          <div
            className="flex size-9 shrink-0 items-center justify-center rounded-full"
            style={{ backgroundColor: item.soft, color: item.color }}
          >
            <item.icon className="size-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium text-[#64748B]">
              {item.label}
            </p>
            <p className="truncate text-sm font-semibold text-[#0F172A]">
              {item.row?.carrier.carrierName ?? "No carrier"}
            </p>
          </div>
          <p className="shrink-0 text-sm font-bold text-[#0F172A]">
            {item.value}
          </p>
        </div>
      ))}
    </div>
  );
}

function ExtensionRequestsCard({
  requests,
  canReview,
  onApprove,
  onReject,
}: {
  requests: ExtensionRequest[];
  canReview: boolean;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[520px] text-left text-xs">
        <thead>
          <tr className="text-[#475569]">
            <th className="pb-3 font-semibold">Carrier</th>
            <th className="pb-3 font-semibold">Dispatcher</th>
            <th className="pb-3 font-semibold">Team</th>
            <th className="pb-3 font-semibold">Requested Extension</th>
            <th className="pb-3 font-semibold">Status</th>
          </tr>
        </thead>
        <tbody>
          {requests.length === 0 ? (
            <tr>
              <td colSpan={5} className="py-8 text-center text-[#64748B]">
                No extension requests yet.
              </td>
            </tr>
          ) : (
            requests.slice(0, 5).map((request) => (
              <tr key={request.id} className="border-t border-[#EDF2F7]">
                <td className="py-2 font-medium text-[#0F172A]">
                  {request.carrierName}
                </td>
                <td className="py-2 text-[#334155]">
                  {request.dispatcherName}
                </td>
                <td className="py-2 text-[#334155]">{request.teamName}</td>
                <td className="py-2 text-[#334155]">
                  {request.requestedExtension}
                </td>
                <td className="py-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <StatusPill
                      label={request.status}
                      className={REQUEST_META[request.status]}
                    />
                    {canReview && request.status === "Pending" ? (
                      <>
                        <button
                          type="button"
                          className="text-[11px] font-semibold text-[#166534] hover:underline"
                          onClick={() => onApprove(request.id)}
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          className="text-[11px] font-semibold text-[#B91C1C] hover:underline"
                          onClick={() => onReject(request.id)}
                        >
                          Reject
                        </button>
                      </>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
      <button
        type="button"
        className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-[#2563EB] hover:underline"
      >
        View all extension requests
        <ArrowRight className="size-4" />
      </button>
    </div>
  );
}

function TopSalesTeams({ rows }: { rows: RankedTeam[] }) {
  return (
    <div className="space-y-3">
      {rows.length === 0 ? (
        <EmptyChart label="No team performance in this period." />
      ) : (
        rows.map((row, index) => (
          <div
            key={row.id}
            className="grid grid-cols-[32px_1fr_auto] items-center gap-3"
          >
            <span
              className={cn(
                "flex size-6 items-center justify-center rounded-full text-xs font-bold",
                index === 0
                  ? "bg-[#FBBF24] text-white"
                  : index === 1
                    ? "bg-[#E2E8F0] text-[#475569]"
                    : index === 2
                      ? "bg-[#FDBA74] text-white"
                      : "bg-[#F1F5F9] text-[#64748B]",
              )}
            >
              {index + 1}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-[#0F172A]">
                {row.name}
              </p>
              <p className="text-xs text-[#64748B]">
                {row.activeCarriers} active •{" "}
                {formatPercent(row.conversionRate)}
              </p>
            </div>
            <p className="text-right text-sm font-bold text-[#0F172A]">
              {formatCurrency(row.revenue, { maximumFractionDigits: 0 })}
            </p>
          </div>
        ))
      )}
      <button
        type="button"
        className="inline-flex items-center gap-2 pt-2 text-sm font-semibold text-[#2563EB] hover:underline"
      >
        View all teams performance
        <ArrowRight className="size-4" />
      </button>
    </div>
  );
}

function SalesPipelineTable({
  rows,
  totalRows,
  page,
  totalPages,
  periodLabel,
  onPageChange,
  onView,
  onRequestExtension,
}: {
  rows: PipelineRow[];
  totalRows: number;
  page: number;
  totalPages: number;
  periodLabel: string;
  onPageChange: (page: number) => void;
  onView: (row: PipelineRow) => void;
  onRequestExtension: (row: PipelineRow) => void;
}) {
  return (
    <article className="overflow-hidden rounded-2xl border border-[#E1E8F0] bg-white shadow-[0_12px_32px_rgba(15,23,42,0.05)]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E1E8F0] px-5 py-4">
        <div>
          <h2 className="text-base font-semibold text-[#0F172A]">
            Carrier Pipeline
          </h2>
          <p className="mt-1 text-sm text-[#64748B]">{periodLabel}</p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Pipeline options"
        >
          <MoreHorizontal className="size-4" />
        </Button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1120px] text-left text-sm">
          <thead className="bg-[#F8FAFC] text-xs font-semibold text-[#475569] uppercase">
            <tr>
              <th className="px-5 py-3">Carrier Name</th>
              <th className="px-5 py-3">Team</th>
              <th className="px-5 py-3">Dispatcher</th>
              <th className="px-5 py-3">Status</th>
              <th className="px-5 py-3">Created Date</th>
              <th className="px-5 py-3">Deadline</th>
              <th className="px-5 py-3 text-right">Revenue</th>
              <th className="px-5 py-3 text-right">Dispatch Fee</th>
              <th className="px-5 py-3 text-right">Miles</th>
              <th className="px-5 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={10}
                  className="px-5 py-10 text-center text-[#64748B]"
                >
                  No carriers match the selected filters.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr
                  key={row.carrier.id}
                  className="border-t border-[#EDF2F7] hover:bg-[#F8FAFC]"
                >
                  <td className="px-5 py-3 font-semibold text-[#0F172A]">
                    <button
                      type="button"
                      className="text-left hover:text-[#2563EB] hover:underline"
                      onClick={() => onView(row)}
                    >
                      {row.carrier.carrierName}
                    </button>
                  </td>
                  <td className="px-5 py-3 text-[#334155]">
                    {row.carrier.assignedTeamName}
                  </td>
                  <td className="px-5 py-3 text-[#334155]">
                    {row.carrier.assignedDispatcherName || "Unassigned"}
                  </td>
                  <td className="px-5 py-3">
                    <LifecyclePill status={row.status} />
                  </td>
                  <td className="px-5 py-3 text-[#334155]">
                    {formatDate(row.createdAt, "MMM d, yyyy hh:mm a")}
                  </td>
                  <td className="px-5 py-3">
                    <span
                      className={cn(
                        "font-medium",
                        row.deadlineState === "soon" && "text-[#D97706]",
                        row.deadlineState === "overdue" && "text-[#E11D48]",
                        row.deadlineState === "normal" && "text-[#2563EB]",
                      )}
                    >
                      {row.status === "Active"
                        ? "-"
                        : formatDate(row.deadline, "MMM d, yyyy hh:mm a")}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right font-semibold text-[#0F172A]">
                    {formatCurrency(row.revenue, { maximumFractionDigits: 0 })}
                  </td>
                  <td className="px-5 py-3 text-right text-[#334155]">
                    {formatCurrency(row.dispatchFee, {
                      maximumFractionDigits: 0,
                    })}
                  </td>
                  <td className="px-5 py-3 text-right text-[#334155]">
                    {compactNumber(row.miles)} mi
                  </td>
                  <td className="px-5 py-3 text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Actions for ${row.carrier.carrierName}`}
                          />
                        }
                      >
                        <MoreHorizontal className="size-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => onView(row)}>
                          View profile
                        </DropdownMenuItem>
                        {row.status === "Inactive" ? (
                          <DropdownMenuItem
                            onClick={() => onRequestExtension(row)}
                          >
                            Request Extension
                          </DropdownMenuItem>
                        ) : null}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#E1E8F0] px-5 py-3">
        <p className="text-sm text-[#64748B]">
          Showing {rows.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1} to{" "}
          {Math.min(page * PAGE_SIZE, totalRows)} of {totalRows} entries
        </p>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
            aria-label="Previous page"
          >
            <ArrowRight className="size-4 rotate-180" />
          </Button>
          {Array.from(
            { length: Math.min(totalPages, 3) },
            (_, index) => index + 1,
          ).map((pageNumber) => (
            <Button
              key={pageNumber}
              type="button"
              variant={pageNumber === page ? "default" : "outline"}
              size="icon-sm"
              className={
                pageNumber === page ? "bg-[#2563EB] text-white" : undefined
              }
              onClick={() => onPageChange(pageNumber)}
            >
              {pageNumber}
            </Button>
          ))}
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
            aria-label="Next page"
          >
            <ArrowRight className="size-4" />
          </Button>
        </div>
      </div>
    </article>
  );
}

function CarrierProfileDialog({
  row,
  requests,
  onOpenChange,
}: {
  row: PipelineRow | null;
  requests: ExtensionRequest[];
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={Boolean(row)} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>
            {row?.carrier.carrierName ?? "Carrier Profile"}
          </DialogTitle>
          <DialogDescription>
            Lifecycle, assignment, activity and revenue visibility.
          </DialogDescription>
        </DialogHeader>
        {row ? (
          <div className="space-y-5">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <ProfileField
                label="Assigned dispatcher"
                value={row.carrier.assignedDispatcherName || "Unassigned"}
              />
              <ProfileField
                label="Assigned team"
                value={row.carrier.assignedTeamName}
              />
              <ProfileField label="Created by" value="System record" />
              <ProfileField label="Lifecycle status" value={row.status} />
              <ProfileField
                label="Processing started at"
                value={formatDate(row.createdAt, "MMM d, yyyy hh:mm a")}
              />
              <ProfileField
                label="Activation deadline"
                value={formatDate(row.deadline, "MMM d, yyyy hh:mm a")}
              />
              <ProfileField
                label="Activated at"
                value={row.activatedAt ?? "N/A"}
              />
              <ProfileField
                label="Inactive at"
                value={
                  row.inactiveAt
                    ? formatDate(row.inactiveAt, "MMM d, yyyy hh:mm a")
                    : "N/A"
                }
              />
              <ProfileField label="Dead marked at/by" value="N/A" />
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
              <ProfileMetric
                label="Revenue history"
                value={formatCurrency(row.revenue, {
                  maximumFractionDigits: 0,
                })}
              />
              <ProfileMetric
                label="Dispatch fee history"
                value={formatCurrency(row.dispatchFee, {
                  maximumFractionDigits: 0,
                })}
              />
              <ProfileMetric
                label="Miles history"
                value={`${compactNumber(row.miles)} mi`}
              />
              <ProfileMetric
                label="Rate per mile"
                value={
                  row.ratePerMile ? formatCurrency(row.ratePerMile) : "N/A"
                }
              />
            </div>
            <section className="rounded-xl border border-[#E2E8F0] p-4">
              <h3 className="text-sm font-semibold text-[#0F172A]">
                Extension request history
              </h3>
              <div className="mt-3 space-y-2">
                {requests.length === 0 ? (
                  <p className="text-sm text-[#64748B]">
                    No extension requests.
                  </p>
                ) : (
                  requests.map((request) => (
                    <div
                      key={request.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-[#F8FAFC] p-3 text-sm"
                    >
                      <div>
                        <p className="font-medium text-[#0F172A]">
                          {request.requestedExtension} • {request.reason}
                        </p>
                        <p className="text-xs text-[#64748B]">
                          Requested {formatDateShort(request.requestedAt)}
                        </p>
                      </div>
                      <StatusPill
                        label={request.status}
                        className={REQUEST_META[request.status]}
                      />
                    </div>
                  ))
                )}
              </div>
            </section>
            <section className="rounded-xl border border-[#E2E8F0] p-4">
              <h3 className="text-sm font-semibold text-[#0F172A]">
                Notes and audit timeline
              </h3>
              <p className="mt-2 text-sm text-[#64748B]">
                {row.carrier.notes || "No notes recorded."}
              </p>
              <div className="mt-3 space-y-2 text-sm text-[#334155]">
                <p>
                  Carrier created on {formatDateShort(row.carrier.createdAt)}.
                </p>
                <p>
                  Status resolved as {row.status} using the 72-hour activation
                  window.
                </p>
              </div>
            </section>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function ExtensionRequestDialog({
  row,
  hours,
  reason,
  onHoursChange,
  onReasonChange,
  onSubmit,
  onOpenChange,
}: {
  row: PipelineRow | null;
  hours: ExtensionRequest["requestedExtension"];
  reason: string;
  onHoursChange: (hours: ExtensionRequest["requestedExtension"]) => void;
  onReasonChange: (reason: string) => void;
  onSubmit: () => void;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={Boolean(row)} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Request Extension</DialogTitle>
          <DialogDescription>
            Send an inactive carrier back for lifecycle review.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="rounded-xl bg-[#F8FAFC] p-3 text-sm text-[#334155]">
            {row?.carrier.carrierName ?? "Selected carrier"}
          </div>
          <div className="space-y-2">
            <Label htmlFor="extension-hours">Requested extension</Label>
            <select
              id="extension-hours"
              value={hours}
              onChange={(event) =>
                onHoursChange(
                  event.target.value as ExtensionRequest["requestedExtension"],
                )
              }
              className="h-10 w-full rounded-xl border border-[#D9E2EF] bg-white px-3 text-sm outline-none focus:border-[#2563EB] focus:ring-3 focus:ring-[#DBEAFE]"
            >
              <option value="24 hours">24 hours</option>
              <option value="48 hours">48 hours</option>
              <option value="72 hours">72 hours</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="extension-reason">Reason</Label>
            <Textarea
              id="extension-reason"
              value={reason}
              onChange={(event) => onReasonChange(event.target.value)}
              placeholder="Explain why this carrier still has activation potential."
              rows={4}
            />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" onClick={onSubmit}>
            Request Extension
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ProfileField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[#E2E8F0] bg-white p-3">
      <p className="text-xs font-medium text-[#64748B]">{label}</p>
      <p className="mt-1 text-sm font-semibold text-[#0F172A]">{value}</p>
    </div>
  );
}

function ProfileMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-[#F8FAFC] p-3">
      <p className="text-xs font-medium text-[#64748B]">{label}</p>
      <p className="mt-1 text-lg font-bold text-[#0F172A]">{value}</p>
    </div>
  );
}

function LifecyclePill({ status }: { status: LifecycleStatus }) {
  const meta = LIFECYCLE_META[status];
  return (
    <StatusPill
      label={meta.label.toUpperCase()}
      className="border"
      style={{
        backgroundColor: meta.soft,
        borderColor: meta.soft,
        color: meta.text,
      }}
    />
  );
}

function StatusPill({
  label,
  className,
  style,
}: {
  label: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <span
      className={cn(
        "inline-flex rounded-md border px-2 py-1 text-[11px] leading-none font-bold",
        className,
      )}
      style={style}
    >
      {label}
    </span>
  );
}

function EmptyChart({ label }: { label: string }) {
  return (
    <div className="flex h-[220px] items-center justify-center rounded-xl border border-dashed border-[#CBD5E1] bg-[#F8FAFC] text-sm text-[#64748B]">
      {label}
    </div>
  );
}

function TooltipShell({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="min-w-52 rounded-xl border border-[#E2E8F0] bg-white p-3 text-xs shadow-xl">
      <p className="mb-2 font-semibold text-[#0F172A]">{title}</p>
      <div className="space-y-1.5">{children}</div>
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

export function SalesPageContent() {
  return (
    <Suspense
      fallback={
        <div className="py-10 text-sm text-[#64748B]">
          Loading sales dashboard...
        </div>
      }
    >
      <SalesPageContentInner />
    </Suspense>
  );
}
