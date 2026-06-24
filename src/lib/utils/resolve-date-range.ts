export type WeekStartMode = "sunday" | "monday";

export type ResolveDateRangeOptions = {
  customDateFrom?: string;
  customDateTo?: string;
  weekStart?: WeekStartMode;
  timezone?: string;
  now?: Date;
  /** Used when custom preset is selected but one/both dates are missing. */
  customIncompleteFallback?: "this-month" | "partial";
};

export function formatDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function getDateKeyInTimeZone(date: Date, timezone = "UTC"): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );

  return `${values.year}-${values.month}-${values.day}`;
}

function parseDateKey(dateKey: string): Date {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(year!, month! - 1, day));
}

export function resolveDateRange(
  preset: string,
  options: ResolveDateRangeOptions = {},
): { dateFrom: string; dateTo: string } {
  const now = options.now ?? new Date();
  const dateTo = getDateKeyInTimeZone(now, options.timezone ?? "UTC");
  const today = parseDateKey(dateTo);
  const weekStart = options.weekStart ?? "sunday";

  switch (preset) {
    case "today":
      return { dateFrom: dateTo, dateTo };
    case "last-7-days": {
      const start = new Date(today);
      start.setUTCDate(today.getUTCDate() - 6);
      return { dateFrom: formatDateKey(start), dateTo };
    }
    case "last-30-days": {
      const start = new Date(today);
      start.setUTCDate(today.getUTCDate() - 29);
      return { dateFrom: formatDateKey(start), dateTo };
    }
    case "this-week": {
      const start = new Date(today);
      if (weekStart === "monday") {
        const weekday = today.getUTCDay();
        const mondayOffset = weekday === 0 ? 6 : weekday - 1;
        start.setUTCDate(today.getUTCDate() - mondayOffset);
      } else {
        start.setUTCDate(today.getUTCDate() - today.getUTCDay());
      }
      return { dateFrom: formatDateKey(start), dateTo };
    }
    case "last-month": {
      const start = new Date(
        Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 1, 1),
      );
      const end = new Date(
        Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 0),
      );
      return { dateFrom: formatDateKey(start), dateTo: formatDateKey(end) };
    }
    case "custom": {
      const from = options.customDateFrom?.trim();
      const to = options.customDateTo?.trim();

      if (from && to) {
        return { dateFrom: from, dateTo: to };
      }

      if (options.customIncompleteFallback === "partial") {
        return { dateFrom: from || dateTo, dateTo: to || dateTo };
      }

      const start = new Date(
        Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1),
      );
      return { dateFrom: formatDateKey(start), dateTo };
    }
    case "this-month":
    default: {
      const start = new Date(
        Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1),
      );
      return { dateFrom: formatDateKey(start), dateTo };
    }
  }
}

export function resolveDateRangeStrict(
  preset: string,
  customDateFrom?: string,
  customDateTo?: string,
  options: Omit<
    ResolveDateRangeOptions,
    "customDateFrom" | "customDateTo"
  > = {},
): { dateFrom: string; dateTo: string } {
  if (
    preset === "custom" &&
    (!customDateFrom?.trim() || !customDateTo?.trim())
  ) {
    throw new Error("Custom date range requires start and end dates.");
  }

  return resolveDateRange(preset, {
    ...options,
    customDateFrom,
    customDateTo,
  });
}
