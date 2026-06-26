/**
 * Returns true when a cell value would be interpreted as a formula by a
 * spreadsheet application (CSV injection). Legitimate positive/negative numbers
 * (e.g. "-12.5") are intentionally NOT flagged so numeric columns stay numeric.
 */
function startsWithFormulaTrigger(str: string): boolean {
  const first = str[0];

  if (first === "=" || first === "@" || first === "\t" || first === "\r") {
    return true;
  }

  if (first === "+" || first === "-") {
    return !Number.isFinite(Number(str));
  }

  return false;
}

/**
 * Escapes a single CSV cell:
 * - Neutralizes spreadsheet formula injection by prefixing risky values with a
 *   single quote (so `=`, `+`, `-`, `@`, tab, CR-led strings render as text).
 * - Quotes and escapes values containing delimiters, quotes, or newlines.
 */
export function escapeCsvCell(
  value: string | number | null | undefined,
): string {
  if (value === null || value === undefined) {
    return "";
  }

  let str = String(value);

  if (str.length > 0 && startsWithFormulaTrigger(str)) {
    str = `'${str}`;
  }

  if (
    str.includes(",") ||
    str.includes('"') ||
    str.includes("\n") ||
    str.includes("\r")
  ) {
    return `"${str.replace(/"/g, '""')}"`;
  }

  return str;
}

/** Builds a CSV document from a matrix of cell values. */
export function buildCsv(
  rows: (string | number | null | undefined)[][],
): string {
  return rows.map((row) => row.map(escapeCsvCell).join(",")).join("\r\n");
}
