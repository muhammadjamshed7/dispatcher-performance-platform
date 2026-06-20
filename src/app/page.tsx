import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const PORTALS = [
  {
    title: "Admin Portal",
    description: "Company-wide management, teams, settings, and user approvals.",
    href: "/admin/login",
  },
  {
    title: "Team Lead Portal",
    description: "Team dispatchers, carriers, activities, rankings, and reports.",
    href: "/team-lead/login",
  },
  {
    title: "Dispatcher Portal",
    description: "Personal dashboard, assigned carriers, daily activity, and performance.",
    href: "/dispatcher/login",
  },
] as const;

export default function HomePage() {
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center bg-muted/30 p-6">
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">
          Dispatcher Performance Platform
        </h1>
        <p className="mt-2 max-w-xl text-sm text-muted-foreground">
          Choose your portal to sign in.
        </p>
      </div>
      <div className="grid w-full max-w-4xl gap-4 md:grid-cols-3">
        {PORTALS.map((portal) => (
          <Card key={portal.href} className="flex flex-col shadow-sm">
            <CardHeader className="space-y-2">
              <CardTitle className="text-lg">{portal.title}</CardTitle>
              <CardDescription>{portal.description}</CardDescription>
            </CardHeader>
            <CardContent className="mt-auto">
              <Link
                href={portal.href}
                className={buttonVariants({ className: "w-full" })}
              >
                Sign in
              </Link>
            </CardContent>
          </Card>
        ))}
      </div>
    </main>
  );
}
