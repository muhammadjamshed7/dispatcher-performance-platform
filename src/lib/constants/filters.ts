export const FILTER_ALL = "all" as const;

export function isFilterAll(
  value?: string | null,
): value is typeof FILTER_ALL | null | undefined {
  return !value || value === FILTER_ALL;
}

export function sanitizeFilterId(value?: string | null): string | undefined {
  return isFilterAll(value) ? undefined : value;
}
