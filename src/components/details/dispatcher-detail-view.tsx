"use client";

import { useCallback, useMemo } from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useApiData } from "@/hooks/use-api-data";
import { fetchActivities, fetchCarriers } from "@/lib/api/resources";
import type { Dispatcher } from "@/lib/types";
import { TEAM_STATUS_ACTIVE } from "@/lib/constants/team-statuses";
import { formatDateShort } from "@/lib/utils/format-date";

type DispatcherDetailViewProps = {
  dispatcher: Dispatcher;
};

export function DispatcherDetailView({ dispatcher }: DispatcherDetailViewProps) {
  const loadCarriers = useCallback(() => fetchCarriers(), []);
  const loadActivities = useCallback(
    () => fetchActivities({ dispatcherId: dispatcher.id }),
    [dispatcher.id],
  );

  const { data: carriers = [] } = useApiData(loadCarriers, []);
  const { data: activities = [] } = useApiData(loadActivities, [dispatcher.id]);

  const assignedCarriers = useMemo(
    () =>
      carriers.filter(
        (carrier) => carrier.assignedDispatcherName === dispatcher.fullName,
      ),
    [carriers, dispatcher.fullName],
  );
  const recentActivities = useMemo(() => activities.slice(0, 3), [activities]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Dispatcher Profile</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
          <p>
            <span className="text-muted-foreground">Email:</span> {dispatcher.email}
          </p>
          <p>
            <span className="text-muted-foreground">Phone:</span> {dispatcher.phoneNumber}
          </p>
          <p>
            <span className="text-muted-foreground">Team:</span> {dispatcher.teamName}
          </p>
          <p>
            <span className="text-muted-foreground">Role:</span>{" "}
            {dispatcher.role.replaceAll("_", " ")}
          </p>
          <p>
            <span className="text-muted-foreground">Status:</span>{" "}
            <Badge
              variant={
                dispatcher.status === TEAM_STATUS_ACTIVE ? "default" : "secondary"
              }
            >
              {dispatcher.status}
            </Badge>
          </p>
          <p>
            <span className="text-muted-foreground">Assigned Carriers:</span>{" "}
            {dispatcher.assignedCarriersCount}
          </p>
          <p>
            <span className="text-muted-foreground">Created:</span>{" "}
            {formatDateShort(dispatcher.createdAt)}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Assigned Carriers Preview</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {assignedCarriers.length === 0 ? (
            <p className="text-muted-foreground">No carriers assigned.</p>
          ) : (
            assignedCarriers.map((carrier) => (
              <p key={carrier.id}>
                {carrier.carrierName} · {carrier.truckType.replaceAll("_", " ")}
              </p>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent Activity</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {recentActivities.length === 0 ? (
            <p className="text-muted-foreground">No recent activity logged.</p>
          ) : (
            recentActivities.map((activity) => (
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
