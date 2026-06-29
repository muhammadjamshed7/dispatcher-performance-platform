import "server-only";

import { z } from "zod";
import { T, db } from "@/lib/db/client";
import type {
  JsonValue,
  OrganizationSettings,
  StatusReason,
  TruckType,
} from "@/lib/db/types";
import {
  assertDb,
  assertDbVoid,
  createId,
  decimalToNumber,
  nowIso,
} from "@/lib/db/utils";
import { ForbiddenError } from "@/lib/errors/forbidden-error";
import { ValidationError } from "@/lib/errors/validation-error";
import { TRUCK_TYPES } from "@/lib/constants/truck-types";
import type { AppSettings, DispatchFeeRules } from "@/lib/types";
import type { AccessScope, AuthContextUser } from "@/server/auth/types";
import { writeAuditLog } from "@/server/services/audit.service";

const updateSettingsInputSchema = z.object({
  dispatchFeeMethod: z.literal("percentage").optional(),
  defaultDispatchFeePercent: z.number().min(0).max(100).optional(),
  minimumDispatchFee: z.number().min(0).optional(),
  roundToNearestDollar: z.boolean().optional(),
  allowedTruckTypes: z.array(z.enum(TRUCK_TYPES)).optional(),
  timezone: z.string().trim().min(1).optional(),
  currency: z
    .string()
    .trim()
    .length(3)
    .transform((value) => value.toUpperCase())
    .optional(),
  csvIncludeHeaders: z.boolean().optional(),
  csvDateFormat: z.string().trim().min(1).optional(),
  csvMaxRows: z.number().int().positive().optional(),
  csvFileNamePrefix: z.string().trim().min(1).optional(),
  directAdminApprovalMode: z.boolean().optional(),
  allowedStatusReasons: z.array(z.string().trim().min(1)).optional(),
});

type UpdateSettingsInput = z.infer<typeof updateSettingsInputSchema>;

const DISPATCH_FEE_SETTING_FIELDS = [
  "dispatchFeeMethod",
  "defaultDispatchFeePercent",
  "minimumDispatchFee",
  "roundToNearestDollar",
] as const;

function requireAdmin(scope: AccessScope): void {
  if (!scope.isCompanyWide) {
    throw new ForbiddenError("Admin access is required.");
  }
}

function mapSettings(
  settings: OrganizationSettings,
  statusReasons: StatusReason[],
  currency: string,
): AppSettings {
  return {
    dispatchFeeCalculation: {
      method: settings.dispatchFeeMethod,
      defaultPercentage:
        decimalToNumber(settings.defaultDispatchFeePercent) ?? 0,
      minimumFee: decimalToNumber(settings.minimumDispatchFee) ?? 0,
      roundToNearestDollar: settings.roundToNearestDollar,
    },
    allowedTruckTypes:
      settings.allowedTruckTypes as AppSettings["allowedTruckTypes"],
    allowedStatusReasons: statusReasons
      .filter((reason) => reason.isActive)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((reason) => reason.label),
    timezone: settings.timezone,
    currency,
    csvExport: {
      includeHeaders: settings.csvIncludeHeaders,
      dateFormat: settings.csvDateFormat,
      maxRows: settings.csvMaxRows,
      fileNamePrefix: settings.csvFileNamePrefix,
    },
    directAdminApprovalMode: settings.directAdminApprovalMode ?? false,
  };
}

async function getOrCreateSettings(
  organizationId: string,
): Promise<OrganizationSettings> {
  const existingResult = await db()
    .from(T.OrganizationSettings)
    .select("*")
    .eq("organizationId", organizationId)
    .maybeSingle();

  if (existingResult.error) {
    throw new Error(existingResult.error.message);
  }

  if (existingResult.data) {
    return existingResult.data;
  }

  const organizationResult = await db()
    .from(T.Organization)
    .select("id, timezone")
    .eq("id", organizationId)
    .maybeSingle();

  if (organizationResult.error) {
    throw new Error(organizationResult.error.message);
  }

  if (!organizationResult.data) {
    throw new ValidationError("Organization not found.");
  }

  const organization = organizationResult.data;

  const createdResult = await db()
    .from(T.OrganizationSettings)
    .insert({
      id: createId(),
      organizationId,
      timezone: organization.timezone,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    })
    .select("*")
    .single();

  return assertDb(createdResult);
}

export async function getOrganizationPreferences(
  organizationId: string,
): Promise<{ timezone: string; currency: string }> {
  const [settings, organizationResult] = await Promise.all([
    getOrCreateSettings(organizationId),
    db()
      .from(T.Organization)
      .select("timezone, currency")
      .eq("id", organizationId)
      .is("deletedAt", null)
      .maybeSingle(),
  ]);

  if (organizationResult.error) {
    throw new Error(organizationResult.error.message);
  }

  if (!organizationResult.data) {
    throw new ValidationError("Organization not found.");
  }

  return {
    timezone: settings.timezone || organizationResult.data.timezone,
    currency: organizationResult.data.currency || "USD",
  };
}

async function loadStatusReasons(
  organizationId: string,
): Promise<StatusReason[]> {
  const result = await db()
    .from(T.StatusReason)
    .select("*")
    .eq("organizationId", organizationId)
    .order("sortOrder", { ascending: true })
    .order("label", { ascending: true });

  return assertDb(result) ?? [];
}

export async function getSettings(scope: AccessScope): Promise<AppSettings> {
  requireAdmin(scope);

  const settings = await getOrCreateSettings(scope.organizationId);
  const statusReasons = await loadStatusReasons(scope.organizationId);
  const preferences = await getOrganizationPreferences(scope.organizationId);

  return mapSettings(settings, statusReasons, preferences.currency);
}

export async function getDispatchFeeRules(
  organizationId: string,
): Promise<DispatchFeeRules> {
  const settings = await getOrCreateSettings(organizationId);

  if (settings.dispatchFeeMethod !== "percentage") {
    throw new ValidationError("Unsupported dispatch fee calculation method.");
  }

  return {
    method: "percentage",
    defaultPercentage: decimalToNumber(settings.defaultDispatchFeePercent) ?? 0,
    minimumFee: decimalToNumber(settings.minimumDispatchFee) ?? 0,
    roundToNearestDollar: settings.roundToNearestDollar,
  };
}

export async function getDirectAdminApprovalMode(
  organizationId: string,
): Promise<boolean> {
  const settings = await getOrCreateSettings(organizationId);
  return settings.directAdminApprovalMode ?? false;
}

export async function getAllowedStatusReasons(
  scope: AccessScope,
): Promise<string[]> {
  const statusReasons = await loadStatusReasons(scope.organizationId);

  return statusReasons
    .filter((entry) => entry.isActive)
    .map((entry) => entry.label);
}

export async function assertAllowedTruckType(
  organizationId: string,
  truckType: TruckType,
): Promise<void> {
  const settings = await getOrCreateSettings(organizationId);

  if (!settings.allowedTruckTypes.includes(truckType)) {
    throw new ValidationError(
      "This truck type is not allowed by organization settings.",
    );
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
    throw new ValidationError(
      "This status reason is not allowed by organization settings.",
    );
  }
}

async function syncStatusReasons(
  organizationId: string,
  allowedStatusReasons: string[],
): Promise<void> {
  const existingReasons = await loadStatusReasons(organizationId);
  const existingByLabel = new Map(
    existingReasons.map((reason) => [reason.label.toLowerCase(), reason]),
  );
  const incomingLabels = new Set(
    allowedStatusReasons.map((label) => label.toLowerCase()),
  );

  for (const reason of existingReasons) {
    const updateResult = await db()
      .from(T.StatusReason)
      .update({
        isActive: incomingLabels.has(reason.label.toLowerCase()),
        updatedAt: nowIso(),
      })
      .eq("id", reason.id);

    assertDbVoid(updateResult);
  }

  for (const [index, label] of allowedStatusReasons.entries()) {
    const existing = existingByLabel.get(label.toLowerCase());

    if (existing) {
      const updateResult = await db()
        .from(T.StatusReason)
        .update({
          label,
          isActive: true,
          sortOrder: index,
          updatedAt: nowIso(),
        })
        .eq("id", existing.id);

      assertDbVoid(updateResult);
      continue;
    }

    const createResult = await db().from(T.StatusReason).insert({
      id: createId(),
      organizationId,
      label,
      isActive: true,
      sortOrder: index,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });

    assertDbVoid(createResult);
  }
}

export async function updateSettings(
  scope: AccessScope,
  actor: AuthContextUser,
  input: UpdateSettingsInput,
): Promise<AppSettings> {
  requireAdmin(scope);
  const parsed = updateSettingsInputSchema.parse(input);
  const changedFields = Object.keys(parsed);

  if (parsed.timezone !== undefined) {
    try {
      new Intl.DateTimeFormat("en-US", {
        timeZone: parsed.timezone,
      }).format(new Date());
    } catch {
      throw new ValidationError("Enter a valid IANA timezone.");
    }
  }

  if (parsed.currency !== undefined) {
    try {
      new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: parsed.currency,
      }).format(0);
    } catch {
      throw new ValidationError("Enter a valid ISO 4217 currency code.");
    }
  }

  const previousSettings = await getOrCreateSettings(scope.organizationId);
  const previousStatusReasons = await loadStatusReasons(scope.organizationId);
  const previousPreferences = await getOrganizationPreferences(
    scope.organizationId,
  );
  const previousSnapshot = mapSettings(
    previousSettings,
    previousStatusReasons,
    previousPreferences.currency,
  );

  const updatePayload: Record<string, unknown> = {
    updatedAt: nowIso(),
  };

  if (parsed.dispatchFeeMethod !== undefined) {
    updatePayload.dispatchFeeMethod = parsed.dispatchFeeMethod;
  }

  if (parsed.defaultDispatchFeePercent !== undefined) {
    updatePayload.defaultDispatchFeePercent = String(
      parsed.defaultDispatchFeePercent,
    );
  }

  if (parsed.minimumDispatchFee !== undefined) {
    updatePayload.minimumDispatchFee = String(parsed.minimumDispatchFee);
  }

  if (parsed.roundToNearestDollar !== undefined) {
    updatePayload.roundToNearestDollar = parsed.roundToNearestDollar;
  }

  if (parsed.allowedTruckTypes !== undefined) {
    updatePayload.allowedTruckTypes = parsed.allowedTruckTypes;
  }

  if (parsed.timezone !== undefined) {
    updatePayload.timezone = parsed.timezone;
  }

  if (parsed.csvIncludeHeaders !== undefined) {
    updatePayload.csvIncludeHeaders = parsed.csvIncludeHeaders;
  }

  if (parsed.csvDateFormat !== undefined) {
    updatePayload.csvDateFormat = parsed.csvDateFormat;
  }

  if (parsed.csvMaxRows !== undefined) {
    updatePayload.csvMaxRows = parsed.csvMaxRows;
  }

  if (parsed.csvFileNamePrefix !== undefined) {
    updatePayload.csvFileNamePrefix = parsed.csvFileNamePrefix;
  }

  if (parsed.directAdminApprovalMode !== undefined) {
    updatePayload.directAdminApprovalMode = parsed.directAdminApprovalMode;
  }

  const settingsResult = await db()
    .from(T.OrganizationSettings)
    .update(updatePayload)
    .eq("organizationId", scope.organizationId)
    .select("*")
    .single();

  const settings = assertDb(settingsResult);

  if (parsed.timezone !== undefined || parsed.currency !== undefined) {
    const organizationUpdateResult = await db()
      .from(T.Organization)
      .update({
        ...(parsed.timezone !== undefined ? { timezone: parsed.timezone } : {}),
        ...(parsed.currency !== undefined ? { currency: parsed.currency } : {}),
        updatedAt: nowIso(),
      })
      .eq("id", scope.organizationId);

    assertDbVoid(organizationUpdateResult);
  }

  if (parsed.allowedStatusReasons !== undefined) {
    await syncStatusReasons(scope.organizationId, parsed.allowedStatusReasons);
  }

  const statusReasons = await loadStatusReasons(scope.organizationId);
  const preferences = await getOrganizationPreferences(scope.organizationId);
  const nextSnapshot = mapSettings(
    settings,
    statusReasons,
    preferences.currency,
  );

  await writeAuditLog({
    organizationId: scope.organizationId,
    actorUserId: actor.id,
    action: "SETTINGS_UPDATED",
    entityType: "OrganizationSettings",
    entityId: settings.id,
    metadata: {
      entityName: "Organization Settings",
      changedFields,
      oldData: previousSnapshot,
      newData: nextSnapshot,
    } as unknown as JsonValue,
  });

  const categoryAuditMetadata = {
    entityName: "Organization Settings",
    changedFields,
    oldData: previousSnapshot,
    newData: nextSnapshot,
  } as unknown as JsonValue;

  if (
    DISPATCH_FEE_SETTING_FIELDS.some((field) =>
      Object.prototype.hasOwnProperty.call(parsed, field),
    )
  ) {
    await writeAuditLog({
      organizationId: scope.organizationId,
      actorUserId: actor.id,
      action: "SETTINGS_DISPATCH_FEE_RULES_UPDATED",
      entityType: "OrganizationSettings",
      entityId: settings.id,
      metadata: categoryAuditMetadata,
    });
  }

  if (parsed.allowedTruckTypes !== undefined) {
    await writeAuditLog({
      organizationId: scope.organizationId,
      actorUserId: actor.id,
      action: "SETTINGS_TRUCK_TYPES_UPDATED",
      entityType: "OrganizationSettings",
      entityId: settings.id,
      metadata: categoryAuditMetadata,
    });
  }

  if (parsed.allowedStatusReasons !== undefined) {
    await writeAuditLog({
      organizationId: scope.organizationId,
      actorUserId: actor.id,
      action: "SETTINGS_STATUS_REASONS_UPDATED",
      entityType: "OrganizationSettings",
      entityId: settings.id,
      metadata: categoryAuditMetadata,
    });
  }

  if (parsed.directAdminApprovalMode !== undefined) {
    await writeAuditLog({
      organizationId: scope.organizationId,
      actorUserId: actor.id,
      action: "SETTINGS_DIRECT_APPROVAL_UPDATED",
      entityType: "OrganizationSettings",
      entityId: settings.id,
      metadata: categoryAuditMetadata,
    });
  }

  return nextSnapshot;
}
