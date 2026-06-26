import { ADMIN, DISPATCHER, TEAM_LEAD, type Role } from "@/lib/constants/roles";

export type RoleRoutePrefix = "admin" | "team-lead" | "dispatcher";

export const ROLE_ROUTE_PREFIX: Record<Role, RoleRoutePrefix> = {
  [ADMIN]: "admin",
  [TEAM_LEAD]: "team-lead",
  [DISPATCHER]: "dispatcher",
};

export const ROLE_LOGIN_PATH: Record<Role, string> = {
  [ADMIN]: "/admin/login",
  [TEAM_LEAD]: "/team-lead/login",
  [DISPATCHER]: "/dispatcher/login",
};

export const ROLE_DASHBOARD_PATH: Record<Role, string> = {
  [ADMIN]: "/admin/dashboard",
  [TEAM_LEAD]: "/team-lead/dashboard",
  [DISPATCHER]: "/dispatcher/dashboard",
};

export const ROLE_NOTIFICATIONS_PATH: Record<Role, string> = {
  [ADMIN]: "/admin/notifications",
  [TEAM_LEAD]: "/team-lead/notifications",
  [DISPATCHER]: "/dispatcher/notifications",
};

export const ROLE_ACCOUNT_PATH: Record<Role, string> = {
  [ADMIN]: "/admin/account",
  [TEAM_LEAD]: "/team-lead/account",
  [DISPATCHER]: "/dispatcher/account",
};

export const ROLE_REGISTER_PATH: Partial<Record<Role, string>> = {
  [DISPATCHER]: "/dispatcher/register",
};

export type RoleNavItem = {
  label: string;
  href: string;
  iconKey: string;
};

export const ADMIN_NAV_ITEMS: RoleNavItem[] = [
  { label: "Dashboard", href: "/admin/dashboard", iconKey: "dashboard" },
  { label: "Teams", href: "/admin/teams", iconKey: "teams" },
  { label: "Dispatchers", href: "/admin/dispatchers", iconKey: "dispatchers" },
  { label: "Carriers", href: "/admin/carriers", iconKey: "carriers" },
  { label: "Activities", href: "/admin/activities", iconKey: "activities" },
  {
    label: "Pending Approvals",
    href: "/admin/activities/pending",
    iconKey: "pendingApprovals",
  },
  { label: "Audit Logs", href: "/admin/logs", iconKey: "logs" },
  { label: "Notifications", href: "/admin/notifications", iconKey: "notifications" },
  { label: "Rankings", href: "/admin/rankings", iconKey: "rankings" },
  { label: "Reports", href: "/admin/reports", iconKey: "reports" },
  {
    label: "Daily Report",
    href: "/admin/daily-report",
    iconKey: "dailyReport",
  },
  { label: "Settings", href: "/admin/settings", iconKey: "settings" },
  { label: "User Requests", href: "/admin/users/requests", iconKey: "users" },
  { label: "Account", href: "/admin/account", iconKey: "account" },
];

export const TEAM_LEAD_NAV_ITEMS: RoleNavItem[] = [
  { label: "Dashboard", href: "/team-lead/dashboard", iconKey: "dashboard" },
  {
    label: "Dispatchers",
    href: "/team-lead/dispatchers",
    iconKey: "dispatchers",
  },
  { label: "Carriers", href: "/team-lead/carriers", iconKey: "carriers" },
  { label: "Activities", href: "/team-lead/activities", iconKey: "activities" },
  {
    label: "Pending Approvals",
    href: "/team-lead/activities/pending",
    iconKey: "pendingApprovals",
  },
  { label: "Notifications", href: "/team-lead/notifications", iconKey: "notifications" },
  { label: "Rankings", href: "/team-lead/rankings", iconKey: "rankings" },
  { label: "Reports", href: "/team-lead/reports", iconKey: "reports" },
  { label: "Account", href: "/team-lead/account", iconKey: "account" },
];

export const DISPATCHER_NAV_ITEMS: RoleNavItem[] = [
  { label: "Dashboard", href: "/dispatcher/dashboard", iconKey: "dashboard" },
  { label: "My Carriers", href: "/dispatcher/carriers", iconKey: "carriers" },
  {
    label: "Daily Activities",
    href: "/dispatcher/activities",
    iconKey: "activities",
  },
  {
    label: "My Submissions",
    href: "/dispatcher/activities/submissions",
    iconKey: "pendingApprovals",
  },
  {
    label: "Notifications",
    href: "/dispatcher/notifications",
    iconKey: "notifications",
  },
  {
    label: "My Performance",
    href: "/dispatcher/performance",
    iconKey: "performance",
  },
  { label: "Finance", href: "/dispatcher/finance", iconKey: "finance" },
  { label: "Account", href: "/dispatcher/account", iconKey: "account" },
];

export function getNavItemsForRole(role: Role): RoleNavItem[] {
  if (role === ADMIN) {
    return ADMIN_NAV_ITEMS;
  }

  if (role === TEAM_LEAD) {
    return TEAM_LEAD_NAV_ITEMS;
  }

  return DISPATCHER_NAV_ITEMS;
}

export function getNotificationsPathForRole(role: Role): string {
  return ROLE_NOTIFICATIONS_PATH[role];
}

export function getAccountPathForRole(role: Role): string {
  return ROLE_ACCOUNT_PATH[role];
}

export function getDashboardPathForRole(role: Role): string {
  return ROLE_DASHBOARD_PATH[role];
}

export function getLoginPathForRole(role: Role): string {
  return ROLE_LOGIN_PATH[role];
}

export function getRoleFromPathname(pathname: string): Role | null {
  if (pathname.startsWith("/admin")) {
    return ADMIN;
  }

  if (pathname.startsWith("/team-lead")) {
    return TEAM_LEAD;
  }

  if (pathname.startsWith("/dispatcher")) {
    return DISPATCHER;
  }

  return null;
}

export function isPublicAuthPath(pathname: string): boolean {
  return (
    pathname.endsWith("/login") ||
    pathname.endsWith("/register") ||
    pathname === "/auth/login" ||
    pathname === "/auth/reset-password" ||
    pathname === "/auth/update-password"
  );
}
