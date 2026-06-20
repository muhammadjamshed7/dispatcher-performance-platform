import { TEAM_LEAD } from "@/lib/constants/roles";
import { RoleLoginForm } from "@/components/auth/role-login-form";

export default function TeamLeadLoginPage() {
  return (
    <RoleLoginForm
      role={TEAM_LEAD}
      title="Team Lead Sign In"
      description="Sign in to your team lead portal."
    />
  );
}
