"use client";

import { useRouter } from "next/navigation";

import { useMockSession } from "@/components/auth/mock-session-provider";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type LogoutButtonProps = {
  redirectTo?: string;
  className?: string;
  variant?: "default" | "outline" | "ghost" | "secondary";
  size?: "default" | "sm" | "lg" | "icon" | "icon-sm";
  showLoggedOutNotice?: boolean;
};

export function LogoutButton({
  redirectTo = "/",
  className,
  variant = "outline",
  size = "sm",
  showLoggedOutNotice = true,
}: LogoutButtonProps) {
  const router = useRouter();
  const { signOut } = useMockSession();

  const handleLogout = () => {
    signOut();
    const target = showLoggedOutNotice
      ? `${redirectTo}${redirectTo.includes("?") ? "&" : "?"}loggedOut=1`
      : redirectTo;
    router.replace(target);
  };

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      className={cn(className)}
      onClick={handleLogout}
    >
      Sign out
    </Button>
  );
}
