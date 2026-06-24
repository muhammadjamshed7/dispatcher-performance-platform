import type { Role } from "@/lib/constants/roles";
import type { UserStatus } from "@/lib/auth/user-statuses";

export type SessionUser = {
  userId: string;
  fullName: string;
  email: string;
  role: Role;
  status: UserStatus;
  teamId: string | null;
  teamName?: string | null;
  dispatcherId: string | null;
  lastLoginAt: string | null;
  timezone: string;
  currency: string;
};
