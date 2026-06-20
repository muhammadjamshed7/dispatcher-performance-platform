"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  BarChart3,
  Building2,
  FileText,
  LayoutDashboard,
  Settings,
  Trophy,
  Truck,
  UserCircle,
  UserPlus,
  Users,
} from "lucide-react";

import { useMockSession } from "@/components/auth/mock-session-provider";
import { Badge } from "@/components/ui/badge";
import {
  getAccountPathForRole,
  getNavItemsForRole,
} from "@/lib/auth/roles";
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

export function AppSidebar() {
  const pathname = usePathname();
  const { session } = useMockSession();
  const navItems = session ? getNavItemsForRole(session.role) : [];
  const accountPath = session ? getAccountPathForRole(session.role) : null;

  return (
    <aside className="hidden w-64 shrink-0 border-r bg-card md:flex md:flex-col">
      <div className="flex h-14 items-center border-b px-4">
        <Building2 className="mr-2 size-5 text-primary" />
        <span className="text-sm font-semibold tracking-tight">Dispatcher Platform</span>
      </div>

      <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-3">
        {navItems.map((item) => {
          const Icon = NAV_ICONS[item.iconKey] ?? BarChart3;
          const isActive = isNavItemActive(pathname, item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <Icon className="size-4 shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {session && accountPath ? (
        <div className="space-y-2 border-t p-4">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
              Mock session
            </Badge>
            <Badge variant="secondary" className="text-[10px]">
              {session.role.replaceAll("_", " ")}
            </Badge>
          </div>
          <p className="truncate text-sm font-medium">{session.fullName}</p>
          <Link
            href={accountPath}
            className={cn(
              "flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition-colors",
              pathname === accountPath
                ? "bg-muted text-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <UserCircle className="size-3.5" />
            View account
          </Link>
        </div>
      ) : null}
    </aside>
  );
}
