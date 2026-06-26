"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, Menu } from "lucide-react";

import { LogoutButton } from "@/components/auth/logout-button";
import { GlobalSearch } from "@/components/layout/global-search";
import { NotificationsDropdown } from "@/components/notifications/notifications-dropdown";
import { useSession } from "@/components/auth/session-provider";
import { Badge } from "@/components/ui/badge";
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
  const showAccountSummary = session?.role === "TEAM_LEAD";

  return (
    <header className="sticky top-0 z-30 border-b border-[#E5E7EB] bg-white">
      <div className="flex h-[72px] items-center justify-between gap-4 px-4 md:px-8">
        <div className="flex shrink-0 items-center">
          <button
            type="button"
            className="rounded-lg p-2 text-[#475569] hover:bg-[#F1F5F9]"
            onClick={onMenuClick}
            aria-label="Toggle sidebar"
          >
            <Menu className="size-5" />
          </button>
        </div>

        <div className="flex min-w-0 flex-1 items-center justify-end gap-2 sm:gap-3">
          <GlobalSearch />

          <NotificationsDropdown />

          {session && showAccountSummary ? (
            <Badge className="hidden rounded-full bg-[#DBEAFE] px-3 py-1 text-xs font-medium text-[#1D4ED8] hover:bg-[#DBEAFE] md:inline-flex">
              {roleLabel(session.role)}
            </Badge>
          ) : null}

          {session && accountPath && showAccountSummary ? (
            <Link
              href={accountPath}
              className="hidden items-center gap-3 rounded-xl border border-[#E2E8F0] px-3 py-2 hover:bg-[#F8FAFC] sm:flex"
            >
              <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#DBEAFE] text-sm font-semibold text-[#1D4ED8]">
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
              <ChevronDown className="size-4 shrink-0 text-[#64748B]" />
            </Link>
          ) : null}

          {session ? (
            <LogoutButton
              redirectTo={getLoginPathForRole(session.role)}
              variant="outline"
              size="sm"
              className="shrink-0 border-[#E2E8F0] sm:inline-flex"
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
