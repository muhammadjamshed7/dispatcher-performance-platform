export const DAILY = "DAILY" as const;
export const WEEKLY = "WEEKLY" as const;
export const MONTHLY = "MONTHLY" as const;
export const HISTORICAL = "HISTORICAL" as const;
export const CUSTOM = "CUSTOM" as const;

export const REPORT_PERIODS = [
  DAILY,
  WEEKLY,
  MONTHLY,
  HISTORICAL,
  CUSTOM,
] as const;

export type ReportPeriod = (typeof REPORT_PERIODS)[number];
