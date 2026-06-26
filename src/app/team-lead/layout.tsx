import { TEAM_LEAD } from "@/lib/constants/roles";
import { RoleProtectedLayout } from "@/components/auth/role-protected-layout";
import { AppProviders } from "@/components/providers/app-providers";

export const dynamic = "force-dynamic";

export default function TeamLeadLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <AppProviders>
      <RoleProtectedLayout role={TEAM_LEAD}>{children}</RoleProtectedLayout>
    </AppProviders>
  );
}
