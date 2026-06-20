"use client";

import Link from "next/link";
import { LogOut } from "lucide-react";

import { AuthStateScreen } from "@/components/auth/auth-state-screen";
import { buttonVariants } from "@/components/ui/button";
import { getLoginPathForRole } from "@/lib/auth/roles";
import type { Role } from "@/lib/constants/roles";

type LoggedOutScreenProps = {
  role?: Role;
  message?: string;
};

export function LoggedOutScreen({
  role,
  message = "You have been signed out. Sign in again to continue.",
}: LoggedOutScreenProps) {
  return (
    <AuthStateScreen
      icon={LogOut}
      iconClassName="bg-primary/10 text-primary"
      title="Signed Out"
      description={message}
    >
      {role ? (
        <Link href={getLoginPathForRole(role)} className={buttonVariants({ variant: "default" })}>
          Go to sign in
        </Link>
      ) : (
        <Link href="/" className={buttonVariants({ variant: "default" })}>
          Return home
        </Link>
      )}
    </AuthStateScreen>
  );
}
