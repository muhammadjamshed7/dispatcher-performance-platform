function normalizePath(value: string): string {
  // Drop any query string / hash and trailing slash so the active state only
  // depends on the page path (e.g. "/admin/activities/pending?activityId=1"
  // and "/admin/activities/pending/" both normalize to the same path).
  const pathOnly = value.split(/[?#]/, 1)[0] ?? value;

  if (pathOnly.length > 1 && pathOnly.endsWith("/")) {
    return pathOnly.slice(0, -1);
  }

  return pathOnly;
}

export function isNavItemActive(pathname: string, href: string): boolean {
  // Exact page matching: only the page the user is currently viewing is
  // highlighted. A parent item (e.g. "Activities") is not highlighted when a
  // child page (e.g. "Pending Approvals") is selected.
  return normalizePath(pathname) === normalizePath(href);
}
