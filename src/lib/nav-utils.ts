import { getNavItemsForRole, type RoleNavItem } from "@/lib/auth/roles";
import type { Role } from "@/lib/constants/roles";

export function getActiveNavItem(
  pathname: string,
  navItems: RoleNavItem[],
): RoleNavItem | undefined {
  return navItems.find((item) => isNavItemActive(pathname, item.href));
}

export function isNavItemActive(pathname: string, href: string): boolean {
  if (pathname === href) {
    return true;
  }

  return pathname.startsWith(`${href}/`);
}

export function getPrimaryNavItems(role: Role): RoleNavItem[] {
  return getNavItemsForRole(role);
}
