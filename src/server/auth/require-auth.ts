import "server-only";

import { ForbiddenError } from "@/lib/errors/forbidden-error";
import { NotFoundError } from "@/lib/errors/not-found-error";
import type { Role } from "@/lib/constants/roles";
import { ACTIVE } from "@/lib/auth/user-statuses";
import { getAccessDeniedMessage } from "@/lib/auth/permissions";
import {
  buildAccessScope,
  type AccessScope,
  type AuthContextUser,
} from "@/server/auth/types";
import { getCurrentUser } from "@/server/auth/session";

export class UnauthorizedError extends Error {
  constructor(message = "Authentication required.") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

export async function requireUser(): Promise<AuthContextUser> {
  const user = await getCurrentUser();

  if (!user) {
    throw new UnauthorizedError();
  }

  return user;
}

export async function requireActiveUser(): Promise<AuthContextUser> {
  const user = await requireUser();

  if (user.status !== ACTIVE) {
    throw new ForbiddenError(
      getAccessDeniedMessage(
        {
          userId: user.id,
          fullName: user.fullName,
          email: user.email,
          role: user.role,
          status: user.status,
          teamId: user.teamId,
          dispatcherId: user.dispatcherId,
          lastLoginAt: user.lastLoginAt ?? null,
          timezone: user.timezone,
          currency: user.currency,
        },
        user.role,
      ),
    );
  }

  return user;
}

export async function requireRole(
  requiredRole: Role,
): Promise<AuthContextUser> {
  const user = await requireActiveUser();

  if (user.role !== requiredRole) {
    throw new ForbiddenError(
      getAccessDeniedMessage(
        {
          userId: user.id,
          fullName: user.fullName,
          email: user.email,
          role: user.role,
          status: user.status,
          teamId: user.teamId,
          dispatcherId: user.dispatcherId,
          lastLoginAt: user.lastLoginAt ?? null,
          timezone: user.timezone,
          currency: user.currency,
        },
        requiredRole,
      ),
    );
  }

  return user;
}

export async function requireAccessScope(requiredRole?: Role): Promise<{
  user: AuthContextUser;
  scope: AccessScope;
}> {
  const user = requiredRole
    ? await requireRole(requiredRole)
    : await requireActiveUser();

  return {
    user,
    scope: buildAccessScope(user),
  };
}

export function assertTeamAccess(scope: AccessScope, teamId: string): void {
  if (scope.isCompanyWide) {
    return;
  }

  if (scope.teamId !== teamId) {
    throw new ForbiddenError("You do not have access to this team.");
  }
}

export function assertDispatcherAccess(
  scope: AccessScope,
  dispatcherId: string,
): void {
  if (scope.isCompanyWide || scope.role === "TEAM_LEAD") {
    return;
  }

  if (scope.dispatcherId !== dispatcherId) {
    throw new ForbiddenError(
      "You do not have access to this dispatcher record.",
    );
  }
}

export function assertOrganizationResource(
  scope: AccessScope,
  organizationId: string,
): void {
  if (scope.organizationId !== organizationId) {
    throw new NotFoundError("Resource not found.");
  }
}
