import { z } from "zod";

import {
  CANCELLED,
  DELIVERED,
  NOT_BOOKED,
  NOT_WORKING,
  STATUSES,
} from "@/lib/constants/statuses";

export const dailyActivityFormSchema = z
  .object({
    date: z.string().min(1, "Date is required"),
    carrier: z.string().trim().min(1, "Carrier is required"),
    status: z.enum(STATUSES, { message: "Status is required" }),
    notes: z.string().trim().optional(),
    origin: z.string().trim().optional(),
    destination: z.string().trim().optional(),
    totalMiles: z.number().optional(),
    loadAmount: z.number().optional(),
    reason: z.string().trim().optional(),
  })
  .superRefine((data, context) => {
    if (data.status === DELIVERED) {
      if (!data.origin?.trim()) {
        context.addIssue({
          code: "custom",
          message: "Origin is required for delivered loads",
          path: ["origin"],
        });
      }

      if (!data.destination?.trim()) {
        context.addIssue({
          code: "custom",
          message: "Destination is required for delivered loads",
          path: ["destination"],
        });
      }

      if (data.totalMiles === undefined || data.totalMiles <= 0) {
        context.addIssue({
          code: "custom",
          message: "Total miles must be greater than 0",
          path: ["totalMiles"],
        });
      }

      if (data.loadAmount === undefined || data.loadAmount <= 0) {
        context.addIssue({
          code: "custom",
          message: "Load amount must be greater than 0",
          path: ["loadAmount"],
        });
      }

      return;
    }

    if (
      data.status === CANCELLED ||
      data.status === NOT_BOOKED ||
      data.status === NOT_WORKING
    ) {
      if (!data.reason?.trim()) {
        context.addIssue({
          code: "custom",
          message: "Reason is required for this status",
          path: ["reason"],
        });
      }
    }
  });

export type DailyActivityFormValues = z.infer<typeof dailyActivityFormSchema>;

export const defaultDailyActivityFormValues: DailyActivityFormValues = {
  date: new Date().toISOString().slice(0, 10),
  carrier: "",
  status: DELIVERED,
  notes: "",
  origin: "",
  destination: "",
  totalMiles: undefined,
  loadAmount: undefined,
  reason: "",
};

export {
  calculateRatePerMile,
} from "@/lib/utils/calculate-rate-per-mile";
export {
  calculateDispatchFee,
  calculateDispatchFeeEarned,
} from "@/lib/utils/calculate-dispatch-fee";
