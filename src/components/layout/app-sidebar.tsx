"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  BarChart3,
  Crown,
  FileText,
  LayoutDashboard,
  Settings,
  Trophy,
  Truck,
  UserCircle,
  UserPlus,
  Users,
  X,
} from "lucide-react";

import { useSession } from "@/components/auth/session-provider";
import { Badge } from "@/components/ui/badge";
import {
  getAccountPathForRole,
  getNavItemsForRole,
} from "@/lib/auth/roles";
import { getInitials } from "@/lib/utils/get-initials";
import { isNavItemActive } from "@/lib/nav-utils";
import { cn } from "@/lib/utils";

const NAV_ICONS: Record<string, typeof LayoutDashboard> = {
  dashboard: LayoutDashboard,
  teams: Users,
  dispatchers: Users,
  carriers: Truck,
  activities: Activity,
  rankings: Trophy,
  reports: FileText,
  settings: Settings,
  users: UserPlus,
  performance: BarChart3,
  account: UserCircle,
};

type AppSidebarProps = {
  mobileOpen?: boolean;
  onMobileClose?: () => void;
};

export function AppSidebar({ mobileOpen = false, onMobileClose }: AppSidebarProps) {
  const pathname = usePathname();
  const { session } = useSession();
  const navItems = session ? getNavItemsForRole(session.role) : [];
  const accountPath = session ? getAccountPathForRole(session.role) : null;
  const initials = session ? getInitials(session.fullName) : "AA";

  const sidebarContent = (
    <>
      <div className="flex h-[72px] items-center border-b border-[#E5E7EB] px-5">
        <div className="flex size-9 items-center justify-center rounded-xl bg-[#2563EB] text-white">
          <Truck className="size-4" />
        </div>
        <div className="ml-3 min-w-0">
          <p className="truncate text-sm font-semibold text-[#0F172A]">
            Dispatcher Performance
          </p>
          <p className="truncate text-xs text-[#64748B]">Platform</p>
        </div>
        {onMobileClose ? (
          <button
            type="button"
            className="ml-auto rounded-md p-1 text-[#64748B] hover:bg-[#F1F5F9] md:hidden"
            onClick={onMobileClose}
            aria-label="Close menu"
          >
            <X className="size-4" />
          </button>
        ) : null}
      </div>

      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-3">
        {navItems.map((item) => {
          const Icon = NAV_ICONS[item.iconKey] ?? BarChart3;
          const isActive = isNavItemActive(pathname, item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onMobileClose}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-gradient-to-br from-[#2563EB] to-[#1D4ED8] text-white shadow-sm"
                  : "text-[#475569] hover:bg-[#F1F5F9] hover:text-[#0F172A]",
              )}
            >
              <Icon className="size-4 shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {session && accountPath ? (
        <div className="space-y-4 border-t border-[#E5E7EB] p-4">
          <div className="rounded-2xl border border-[#E5E7EB] bg-[#F8FAFC] p-4">
            <div className="flex items-center gap-2">
              <Crown className="size-4 text-[#F97316]" />
              <p className="text-sm font-semibold text-[#0F172A]">Premium Plan</p>
            </div>
            <p className="mt-1 text-xs text-[#64748B]">You&apos;re on a premium plan</p>
            <button
              type="button"
              className="mt-2 text-xs font-medium text-[#2563EB] hover:text-[#1D4ED8]"
            >
              View Plan Details →
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <Badge
              variant="outline"
              className="border-[#E2E8F0] bg-white text-[10px] uppercase tracking-wide text-[#64748B]"
            >
              Session
            </Badge>
            <Badge
              variant="secondary"
              className="bg-[#F1F5F9] text-[10px] text-[#475569]"
            >
              {session.role.replaceAll("_", " ")}
            </Badge>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-full bg-[#DBEAFE] text-sm font-semibold text-[#1D4ED8]">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-[#0F172A]">
                {session.fullName}
              </p>
              <Link
                href={accountPath}
                onClick={onMobileClose}
                className="text-xs text-[#64748B] hover:text-[#2563EB]"
              >
                View account
              </Link>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );

  return (
    <>
      <aside className="hidden w-[260px] shrink-0 flex-col border-r border-[#E5E7EB] bg-white md:flex">
        {sidebarContent}
      </aside>

      {mobileOpen ? (
        <div className="fixed inset-0 z-40 md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            aria-label="Close menu overlay"
            onClick={onMobileClose}
          />
          <aside className="relative flex h-full w-[260px] max-w-[85vw] flex-col bg-white shadow-xl">
            {sidebarContent}
          </aside>
        </div>
      ) : null}
    </>
  );
}
