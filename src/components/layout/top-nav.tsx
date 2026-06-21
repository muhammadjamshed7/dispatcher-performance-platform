"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, ChevronDown, Menu, Search } from "lucide-react";

import { LogoutButton } from "@/components/auth/logout-button";
import { useSession } from "@/components/auth/session-provider";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { publicEnv } from "@/lib/env";
import {
  getAccountPathForRole,
  getLoginPathForRole,
  getNavItemsForRole,
} from "@/lib/auth/roles";
import { getInitials } from "@/lib/utils/get-initials";
import { isNavItemActive } from "@/lib/nav-utils";
import { cn } from "@/lib/utils";

type TopNavProps = {
  onMenuClick?: () => void;
};

function roleLabel(role: string): string {
  if (role === "ADMIN") return "Administrator";
  if (role === "TEAM_LEAD") return "Team Lead";
  return "Dispatcher";
}

export function TopNav({ onMenuClick }: TopNavProps) {
  const pathname = usePathname();
  const { session } = useSession();
  const navItems = session ? getNavItemsForRole(session.role) : [];
  const accountPath = session ? getAccountPathForRole(session.role) : null;
  const initials = session ? getInitials(session.fullName) : "AA";

  return (
    <header className="sticky top-0 z-30 border-b border-[#E5E7EB] bg-white">
      <div className="flex h-[72px] items-center justify-between gap-4 px-4 md:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            className="rounded-lg p-2 text-[#475569] hover:bg-[#F1F5F9] md:hidden"
            onClick={onMenuClick}
            aria-label="Open menu"
          >
            <Menu className="size-5" />
          </button>

          <div className="hidden min-w-0 items-center gap-3 sm:flex">
            <div className="flex size-9 items-center justify-center rounded-xl bg-[#2563EB] text-white">
              <span className="text-xs font-bold">DP</span>
            </div>
            <p className="truncate text-sm font-semibold text-[#0F172A]">
              {publicEnv.NEXT_PUBLIC_APP_NAME}
            </p>
          </div>

          {session ? (
            <div className="hidden items-center gap-2 lg:flex">
              <span className="text-sm text-[#64748B]">Platform Mode:</span>
              <Badge className="rounded-full bg-[#F1F5F9] px-3 py-1 text-xs font-medium text-[#475569] hover:bg-[#F1F5F9]">
                {session.fullName}
              </Badge>
              <Badge className="rounded-full bg-[#DBEAFE] px-3 py-1 text-xs font-medium text-[#1D4ED8] hover:bg-[#DBEAFE]">
                {session.role.replaceAll("_", " ")}
              </Badge>
              <Badge className="rounded-full bg-[#DCFCE7] px-3 py-1 text-xs font-medium text-[#15803D] hover:bg-[#DCFCE7]">
                Live
              </Badge>
            </div>
          ) : null}
        </div>

        <div className="flex min-w-0 flex-1 items-center justify-end gap-3">
          <div className="relative hidden max-w-sm flex-1 md:block">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[#94A3B8]" />
            <Input
              placeholder="Search anything..."
              className="h-10 rounded-[10px] border-[#E2E8F0] bg-white pl-9 text-sm text-[#334155] placeholder:text-[#94A3B8]"
            />
          </div>

          <button
            type="button"
            className="relative rounded-lg p-2 text-[#475569] hover:bg-[#F1F5F9]"
            aria-label="Notifications"
          >
            <Bell className="size-5" />
            <span className="absolute top-1.5 right-1.5 size-2 rounded-full bg-[#2563EB]" />
          </button>

          {session && accountPath ? (
            <Link
              href={accountPath}
              className="hidden items-center gap-3 rounded-xl border border-[#E2E8F0] px-3 py-2 hover:bg-[#F8FAFC] sm:flex"
            >
              <div className="flex size-9 items-center justify-center rounded-full bg-[#DBEAFE] text-sm font-semibold text-[#1D4ED8]">
                {initials}
              </div>
              <div className="min-w-0 text-left">
                <p className="truncate text-sm font-medium text-[#0F172A]">
                  {session.fullName}
                </p>
                <p className="truncate text-xs text-[#64748B]">
                  {roleLabel(session.role)}
                </p>
              </div>
              <ChevronDown className="size-4 text-[#64748B]" />
            </Link>
          ) : null}

          {session ? (
            <LogoutButton
              redirectTo={getLoginPathForRole(session.role)}
              variant="outline"
              size="sm"
              className="hidden border-[#E2E8F0] lg:inline-flex"
            />
          ) : null}
        </div>
      </div>

      <nav className="flex gap-1 overflow-x-auto border-t border-[#E5E7EB] px-3 py-2 md:hidden">
        {navItems.map((item) => {
          const isActive = isNavItemActive(pathname, item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "shrink-0 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                isActive
                  ? "bg-[#2563EB] text-white"
                  : "bg-[#F1F5F9] text-[#64748B]",
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
