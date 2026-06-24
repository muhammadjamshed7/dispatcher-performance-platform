import { DISPATCHER } from "@/lib/constants/roles";
import { RoleProtectedLayout } from "@/components/auth/role-protected-layout";

export default function DispatcherLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <RoleProtectedLayout role={DISPATCHER}>{children}</RoleProtectedLayout>
  );
}
