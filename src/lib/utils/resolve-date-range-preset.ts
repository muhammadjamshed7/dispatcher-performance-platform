function formatDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function resolveDateRangePreset(preset: string): {
  dateFrom: string;
  dateTo: string;
} {
  const now = new Date();
  const dateTo = formatDateKey(now);

  switch (preset) {
    case "today":
      return { dateFrom: dateTo, dateTo };
    case "last-7-days": {
      const start = new Date(now);
      start.setUTCDate(now.getUTCDate() - 6);
      return { dateFrom: formatDateKey(start), dateTo };
    }
    case "last-30-days": {
      const start = new Date(now);
      start.setUTCDate(now.getUTCDate() - 29);
      return { dateFrom: formatDateKey(start), dateTo };
    }
    case "last-month": {
      const start = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1),
      );
      const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0));
      return { dateFrom: formatDateKey(start), dateTo: formatDateKey(end) };
    }
    case "this-month":
    default: {
      const start = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
      );
      return { dateFrom: formatDateKey(start), dateTo };
    }
  }
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
