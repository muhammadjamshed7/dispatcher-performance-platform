import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  mockActivities,
  mockCarriers,
  mockDispatchers,
} from "@/lib/mock-data";
import type { Team } from "@/lib/types";
import { TEAM_STATUS_ACTIVE } from "@/lib/constants/team-statuses";
import { formatDateShort } from "@/lib/utils/format-date";

type TeamDetailViewProps = {
  team: Team;
};

export function TeamDetailView({ team }: TeamDetailViewProps) {
  const teamDispatchers = mockDispatchers.filter(
    (dispatcher) => dispatcher.teamName === team.name,
  );
  const teamCarriers = mockCarriers.filter(
    (carrier) => carrier.assignedTeamName === team.name,
  );
  const teamActivities = mockActivities
    .filter((activity) => activity.teamName === team.name)
    .slice(0, 3);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Team Overview</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
          <p>
            <span className="text-muted-foreground">Team Lead:</span> {team.teamLeadName}
          </p>
          <p>
            <span className="text-muted-foreground">Status:</span>{" "}
            <Badge variant={team.status === TEAM_STATUS_ACTIVE ? "default" : "secondary"}>
              {team.status}
            </Badge>
          </p>
          <p>
            <span className="text-muted-foreground">Dispatchers:</span> {team.dispatchersCount}
          </p>
          <p>
            <span className="text-muted-foreground">Carriers:</span> {team.carriersCount}
          </p>
          <p>
            <span className="text-muted-foreground">Created:</span>{" "}
            {formatDateShort(team.createdAt)}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Team Dispatchers Preview</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {teamDispatchers.length === 0 ? (
            <p className="text-muted-foreground">No dispatchers assigned.</p>
          ) : (
            teamDispatchers.map((dispatcher) => (
              <p key={dispatcher.id}>
                {dispatcher.fullName} · {dispatcher.assignedCarriersCount} carriers
              </p>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Team Carriers Preview</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {teamCarriers.length === 0 ? (
            <p className="text-muted-foreground">No carriers assigned.</p>
          ) : (
            teamCarriers.slice(0, 5).map((carrier) => (
              <p key={carrier.id}>
                {carrier.carrierName} · {carrier.assignedDispatcherName}
              </p>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent Team Activity</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {teamActivities.length === 0 ? (
            <p className="text-muted-foreground">No recent activity logged.</p>
          ) : (
            teamActivities.map((activity) => (
              <p key={activity.id}>
                {activity.date} · {activity.carrierName} ·{" "}
                {activity.status.replaceAll("_", " ")}
              </p>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
