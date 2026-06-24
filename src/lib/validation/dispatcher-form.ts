import { z } from "zod";

import { DISPATCHER, TEAM_LEAD } from "@/lib/constants/roles";
import {
  TEAM_STATUS_ACTIVE,
  TEAM_STATUSES,
} from "@/lib/constants/team-statuses";

export const DISPATCHER_ROLES = [DISPATCHER, TEAM_LEAD] as const;

export const dispatcherFormSchema = z.object({
  fullName: z.string().trim().min(1, "Full name is required"),
  email: z
    .string()
    .trim()
    .min(1, "Email is required")
    .email("Enter a valid email"),
  phoneNumber: z.string().trim().optional(),
  team: z.string().trim().min(1, "Team is required"),
  role: z.enum(DISPATCHER_ROLES, { message: "Role is required" }),
  status: z.enum(TEAM_STATUSES, { message: "Status is required" }),
});

export type DispatcherFormValues = z.infer<typeof dispatcherFormSchema>;

export const defaultDispatcherFormValues: DispatcherFormValues = {
  fullName: "",
  email: "",
  phoneNumber: "",
  team: "",
  role: DISPATCHER,
  status: TEAM_STATUS_ACTIVE,
};
