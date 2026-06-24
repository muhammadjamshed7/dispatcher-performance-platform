type CarrierLabelSource = {
  carrierName?: string | null;
  name?: string | null;
};

export function getCarrierDisplayName(
  carrier: CarrierLabelSource | null | undefined,
  fallback = "",
): string {
  if (!carrier) {
    return fallback;
  }

  const label = carrier.carrierName?.trim() || carrier.name?.trim() || "";
  return label || fallback;
}

export function resolveCarrierLabel(
  carrierId: string | null | undefined,
  labelById: Map<string, string>,
  fallbackLabel = "",
): string {
  if (!carrierId) {
    return "";
  }

  return labelById.get(carrierId) ?? fallbackLabel;
}
