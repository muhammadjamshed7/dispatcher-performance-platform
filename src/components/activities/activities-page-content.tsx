"use client";

import type { ReactNode } from "react";
import { Suspense, useCallback, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
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
  Ban,
  CheckCircle2,
  FileText,
  Filter,
  MoreHorizontal,
  PackageCheck,
  Plus,
  Route,
  Truck,
} from "lucide-react";

import { PageContentGate } from "@/components/feedback/page-content-gate";
import type { PageContentState } from "@/components/feedback/page-content-gate";
import { AppToast } from "@/components/feedback/app-toast";
import { ActivitiesExcelFilterControls } from "@/components/activities/activities-excel-filter-controls";
import { ActivitiesPdfExportButton } from "@/components/activities/activities-pdf-export-button";
import { CarrierFilter } from "@/components/filters/carrier-filter";
import { DispatcherFilter } from "@/components/filters/dispatcher-filter";
import { EntityFilterBar } from "@/components/filters/entity-filter-bar";
import { TeamFilter } from "@/components/filters/team-filter";
import { RoleScopeBanner } from "@/components/layout/role-scope-banner";
import {
  ActivityModal,
  type ActivityModalMode,
} from "@/components/modals/activity-modal";
import {
  ActivitiesTable,
  type ActivityRowAction,
} from "@/components/tables/activities-table";
import { PageShell } from "@/components/layout/page-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useApiData } from "@/hooks/use-api-data";
import { useRealtimeRefresh } from "@/hooks/use-realtime-refresh";
import { useSession } from "@/components/auth/session-provider";
import { DISPATCHER } from "@/lib/constants/roles";
import { ApiClientError } from "@/lib/api/client";
import { useEntityOptions } from "@/hooks/use-entity-options";
import {
  activityExcelFiltersToParams,
  parseActivityExcelFiltersFromSearchParams,
  type ActivityExcelFilterState,
} from "@/lib/filters/activity-excel-filter-params";
import {
  entityFiltersToActivityParams,
  parseEntityFiltersFromSearchParams,
  type EntityFilterValues,
} from "@/lib/filters/entity-filter-params";
import {
  createActivityRequest,
  fetchActivities,
  fetchAllowedStatusReasons,
  fetchDispatcherSubmissions,
  updateActivityRequest,
} from "@/lib/api/resources";
import { getCarrierDisplayName } from "@/lib/utils/carrier-display";
import { APPROVED, REJECTED } from "@/lib/constants/activity-approval";
import {
  CANCELLED,
  DELIVERED,
  NOT_BOOKED,
  NOT_WORKING,
} from "@/lib/constants/statuses";
import { FILTER_ALL } from "@/lib/constants/filters";
import type { ActivityEditRequestDto, DailyActivity } from "@/lib/types";
import { formatCurrency } from "@/lib/utils/format-currency";
import type { DailyActivityFormValues } from "@/lib/validation/daily-activity-form";

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof ApiClientError ? error.message : fallback;
}

function toCreateActivityPayload(values: DailyActivityFormValues) {
  const base = {
    activityDate: values.date,
    carrierId: values.carrierId,
    status: values.status,
    notes: values.notes?.trim() ? values.notes : undefined,
  };

  if (values.status === DELIVERED) {
    return {
      ...base,
      origin: values.origin,
      destination: values.destination,
      totalMiles: values.totalMiles,
      loadAmount: values.loadAmount,
    };
  }

  return {
    ...base,
    reason: values.reason,
  };
}

function toUpdateActivityPayload(values: DailyActivityFormValues) {
  const base = {
    activityDate: values.date,
    status: values.status,
    notes: values.notes?.trim() ? values.notes : undefined,
  };

  if (values.status === DELIVERED) {
    return {
      ...base,
      origin: values.origin,
      destination: values.destination,
      totalMiles: values.totalMiles,
      loadAmount: values.loadAmount,
    };
  }

  return {
    ...base,
    reason: values.reason,
  };
}

const ACTIVITY_STATUS_META = {
  DELIVERED: {
    label: "Delivered",
    color: "#22C55E",
    pale: "#DCFCE7",
    icon: CheckCircle2,
  },
  CANCELLED: {
    label: "Cancelled",
    color: "#EF4444",
    pale: "#FEE2E2",
    icon: Ban,
  },
  NOT_BOOKED: {
    label: "Not Booked",
    color: "#F59E0B",
    pale: "#FEF3C7",
    icon: PackageCheck,
  },
  BOOKED: {
    label: "Booked",
    color: "#8B5CF6",
    pale: "#F3E8FF",
    icon: PackageCheck,
  },
  IN_TRANSIT: {
    label: "In Transit",
    color: "#2563EB",
    pale: "#DBEAFE",
    icon: Truck,
  },
} as const;

const APPROVAL_META = {
  APPROVED: { label: "Approved", color: "#22C55E" },
  PENDING: { label: "Pending", color: "#F59E0B" },
  REJECTED: { label: "Rejected", color: "#EF4444" },
} as const;

type DashboardStatusKey = keyof typeof ACTIVITY_STATUS_META;
type ApprovalGroup = keyof typeof APPROVAL_META;

type AdminActivityRange = "today" | "this-week" | "this-month" | "custom";

type AdminActivityFilters = {
  range: AdminActivityRange;
  customFrom: string;
  customTo: string;
  teamId: string;
  dispatcherId: string;
  carrierId: string;
  status: string;
  approval: string;
};

type StatusBreakdownRow = {
  key: DashboardStatusKey;
  name: string;
  value: number;
  percent: number;
  fill: string;
};

type ApprovalBreakdownRow = {
  key: ApprovalGroup;
  name: string;
  value: number;
  percent: number;
  fill: string;
};

type DispatcherComparisonRow = {
  id: string;
  name: string;
  delivered: number;
  cancelled: number;
  notBooked: number;
  booked: number;
  inTransit: number;
  total: number;
};

type ActivityDashboardAnalytics = {
  total: number;
  delivered: number;
  cancelled: number;
  notBooked: number;
  booked: number;
  inTransit: number;
  totalLoadAmount: number;
  totalMiles: number;
  avgMilesPerLoad: number;
  avgLoadAmount: number;
  approvalRate: number;
  rejectionRate: number;
  totalGrowth: number | null;
  deliveredGrowth: number | null;
  cancelledGrowth: number | null;
  notBookedGrowth: number | null;
  inTransitGrowth: number | null;
  previousTotal: number;
  statusBreakdown: StatusBreakdownRow[];
  approvalBreakdown: ApprovalBreakdownRow[];
  dispatcherComparison: DispatcherComparisonRow[];
};

const DEFAULT_ADMIN_ACTIVITY_FILTERS: AdminActivityFilters = {
  range: "today",
  customFrom: "",
  customTo: "",
  teamId: FILTER_ALL,
  dispatcherId: FILTER_ALL,
  carrierId: FILTER_ALL,
  status: FILTER_ALL,
  approval: FILTER_ALL,
};

function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(date: Date, days: number): Date {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function parseDateKey(dateKey: string): Date {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year ?? 0, (month ?? 1) - 1, day ?? 1);
}

function resolveAdminActivityDateRange(filters: AdminActivityFilters): {
  dateFrom: string;
  dateTo: string;
} {
  const today = new Date();

  if (filters.range === "custom" && filters.customFrom && filters.customTo) {
    return { dateFrom: filters.customFrom, dateTo: filters.customTo };
  }

  if (filters.range === "this-week") {
    const day = today.getDay();
    const mondayOffset = day === 0 ? -6 : 1 - day;
    return {
      dateFrom: toDateKey(addDays(today, mondayOffset)),
      dateTo: toDateKey(today),
    };
  }

  if (filters.range === "this-month") {
    return {
      dateFrom: toDateKey(new Date(today.getFullYear(), today.getMonth(), 1)),
      dateTo: toDateKey(today),
    };
  }

  return {
    dateFrom: toDateKey(today),
    dateTo: toDateKey(today),
  };
}

function getPreviousDateRange(dateFrom: string, dateTo: string) {
  const from = parseDateKey(dateFrom);
  const to = parseDateKey(dateTo);
  const dayMs = 24 * 60 * 60 * 1000;
  const spanDays = Math.max(
    1,
    Math.round((to.getTime() - from.getTime()) / dayMs) + 1,
  );
  const previousTo = addDays(from, -1);
  const previousFrom = addDays(previousTo, -(spanDays - 1));

  return {
    dateFrom: toDateKey(previousFrom),
    dateTo: toDateKey(previousTo),
  };
}

function buildAdminActivityParams(
  filters: AdminActivityFilters,
  rangeOverride?: { dateFrom: string; dateTo: string },
): Record<string, string> {
  const range = rangeOverride ?? resolveAdminActivityDateRange(filters);
  const params: Record<string, string> = {
    dateFrom: range.dateFrom,
    dateTo: range.dateTo,
  };

  if (filters.teamId !== FILTER_ALL) params.teamId = filters.teamId;
  if (filters.dispatcherId !== FILTER_ALL) {
    params.dispatcherId = filters.dispatcherId;
  }
  if (filters.carrierId !== FILTER_ALL) params.carrierId = filters.carrierId;
  if (
    filters.status !== FILTER_ALL &&
    [DELIVERED, CANCELLED, NOT_BOOKED, NOT_WORKING].some(
      (status) => status === filters.status,
    )
  ) {
    params.status = filters.status;
  }
  if (
    filters.approval !== FILTER_ALL &&
    filters.approval !== "PENDING" &&
    [APPROVED, REJECTED].some((status) => status === filters.approval)
  ) {
    params.approvalStatus = filters.approval;
  }

  return params;
}

function getFilterPeriodLabel(filters: AdminActivityFilters): string {
  if (filters.range === "this-week") return "This Week";
  if (filters.range === "this-month") return "This Month";
  if (filters.range === "custom") return "Custom Range";
  return "Today";
}

function getActivityStatusKey(status: string): DashboardStatusKey | null {
  if (status === DELIVERED) return "DELIVERED";
  if (status === CANCELLED) return "CANCELLED";
  if (status === NOT_BOOKED) return "NOT_BOOKED";
  if (status === "BOOKED") return "BOOKED";
  if (status === "IN_TRANSIT") return "IN_TRANSIT";
  return null;
}

function getApprovalGroup(activity: DailyActivity): ApprovalGroup {
  const status = activity.pendingEditApprovalStatus ?? activity.approvalStatus;
  if (status === APPROVED) return "APPROVED";
  if (status === REJECTED) return "REJECTED";
  return "PENDING";
}

function matchesAdminActivityFilters(
  activity: DailyActivity,
  filters: AdminActivityFilters,
): boolean {
  if (filters.status !== FILTER_ALL) {
    const key = getActivityStatusKey(activity.status);
    if (key !== filters.status && activity.status !== filters.status) {
      return false;
    }
  }

  if (filters.approval !== FILTER_ALL) {
    if (getApprovalGroup(activity) !== filters.approval) {
      return false;
    }
  }

  return true;
}

function calculateGrowth(current: number, previous: number): number | null {
  if (previous === 0) {
    return current === 0 ? null : 100;
  }

  return Math.round(((current - previous) / previous) * 1000) / 10;
}

function formatGrowth(growth: number | null, previous: number): string {
  if (growth === null) {
    return `0% vs previous (${previous.toLocaleString()})`;
  }

  const sign = growth >= 0 ? "+" : "-";
  return `${sign}${Math.abs(growth).toFixed(1)}% vs previous (${previous.toLocaleString()})`;
}

function buildActivityDashboardAnalytics(
  activities: DailyActivity[],
  previousActivities: DailyActivity[],
): ActivityDashboardAnalytics {
  const statusCounts = new Map<DashboardStatusKey, number>(
    Object.keys(ACTIVITY_STATUS_META).map((status) => [
      status as DashboardStatusKey,
      0,
    ]),
  );
  const previousStatusCounts = new Map<DashboardStatusKey, number>(
    Object.keys(ACTIVITY_STATUS_META).map((status) => [
      status as DashboardStatusKey,
      0,
    ]),
  );
  const approvalCounts = new Map<ApprovalGroup, number>(
    Object.keys(APPROVAL_META).map((status) => [status as ApprovalGroup, 0]),
  );
  const dispatcherRows = new Map<string, DispatcherComparisonRow>();

  for (const activity of activities) {
    const statusKey = getActivityStatusKey(activity.status);
    if (statusKey) {
      statusCounts.set(statusKey, (statusCounts.get(statusKey) ?? 0) + 1);
    }

    const approvalGroup = getApprovalGroup(activity);
    approvalCounts.set(
      approvalGroup,
      (approvalCounts.get(approvalGroup) ?? 0) + 1,
    );

    const row =
      dispatcherRows.get(activity.dispatcherId) ??
      ({
        id: activity.dispatcherId,
        name: activity.dispatcherName,
        delivered: 0,
        cancelled: 0,
        notBooked: 0,
        booked: 0,
        inTransit: 0,
        total: 0,
      } satisfies DispatcherComparisonRow);
    if (statusKey === "DELIVERED") row.delivered += 1;
    if (statusKey === "CANCELLED") row.cancelled += 1;
    if (statusKey === "NOT_BOOKED") row.notBooked += 1;
    if (statusKey === "BOOKED") row.booked += 1;
    if (statusKey === "IN_TRANSIT") row.inTransit += 1;
    row.total += 1;
    dispatcherRows.set(activity.dispatcherId, row);
  }

  for (const activity of previousActivities) {
    const statusKey = getActivityStatusKey(activity.status);
    if (statusKey) {
      previousStatusCounts.set(
        statusKey,
        (previousStatusCounts.get(statusKey) ?? 0) + 1,
      );
    }
  }

  const deliveredActivities = activities.filter(
    (activity) => activity.status === DELIVERED,
  );
  const totalLoadAmount = activities.reduce(
    (total, activity) => total + (activity.loadAmount ?? 0),
    0,
  );
  const totalMiles = activities.reduce(
    (total, activity) => total + (activity.miles ?? 0),
    0,
  );
  const approvalTotal = activities.length;
  const approved = approvalCounts.get("APPROVED") ?? 0;
  const rejected = approvalCounts.get("REJECTED") ?? 0;

  return {
    total: activities.length,
    delivered: statusCounts.get("DELIVERED") ?? 0,
    cancelled: statusCounts.get("CANCELLED") ?? 0,
    notBooked: statusCounts.get("NOT_BOOKED") ?? 0,
    booked: statusCounts.get("BOOKED") ?? 0,
    inTransit: statusCounts.get("IN_TRANSIT") ?? 0,
    totalLoadAmount,
    totalMiles,
    avgMilesPerLoad:
      deliveredActivities.length > 0
        ? totalMiles / deliveredActivities.length
        : 0,
    avgLoadAmount:
      deliveredActivities.length > 0
        ? totalLoadAmount / deliveredActivities.length
        : 0,
    approvalRate: approvalTotal > 0 ? (approved / approvalTotal) * 100 : 0,
    rejectionRate: approvalTotal > 0 ? (rejected / approvalTotal) * 100 : 0,
    totalGrowth: calculateGrowth(activities.length, previousActivities.length),
    deliveredGrowth: calculateGrowth(
      statusCounts.get("DELIVERED") ?? 0,
      previousStatusCounts.get("DELIVERED") ?? 0,
    ),
    cancelledGrowth: calculateGrowth(
      statusCounts.get("CANCELLED") ?? 0,
      previousStatusCounts.get("CANCELLED") ?? 0,
    ),
    notBookedGrowth: calculateGrowth(
      statusCounts.get("NOT_BOOKED") ?? 0,
      previousStatusCounts.get("NOT_BOOKED") ?? 0,
    ),
    inTransitGrowth: calculateGrowth(
      statusCounts.get("IN_TRANSIT") ?? 0,
      previousStatusCounts.get("IN_TRANSIT") ?? 0,
    ),
    previousTotal: previousActivities.length,
    statusBreakdown: (
      Object.entries(ACTIVITY_STATUS_META) as Array<
        [DashboardStatusKey, (typeof ACTIVITY_STATUS_META)[DashboardStatusKey]]
      >
    ).map(([key, meta]) => {
      const value = statusCounts.get(key) ?? 0;
      return {
        key,
        name: meta.label,
        value,
        percent: activities.length > 0 ? (value / activities.length) * 100 : 0,
        fill: meta.color,
      };
    }),
    approvalBreakdown: (
      Object.entries(APPROVAL_META) as Array<
        [ApprovalGroup, (typeof APPROVAL_META)[ApprovalGroup]]
      >
    ).map(([key, meta]) => {
      const value = approvalCounts.get(key) ?? 0;
      return {
        key,
        name: meta.label,
        value,
        percent: activities.length > 0 ? (value / activities.length) * 100 : 0,
        fill: meta.color,
      };
    }),
    dispatcherComparison: [...dispatcherRows.values()]
      .sort((left, right) => right.total - left.total)
      .slice(0, 10),
  };
}

type ActivitiesPageContentProps = {
  compact?: boolean;
  /**
   * Controls whether the role scope banner and entity filter bar render.
   * Disabled on the Admin Activities page, which shows only the title,
   * action buttons, and the activities table.
   */
  showScopeAndFilters?: boolean;
};

function ActivitiesPageContentInner({
  compact = false,
  showScopeAndFilters = true,
}: ActivitiesPageContentProps) {
  const searchParams = useSearchParams();
  const searchParamKey = searchParams.toString();
  const urlEntityFilters = useMemo(
    () =>
      parseEntityFiltersFromSearchParams(new URLSearchParams(searchParamKey)),
    [searchParamKey],
  );
  const urlExcelFilters = useMemo(
    () =>
      parseActivityExcelFiltersFromSearchParams(
        new URLSearchParams(searchParamKey),
      ),
    [searchParamKey],
  );

  return (
    <ActivitiesPageState
      key={searchParamKey}
      initialEntityFilters={urlEntityFilters}
      initialExcelFilters={urlExcelFilters}
      compact={compact}
      showScopeAndFilters={showScopeAndFilters}
    />
  );
}

function ActivitiesPageState({
  initialEntityFilters,
  initialExcelFilters,
  compact,
  showScopeAndFilters,
}: {
  initialEntityFilters: EntityFilterValues;
  initialExcelFilters: ActivityExcelFilterState;
  compact: boolean;
  showScopeAndFilters: boolean;
}) {
  const { session } = useSession();
  const isDispatcher = session?.role === DISPATCHER;
  const isAdminDashboard = !compact && !showScopeAndFilters;
  const [draftFilters, setDraftFilters] =
    useState<EntityFilterValues>(initialEntityFilters);
  const [appliedFilters, setAppliedFilters] =
    useState<EntityFilterValues>(initialEntityFilters);
  const [excelAppliedFilters, setExcelAppliedFilters] =
    useState<ActivityExcelFilterState>(initialExcelFilters);
  const [dashboardDraftFilters, setDashboardDraftFilters] =
    useState<AdminActivityFilters>(DEFAULT_ADMIN_ACTIVITY_FILTERS);
  const [dashboardAppliedFilters, setDashboardAppliedFilters] =
    useState<AdminActivityFilters>(DEFAULT_ADMIN_ACTIVITY_FILTERS);
  const [dashboardFiltersOpen, setDashboardFiltersOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<ActivityModalMode>("create");
  const [selectedActivity, setSelectedActivity] =
    useState<DailyActivity | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const loadActivities = useCallback(() => {
    const params = isAdminDashboard
      ? buildAdminActivityParams(dashboardAppliedFilters)
      : compact
        ? activityExcelFiltersToParams(excelAppliedFilters)
        : entityFiltersToActivityParams(appliedFilters);

    return fetchActivities(params);
  }, [
    appliedFilters,
    compact,
    dashboardAppliedFilters,
    excelAppliedFilters,
    isAdminDashboard,
  ]);
  const loadPreviousActivities = useCallback(() => {
    const currentRange = resolveAdminActivityDateRange(dashboardAppliedFilters);
    const previousRange = getPreviousDateRange(
      currentRange.dateFrom,
      currentRange.dateTo,
    );

    return fetchActivities(
      buildAdminActivityParams(dashboardAppliedFilters, previousRange),
    );
  }, [dashboardAppliedFilters]);
  const loadAllowedReasons = useCallback(() => fetchAllowedStatusReasons(), []);
  const { carriers, teams, dispatchers } = useEntityOptions();

  const {
    data: activities = [],
    error,
    isLoading,
    isEmpty,
    reload,
  } = useApiData(loadActivities, [
    isAdminDashboard
      ? dashboardAppliedFilters
      : compact
        ? excelAppliedFilters
        : appliedFilters,
    compact,
    isAdminDashboard,
  ]);
  const {
    data: previousActivities = [],
    isLoading: previousActivitiesLoading,
    reload: reloadPreviousActivities,
  } = useApiData(loadPreviousActivities, [dashboardAppliedFilters], {
    enabled: isAdminDashboard,
  });
  const { data: allowedStatusReasons = [] } = useApiData(
    loadAllowedReasons,
    [],
  );

  const loadSubmissions = useCallback(() => fetchDispatcherSubmissions(), []);
  const { data: submissions = [], reload: reloadSubmissions } = useApiData(
    loadSubmissions,
    [],
    { enabled: isDispatcher },
  );

  const editRequestByActivityId = useMemo(() => {
    const map = new Map<string, ActivityEditRequestDto>();

    for (const item of submissions) {
      if (item.kind !== "edit_request" || !item.editRequest) {
        continue;
      }

      const activityId = item.editRequest.originalActivityId;
      const existing = map.get(activityId);

      if (
        !existing ||
        new Date(item.editRequest.editedAt).getTime() >
          new Date(existing.editedAt).getTime()
      ) {
        map.set(activityId, item.editRequest);
      }
    }

    return map;
  }, [submissions]);

  const refreshAll = useCallback(() => {
    void reload();
    if (isAdminDashboard) {
      void reloadPreviousActivities();
    }
    if (isDispatcher) {
      void reloadSubmissions();
    }
  }, [
    isAdminDashboard,
    isDispatcher,
    reload,
    reloadPreviousActivities,
    reloadSubmissions,
  ]);

  const activityRealtimeTables = useMemo(
    () => ["DailyActivity", "ActivityEditRequest"] as const,
    [],
  );

  useRealtimeRefresh(activityRealtimeTables, refreshAll);

  const carrierNameById = useMemo(
    () =>
      new Map(
        carriers.map((carrier) => [carrier.id, getCarrierDisplayName(carrier)]),
      ),
    [carriers],
  );

  const visibleActivities = useMemo(
    () =>
      isAdminDashboard
        ? activities.filter((activity) =>
            matchesAdminActivityFilters(activity, dashboardAppliedFilters),
          )
        : activities,
    [activities, dashboardAppliedFilters, isAdminDashboard],
  );
  const visiblePreviousActivities = useMemo(
    () =>
      previousActivities.filter((activity) =>
        matchesAdminActivityFilters(activity, dashboardAppliedFilters),
      ),
    [dashboardAppliedFilters, previousActivities],
  );
  const dashboardAnalytics = useMemo(
    () =>
      buildActivityDashboardAnalytics(
        visibleActivities,
        visiblePreviousActivities,
      ),
    [visibleActivities, visiblePreviousActivities],
  );
  const dashboardPeriodLabel = getFilterPeriodLabel(dashboardAppliedFilters);
  const dashboardExportFilters = useMemo<EntityFilterValues>(
    () => ({
      dateRange:
        dashboardAppliedFilters.range === "this-week"
          ? "last-7-days"
          : dashboardAppliedFilters.range === "this-month"
            ? "this-month"
            : "today",
      teamId: dashboardAppliedFilters.teamId,
      dispatcherId: dashboardAppliedFilters.dispatcherId,
      carrierId: dashboardAppliedFilters.carrierId,
      truckType: FILTER_ALL,
      status:
        dashboardAppliedFilters.status !== FILTER_ALL &&
        dashboardAppliedFilters.status !== "BOOKED" &&
        dashboardAppliedFilters.status !== "IN_TRANSIT"
          ? dashboardAppliedFilters.status
          : FILTER_ALL,
    }),
    [dashboardAppliedFilters],
  );

  const pageState: PageContentState = isLoading
    ? "loading"
    : isAdminDashboard && previousActivitiesLoading
      ? "loading"
      : error
        ? "error"
        : isAdminDashboard
          ? "ready"
          : isEmpty || visibleActivities.length === 0
            ? "empty"
            : "ready";

  const showToast = useCallback((message: string) => {
    setToastMessage(message);
  }, []);

  function openModal(
    mode: ActivityModalMode,
    activity: DailyActivity | null = null,
  ) {
    setSelectedActivity(activity);
    setModalMode(mode);
    setModalOpen(true);
  }

  function handleRowAction(activity: DailyActivity, action: ActivityRowAction) {
    openModal(action, activity);
  }

  async function handleCreate(values: DailyActivityFormValues) {
    const carrierName = carrierNameById.get(values.carrierId) ?? "carrier";

    try {
      await createActivityRequest(toCreateActivityPayload(values));
      showToast(
        session?.role === DISPATCHER
          ? `Activity for "${carrierName}" submitted for approval.`
          : `Activity for "${carrierName}" added successfully.`,
      );
      await reload();
      if (isAdminDashboard) {
        await reloadPreviousActivities();
      }
    } catch (err) {
      showToast(getErrorMessage(err, "Failed to create activity."));
      throw err;
    }
  }

  async function handleEdit(values: DailyActivityFormValues) {
    if (!selectedActivity) {
      return;
    }

    const carrierName =
      carrierNameById.get(values.carrierId) ?? selectedActivity.carrierName;

    try {
      await updateActivityRequest(
        selectedActivity.id,
        toUpdateActivityPayload(values),
      );
      showToast(
        session?.role === DISPATCHER &&
          selectedActivity.approvalStatus === "APPROVED"
          ? `Edit request for "${carrierName}" submitted for approval. The approved activity remains active until review.`
          : selectedActivity.approvalStatus === "APPROVED"
            ? `Activity for "${carrierName}" updated successfully.`
            : `Activity for "${carrierName}" resubmitted for approval.`,
      );
      await reload();
      if (isAdminDashboard) {
        await reloadPreviousActivities();
      }
    } catch (err) {
      showToast(getErrorMessage(err, "Failed to update activity."));
      throw err;
    }
  }

  return (
    <>
      <PageShell
        title="Daily Activity"
        description={
          isAdminDashboard
            ? "Track and review daily carrier activity by status, approvals, and performance."
            : compact
              ? undefined
              : "Log and review daily carrier activity by status."
        }
        actions={
          <div className="flex flex-wrap items-center justify-end gap-2">
            {isAdminDashboard ? (
              <Button
                type="button"
                variant="outline"
                className="h-9 rounded-lg border-[#CBD5E1] bg-white px-3 text-[#334155] shadow-sm hover:bg-[#F8FAFC]"
                onClick={() => setDashboardFiltersOpen((open) => !open)}
              >
                <Filter className="size-4" />
                Filters
              </Button>
            ) : null}
            {compact ? (
              <ActivitiesExcelFilterControls
                appliedFilters={excelAppliedFilters}
                onApplyFilters={setExcelAppliedFilters}
              />
            ) : null}
            <ActivitiesPdfExportButton
              activities={visibleActivities}
              compact={compact}
              entityFilters={
                isAdminDashboard ? dashboardExportFilters : appliedFilters
              }
              excelFilters={excelAppliedFilters}
              teams={teams}
              dispatchers={dispatchers}
              carriers={carriers}
              includeAllStatuses={isDispatcher}
              includeApprovalDetails={isDispatcher}
              disabled={isLoading || Boolean(error)}
              onSuccess={() =>
                showToast("Daily activities PDF exported successfully.")
              }
              onError={(message) => showToast(message)}
            />
            <Button type="button" onClick={() => openModal("create")}>
              {isAdminDashboard ? <Plus className="size-4" /> : null}
              Add Activity
            </Button>
          </div>
        }
      >
        {!isAdminDashboard && !compact && showScopeAndFilters ? (
          <RoleScopeBanner />
        ) : null}

        {!isAdminDashboard && !compact && showScopeAndFilters ? (
          <EntityFilterBar
            values={draftFilters}
            onChange={setDraftFilters}
            onApply={() => setAppliedFilters(draftFilters)}
            showDateRange
          />
        ) : null}

        {isAdminDashboard ? (
          <div className="-m-4 space-y-6 bg-[#F6F8FB] p-4 md:-m-6 md:p-6 lg:-m-8 lg:p-8">
            {dashboardFiltersOpen ? (
              <AdminActivityFilterPanel
                values={dashboardDraftFilters}
                onChange={setDashboardDraftFilters}
                onApply={() => {
                  setDashboardAppliedFilters(dashboardDraftFilters);
                  setDashboardFiltersOpen(false);
                }}
                onReset={() => {
                  setDashboardDraftFilters(DEFAULT_ADMIN_ACTIVITY_FILTERS);
                  setDashboardAppliedFilters(DEFAULT_ADMIN_ACTIVITY_FILTERS);
                }}
              />
            ) : null}

            <PageContentGate
              state={pageState}
              onRetry={refreshAll}
              loadingTitle="Loading activity dashboard"
              emptyTitle="No activities logged"
              emptyDescription="Add a daily activity to start tracking carrier performance."
              emptyActionLabel="Add Activity"
              onEmptyAction={() => openModal("create")}
              errorTitle="Unable to load activity dashboard"
              errorDescription={
                error ??
                "Daily activities could not be loaded. Try again in a moment."
              }
            >
              <ActivityKpiGrid analytics={dashboardAnalytics} />
              <ActivityCharts
                analytics={dashboardAnalytics}
                periodLabel={dashboardPeriodLabel}
              />
              <ActivitiesTable
                activities={visibleActivities}
                onAction={handleRowAction}
                variant="dashboard"
              />
            </PageContentGate>
          </div>
        ) : (
          <PageContentGate
            state={pageState}
            onRetry={reload}
            loadingTitle="Loading activities"
            emptyTitle="No activities logged"
            emptyDescription="Add a daily activity to start tracking carrier performance."
            emptyActionLabel="Add Activity"
            onEmptyAction={() => openModal("create")}
            errorTitle="Unable to load activities"
            errorDescription={
              error ??
              "Daily activities could not be loaded. Try again in a moment."
            }
          >
            <ActivitiesTable
              activities={visibleActivities}
              onAction={handleRowAction}
            />
          </PageContentGate>
        )}
      </PageShell>

      <ActivityModal
        open={modalOpen}
        mode={modalMode}
        activity={selectedActivity}
        pendingEditRequest={
          selectedActivity
            ? (editRequestByActivityId.get(selectedActivity.id) ?? null)
            : null
        }
        allowedStatusReasons={allowedStatusReasons}
        onOpenChange={setModalOpen}
        onCreate={handleCreate}
        onEdit={handleEdit}
      />

      <AppToast
        message={toastMessage}
        onDismiss={() => setToastMessage(null)}
      />
    </>
  );
}

function AdminActivityFilterPanel({
  values,
  onChange,
  onApply,
  onReset,
}: {
  values: AdminActivityFilters;
  onChange: (values: AdminActivityFilters) => void;
  onApply: () => void;
  onReset: () => void;
}) {
  function updateField<K extends keyof AdminActivityFilters>(
    field: K,
    value: AdminActivityFilters[K],
  ) {
    onChange({ ...values, [field]: value });
  }

  return (
    <section className="rounded-2xl border border-[#E2E8F0] bg-white p-4 shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-[#0F172A]">Filters</h2>
          <p className="mt-1 text-xs text-[#64748B]">
            Switch between daily, weekly, monthly, and custom activity tracking.
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
        <div>
          <p className="mb-1 text-xs font-medium text-[#64748B]">Date Range</p>
          <Select
            value={values.range}
            onValueChange={(value) => {
              if (value) updateField("range", value as AdminActivityRange);
            }}
          >
            <SelectTrigger className="w-full" size="sm">
              <SelectValue placeholder="Date range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="this-week">This Week</SelectItem>
              <SelectItem value="this-month">This Month</SelectItem>
              <SelectItem value="custom">Custom Range</SelectItem>
            </SelectContent>
          </Select>
        </div>
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
        <div>
          <p className="mb-1 text-xs font-medium text-[#64748B]">Status</p>
          <Select
            value={values.status}
            onValueChange={(value) => {
              if (value) updateField("status", value);
            }}
          >
            <SelectTrigger className="w-full" size="sm">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={FILTER_ALL}>All statuses</SelectItem>
              {(
                Object.entries(ACTIVITY_STATUS_META) as Array<
                  [
                    DashboardStatusKey,
                    (typeof ACTIVITY_STATUS_META)[DashboardStatusKey],
                  ]
                >
              ).map(([key, meta]) => (
                <SelectItem key={key} value={key}>
                  {meta.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <p className="mb-1 text-xs font-medium text-[#64748B]">Approval</p>
          <Select
            value={values.approval}
            onValueChange={(value) => {
              if (value) updateField("approval", value);
            }}
          >
            <SelectTrigger className="w-full" size="sm">
              <SelectValue placeholder="Approval" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={FILTER_ALL}>All approvals</SelectItem>
              <SelectItem value="APPROVED">Approved</SelectItem>
              <SelectItem value="PENDING">Pending</SelectItem>
              <SelectItem value="REJECTED">Rejected</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      {values.range === "custom" ? (
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:max-w-xl">
          <div>
            <p className="mb-1 text-xs font-medium text-[#64748B]">From</p>
            <Input
              type="date"
              value={values.customFrom}
              onChange={(event) =>
                updateField("customFrom", event.target.value)
              }
              className="h-9"
            />
          </div>
          <div>
            <p className="mb-1 text-xs font-medium text-[#64748B]">To</p>
            <Input
              type="date"
              value={values.customTo}
              onChange={(event) => updateField("customTo", event.target.value)}
              className="h-9"
            />
          </div>
        </div>
      ) : null}
    </section>
  );
}

function ActivityKpiGrid({
  analytics,
}: {
  analytics: ActivityDashboardAnalytics;
}) {
  return (
    <section className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,210px),1fr))] gap-4">
      <ActivityKpiCard
        title="Total Activities"
        value={analytics.total.toLocaleString()}
        helper={formatGrowth(analytics.totalGrowth, analytics.previousTotal)}
        icon={Route}
        accent="#2563EB"
        iconBackground="#DBEAFE"
      />
      <ActivityKpiCard
        title="Delivered"
        value={analytics.delivered.toLocaleString()}
        helper={formatGrowth(analytics.deliveredGrowth, 0)}
        icon={CheckCircle2}
        accent={ACTIVITY_STATUS_META.DELIVERED.color}
        iconBackground={ACTIVITY_STATUS_META.DELIVERED.pale}
      />
      <ActivityKpiCard
        title="Cancelled"
        value={analytics.cancelled.toLocaleString()}
        helper={formatGrowth(analytics.cancelledGrowth, 0)}
        icon={Ban}
        accent={ACTIVITY_STATUS_META.CANCELLED.color}
        iconBackground={ACTIVITY_STATUS_META.CANCELLED.pale}
      />
      <ActivityKpiCard
        title="Not Booked"
        value={analytics.notBooked.toLocaleString()}
        helper={formatGrowth(analytics.notBookedGrowth, 0)}
        icon={PackageCheck}
        accent={ACTIVITY_STATUS_META.NOT_BOOKED.color}
        iconBackground={ACTIVITY_STATUS_META.NOT_BOOKED.pale}
      />
      <ActivityKpiCard
        title="In Transit"
        value={analytics.inTransit.toLocaleString()}
        helper={formatGrowth(analytics.inTransitGrowth, 0)}
        icon={Truck}
        accent={ACTIVITY_STATUS_META.IN_TRANSIT.color}
        iconBackground={ACTIVITY_STATUS_META.IN_TRANSIT.pale}
      />
    </section>
  );
}

function ActivityKpiCard({
  title,
  value,
  helper,
  icon: Icon,
  accent,
  iconBackground,
}: {
  title: string;
  value: string;
  helper: string;
  icon: LucideIcon;
  accent: string;
  iconBackground: string;
}) {
  return (
    <article className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.05)] transition hover:-translate-y-0.5 hover:shadow-[0_16px_36px_rgba(15,23,42,0.08)]">
      <div className="flex items-start gap-4">
        <div
          className="flex size-11 shrink-0 items-center justify-center rounded-2xl"
          style={{ backgroundColor: iconBackground, color: accent }}
        >
          <Icon className="size-5" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[#334155]">{title}</p>
          <p className="mt-1 text-2xl font-bold tracking-tight text-[#0F172A]">
            {value}
          </p>
          <p className="mt-2 text-xs font-medium text-[#64748B]">{helper}</p>
        </div>
      </div>
    </article>
  );
}

function ActivityCharts({
  analytics,
  periodLabel,
}: {
  analytics: ActivityDashboardAnalytics;
  periodLabel: string;
}) {
  return (
    <section className="space-y-4">
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,340px),1fr))] gap-4 2xl:grid-cols-3">
        <ActivityChartCard title="Activity Status Breakdown">
          <ActivityStatusDonut
            rows={analytics.statusBreakdown}
            total={analytics.total}
          />
        </ActivityChartCard>
        <ActivityChartCard title="Approval Summary">
          <ApprovalDonut
            rows={analytics.approvalBreakdown}
            total={analytics.total}
          />
        </ActivityChartCard>
        <ActivityChartCard title="Daily Activity Comparison">
          <DailyActivityComparison rows={analytics.statusBreakdown} />
        </ActivityChartCard>
      </div>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(320px,0.75fr)]">
        <ActivityChartCard title="Dispatcher Activity Comparison" showOptions>
          <DispatcherActivityComparison rows={analytics.dispatcherComparison} />
        </ActivityChartCard>
        <QuickStatsPanel analytics={analytics} periodLabel={periodLabel} />
      </div>
    </section>
  );
}

function ActivityChartCard({
  title,
  showOptions = false,
  children,
}: {
  title: string;
  showOptions?: boolean;
  children: ReactNode;
}) {
  return (
    <article className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
      <div className="mb-5 flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-[#0F172A]">{title}</h2>
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

function ActivityStatusTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: TooltipPayload<StatusBreakdownRow>;
}) {
  const row = payload?.[0]?.payload;
  if (!active || !row) return null;

  return (
    <ChartTooltipShell title={row.name}>
      <TooltipLine label="Count" value={row.value.toLocaleString()} />
      <TooltipLine label="Share" value={`${row.percent.toFixed(1)}%`} />
    </ChartTooltipShell>
  );
}

function ApprovalTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: TooltipPayload<ApprovalBreakdownRow>;
}) {
  const row = payload?.[0]?.payload;
  if (!active || !row) return null;

  return (
    <ChartTooltipShell title={row.name}>
      <TooltipLine label="Count" value={row.value.toLocaleString()} />
      <TooltipLine label="Share" value={`${row.percent.toFixed(1)}%`} />
    </ChartTooltipShell>
  );
}

function DispatcherTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: TooltipPayload<DispatcherComparisonRow>;
  label?: string;
}) {
  const row = payload?.[0]?.payload;
  if (!active || !row) return null;

  return (
    <ChartTooltipShell title={label ?? row.name}>
      <TooltipLine label="Delivered" value={row.delivered.toLocaleString()} />
      <TooltipLine label="Cancelled" value={row.cancelled.toLocaleString()} />
      <TooltipLine label="Not Booked" value={row.notBooked.toLocaleString()} />
      <TooltipLine label="Booked" value={row.booked.toLocaleString()} />
      <TooltipLine label="In Transit" value={row.inTransit.toLocaleString()} />
      <TooltipLine label="Total" value={row.total.toLocaleString()} />
    </ChartTooltipShell>
  );
}

function DonutLegend({
  rows,
}: {
  rows: Array<{
    key: string;
    name: string;
    value: number;
    percent: number;
    fill: string;
  }>;
}) {
  return (
    <div className="space-y-3">
      {rows.map((row) => (
        <div
          key={row.key}
          className="flex items-center justify-between gap-3 text-xs"
        >
          <div className="flex min-w-0 items-center gap-2">
            <span
              className="size-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: row.fill }}
            />
            <span className="truncate font-medium text-[#334155]">
              {row.name}
            </span>
          </div>
          <span className="shrink-0 font-semibold text-[#0F172A]">
            {row.value} ({row.percent.toFixed(1)}%)
          </span>
        </div>
      ))}
    </div>
  );
}

function ActivityStatusDonut({
  rows,
  total,
}: {
  rows: StatusBreakdownRow[];
  total: number;
}) {
  if (total === 0) {
    return <EmptyChart label="No activity status data for this period." />;
  }

  return (
    <div className="grid min-h-[300px] grid-cols-1 items-center gap-4 2xl:grid-cols-[minmax(0,1fr)_170px]">
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
                <Cell key={row.key} fill={row.fill} />
              ))}
            </Pie>
            <Tooltip content={<ActivityStatusTooltip />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold text-[#0F172A]">
            {total.toLocaleString()}
          </span>
          <span className="text-xs font-medium text-[#64748B]">
            Total Activities
          </span>
        </div>
      </div>
      <DonutLegend rows={rows} />
    </div>
  );
}

function ApprovalDonut({
  rows,
  total,
}: {
  rows: ApprovalBreakdownRow[];
  total: number;
}) {
  if (total === 0) {
    return <EmptyChart label="No approval data for this period." />;
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
                <Cell key={row.key} fill={row.fill} />
              ))}
            </Pie>
            <Tooltip content={<ApprovalTooltip />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold text-[#0F172A]">
            {total.toLocaleString()}
          </span>
          <span className="text-xs font-medium text-[#64748B]">Total</span>
        </div>
      </div>
      <DonutLegend rows={rows} />
    </div>
  );
}

function DailyActivityComparison({ rows }: { rows: StatusBreakdownRow[] }) {
  if (rows.every((row) => row.value === 0)) {
    return <EmptyChart label="No status comparison data for this period." />;
  }

  return (
    <div className="h-[300px]">
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
            content={<ActivityStatusTooltip />}
            cursor={{ fill: "#F8FAFC" }}
          />
          <Bar dataKey="value" radius={[8, 8, 0, 0]} barSize={34}>
            {rows.map((row) => (
              <Cell key={row.key} fill={row.fill} />
            ))}
            <LabelList
              dataKey="value"
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

function DispatcherActivityComparison({
  rows,
}: {
  rows: DispatcherComparisonRow[];
}) {
  if (rows.length === 0) {
    return <EmptyChart label="No dispatcher activity data for this period." />;
  }

  return (
    <div className="h-[340px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={rows}
          margin={{ top: 8, right: 12, left: 0, bottom: 20 }}
        >
          <CartesianGrid stroke="#E2E8F0" vertical={false} />
          <XAxis
            dataKey="name"
            tick={{ fill: "#64748B", fontSize: 12 }}
            tickLine={false}
            axisLine={false}
            interval={0}
            angle={-12}
            textAnchor="end"
            height={58}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fill: "#64748B", fontSize: 12 }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip content={<DispatcherTooltip />} />
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
            fill={ACTIVITY_STATUS_META.DELIVERED.color}
          />
          <Bar
            name="Cancelled"
            dataKey="cancelled"
            stackId="status"
            fill={ACTIVITY_STATUS_META.CANCELLED.color}
          />
          <Bar
            name="Not Booked"
            dataKey="notBooked"
            stackId="status"
            fill={ACTIVITY_STATUS_META.NOT_BOOKED.color}
          />
          <Bar
            name="Booked"
            dataKey="booked"
            stackId="status"
            fill={ACTIVITY_STATUS_META.BOOKED.color}
          />
          <Bar
            name="In Transit"
            dataKey="inTransit"
            stackId="status"
            fill={ACTIVITY_STATUS_META.IN_TRANSIT.color}
            radius={[8, 8, 0, 0]}
          >
            <LabelList
              dataKey="total"
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

function QuickStatsPanel({
  analytics,
  periodLabel,
}: {
  analytics: ActivityDashboardAnalytics;
  periodLabel: string;
}) {
  const stats = [
    {
      label: "Total Load Amount",
      value: formatCurrency(analytics.totalLoadAmount, {
        currency: "USD",
        maximumFractionDigits: 0,
      }),
    },
    {
      label: "Total Miles",
      value: Math.round(analytics.totalMiles).toLocaleString(),
    },
    {
      label: "Avg. Miles per Load",
      value: analytics.avgMilesPerLoad.toFixed(1),
    },
    {
      label: "Avg. Load Amount",
      value: formatCurrency(analytics.avgLoadAmount, {
        currency: "USD",
        maximumFractionDigits: 0,
      }),
    },
    { label: "Approval Rate", value: `${analytics.approvalRate.toFixed(1)}%` },
    {
      label: "Rejection Rate",
      value: `${analytics.rejectionRate.toFixed(1)}%`,
    },
  ];

  return (
    <article className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
      <div className="mb-5 flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-[#0F172A]">
          Quick Stats ({periodLabel})
        </h2>
        <FileText className="size-4 text-[#94A3B8]" />
      </div>
      <div className="divide-y divide-[#E2E8F0]">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="flex items-center justify-between gap-4 py-3 text-sm"
          >
            <span className="text-[#64748B]">{stat.label}</span>
            <span className="font-semibold text-[#0F172A]">{stat.value}</span>
          </div>
        ))}
      </div>
    </article>
  );
}

export function ActivitiesPageContent({
  compact = false,
  showScopeAndFilters = true,
}: ActivitiesPageContentProps = {}) {
  return (
    <Suspense
      fallback={
        <div className="py-10 text-sm text-[#64748B]">
          Loading activities...
        </div>
      }
    >
      <ActivitiesPageContentInner
        compact={compact}
        showScopeAndFilters={showScopeAndFilters}
      />
    </Suspense>
  );
}
