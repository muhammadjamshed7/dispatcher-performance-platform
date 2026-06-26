import Link from "next/link";
import { FileQuestion } from "lucide-react";

import { AuthStateScreen } from "@/components/auth/auth-state-screen";
import { buttonVariants } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default function NotFoundPage() {
  return (
    <AuthStateScreen
      icon={FileQuestion}
      iconClassName="bg-muted text-muted-foreground"
      title="Page Not Found"
      description="The page you requested does not exist or may have moved."
    >
      <Link href="/" className={buttonVariants({ variant: "default" })}>
        Return home
      </Link>
    </AuthStateScreen>
  );
}
