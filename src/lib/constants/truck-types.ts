export const FLATBED = "FLATBED" as const;
export const POWER_ONLY = "POWER_ONLY" as const;
export const BOX_TRUCK = "BOX_TRUCK" as const;
export const REEFER = "REEFER" as const;
export const CARGO_VAN = "CARGO_VAN" as const;
export const DRY_VAN = "DRY_VAN" as const;
export const HOTSHOT = "HOTSHOT" as const;

export const TRUCK_TYPES = [
  FLATBED,
  POWER_ONLY,
  BOX_TRUCK,
  REEFER,
  CARGO_VAN,
  DRY_VAN,
  HOTSHOT,
] as const;

export type TruckType = (typeof TRUCK_TYPES)[number];
