import { ADMIN } from "@/lib/constants/roles";
import { RoleProtectedLayout } from "@/components/auth/role-protected-layout";

export default function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <RoleProtectedLayout role={ADMIN}>{children}</RoleProtectedLayout>;
}
