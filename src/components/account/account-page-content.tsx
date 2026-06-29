"use client";

import { UserCircle } from "lucide-react";

import { LogoutButton } from "@/components/auth/logout-button";
import { DispatcherAccountFinanceSummary } from "@/components/account/dispatcher-account-finance-summary";
import { PageShell } from "@/components/layout/page-shell";
import { StatusBadge } from "@/components/status-badge";
import { useSession } from "@/components/auth/session-provider";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { getLoginPathForRole } from "@/lib/auth/roles";
import { ADMIN, DISPATCHER } from "@/lib/constants/roles";

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
      <dt className="text-muted-foreground text-sm">{label}</dt>
      <dd className="text-sm font-medium">{value}</dd>
    </div>
  );
}

export function AccountPageContent() {
  const { session } = useSession();

  if (!session) {
    return null;
  }

  const teamName = session.teamName;

  return (
    <PageShell title="Account" description="Your profile and session details.">
      <div className="space-y-6">
        <Card>
          <CardHeader className="flex flex-row items-center gap-3 space-y-0">
            <div className="bg-primary/10 flex size-10 items-center justify-center rounded-full">
              <UserCircle className="text-primary size-5" />
            </div>
            <div>
              <CardTitle className="text-base">{session.fullName}</CardTitle>
              <p className="text-muted-foreground text-sm">{session.email}</p>
            </div>
            <Badge variant="outline" className="ml-auto hidden sm:inline-flex">
              Live session
            </Badge>
          </CardHeader>
          <CardContent className="space-y-4">
            <dl className="space-y-3 ">
              <DetailRow label="Full Name" value={session.fullName} />
              <DetailRow label="Email" value={session.email} />
              <DetailRow
                label="Role"
                value={session.role.replaceAll("_", " ")}
              />
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <dt className="text-muted-foreground text-sm">Status</dt>
                <dd>
                  <StatusBadge status={session.status} />
                </dd>
              </div>
              {session.role !== ADMIN ? (
                <DetailRow label="Team" value={teamName ?? "Not assigned"} />
              ) : null}
              <DetailRow
                label="Last Login"
                value={
                  session.lastLoginAt
                    ? new Date(session.lastLoginAt).toLocaleString()
                    : "No login recorded yet"
                }
              />
            </dl>

            <Separator />

            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">
                {session.role.replaceAll("_", " ")}
              </Badge>
              <Badge variant="outline" className="text-muted-foreground">
                User ID: {session.userId}
              </Badge>
            </div>

            <LogoutButton
              redirectTo={getLoginPathForRole(session.role)}
              variant="outline"
              className="w-full sm:w-auto"
            />
          </CardContent>
        </Card>

        {session.role === DISPATCHER ? (
          <DispatcherAccountFinanceSummary />
        ) : null}
      </div>
    </PageShell>
  );
}
