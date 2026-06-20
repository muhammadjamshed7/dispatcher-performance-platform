import { ADMIN, DISPATCHER, TEAM_LEAD, type Role } from "@/lib/constants/roles";
import {
  ACTIVE,
  INACTIVE,
  INVITED,
  PENDING_APPROVAL,
  type UserStatus,
} from "@/lib/auth/user-statuses";
import type { MockSession } from "@/lib/auth/mock-session";

export function isSessionActive(session: MockSession | null): session is MockSession {
  return session !== null && session.status === ACTIVE;
}

export function canLoginWithStatus(status: UserStatus): boolean {
  return status === ACTIVE;
}

export function canAccessAdminRoutes(session: MockSession | null): boolean {
  return isSessionActive(session) && session.role === ADMIN;
}

export function canAccessTeamLeadRoutes(session: MockSession | null): boolean {
  return isSessionActive(session) && session.role === TEAM_LEAD;
}

export function canAccessDispatcherRoutes(session: MockSession | null): boolean {
  return isSessionActive(session) && session.role === DISPATCHER;
}

export function canAccessRoleRoute(
  session: MockSession | null,
  requiredRole: Role,
): boolean {
  if (!isSessionActive(session)) {
    return false;
  }

  return session.role === requiredRole;
}

export function getAccessDeniedMessage(
  session: MockSession | null,
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

export function canApproveUsers(session: MockSession | null): boolean {
  return canAccessAdminRoutes(session);
}

export function canManageTeams(session: MockSession | null): boolean {
  return canAccessAdminRoutes(session);
}

export function canViewReports(session: MockSession | null): boolean {
  return (
    isSessionActive(session) &&
    (session.role === ADMIN || session.role === TEAM_LEAD)
  );
}

export function canLogDailyActivity(session: MockSession | null): boolean {
  return (
    isSessionActive(session) &&
    (session.role === ADMIN ||
      session.role === TEAM_LEAD ||
      session.role === DISPATCHER)
  );
}
