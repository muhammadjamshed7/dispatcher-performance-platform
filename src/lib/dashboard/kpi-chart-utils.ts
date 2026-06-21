export type KpiChartPoint = {
  date: string;
  value: number;
};

export function buildTrendChartData(
  dates: string[],
  values: number[],
): KpiChartPoint[] {
  return dates.map((date, index) => ({
    date,
    value: values[index] ?? 0,
  }));
}

export function formatKpiCurrencyAxis(value: number) {
  if (value >= 1000) {
    return `$${Math.round(value / 1000)}K`;
  }

  return `$${value}`;
}

export function formatKpiCurrencyLabel(value: number) {
  if (value >= 1000) {
    return `$${Math.round(value).toLocaleString()}`;
  }

  return `$${value}`;
}

export function computeYAxisMax(values: number[], paddingRatio = 1.15) {
  const max = values.reduce((current, value) => Math.max(current, value), 0);
  if (max <= 0) return 10;

  const padded = Math.ceil(max * paddingRatio);
  if (padded <= 10) return 10;
  if (padded <= 50) return Math.ceil(padded / 5) * 5;
  if (padded <= 100) return Math.ceil(padded / 10) * 10;

  return Math.ceil(padded / 1000) * 1000;
}

export function computeGrowthYAxisDomain(values: number[]) {
  if (values.length === 0) {
    return [0, 10] as const;
  }

  const max = Math.max(...values, 0);
  const min = Math.min(...values, 0);

  if (max === 0 && min === 0) {
    return [0, 10] as const;
  }

  const span = Math.max(Math.abs(max), Math.abs(min));
  const padding = Math.max(Math.ceil(span * 0.15), 5);

  return [Math.floor(min - padding), Math.ceil(max + padding)] as const;
}

export function formatGrowthPercentLabel(value: number) {
  return `${Math.round(value * 10) / 10}%`;
}

export function formatGrowthPercentAxis(value: number) {
  return `${value}%`;
}

export function computeYAxisMaxFromRows<T extends Record<string, unknown>>(
  rows: T[],
  keys: (keyof T)[],
  paddingRatio = 1.2,
) {
  const values = rows.flatMap((row) =>
    keys.map((key) => Number(row[key] ?? 0)),
  );

  return computeYAxisMax(values, paddingRatio);
}
