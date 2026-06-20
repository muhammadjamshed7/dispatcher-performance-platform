"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";

import { AccessDenied } from "@/components/auth/access-denied";
import { useSession } from "@/components/auth/session-provider";
import { PendingApprovalScreen } from "@/components/auth/pending-approval-screen";
import { LoadingState } from "@/components/feedback/loading-state";
import {
  ACTIVE,
  INACTIVE,
  INVITED,
  PENDING_APPROVAL,
} from "@/lib/auth/user-statuses";
import { getAccessDeniedMessage } from "@/lib/auth/permissions";
import {
  getDashboardPathForRole,
  getLoginPathForRole,
} from "@/lib/auth/roles";
import type { Role } from "@/lib/constants/roles";

type RoleGuardProps = {
  requiredRole: Role;
  children: ReactNode;
};

export function RoleGuard({ requiredRole, children }: RoleGuardProps) {
  const router = useRouter();
  const { session, isLoading } = useSession();

  useEffect(() => {
    if (isLoading) {
      return;
    }

    if (!session) {
      router.replace(getLoginPathForRole(requiredRole));
      return;
    }

    if (session.status === ACTIVE && session.role !== requiredRole) {
      router.replace(getDashboardPathForRole(session.role));
    }
  }, [isLoading, requiredRole, router, session]);

  if (isLoading) {
    return <LoadingState title="Checking session…" rows={3} />;
  }

  if (!session) {
    return <LoadingState title="Redirecting to sign in…" rows={3} />;
  }

  if (session.status === PENDING_APPROVAL) {
    return <PendingApprovalScreen role={session.role} email={session.email} />;
  }

  if (session.status === INACTIVE || session.status === INVITED) {
    return (
      <AccessDenied
        message={getAccessDeniedMessage(session, requiredRole)}
        role={session.role}
      />
    );
  }

  if (session.role !== requiredRole) {
    return <LoadingState title="Redirecting to your dashboard…" rows={3} />;
  }

  return children;
}
