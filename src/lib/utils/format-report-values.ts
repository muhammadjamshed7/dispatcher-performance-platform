export {
  formatCurrency,
  formatCurrencyCompact,
} from "@/lib/utils/format-currency";
export { formatPercent } from "@/lib/utils/format-percent";
export { formatRatePerMile } from "@/lib/utils/format-rate-per-mile";
export {
  formatNullableNumber,
  formatNullableText,
} from "@/lib/utils/format-display";

/** @deprecated Use formatCurrencyCompact */
export { formatCurrencyCompact as formatReportCurrency } from "@/lib/utils/format-currency";

/** @deprecated Use formatCurrency */
export { formatCurrency as formatReportCurrencyDetailed } from "@/lib/utils/format-currency";

/** @deprecated Use formatPercent */
export { formatPercent as formatReportPercent } from "@/lib/utils/format-percent";

/** @deprecated Use formatRatePerMile */
export { formatRatePerMile as formatReportRatePerMile } from "@/lib/utils/format-rate-per-mile";

/** @deprecated Use formatNullableText */
export { formatNullableText as formatReportText } from "@/lib/utils/format-display";

/** @deprecated Use formatNullableNumber */
export { formatNullableNumber as formatReportNumber } from "@/lib/utils/format-display";
