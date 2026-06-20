"use client";

import Link from "next/link";
import { ShieldX } from "lucide-react";

import { AuthStateScreen } from "@/components/auth/auth-state-screen";
import { buttonVariants } from "@/components/ui/button";
import { getDashboardPathForRole, getLoginPathForRole } from "@/lib/auth/roles";
import type { Role } from "@/lib/constants/roles";

type AccessDeniedProps = {
  title?: string;
  message: string;
  role?: Role;
  showDashboardLink?: boolean;
};

export function AccessDenied({
  title = "Access Denied",
  message,
  role,
  showDashboardLink = true,
}: AccessDeniedProps) {
  return (
    <AuthStateScreen
      icon={ShieldX}
      iconClassName="bg-destructive/10 text-destructive"
      title={title}
      description={message}
    >
      {showDashboardLink && role ? (
        <Link
          href={getDashboardPathForRole(role)}
          className={buttonVariants({ variant: "default" })}
        >
          Go to your dashboard
        </Link>
      ) : null}
      {role ? (
        <Link
          href={getLoginPathForRole(role)}
          className={buttonVariants({ variant: "outline" })}
        >
          Back to sign in
        </Link>
      ) : (
        <Link href="/" className={buttonVariants({ variant: "outline" })}>
          Return home
        </Link>
      )}
    </AuthStateScreen>
  );
}
