import { DISPATCHER } from "@/lib/constants/roles";
import { RoleLoginForm } from "@/components/auth/role-login-form";

export default function DispatcherLoginPage() {
  return (
    <RoleLoginForm
      role={DISPATCHER}
      title="Dispatcher Sign In"
      description="Sign in to your dispatcher portal (mock session)."
    />
  );
}
