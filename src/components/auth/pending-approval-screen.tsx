"use client";

import Link from "next/link";
import { Clock } from "lucide-react";

import { AuthStateScreen } from "@/components/auth/auth-state-screen";
import { LogoutButton } from "@/components/auth/logout-button";
import { buttonVariants } from "@/components/ui/button";
import { getLoginPathForRole } from "@/lib/auth/roles";
import type { Role } from "@/lib/constants/roles";

type PendingApprovalScreenProps = {
  role: Role;
  email?: string;
};

export function PendingApprovalScreen({ role, email }: PendingApprovalScreenProps) {
  return (
    <AuthStateScreen
      icon={Clock}
      iconClassName="bg-amber-500/10 text-amber-600"
      title="Pending Approval"
      description={`Your account is waiting for administrator approval before you can access the platform.${email ? ` (${email})` : ""}`}
    >
      <p className="text-center text-sm text-muted-foreground">
        Dispatcher registrations require admin approval. Team Lead accounts are created
        by an administrator only.
      </p>
      <LogoutButton redirectTo={getLoginPathForRole(role)} className="w-full" />
      <Link href="/" className={buttonVariants({ variant: "outline" })}>
        Return home
      </Link>
    </AuthStateScreen>
  );
}
