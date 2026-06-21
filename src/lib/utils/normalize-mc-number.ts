export function normalizeMcNumber(value: string): string {
  return value.trim().toUpperCase().replace(/\s+/g, "");
}
