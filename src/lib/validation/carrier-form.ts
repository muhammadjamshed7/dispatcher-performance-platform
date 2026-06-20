import { z } from "zod";

import { TRUCK_TYPES } from "@/lib/constants/truck-types";
import {
  TEAM_STATUS_ACTIVE,
  TEAM_STATUSES,
} from "@/lib/constants/team-statuses";

export const carrierFormSchema = z.object({
  carrierName: z.string().trim().min(1, "Carrier name is required"),
  driverName: z.string().trim().min(1, "Driver name is required"),
  mcNumber: z.string().trim().min(1, "MC number is required"),
  dispatchFeePercentage: z
    .number({ message: "Dispatch fee percentage is required" })
    .min(0, "Must be at least 0")
    .max(100, "Must be at most 100"),
  truckType: z.enum(TRUCK_TYPES, { message: "Truck type is required" }),
  assignedTeam: z.string().trim().min(1, "Assigned team is required"),
  assignedDispatcher: z
    .string()
    .trim()
    .min(1, "Assigned dispatcher is required"),
  status: z.enum(TEAM_STATUSES, { message: "Status is required" }),
  notes: z.string().trim().optional(),
});

export type CarrierFormValues = z.infer<typeof carrierFormSchema>;

export const defaultCarrierFormValues: CarrierFormValues = {
  carrierName: "",
  driverName: "",
  mcNumber: "",
  dispatchFeePercentage: 10,
  truckType: "DRY_VAN",
  assignedTeam: "",
  assignedDispatcher: "",
  status: TEAM_STATUS_ACTIVE,
  notes: "",
};

export const carrierReassignSchema = z.object({
  assignedTeam: z.string().trim().min(1, "Assigned team is required"),
  assignedDispatcher: z
    .string()
    .trim()
    .min(1, "Assigned dispatcher is required"),
});

export type CarrierReassignValues = z.infer<typeof carrierReassignSchema>;
