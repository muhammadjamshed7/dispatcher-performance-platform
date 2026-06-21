import "server-only";

import { z } from "zod";
import type { LoadActivityStatus } from "@/generated/prisma/client";
import { ForbiddenError } from "@/lib/errors/forbidden-error";
import { NotFoundError } from "@/lib/errors/not-found-error";
import { ValidationError } from "@/lib/errors/validation-error";
import {
  CANCELLED,
  DELIVERED,
  NOT_BOOKED,
  NOT_WORKING,
  STATUSES,
} from "@/lib/constants/statuses";
import { TEAM_LEAD } from "@/lib/constants/roles";
import { db } from "@/lib/db/prisma";
import type { DailyActivity as DailyActivityDto } from "@/lib/types";
import { calculateDispatchFee } from "@/lib/utils/calculate-dispatch-fee";
import { calculateRatePerMile } from "@/lib/utils/calculate-rate-per-mile";
import type { AccessScope, AuthContextUser } from "@/server/auth/types";
import { mapDailyActivity } from "@/server/mappers";
import { writeAuditLog } from "@/server/services/audit.service";
import { assertAllowedStatusReason } from "@/server/services/settings.service";
import {
  activityFiltersSchema,
  assertFilterAccess,
  buildActivityWhere,
  parseActivityDate,
  type ActivityFilters,
} from "@/server/utils/activity-filters";
import { activityScopeFilter } from "@/server/utils/scope-filters";

const activityPayloadSchema = z.object({
  status: z.enum(STATUSES, { message: "Status is required" }),
  notes: z.string().trim().optional(),
  origin: z.string().trim().optional(),
  destination: z.string().trim().optional(),
  totalMiles: z.number().optional(),
  loadAmount: z.number().optional(),
  reason: z.string().trim().optional(),
});

function refineActivityPayload(
  data: z.infer<typeof activityPayloadSchema>,
  context: z.RefinementCtx,
): void {
  if (data.status === DELIVERED) {
    if (!data.origin?.trim()) {
      context.addIssue({
        code: "custom",
        message: "Origin is required for delivered loads",
        path: ["origin"],
      });
    }

    if (!data.destination?.trim()) {
      context.addIssue({
        code: "custom",
        message: "Destination is required for delivered loads",
        path: ["destination"],
      });
    }

    if (data.totalMiles === undefined || data.totalMiles <= 0) {
      context.addIssue({
        code: "custom",
        message: "Total miles must be greater than 0",
        path: ["totalMiles"],
      });
    }

    if (data.loadAmount === undefined || data.loadAmount <= 0) {
      context.addIssue({
        code: "custom",
        message: "Load amount must be greater than 0",
        path: ["loadAmount"],
      });
    }

    return;
  }

  if (
    data.status === CANCELLED ||
    data.status === NOT_BOOKED ||
    data.status === NOT_WORKING
  ) {
    if (!data.reason?.trim()) {
      context.addIssue({
        code: "custom",
        message: "Reason is required for this status",
        path: ["reason"],
      });
    }
  }
}

const createActivityInputSchema = z
  .object({
    carrierId: z.string().trim().min(1, "Carrier is required"),
    activityDate: z.string().min(1, "Date is required"),
  })
  .merge(activityPayloadSchema)
  .superRefine(refineActivityPayload);

const updateActivityInputSchema = activityPayloadSchema
  .partial()
  .extend({
    activityDate: z.string().min(1).optional(),
  });

const validatedActivityPayloadSchema =
  activityPayloadSchema.superRefine(refineActivityPayload);

type CreateActivityInput = z.infer<typeof createActivityInputSchema>;
type UpdateActivityInput = z.infer<typeof updateActivityInputSchema>;

async function assertCarrierAccess(
  scope: AccessScope,
  carrier: {
    id: string;
    teamId: string;
    dispatcherId: string | null;
    status: string;
    deletedAt: Date | null;
  },
): Promise<void> {
  if (carrier.deletedAt || carrier.status !== "ACTIVE") {
    throw new ValidationError("Carrier is not active.");
  }

  if (scope.isCompanyWide) {
    return;
  }

  if (scope.role === TEAM_LEAD && scope.teamId !== carrier.teamId) {
    throw new ForbiddenError("You can only log activity for carriers on your team.");
  }

  if (scope.role === "DISPATCHER" && scope.dispatcherId !== carrier.dispatcherId) {
    throw new ForbiddenError("You can only log activity for your assigned carriers.");
  }
}

function computeFinancials(
  status: LoadActivityStatus,
  totalMiles: number | undefined,
  loadAmount: number | undefined,
  dispatchFeePercentage: number,
): { ratePerMile: number | null; dispatchFee: number | null } {
  if (status !== DELIVERED || !totalMiles || !loadAmount) {
    return { ratePerMile: null, dispatchFee: null };
  }

  return {
    ratePerMile: calculateRatePerMile(loadAmount, totalMiles),
    dispatchFee: calculateDispatchFee(loadAmount, dispatchFeePercentage),
  };
}

export async function upsertDailySubmission(
  organizationId: string,
  dispatcherId: string,
  teamId: string,
  submissionDate: Date,
): Promise<void> {
  const activities = await db.dailyActivity.findMany({
    where: { dispatcherId, activityDate: submissionDate },
    select: { carrierId: true },
  });

  const carrierIds = new Set(activities.map((activity) => activity.carrierId));

  await db.dailySubmission.upsert({
    where: {
      dispatcherId_submissionDate: {
        dispatcherId,
        submissionDate,
      },
    },
    create: {
      organizationId,
      dispatcherId,
      teamId,
      submissionDate,
      carrierCount: carrierIds.size,
      activityCount: activities.length,
    },
    update: {
      teamId,
      carrierCount: carrierIds.size,
      activityCount: activities.length,
      submittedAt: new Date(),
    },
  });
}

export async function listActivities(
  scope: AccessScope,
  filters: ActivityFilters = {},
): Promise<DailyActivityDto[]> {
  const parsedFilters = activityFiltersSchema.parse(filters);
  await assertFilterAccess(scope, parsedFilters);

  const activities = await db.dailyActivity.findMany({
    where: buildActivityWhere(scope, parsedFilters),
    orderBy: [{ activityDate: "desc" }, { createdAt: "desc" }],
  });

  return activities.map(mapDailyActivity);
}

export async function createActivity(
  scope: AccessScope,
  actor: AuthContextUser,
  input: CreateActivityInput,
): Promise<DailyActivityDto> {
  const parsed = createActivityInputSchema.parse(input);
  const activityDate = parseActivityDate(parsed.activityDate);

  const carrier = await db.carrier.findFirst({
    where: {
      id: parsed.carrierId,
      organizationId: scope.organizationId,
      deletedAt: null,
    },
    include: {
      team: { select: { id: true, name: true } },
      dispatcher: {
        include: { user: { select: { fullName: true } } },
      },
    },
  });

  if (!carrier || !carrier.dispatcherId || !carrier.dispatcher) {
    throw new NotFoundError("Carrier not found.");
  }

  await assertCarrierAccess(scope, carrier);

  if (parsed.reason?.trim()) {
    await assertAllowedStatusReason(scope.organizationId, parsed.reason);
  }

  const duplicate = await db.dailyActivity.findUnique({
    where: {
      carrierId_activityDate: {
        carrierId: parsed.carrierId,
        activityDate,
      },
    },
  });

  if (duplicate) {
    throw new ValidationError("An activity for this carrier on this date already exists.");
  }

  const dispatchFeePercentage = carrier.dispatchFeePercentage.toNumber();
  const { ratePerMile, dispatchFee } = computeFinancials(
    parsed.status,
    parsed.totalMiles,
    parsed.loadAmount,
    dispatchFeePercentage,
  );

  const activity = await db.dailyActivity.create({
    data: {
      organizationId: scope.organizationId,
      activityDate,
      carrierId: carrier.id,
      dispatcherId: carrier.dispatcherId,
      teamId: carrier.teamId,
      status: parsed.status,
      carrierNameSnapshot: carrier.carrierName,
      driverNameSnapshot: carrier.driverName,
      dispatcherNameSnapshot: carrier.dispatcher.user.fullName,
      teamNameSnapshot: carrier.team.name,
      truckTypeSnapshot: carrier.truckType,
      dispatchFeePercentageSnapshot: dispatchFeePercentage,
      origin: parsed.origin?.trim() || null,
      destination: parsed.destination?.trim() || null,
      totalMiles: parsed.totalMiles ?? null,
      loadAmount: parsed.loadAmount ?? null,
      ratePerMile,
      dispatchFee,
      reason: parsed.reason?.trim() || null,
      notes: parsed.notes?.trim() || null,
    },
  });

  await upsertDailySubmission(
    scope.organizationId,
    carrier.dispatcherId,
    carrier.teamId,
    activityDate,
  );

  await writeAuditLog({
    organizationId: scope.organizationId,
    actorUserId: actor.id,
    action: "ACTIVITY_CREATED",
    entityType: "DailyActivity",
    entityId: activity.id,
    metadata: {
      carrierId: carrier.id,
      activityDate: parsed.activityDate,
      status: parsed.status,
    },
  });

  return mapDailyActivity(activity);
}

export async function updateActivity(
  scope: AccessScope,
  actor: AuthContextUser,
  id: string,
  input: UpdateActivityInput,
): Promise<DailyActivityDto> {
  const parsed = updateActivityInputSchema.parse(input);

  const existing = await db.dailyActivity.findFirst({
    where: {
      id,
      organizationId: scope.organizationId,
      ...activityScopeFilter(scope),
    },
  });

  if (!existing) {
    throw new NotFoundError("Activity not found.");
  }

  const merged = {
    status: parsed.status ?? existing.status,
    origin: parsed.origin ?? existing.origin ?? undefined,
    destination: parsed.destination ?? existing.destination ?? undefined,
    totalMiles:
      parsed.totalMiles ??
      (existing.totalMiles ? existing.totalMiles.toNumber() : undefined),
    loadAmount:
      parsed.loadAmount ??
      (existing.loadAmount ? existing.loadAmount.toNumber() : undefined),
    reason: parsed.reason ?? existing.reason ?? undefined,
    notes: parsed.notes ?? existing.notes ?? undefined,
  };

  validatedActivityPayloadSchema.parse(merged);

  if (merged.reason?.trim()) {
    await assertAllowedStatusReason(scope.organizationId, merged.reason);
  }

  const activityDate = parsed.activityDate
    ? parseActivityDate(parsed.activityDate)
    : existing.activityDate;

  if (parsed.activityDate) {
    const duplicate = await db.dailyActivity.findFirst({
      where: {
        carrierId: existing.carrierId,
        activityDate,
        NOT: { id },
      },
    });

    if (duplicate) {
      throw new ValidationError("An activity for this carrier on this date already exists.");
    }
  }

  const dispatchFeePercentage = existing.dispatchFeePercentageSnapshot.toNumber();
  const { ratePerMile, dispatchFee } = computeFinancials(
    merged.status,
    merged.totalMiles,
    merged.loadAmount,
    dispatchFeePercentage,
  );

  const activity = await db.dailyActivity.update({
    where: { id },
    data: {
      ...(parsed.activityDate !== undefined ? { activityDate } : {}),
      ...(parsed.status !== undefined ? { status: parsed.status } : {}),
      ...(parsed.origin !== undefined ? { origin: parsed.origin?.trim() || null } : {}),
      ...(parsed.destination !== undefined
        ? { destination: parsed.destination?.trim() || null }
        : {}),
      ...(parsed.totalMiles !== undefined ? { totalMiles: parsed.totalMiles ?? null } : {}),
      ...(parsed.loadAmount !== undefined ? { loadAmount: parsed.loadAmount ?? null } : {}),
      ...(parsed.reason !== undefined ? { reason: parsed.reason?.trim() || null } : {}),
      ...(parsed.notes !== undefined ? { notes: parsed.notes?.trim() || null } : {}),
      ratePerMile,
      dispatchFee,
    },
  });

  await upsertDailySubmission(
    scope.organizationId,
    existing.dispatcherId,
    existing.teamId,
    activity.activityDate,
  );

  if (parsed.activityDate && activityDate.getTime() !== existing.activityDate.getTime()) {
    await upsertDailySubmission(
      scope.organizationId,
      existing.dispatcherId,
      existing.teamId,
      existing.activityDate,
    );
  }

  await writeAuditLog({
    organizationId: scope.organizationId,
    actorUserId: actor.id,
    action: "ACTIVITY_UPDATED",
    entityType: "DailyActivity",
    entityId: activity.id,
    metadata: parsed,
  });

  return mapDailyActivity(activity);
}
