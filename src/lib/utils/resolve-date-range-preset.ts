import {
  formatDateKey,
  resolveDateRange,
  resolveDateRangeStrict,
} from "@/lib/utils/resolve-date-range";

export function resolveDateRangePreset(preset: string): {
  dateFrom: string;
  dateTo: string;
} {
  return resolveDateRange(preset);
}

export function formatDateRangeLabel(dateFrom: string, dateTo: string): string {
  const from = new Date(`${dateFrom}T00:00:00Z`);
  const to = new Date(`${dateTo}T00:00:00Z`);
  const sameMonth =
    from.getUTCFullYear() === to.getUTCFullYear() &&
    from.getUTCMonth() === to.getUTCMonth();

  const fromLabel = from.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    ...(sameMonth ? {} : { year: "numeric" }),
  });
  const toLabel = to.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return `${fromLabel} – ${toLabel}`;
}

export function formatGrowthLabel(
  growth: number | null | undefined,
  suffix = "vs previous period",
): string | null {
  if (growth === null || growth === undefined) {
    return null;
  }

  const arrow = growth >= 0 ? "↑" : "↓";
  return `${arrow} ${Math.abs(growth).toFixed(1)}% ${suffix}`;
}

export { formatDateKey, resolveDateRange, resolveDateRangeStrict };
