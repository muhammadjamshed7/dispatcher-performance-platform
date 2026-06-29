import "server-only";

import { z } from "zod";
import type { LoadActivityStatus } from "@/lib/db/types";
import {
  CANCELLED,
  DELIVERED,
  NOT_BOOKED,
  NOT_WORKING,
  STATUSES,
} from "@/lib/constants/statuses";
import { T, db } from "@/lib/db/client";
import { assertDb, toAmount, unwrapRelation } from "@/lib/db/utils";
import type { AdminDailyReportBundle } from "@/lib/types";
import type { AccessScope } from "@/server/auth/types";
import { getOrganizationPreferences } from "@/server/services/settings.service";
import { APPROVED } from "@/lib/constants/activity-approval";
import { getDateKeyInTimeZone } from "@/lib/utils/resolve-date-range";

const dailyReportFiltersSchema = z.object({
  date: z.string().min(1),
  teamId: z.string().optional(),
  dispatcherId: z.string().optional(),
  status: z.enum(STATUSES).optional(),
});

export type AdminDailyReportFilters = z.infer<typeof dailyReportFiltersSchema>;

const STATUS_META: Record<
  LoadActivityStatus,
  { label: string; color: string }
> = {
  DELIVERED: { label: "Delivered", color: "#22C55E" },
  CANCELLED: { label: "Cancelled", color: "#EF4444" },
  NOT_BOOKED: { label: "Not Booked", color: "#F97316" },
  NOT_WORKING: { label: "Not Working", color: "#3B82F6" },
};

function formatTime(value: string): string {
  return new Date(value).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

async function loadFilterOptions(organizationId: string) {
  const [teamsResult, dispatchersResult] = await Promise.all([
    db()
      .from(T.Team)
      .select("id, name")
      .eq("organizationId", organizationId)
      .is("deletedAt", null)
      .eq("status", "ACTIVE")
      .order("name", { ascending: true }),
    db()
      .from(T.Dispatcher)
      .select("id, teamId, user:User!Dispatcher_userId_fkey(fullName)")
      .eq("organizationId", organizationId)
      .is("deletedAt", null)
      .eq("status", "ACTIVE"),
  ]);

  const teams = assertDb(teamsResult) ?? [];
  const dispatchersRaw = assertDb(dispatchersResult) ?? [];

  const dispatchers = (
    dispatchersRaw as Array<{
      id: string;
      teamId: string;
      user: { fullName: string } | Array<{ fullName: string }>;
    }>
  )
    .map((dispatcher) => ({
      id: dispatcher.id,
      name: unwrapRelation(dispatcher.user)?.fullName ?? "",
      teamId: dispatcher.teamId,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return {
    teams: teams as Array<{ id: string; name: string }>,
    dispatchers,
    statuses: STATUSES.map((status) => ({
      value: status,
      label: STATUS_META[status].label,
    })),
  };
}

export async function getAdminDailyReportBundle(
  scope: AccessScope,
  rawFilters: Partial<AdminDailyReportFilters> = {},
): Promise<AdminDailyReportBundle> {
  const preferences = await getOrganizationPreferences(scope.organizationId);
  const today = getDateKeyInTimeZone(new Date(), preferences.timezone);
  const parsed = dailyReportFiltersSchema.parse({
    date: rawFilters.date ?? today,
    teamId: rawFilters.teamId,
    dispatcherId: rawFilters.dispatcherId,
    status: rawFilters.status,
  });

  let activityQuery = db()
    .from(T.DailyActivity)
    .select(
      "id, createdAt, status, teamNameSnapshot, dispatcherNameSnapshot, carrierNameSnapshot, loadAmount, dispatchFee, origin, destination, dispatcherId, carrierId",
    )
    .eq("organizationId", scope.organizationId)
    .eq("activityDate", parsed.date)
    .eq("approvalStatus", APPROVED)
    .order("createdAt", { ascending: false });

  if (parsed.teamId) {
    activityQuery = activityQuery.eq("teamId", parsed.teamId);
  }

  if (parsed.dispatcherId) {
    activityQuery = activityQuery.eq("dispatcherId", parsed.dispatcherId);
  }

  if (parsed.status) {
    activityQuery = activityQuery.eq("status", parsed.status);
  }

  const [activitiesResult, filterOptions] = await Promise.all([
    activityQuery,
    loadFilterOptions(scope.organizationId),
  ]);

  const activities = (assertDb(activitiesResult) ?? []) as Array<{
    id: string;
    createdAt: string;
    status: LoadActivityStatus;
    teamNameSnapshot: string;
    dispatcherNameSnapshot: string;
    carrierNameSnapshot: string;
    loadAmount: string | null;
    dispatchFee: string | null;
    origin: string | null;
    destination: string | null;
    dispatcherId: string;
    carrierId: string;
  }>;

  const delivered = activities.filter((row) => row.status === DELIVERED);
  const totalRevenue = delivered.reduce(
    (sum, row) => sum + toAmount(row.loadAmount),
    0,
  );
  const dispatchFees = delivered.reduce(
    (sum, row) => sum + toAmount(row.dispatchFee),
    0,
  );

  const activeDispatcherIds = new Set(
    activities.map((row) => row.dispatcherId),
  );
  const activeCarrierIds = new Set(activities.map((row) => row.carrierId));

  const teamDeliveredMap = new Map<string, number>();
  const teamRevenueMap = new Map<string, number>();

  for (const row of delivered) {
    const team = row.teamNameSnapshot;
    teamDeliveredMap.set(team, (teamDeliveredMap.get(team) ?? 0) + 1);
    const amount = toAmount(row.loadAmount);
    teamRevenueMap.set(team, (teamRevenueMap.get(team) ?? 0) + amount);
  }

  const statusCounts = new Map<LoadActivityStatus, number>();
  for (const row of activities) {
    statusCounts.set(row.status, (statusCounts.get(row.status) ?? 0) + 1);
  }

  const totalActivities = activities.length;
  const statusBreakdown = STATUSES.map((status) => {
    const value = statusCounts.get(status) ?? 0;
    const percent =
      totalActivities > 0
        ? `${Math.round((value / totalActivities) * 1000) / 10}%`
        : "0%";

    return {
      name: STATUS_META[status].label,
      value,
      percent,
      color: STATUS_META[status].color,
    };
  }).filter((item) => item.value > 0);

  return {
    filters: {
      date: parsed.date,
      teamId: parsed.teamId ?? null,
      dispatcherId: parsed.dispatcherId ?? null,
      status: parsed.status ?? null,
    },
    summary: {
      totalActivities,
      deliveredLoads: statusCounts.get(DELIVERED) ?? 0,
      cancelledLoads: statusCounts.get(CANCELLED) ?? 0,
      notBooked: statusCounts.get(NOT_BOOKED) ?? 0,
      notWorking: statusCounts.get(NOT_WORKING) ?? 0,
      totalRevenue,
      dispatchFees,
      activeDispatchers: activeDispatcherIds.size,
      activeCarriers: activeCarrierIds.size,
    },
    teamComparison: [...teamDeliveredMap.entries()]
      .map(([team, deliveredLoads]) => ({ team, deliveredLoads }))
      .sort((a, b) => b.deliveredLoads - a.deliveredLoads),
    revenueByTeam: [...teamRevenueMap.entries()]
      .map(([team, revenue]) => ({ team, revenue }))
      .sort((a, b) => b.revenue - a.revenue),
    statusBreakdown,
    liveActivities: activities.map((row) => ({
      id: row.id,
      time: formatTime(row.createdAt),
      dispatcher: row.dispatcherNameSnapshot,
      team: row.teamNameSnapshot,
      carrier: row.carrierNameSnapshot,
      status: STATUS_META[row.status].label,
      loadAmount: row.status === DELIVERED ? toAmount(row.loadAmount) : null,
      origin: row.origin,
      destination: row.destination,
    })),
    filterOptions,
  };
}
