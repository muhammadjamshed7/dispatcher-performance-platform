import { z } from "zod";

import { TEAM_STATUSES } from "@/lib/constants/team-statuses";

export const teamFormSchema = z.object({
  name: z.string().trim().min(1, "Team name is required"),
  teamLead: z.string().trim().min(1, "Team lead is required"),
  status: z.enum(TEAM_STATUSES),
});

export type TeamFormValues = z.infer<typeof teamFormSchema>;

export const defaultTeamFormValues: TeamFormValues = {
  name: "",
  teamLead: "",
  status: "ACTIVE",
};
