import { ADMIN, DISPATCHER, TEAM_LEAD } from "@/lib/constants/roles";
import type { SessionUser } from "@/lib/auth/session-types";
import type {
  Carrier,
  DailyActivity,
  Dispatcher,
  RoleScope,
  Team,
  User,
} from "@/lib/types";

function userFromSession(session: SessionUser): User {
  return {
    id: session.userId,
    fullName: session.fullName,
    email: session.email,
    role: session.role,
    status: session.status,
    teamId: session.teamId,
    teamName: session.teamName ?? undefined,
    dispatcherId: session.dispatcherId,
  };
}

export function buildRoleScopeFromSession(session: SessionUser): RoleScope {
  const user = userFromSession(session);
  const teamName = session.teamName ?? null;
  const dispatcherName = session.role === DISPATCHER ? session.fullName : null;

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

export function emptyRoleScope(): RoleScope {
  return {
    role: ADMIN,
    user: {
      id: "",
      fullName: "",
      email: "",
      role: ADMIN,
      status: "INACTIVE",
      teamId: null,
      dispatcherId: null,
    },
    teamName: null,
    dispatcherName: null,
    scopeLabel: "Loading…",
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
