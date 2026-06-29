import "server-only";

import type { AuditAction, JsonValue } from "@/lib/db/types";
import { T, db } from "@/lib/db/client";
import { assertDbVoid, createId, nowIso } from "@/lib/db/utils";

type AuditInput = {
  organizationId: string;
  actorUserId?: string | null;
  action: AuditAction;
  entityType: string;
  entityId?: string | null;
  metadata?: JsonValue;
};

const SENSITIVE_KEY_PATTERN =
  /(password|token|secret|authorization|cookie|session|service[_-]?role|servicekey|supabase|access[_-]?token|refresh[_-]?token|api[_-]?key|reset[_-]?token)/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function sanitizeAuditValue(value: unknown, key = ""): JsonValue | undefined {
  if (SENSITIVE_KEY_PATTERN.test(key)) {
    return "[REDACTED]";
  }

  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === "bigint") {
    return value.toString();
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => sanitizeAuditValue(item))
      .filter((item): item is JsonValue => item !== undefined);
  }

  if (isRecord(value)) {
    return Object.fromEntries(
      Object.entries(value)
        .map(([entryKey, entryValue]) => [
          entryKey,
          sanitizeAuditValue(entryValue, entryKey),
        ])
        .filter(
          (entry): entry is [string, JsonValue] => entry[1] !== undefined,
        ),
    );
  }

  return undefined;
}

function normalizeMetadata(metadata: unknown): Record<string, JsonValue> {
  const sanitized = sanitizeAuditValue(metadata);

  if (sanitized === null || sanitized === undefined) {
    return {};
  }

  if (isRecord(sanitized)) {
    return sanitized as Record<string, JsonValue>;
  }

  return { details: sanitized };
}

async function loadActorSnapshot(input: AuditInput): Promise<{
  actorName?: string;
  actorEmail?: string;
  actorRole?: string;
  actorTeamName?: string;
} | null> {
  if (!input.actorUserId) {
    return null;
  }

  const result = await db()
    .from(T.User)
    .select("fullName, email, role, team:Team!User_teamId_fkey(name)")
    .eq("id", input.actorUserId)
    .eq("organizationId", input.organizationId)
    .maybeSingle();

  if (result.error || !result.data) {
    return null;
  }

  const team = Array.isArray(result.data.team)
    ? result.data.team[0]
    : (result.data.team as { name?: string } | null);

  return {
    actorName: result.data.fullName as string,
    actorEmail: result.data.email as string,
    actorRole: result.data.role as string,
    actorTeamName: team?.name,
  };
}

export async function writeAuditLog(input: AuditInput): Promise<void> {
  try {
    const metadata = normalizeMetadata(input.metadata);
    const actorSnapshot = await loadActorSnapshot(input);

    if (actorSnapshot) {
      metadata.actorName ??= actorSnapshot.actorName ?? null;
      metadata.actorEmail ??= actorSnapshot.actorEmail ?? null;
      metadata.actorRole ??= actorSnapshot.actorRole ?? null;
      metadata.actorTeamName ??= actorSnapshot.actorTeamName ?? null;
    }

    const result = await db()
      .from(T.AuditLog)
      .insert({
        id: createId(),
        organizationId: input.organizationId,
        actorUserId: input.actorUserId ?? null,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId ?? null,
        metadata,
        createdAt: nowIso(),
      });

    assertDbVoid(result);
  } catch (error) {
    console.error("Failed to write audit log", {
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      error,
    });
  }
}
