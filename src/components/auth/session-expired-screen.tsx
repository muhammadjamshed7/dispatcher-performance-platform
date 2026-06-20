"use client";

import Link from "next/link";
import { Clock3 } from "lucide-react";

import { AuthStateScreen } from "@/components/auth/auth-state-screen";
import { buttonVariants } from "@/components/ui/button";

type SessionExpiredScreenProps = {
  loginHref?: string;
};

export function SessionExpiredScreen({
  loginHref = "/",
}: SessionExpiredScreenProps) {
  return (
    <AuthStateScreen
      icon={Clock3}
      iconClassName="bg-amber-500/10 text-amber-600"
      title="Session Expired"
      description="Your session has expired. Sign in again to continue. (Placeholder — real expiry will come from Supabase Auth.)"
    >
      <Link href={loginHref} className={buttonVariants({ variant: "default" })}>
        Sign in again
      </Link>
      <Link href="/" className={buttonVariants({ variant: "outline" })}>
        Return home
      </Link>
    </AuthStateScreen>
  );
}
