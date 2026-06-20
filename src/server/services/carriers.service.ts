import "server-only";

import { z } from "zod";
import type { CarrierStatus, TruckType } from "@/generated/prisma/client";
import { ForbiddenError } from "@/lib/errors/forbidden-error";
import { NotFoundError } from "@/lib/errors/not-found-error";
import { ValidationError } from "@/lib/errors/validation-error";
import { TEAM_LEAD } from "@/lib/constants/roles";
import { TEAM_STATUSES } from "@/lib/constants/team-statuses";
import { db } from "@/lib/db/prisma";
import type { Carrier as CarrierDto } from "@/lib/types";
import type { AccessScope, AuthContextUser } from "@/server/auth/types";
import { mapCarrier } from "@/server/mappers";
import { writeAuditLog } from "@/server/services/audit.service";
import { carrierScopeFilter } from "@/server/utils/scope-filters";

const PRISMA_TRUCK_TYPES = [
  "DRY_VAN",
  "REEFER",
  "FLATBED",
  "BOX_TRUCK",
  "HOTSHOT",
  "POWER_ONLY",
  "CARGO_VAN",
] as const satisfies readonly TruckType[];

const createCarrierInputSchema = z.object({
  carrierName: z.string().trim().min(1, "Carrier name is required"),
  driverName: z.string().trim().min(1, "Driver name is required"),
  mcNumber: z.string().trim().min(1, "MC number is required"),
  dispatchFeePercentage: z
    .number({ message: "Dispatch fee percentage is required" })
    .min(0)
    .max(100),
  truckType: z.enum(PRISMA_TRUCK_TYPES),
  teamId: z.string().trim().min(1, "Assigned team is required"),
  dispatcherId: z.string().trim().min(1, "Assigned dispatcher is required"),
  status: z.enum(TEAM_STATUSES).default("ACTIVE"),
  notes: z.string().trim().optional(),
});

const updateCarrierInputSchema = createCarrierInputSchema
  .omit({ teamId: true, dispatcherId: true })
  .partial();

const reassignCarrierInputSchema = z.object({
  teamId: z.string().trim().min(1, "Assigned team is required"),
  dispatcherId: z.string().trim().min(1, "Assigned dispatcher is required"),
  notes: z.string().trim().optional(),
});

type CreateCarrierInput = z.infer<typeof createCarrierInputSchema>;
type UpdateCarrierInput = z.infer<typeof updateCarrierInputSchema>;
type ReassignCarrierInput = z.infer<typeof reassignCarrierInputSchema>;

function requireAdminOrTeamLead(scope: AccessScope): void {
  if (!scope.isCompanyWide && scope.role !== TEAM_LEAD) {
    throw new ForbiddenError("Admin or team lead access is required.");
  }
}

function assertTeamAssignment(scope: AccessScope, teamId: string): void {
  if (scope.isCompanyWide) {
    return;
  }

  if (scope.teamId !== teamId) {
    throw new ForbiddenError("You can only manage carriers on your team.");
  }
}

const carrierInclude = {
  team: { select: { name: true } },
  dispatcher: { include: { user: { select: { fullName: true } } } },
} as const;

export async function listCarriers(scope: AccessScope): Promise<CarrierDto[]> {
  const carriers = await db.carrier.findMany({
    where: {
      organizationId: scope.organizationId,
      ...carrierScopeFilter(scope),
    },
    include: carrierInclude,
    orderBy: { carrierName: "asc" },
  });

  return carriers.map(mapCarrier);
}

async function getCarrierRecord(scope: AccessScope, id: string) {
  const carrier = await db.carrier.findFirst({
    where: {
      id,
      organizationId: scope.organizationId,
      ...carrierScopeFilter(scope),
    },
    include: carrierInclude,
  });

  if (!carrier) {
    throw new NotFoundError("Carrier not found.");
  }

  return carrier;
}

async function validateAssignment(
  organizationId: string,
  teamId: string,
  dispatcherId: string,
): Promise<{ teamName: string; dispatcherName: string }> {
  const team = await db.team.findFirst({
    where: { id: teamId, organizationId, deletedAt: null, status: "ACTIVE" },
  });

  if (!team) {
    throw new ValidationError("Team not found or inactive.");
  }

  const dispatcher = await db.dispatcher.findFirst({
    where: {
      id: dispatcherId,
      organizationId,
      teamId,
      deletedAt: null,
      status: "ACTIVE",
    },
    include: { user: { select: { fullName: true } } },
  });

  if (!dispatcher) {
    throw new ValidationError("Dispatcher not found on the selected team.");
  }

  return {
    teamName: team.name,
    dispatcherName: dispatcher.user.fullName,
  };
}

export async function createCarrier(
  scope: AccessScope,
  actor: AuthContextUser,
  input: CreateCarrierInput,
): Promise<CarrierDto> {
  requireAdminOrTeamLead(scope);
  const parsed = createCarrierInputSchema.parse(input);

  assertTeamAssignment(scope, parsed.teamId);

  const duplicate = await db.carrier.findFirst({
    where: {
      organizationId: scope.organizationId,
      mcNumber: parsed.mcNumber,
      deletedAt: null,
    },
  });

  if (duplicate) {
    throw new ValidationError("A carrier with this MC number already exists.");
  }

  const { teamName, dispatcherName } = await validateAssignment(
    scope.organizationId,
    parsed.teamId,
    parsed.dispatcherId,
  );

  const carrier = await db.$transaction(async (tx) => {
    const created = await tx.carrier.create({
      data: {
        organizationId: scope.organizationId,
        carrierName: parsed.carrierName,
        driverName: parsed.driverName,
        mcNumber: parsed.mcNumber,
        truckType: parsed.truckType,
        teamId: parsed.teamId,
        dispatcherId: parsed.dispatcherId,
        dispatchFeePercentage: parsed.dispatchFeePercentage,
        status: (parsed.status === "ACTIVE" ? "ACTIVE" : "INACTIVE") as CarrierStatus,
      },
      include: carrierInclude,
    });

    await tx.carrierAssignmentHistory.create({
      data: {
        organizationId: scope.organizationId,
        carrierId: created.id,
        teamId: parsed.teamId,
        dispatcherId: parsed.dispatcherId,
        teamNameSnapshot: teamName,
        dispatcherNameSnapshot: dispatcherName,
        assignedByUserId: actor.id,
        notes: parsed.notes ?? null,
      },
    });

    return created;
  });

  await writeAuditLog({
    organizationId: scope.organizationId,
    actorUserId: actor.id,
    action: "CARRIER_CREATED",
    entityType: "Carrier",
    entityId: carrier.id,
    metadata: { mcNumber: parsed.mcNumber },
  });

  return mapCarrier(await getCarrierRecord(scope, carrier.id));
}

export async function updateCarrier(
  scope: AccessScope,
  actor: AuthContextUser,
  id: string,
  input: UpdateCarrierInput,
): Promise<CarrierDto> {
  requireAdminOrTeamLead(scope);
  const parsed = updateCarrierInputSchema.parse(input);

  const existing = await getCarrierRecord(scope, id);
  assertTeamAssignment(scope, existing.teamId);

  if (parsed.mcNumber && parsed.mcNumber !== existing.mcNumber) {
    const duplicate = await db.carrier.findFirst({
      where: {
        organizationId: scope.organizationId,
        mcNumber: parsed.mcNumber,
        deletedAt: null,
        NOT: { id },
      },
    });

    if (duplicate) {
      throw new ValidationError("A carrier with this MC number already exists.");
    }
  }

  const carrier = await db.carrier.update({
    where: { id },
    data: {
      ...(parsed.carrierName !== undefined ? { carrierName: parsed.carrierName } : {}),
      ...(parsed.driverName !== undefined ? { driverName: parsed.driverName } : {}),
      ...(parsed.mcNumber !== undefined ? { mcNumber: parsed.mcNumber } : {}),
      ...(parsed.truckType !== undefined ? { truckType: parsed.truckType } : {}),
      ...(parsed.dispatchFeePercentage !== undefined
        ? { dispatchFeePercentage: parsed.dispatchFeePercentage }
        : {}),
      ...(parsed.status !== undefined
        ? { status: (parsed.status === "ACTIVE" ? "ACTIVE" : "INACTIVE") as CarrierStatus }
        : {}),
    },
    include: carrierInclude,
  });

  await writeAuditLog({
    organizationId: scope.organizationId,
    actorUserId: actor.id,
    action: "CARRIER_UPDATED",
    entityType: "Carrier",
    entityId: carrier.id,
    metadata: parsed,
  });

  return mapCarrier(await getCarrierRecord(scope, carrier.id));
}

export async function activateCarrier(
  scope: AccessScope,
  actor: AuthContextUser,
  id: string,
): Promise<CarrierDto> {
  requireAdminOrTeamLead(scope);
  await getCarrierRecord(scope, id);

  const carrier = await db.carrier.update({
    where: { id },
    data: { status: "ACTIVE", deletedAt: null },
    include: carrierInclude,
  });

  await writeAuditLog({
    organizationId: scope.organizationId,
    actorUserId: actor.id,
    action: "CARRIER_UPDATED",
    entityType: "Carrier",
    entityId: id,
    metadata: { status: "ACTIVE" },
  });

  return mapCarrier(await getCarrierRecord(scope, carrier.id));
}

export async function deactivateCarrier(
  scope: AccessScope,
  actor: AuthContextUser,
  id: string,
): Promise<CarrierDto> {
  requireAdminOrTeamLead(scope);
  await getCarrierRecord(scope, id);

  const carrier = await db.carrier.update({
    where: { id },
    data: { status: "INACTIVE", deletedAt: new Date() },
    include: carrierInclude,
  });

  await writeAuditLog({
    organizationId: scope.organizationId,
    actorUserId: actor.id,
    action: "CARRIER_DEACTIVATED",
    entityType: "Carrier",
    entityId: id,
  });

  return mapCarrier(await getCarrierRecord(scope, carrier.id));
}

export async function reassignCarrier(
  scope: AccessScope,
  actor: AuthContextUser,
  id: string,
  input: ReassignCarrierInput,
): Promise<CarrierDto> {
  requireAdminOrTeamLead(scope);
  const parsed = reassignCarrierInputSchema.parse(input);

  await getCarrierRecord(scope, id);
  assertTeamAssignment(scope, parsed.teamId);

  const { teamName, dispatcherName } = await validateAssignment(
    scope.organizationId,
    parsed.teamId,
    parsed.dispatcherId,
  );

  const carrier = await db.$transaction(async (tx) => {
    await tx.carrierAssignmentHistory.updateMany({
      where: {
        carrierId: id,
        unassignedAt: null,
      },
      data: { unassignedAt: new Date() },
    });

    await tx.carrierAssignmentHistory.create({
      data: {
        organizationId: scope.organizationId,
        carrierId: id,
        teamId: parsed.teamId,
        dispatcherId: parsed.dispatcherId,
        teamNameSnapshot: teamName,
        dispatcherNameSnapshot: dispatcherName,
        assignedByUserId: actor.id,
        notes: parsed.notes ?? null,
      },
    });

    return tx.carrier.update({
      where: { id },
      data: {
        teamId: parsed.teamId,
        dispatcherId: parsed.dispatcherId,
      },
      include: carrierInclude,
    });
  });

  await writeAuditLog({
    organizationId: scope.organizationId,
    actorUserId: actor.id,
    action: "CARRIER_REASSIGNED",
    entityType: "Carrier",
    entityId: id,
    metadata: {
      teamId: parsed.teamId,
      dispatcherId: parsed.dispatcherId,
    },
  });

  return mapCarrier(await getCarrierRecord(scope, carrier.id));
}
