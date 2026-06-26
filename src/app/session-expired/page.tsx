import { SessionExpiredScreen } from "@/components/auth/session-expired-screen";

export const dynamic = "force-dynamic";

export default function SessionExpiredPage() {
  return <SessionExpiredScreen loginHref="/" />;
}
