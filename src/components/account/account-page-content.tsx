"use client";

import { UserCircle } from "lucide-react";

import { LogoutButton } from "@/components/auth/logout-button";
import { PageShell } from "@/components/layout/page-shell";
import { StatusBadge } from "@/components/status-badge";
import { useMockSession } from "@/components/auth/mock-session-provider";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { getLoginPathForRole } from "@/lib/auth/roles";
import { mockTeams } from "@/lib/mock-data";
import { ADMIN } from "@/lib/constants/roles";

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium">{value}</dd>
    </div>
  );
}

function resolveTeamName(teamId: string | null): string | null {
  if (!teamId) {
    return null;
  }

  return mockTeams.find((team) => team.id === teamId)?.name ?? null;
}

export function AccountPageContent() {
  const { session } = useMockSession();

  if (!session) {
    return null;
  }

  const teamName = resolveTeamName(session.teamId);

  return (
    <PageShell
      title="Account"
      description="Your profile and mock session details."
    >
      <Card>
        <CardHeader className="flex flex-row items-center gap-3 space-y-0">
          <div className="flex size-10 items-center justify-center rounded-full bg-primary/10">
            <UserCircle className="size-5 text-primary" />
          </div>
          <div>
            <CardTitle className="text-base">{session.fullName}</CardTitle>
            <p className="text-sm text-muted-foreground">{session.email}</p>
          </div>
          <Badge variant="outline" className="ml-auto hidden sm:inline-flex">
            Mock session
          </Badge>
        </CardHeader>
        <CardContent className="space-y-4">
          <dl className="space-y-3">
            <DetailRow label="Full Name" value={session.fullName} />
            <DetailRow label="Email" value={session.email} />
            <DetailRow label="Role" value={session.role.replaceAll("_", " ")} />
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <dt className="text-sm text-muted-foreground">Status</dt>
              <dd>
                <StatusBadge status={session.status} />
              </dd>
            </div>
            {session.role !== ADMIN ? (
              <DetailRow label="Team" value={teamName ?? "Not assigned"} />
            ) : null}
            <DetailRow label="Last Login" value="Not tracked in mock session" />
          </dl>

          <Separator />

          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{session.role.replaceAll("_", " ")}</Badge>
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
    </PageShell>
  );
}
