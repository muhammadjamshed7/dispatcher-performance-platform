import "server-only";

import { z } from "zod";
import type { LoadActivityStatus } from "@/generated/prisma/client";
import {
  CANCELLED,
  DELIVERED,
  NOT_BOOKED,
  NOT_WORKING,
  STATUSES,
} from "@/lib/constants/statuses";
import { db } from "@/lib/db/prisma";
import type { AdminDailyReportBundle } from "@/lib/types";
import type { AccessScope } from "@/server/auth/types";
import {
  formatActivityDate,
  parseActivityDate,
} from "@/server/utils/activity-filters";

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

function decimalToNumber(value: { toNumber(): number } | null | undefined): number {
  if (!value) {
    return 0;
  }

  return value.toNumber();
}

function formatTime(value: Date): string {
  return value.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

async function loadFilterOptions(organizationId: string) {
  const [teams, dispatchers] = await Promise.all([
    db.team.findMany({
      where: { organizationId, deletedAt: null, status: "ACTIVE" },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    db.dispatcher.findMany({
      where: { organizationId, deletedAt: null, status: "ACTIVE" },
      select: {
        id: true,
        teamId: true,
        user: { select: { fullName: true } },
      },
      orderBy: { user: { fullName: "asc" } },
    }),
  ]);

  return {
    teams,
    dispatchers: dispatchers.map((dispatcher) => ({
      id: dispatcher.id,
      name: dispatcher.user.fullName,
      teamId: dispatcher.teamId,
    })),
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
  const today = formatActivityDate(new Date());
  const parsed = dailyReportFiltersSchema.parse({
    date: rawFilters.date ?? today,
    teamId: rawFilters.teamId,
    dispatcherId: rawFilters.dispatcherId,
    status: rawFilters.status,
  });

  const activityDate = parseActivityDate(parsed.date);

  const where = {
    organizationId: scope.organizationId,
    activityDate,
    ...(parsed.teamId ? { teamId: parsed.teamId } : {}),
    ...(parsed.dispatcherId ? { dispatcherId: parsed.dispatcherId } : {}),
    ...(parsed.status ? { status: parsed.status } : {}),
  };

  const [activities, filterOptions] = await Promise.all([
    db.dailyActivity.findMany({
      where,
      orderBy: [{ createdAt: "desc" }],
      select: {
        id: true,
        createdAt: true,
        status: true,
        teamNameSnapshot: true,
        dispatcherNameSnapshot: true,
        carrierNameSnapshot: true,
        loadAmount: true,
        dispatchFee: true,
        origin: true,
        destination: true,
        dispatcherId: true,
        carrierId: true,
      },
    }),
    loadFilterOptions(scope.organizationId),
  ]);

  const delivered = activities.filter((row) => row.status === DELIVERED);
  const totalRevenue = delivered.reduce(
    (sum, row) => sum + decimalToNumber(row.loadAmount),
    0,
  );
  const dispatchFees = delivered.reduce(
    (sum, row) => sum + decimalToNumber(row.dispatchFee),
    0,
  );

  const activeDispatcherIds = new Set(activities.map((row) => row.dispatcherId));
  const activeCarrierIds = new Set(activities.map((row) => row.carrierId));

  const teamDeliveredMap = new Map<string, number>();
  const teamRevenueMap = new Map<string, number>();

  for (const row of delivered) {
    const team = row.teamNameSnapshot;
    teamDeliveredMap.set(team, (teamDeliveredMap.get(team) ?? 0) + 1);
    const amount = decimalToNumber(row.loadAmount);
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
      loadAmount:
        row.status === DELIVERED ? decimalToNumber(row.loadAmount) : null,
      origin: row.origin,
      destination: row.destination,
    })),
    filterOptions,
  };
}
