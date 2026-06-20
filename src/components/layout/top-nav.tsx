"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, UserCircle } from "lucide-react";

import { LogoutButton } from "@/components/auth/logout-button";
import { useSession } from "@/components/auth/session-provider";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { publicEnv } from "@/lib/env";
import {
  getAccountPathForRole,
  getLoginPathForRole,
  getNavItemsForRole,
} from "@/lib/auth/roles";
import { isNavItemActive } from "@/lib/nav-utils";
import { cn } from "@/lib/utils";

export function TopNav() {
  const pathname = usePathname();
  const { session } = useSession();
  const navItems = session ? getNavItemsForRole(session.role) : [];
  const accountPath = session ? getAccountPathForRole(session.role) : null;

  return (
    <header className="sticky top-0 z-10 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
      <div className="flex h-14 items-center justify-between gap-3 px-4 md:px-6">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <p className="truncate text-sm font-semibold tracking-tight">
            {publicEnv.NEXT_PUBLIC_APP_NAME}
          </p>
          {session ? (
            <div className="hidden items-center gap-1.5 lg:flex">
              <Badge variant="secondary" className="max-w-[140px] truncate text-xs font-normal">
                {session.fullName}
              </Badge>
              <Badge variant="outline" className="text-xs font-normal">
                {session.role.replaceAll("_", " ")}
              </Badge>
              <Badge variant="outline" className="text-xs font-normal text-muted-foreground">
                Live
              </Badge>
            </div>
          ) : null}
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2">
          {session && accountPath ? (
            <Link
              href={accountPath}
              aria-label="Account"
              className={buttonVariants({
                variant: pathname === accountPath ? "secondary" : "ghost",
                size: "sm",
              })}
            >
              <UserCircle className="size-4" />
              <span className="hidden sm:inline">Account</span>
            </Link>
          ) : null}

          {session ? (
            <LogoutButton
              redirectTo={getLoginPathForRole(session.role)}
              variant="outline"
              size="sm"
            />
          ) : null}

          <Button variant="ghost" size="icon-sm" type="button" aria-label="Notifications">
            <Bell className="size-4" />
          </Button>
        </div>
      </div>

      <nav className="flex gap-1 overflow-x-auto border-t px-3 py-2 md:hidden">
        {navItems.map((item) => {
          const isActive = isNavItemActive(pathname, item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "shrink-0 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground",
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
