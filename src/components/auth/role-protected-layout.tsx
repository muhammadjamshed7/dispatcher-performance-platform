"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { MockSessionProvider } from "@/components/auth/mock-session-provider";
import { RoleGuard } from "@/components/auth/role-guard";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import {
  isPublicAuthPath,
  ROLE_ROUTE_PREFIX,
} from "@/lib/auth/roles";
import type { Role } from "@/lib/constants/roles";

type RoleProtectedLayoutProps = {
  role: Role;
  children: ReactNode;
};

export function RoleProtectedLayout({ role, children }: RoleProtectedLayoutProps) {
  const pathname = usePathname();
  const prefix = ROLE_ROUTE_PREFIX[role];
  const isAuthPage =
    pathname.startsWith(`/${prefix}`) && isPublicAuthPath(pathname);

  if (isAuthPage) {
    return <MockSessionProvider>{children}</MockSessionProvider>;
  }

  return (
    <MockSessionProvider>
      <RoleGuard requiredRole={role}>
        <DashboardShell>{children}</DashboardShell>
      </RoleGuard>
    </MockSessionProvider>
  );
}
