import { DISPATCHER, TEAM_LEAD, type Role } from "@/lib/constants/roles";
import {
  PENDING_ADMIN_APPROVAL,
  PENDING_TEAM_LEAD_APPROVAL,
  type ActivityApprovalStatus,
} from "@/lib/constants/activity-approval";

export function resolveEditRequestApprovalStatus(
  role: Role,
  directAdminApproval: boolean,
): ActivityApprovalStatus {
  if (role === TEAM_LEAD) {
    return PENDING_ADMIN_APPROVAL;
  }

  if (role === DISPATCHER) {
    return directAdminApproval
      ? PENDING_ADMIN_APPROVAL
      : PENDING_TEAM_LEAD_APPROVAL;
  }

  throw new Error(`Unsupported edit request role: ${role}`);
}
