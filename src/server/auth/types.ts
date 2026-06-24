import type { User } from "@/lib/db/types";
import type { Role } from "@/lib/constants/roles";

export type AuthContextUser = User & {
  teamName: string | null;
  dispatcherId: string | null;
  timezone: string;
  currency: string;
};

export type AccessScope = {
  organizationId: string;
  role: Role;
  userId: string;
  teamId: string | null;
  dispatcherId: string | null;
  isCompanyWide: boolean;
};

export function buildAccessScope(user: AuthContextUser): AccessScope {
  return {
    organizationId: user.organizationId,
    role: user.role as Role,
    userId: user.id,
    teamId: user.teamId,
    dispatcherId: user.dispatcherId,
    isCompanyWide: user.role === "ADMIN",
  };
}
