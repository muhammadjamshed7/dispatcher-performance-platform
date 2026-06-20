import { ADMIN } from "@/lib/constants/roles";
import { RoleLoginForm } from "@/components/auth/role-login-form";

export default function AdminLoginPage() {
  return (
    <RoleLoginForm
      role={ADMIN}
      title="Admin Sign In"
      description="Sign in to the company admin portal."
    />
  );
}
