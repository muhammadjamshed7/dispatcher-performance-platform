import type { Role } from "@/lib/constants/roles";
import {
  INACTIVE,
  INVITED,
  PENDING_APPROVAL,
} from "@/lib/auth/user-statuses";
import type { SessionUser } from "@/lib/auth/session-types";

export function getAccessDeniedMessage(
  session: SessionUser | null,
  requiredRole: Role,
): string {
  if (!session) {
    return "You must sign in to access this page.";
  }

  if (session.status === PENDING_APPROVAL) {
    return "Your account is pending admin approval.";
  }

  if (session.status === INACTIVE) {
    return "Your account is inactive.";
  }

  if (session.status === INVITED) {
    return "Your invitation has not been accepted yet.";
  }

  if (session.role !== requiredRole) {
    return `This area is restricted to ${requiredRole.replaceAll("_", " ")} users.`;
  }

  return "You do not have access to this page.";
}
