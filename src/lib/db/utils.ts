import "server-only";

import type { PostgrestError } from "@supabase/supabase-js";

import { ValidationError } from "@/lib/errors/validation-error";

export function unwrapRelation<T>(
  value: T | T[] | null | undefined,
): T | null {
  if (value === null || value === undefined) {
    return null;
  }

  return Array.isArray(value) ? (value[0] ?? null) : value;
}

export function createId(): string {
  return crypto.randomUUID();
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function toIsoString(value: string | Date): string {
  return typeof value === "string" ? value : value.toISOString();
}

export function toDateOnly(value: string | Date): string {
  return toIsoString(value).slice(0, 10);
}

export function decimalToNumber(
  value: string | number | { toNumber(): number } | null | undefined,
): number | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  if (typeof value === "number") {
    return value;
  }

  return value.toNumber();
}

export function assertDb<T>(
  result: { data: T; error: PostgrestError | null },
  notFoundMessage?: string,
): T {
  if (result.error) {
    throw mapDbError(result.error);
  }

  if (result.data === null || result.data === undefined) {
    if (notFoundMessage) {
      throw new ValidationError(notFoundMessage);
    }

    throw new Error("Database query returned no data.");
  }

  return result.data;
}

export function assertDbVoid(result: { error: PostgrestError | null }): void {
  if (result.error) {
    throw mapDbError(result.error);
  }
}

const UNIQUE_MESSAGES: Record<string, string> = {
  carrierId_activityDate:
    "An activity already exists for this carrier on that date.",
  DailyActivity_carrierId_activityDate_key:
    "An activity already exists for this carrier on that date.",
  organizationId_mcNumber: "A carrier with this MC number already exists.",
  Carrier_organizationId_mcNumber_key:
    "A carrier with this MC number already exists.",
  organizationId_email: "A user with this email already exists.",
  User_organizationId_email_key: "A user with this email already exists.",
  organizationId_name: "A team with this name already exists.",
  Team_organizationId_name_key: "A team with this name already exists.",
  organizationId_label: "This status reason already exists.",
};

function mapDbError(error: PostgrestError): Error {
  if (error.code === "23505") {
    for (const [key, message] of Object.entries(UNIQUE_MESSAGES)) {
      if (error.message.includes(key) || error.details?.includes(key)) {
        return new ValidationError(message);
      }
    }

    return new ValidationError("A record with these values already exists.");
  }

  return new Error(error.message);
}

export function applyTeamScope<
  T extends { eq: (col: string, val: string) => T },
>(
  query: T,
  scope: { isCompanyWide: boolean; teamId: string | null },
  column = "id",
): T {
  if (scope.isCompanyWide) {
    return query;
  }

  if (scope.teamId) {
    return query.eq(column, scope.teamId);
  }

  return query.eq(column, "__none__");
}

export async function countRows(
  table: string,
  filters: Array<{ column: string; value: string | null; op?: "eq" | "is" }>,
): Promise<number> {
  const { db } = await import("@/lib/db/client");
  let query = db().from(table).select("*", { count: "exact", head: true });

  for (const filter of filters) {
    if (filter.op === "is") {
      query = query.is(filter.column, filter.value);
    } else {
      query = query.eq(filter.column, filter.value as string);
    }
  }

  const { count, error } = await query;

  if (error) {
    throw mapDbError(error);
  }

  return count ?? 0;
}
