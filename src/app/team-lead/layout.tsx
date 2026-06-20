import { TEAM_LEAD } from "@/lib/constants/roles";
import { RoleProtectedLayout } from "@/components/auth/role-protected-layout";

export default function TeamLeadLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <RoleProtectedLayout role={TEAM_LEAD}>{children}</RoleProtectedLayout>;
}
