export type FinanceDateRangeOption = {
  value: string;
  label: string;
};

export const FINANCE_DATE_RANGE_OPTIONS: FinanceDateRangeOption[] = [
  { value: "today", label: "Today" },
  { value: "this-week", label: "This week" },
  { value: "this-month", label: "This month" },
  { value: "custom", label: "Custom date range" },
];
