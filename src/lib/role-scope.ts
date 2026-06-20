import { ADMIN, DISPATCHER, TEAM_LEAD, type Role } from "@/lib/constants/roles";
import type { MockSession } from "@/lib/auth/mock-session";
import {
  mockDispatchers,
  mockTeams,
  mockUsers,
  getMockUserForRole,
} from "@/lib/mock-data";
import type {
  Carrier,
  DailyActivity,
  Dispatcher,
  RoleScope,
  Team,
  User,
} from "@/lib/types";

function resolveUserFromSession(session: MockSession): User {
  return (
    mockUsers.find((user) => user.id === session.userId) ??
    getMockUserForRole(session.role)
  );
}

export function buildRoleScopeFromSession(session: MockSession): RoleScope {
  const user = resolveUserFromSession(session);
  const teamName =
    user.teamName ??
    mockTeams.find((team) => team.id === session.teamId)?.name ??
    null;
  const dispatcherName =
    session.role === DISPATCHER
      ? (mockDispatchers.find((dispatcher) => dispatcher.id === session.dispatcherId)
          ?.fullName ?? user.fullName)
      : null;

  if (session.role === ADMIN) {
    return {
      role: ADMIN,
      user,
      teamName: null,
      dispatcherName: null,
      scopeLabel: "Company-wide view",
      isCompanyWide: true,
    };
  }

  if (session.role === TEAM_LEAD) {
    return {
      role: TEAM_LEAD,
      user,
      teamName,
      dispatcherName: null,
      scopeLabel: teamName ? `${teamName} team view` : "Team view",
      isCompanyWide: false,
    };
  }

  return {
    role: DISPATCHER,
    user,
    teamName,
    dispatcherName,
    scopeLabel: dispatcherName
      ? `${dispatcherName} personal view`
      : "Dispatcher personal view",
    isCompanyWide: false,
  };
}

export function buildRoleScope(role: Role): RoleScope {
  const user = getMockUserForRole(role);

  if (role === ADMIN) {
    return {
      role,
      user,
      teamName: null,
      dispatcherName: null,
      scopeLabel: "Company-wide view",
      isCompanyWide: true,
    };
  }

  if (role === TEAM_LEAD) {
    return {
      role,
      user,
      teamName: user.teamName ?? null,
      dispatcherName: null,
      scopeLabel: user.teamName ? `${user.teamName} team view` : "Team view",
      isCompanyWide: false,
    };
  }

  return {
    role,
    user,
    teamName: user.teamName ?? null,
    dispatcherName: user.fullName,
    scopeLabel: `${user.fullName} personal view`,
    isCompanyWide: false,
  };
}

export function filterTeamsByScope(teams: Team[], scope: RoleScope): Team[] {
  if (scope.isCompanyWide || !scope.teamName) {
    return teams;
  }

  return teams.filter((team) => team.name === scope.teamName);
}

export function filterDispatchersByScope(
  dispatchers: Dispatcher[],
  scope: RoleScope,
): Dispatcher[] {
  if (scope.isCompanyWide) {
    return dispatchers;
  }

  if (scope.role === DISPATCHER && scope.dispatcherName) {
    return dispatchers.filter(
      (dispatcher) => dispatcher.fullName === scope.dispatcherName,
    );
  }

  if (scope.teamName) {
    return dispatchers.filter((dispatcher) => dispatcher.teamName === scope.teamName);
  }

  return dispatchers;
}

export function filterCarriersByScope(
  carriers: Carrier[],
  scope: RoleScope,
): Carrier[] {
  if (scope.isCompanyWide) {
    return carriers;
  }

  if (scope.role === DISPATCHER && scope.dispatcherName) {
    return carriers.filter(
      (carrier) => carrier.assignedDispatcherName === scope.dispatcherName,
    );
  }

  if (scope.teamName) {
    return carriers.filter(
      (carrier) => carrier.assignedTeamName === scope.teamName,
    );
  }

  return carriers;
}

export function filterActivitiesByScope(
  activities: DailyActivity[],
  scope: RoleScope,
): DailyActivity[] {
  if (scope.isCompanyWide) {
    return activities;
  }

  if (scope.role === DISPATCHER && scope.dispatcherName) {
    return activities.filter(
      (activity) => activity.dispatcherName === scope.dispatcherName,
    );
  }

  if (scope.teamName) {
    return activities.filter((activity) => activity.teamName === scope.teamName);
  }

  return activities;
}

export function canManageTeams(role: Role): boolean {
  return role === ADMIN;
}

export function canManageDispatchers(role: Role): boolean {
  return role === ADMIN || role === TEAM_LEAD;
}

export function canViewReports(role: Role): boolean {
  return role === ADMIN || role === TEAM_LEAD;
}
