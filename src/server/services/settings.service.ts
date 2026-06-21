import "server-only";

import { z } from "zod";
import type { OrganizationSettings, StatusReason, TruckType } from "@/generated/prisma/client";
import { ForbiddenError } from "@/lib/errors/forbidden-error";
import { ValidationError } from "@/lib/errors/validation-error";
import { db } from "@/lib/db/prisma";
import type { AppSettings } from "@/lib/types";
import type { AccessScope, AuthContextUser } from "@/server/auth/types";
import { writeAuditLog } from "@/server/services/audit.service";

const PRISMA_TRUCK_TYPES = [
  "DRY_VAN",
  "REEFER",
  "FLATBED",
  "BOX_TRUCK",
  "HOTSHOT",
  "POWER_ONLY",
  "CARGO_VAN",
] as const satisfies readonly TruckType[];

const updateSettingsInputSchema = z.object({
  dispatchFeeMethod: z.string().trim().min(1).optional(),
  defaultDispatchFeePercent: z.number().min(0).max(100).optional(),
  minimumDispatchFee: z.number().min(0).optional(),
  roundToNearestDollar: z.boolean().optional(),
  allowedTruckTypes: z.array(z.enum(PRISMA_TRUCK_TYPES)).optional(),
  timezone: z.string().trim().min(1).optional(),
  csvIncludeHeaders: z.boolean().optional(),
  csvDateFormat: z.string().trim().min(1).optional(),
  csvMaxRows: z.number().int().positive().optional(),
  csvFileNamePrefix: z.string().trim().min(1).optional(),
  allowedStatusReasons: z.array(z.string().trim().min(1)).optional(),
});

type UpdateSettingsInput = z.infer<typeof updateSettingsInputSchema>;

function requireAdmin(scope: AccessScope): void {
  if (!scope.isCompanyWide) {
    throw new ForbiddenError("Admin access is required.");
  }
}

function decimalToNumber(value: { toNumber(): number }): number {
  return value.toNumber();
}

function mapSettings(
  settings: OrganizationSettings,
  statusReasons: StatusReason[],
): AppSettings {
  return {
    dispatchFeeCalculation: {
      method: settings.dispatchFeeMethod,
      defaultPercentage: decimalToNumber(settings.defaultDispatchFeePercent),
      minimumFee: decimalToNumber(settings.minimumDispatchFee),
      roundToNearestDollar: settings.roundToNearestDollar,
    },
    allowedTruckTypes: settings.allowedTruckTypes as AppSettings["allowedTruckTypes"],
    allowedStatusReasons: statusReasons
      .filter((reason) => reason.isActive)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((reason) => reason.label),
    timezone: settings.timezone,
    csvExport: {
      includeHeaders: settings.csvIncludeHeaders,
      dateFormat: settings.csvDateFormat,
      maxRows: settings.csvMaxRows,
      fileNamePrefix: settings.csvFileNamePrefix,
    },
  };
}

async function getOrCreateSettings(organizationId: string): Promise<OrganizationSettings> {
  const existing = await db.organizationSettings.findUnique({
    where: { organizationId },
  });

  if (existing) {
    return existing;
  }

  const organization = await db.organization.findUnique({
    where: { id: organizationId },
  });

  if (!organization) {
    throw new ValidationError("Organization not found.");
  }

  return db.organizationSettings.create({
    data: {
      organizationId,
      timezone: organization.timezone,
    },
  });
}

async function loadStatusReasons(organizationId: string): Promise<StatusReason[]> {
  return db.statusReason.findMany({
    where: { organizationId },
    orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
  });
}

export async function getSettings(scope: AccessScope): Promise<AppSettings> {
  requireAdmin(scope);

  const settings = await getOrCreateSettings(scope.organizationId);
  const statusReasons = await loadStatusReasons(scope.organizationId);

  return mapSettings(settings, statusReasons);
}

export async function assertAllowedTruckType(
  organizationId: string,
  truckType: TruckType,
): Promise<void> {
  const settings = await getOrCreateSettings(organizationId);

  if (!settings.allowedTruckTypes.includes(truckType)) {
    throw new ValidationError("This truck type is not allowed by organization settings.");
  }
}

export async function assertAllowedStatusReason(
  organizationId: string,
  reason: string,
): Promise<void> {
  const statusReasons = await loadStatusReasons(organizationId);
  const allowed = statusReasons
    .filter((entry) => entry.isActive)
    .map((entry) => entry.label.toLowerCase());

  if (!allowed.includes(reason.trim().toLowerCase())) {
    throw new ValidationError("This status reason is not allowed by organization settings.");
  }
}

export async function updateSettings(
  scope: AccessScope,
  actor: AuthContextUser,
  input: UpdateSettingsInput,
): Promise<AppSettings> {
  requireAdmin(scope);
  const parsed = updateSettingsInputSchema.parse(input);

  await getOrCreateSettings(scope.organizationId);

  const settings = await db.$transaction(async (tx) => {
    const updated = await tx.organizationSettings.update({
      where: { organizationId: scope.organizationId },
      data: {
        ...(parsed.dispatchFeeMethod !== undefined
          ? { dispatchFeeMethod: parsed.dispatchFeeMethod }
          : {}),
        ...(parsed.defaultDispatchFeePercent !== undefined
          ? { defaultDispatchFeePercent: parsed.defaultDispatchFeePercent }
          : {}),
        ...(parsed.minimumDispatchFee !== undefined
          ? { minimumDispatchFee: parsed.minimumDispatchFee }
          : {}),
        ...(parsed.roundToNearestDollar !== undefined
          ? { roundToNearestDollar: parsed.roundToNearestDollar }
          : {}),
        ...(parsed.allowedTruckTypes !== undefined
          ? { allowedTruckTypes: parsed.allowedTruckTypes as TruckType[] }
          : {}),
        ...(parsed.timezone !== undefined ? { timezone: parsed.timezone } : {}),
        ...(parsed.csvIncludeHeaders !== undefined
          ? { csvIncludeHeaders: parsed.csvIncludeHeaders }
          : {}),
        ...(parsed.csvDateFormat !== undefined
          ? { csvDateFormat: parsed.csvDateFormat }
          : {}),
        ...(parsed.csvMaxRows !== undefined ? { csvMaxRows: parsed.csvMaxRows } : {}),
        ...(parsed.csvFileNamePrefix !== undefined
          ? { csvFileNamePrefix: parsed.csvFileNamePrefix }
          : {}),
      },
    });

    if (parsed.allowedStatusReasons !== undefined) {
      const existingReasons = await tx.statusReason.findMany({
        where: { organizationId: scope.organizationId },
      });
      const existingByLabel = new Map(
        existingReasons.map((reason) => [reason.label.toLowerCase(), reason]),
      );
      const incomingLabels = new Set(
        parsed.allowedStatusReasons.map((label) => label.toLowerCase()),
      );

      for (const reason of existingReasons) {
        await tx.statusReason.update({
          where: { id: reason.id },
          data: { isActive: incomingLabels.has(reason.label.toLowerCase()) },
        });
      }

      for (const [index, label] of parsed.allowedStatusReasons.entries()) {
        const existing = existingByLabel.get(label.toLowerCase());

        if (existing) {
          await tx.statusReason.update({
            where: { id: existing.id },
            data: { label, isActive: true, sortOrder: index },
          });
          continue;
        }

        await tx.statusReason.create({
          data: {
            organizationId: scope.organizationId,
            label,
            isActive: true,
            sortOrder: index,
          },
        });
      }
    }

    return updated;
  });

  const statusReasons = await loadStatusReasons(scope.organizationId);

  await writeAuditLog({
    organizationId: scope.organizationId,
    actorUserId: actor.id,
    action: "SETTINGS_UPDATED",
    entityType: "OrganizationSettings",
    entityId: settings.id,
    metadata: parsed,
  });

  return mapSettings(settings, statusReasons);
}
