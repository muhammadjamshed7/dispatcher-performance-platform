import "server-only";

import { APPROVED } from "@/lib/constants/activity-approval";
import type { CarrierStatus } from "@/lib/db/types";
import { T, db } from "@/lib/db/client";
import { assertDbVoid, nowIso, toDateOnly } from "@/lib/db/utils";
import {
  CARRIER_AUTO_STATUS_THRESHOLD_HOURS,
  EXCLUDED_CARRIER_AUTO_ACTIVITY_STATUSES,
  VALID_CARRIER_AUTO_ACTIVITY_STATUSES,
  resolveCarrierStatusFromLastValidActivity,
} from "@/lib/carriers/activity-based-status";
import { writeAuditLog } from "@/server/services/audit.service";

const AUTO_STATUS_REASON = "automatic activity-based carrier status update";

type CarrierStatusRecalculationResult = {
  carrierId: string;
  previousStatus: CarrierStatus;
  nextStatus: CarrierStatus;
  changed: boolean;
  lastValidActivityDate: string | null;
};

type CarrierRow = {
  id: string;
  organizationId: string;
  carrierName: string;
  status: CarrierStatus;
  deletedAt: string | null;
};

type ActivityRow = {
  id: string;
  carrierId: string;
  activityDate: string;
  createdAt: string;
  status: string;
  approvalStatus: string;
};

async function getLatestValidActivity(
  organizationId: string,
  carrierId: string,
): Promise<ActivityRow | null> {
  const result = await db()
    .from(T.DailyActivity)
    .select("id, carrierId, activityDate, createdAt, status, approvalStatus")
    .eq("organizationId", organizationId)
    .eq("carrierId", carrierId)
    .eq("approvalStatus", APPROVED)
    .in("status", [...VALID_CARRIER_AUTO_ACTIVITY_STATUSES])
    .order("activityDate", { ascending: false })
    .order("createdAt", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (result.error) {
    throw new Error(result.error.message);
  }

  return (result.data as ActivityRow | null) ?? null;
}

async function getCarrier(
  organizationId: string,
  carrierId: string,
): Promise<CarrierRow | null> {
  const result = await db()
    .from(T.Carrier)
    .select("id, organizationId, carrierName, status, deletedAt")
    .eq("organizationId", organizationId)
    .eq("id", carrierId)
    .maybeSingle();

  if (result.error) {
    throw new Error(result.error.message);
  }

  return (result.data as CarrierRow | null) ?? null;
}

export async function recalculateCarrierStatusFromActivity(
  organizationId: string,
  activityId: string,
  actorUserId?: string | null,
): Promise<CarrierStatusRecalculationResult | null> {
  const activityResult = await db()
    .from(T.DailyActivity)
    .select("carrierId")
    .eq("organizationId", organizationId)
    .eq("id", activityId)
    .maybeSingle();

  if (activityResult.error) {
    throw new Error(activityResult.error.message);
  }

  const carrierId = activityResult.data?.carrierId as string | undefined;
  if (!carrierId) {
    return null;
  }

  return recalculateCarrierStatus(organizationId, carrierId, actorUserId);
}

export async function recalculateCarrierStatus(
  organizationId: string,
  carrierId: string,
  actorUserId?: string | null,
  now = new Date(),
): Promise<CarrierStatusRecalculationResult | null> {
  const carrier = await getCarrier(organizationId, carrierId);
  if (!carrier || carrier.deletedAt) {
    return null;
  }

  const latestValidActivity = await getLatestValidActivity(
    organizationId,
    carrierId,
  );
  const lastValidActivityDate = latestValidActivity
    ? toDateOnly(latestValidActivity.activityDate)
    : null;
  const nextStatus = resolveCarrierStatusFromLastValidActivity(
    lastValidActivityDate,
    now,
  );
  const previousStatus = carrier.status;

  if (previousStatus === nextStatus) {
    return {
      carrierId,
      previousStatus,
      nextStatus,
      changed: false,
      lastValidActivityDate,
    };
  }

  const updateResult = await db()
    .from(T.Carrier)
    .update({ status: nextStatus, updatedAt: nowIso() })
    .eq("organizationId", organizationId)
    .eq("id", carrierId);

  assertDbVoid(updateResult);

  await writeAuditLog({
    organizationId,
    actorUserId: actorUserId ?? null,
    action:
      nextStatus === "ACTIVE" ? "CARRIER_ACTIVATED" : "CARRIER_DEACTIVATED",
    entityType: "Carrier",
    entityId: carrierId,
    metadata: {
      entityName: carrier.carrierName,
      carrierName: carrier.carrierName,
      previousStatus,
      newStatus: nextStatus,
      reason: AUTO_STATUS_REASON,
      lastValidActivityDate,
      thresholdHours: CARRIER_AUTO_STATUS_THRESHOLD_HOURS,
      validActivityStatuses: [...VALID_CARRIER_AUTO_ACTIVITY_STATUSES],
      excludedActivityStatuses: [...EXCLUDED_CARRIER_AUTO_ACTIVITY_STATUSES],
      note: "In Transit is excluded from automatic carrier status calculation.",
    },
  });

  return {
    carrierId,
    previousStatus,
    nextStatus,
    changed: true,
    lastValidActivityDate,
  };
}

export async function recalculateOrganizationCarrierStatuses(
  organizationId: string,
  actorUserId?: string | null,
): Promise<CarrierStatusRecalculationResult[]> {
  const result = await db()
    .from(T.Carrier)
    .select("id")
    .eq("organizationId", organizationId)
    .is("deletedAt", null);

  if (result.error) {
    throw new Error(result.error.message);
  }

  const carriers = (result.data ?? []) as Array<{ id: string }>;
  const recalculations: CarrierStatusRecalculationResult[] = [];

  for (const carrier of carriers) {
    const recalculation = await recalculateCarrierStatus(
      organizationId,
      carrier.id,
      actorUserId,
    );

    if (recalculation) {
      recalculations.push(recalculation);
    }
  }

  return recalculations;
}
