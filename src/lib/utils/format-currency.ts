export type FormatCurrencyOptions = {
  currency?: string;
  maximumFractionDigits?: number;
  nullLabel?: string;
};

let defaultCurrency = "USD";

export function setDefaultCurrency(currency: string | null | undefined): void {
  if (!currency) {
    defaultCurrency = "USD";
    return;
  }

  try {
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
    }).format(0);
    defaultCurrency = currency.toUpperCase();
  } catch {
    defaultCurrency = "USD";
  }
}

export function formatCurrency(
  value: number | null | undefined,
  options: FormatCurrencyOptions = {},
): string {
  const {
    currency = defaultCurrency,
    maximumFractionDigits = 2,
    nullLabel = "N/A",
  } = options;

  if (value === null || value === undefined) {
    return nullLabel;
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits,
    minimumFractionDigits: maximumFractionDigits === 0 ? 0 : undefined,
  }).format(value);
}

export function formatCurrencyCompact(
  value: number | null | undefined,
  nullLabel = "N/A",
): string {
  return formatCurrency(value, { maximumFractionDigits: 0, nullLabel });
}
