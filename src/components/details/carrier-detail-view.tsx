"use client";

import { useCallback, useMemo } from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useApiData } from "@/hooks/use-api-data";
import { fetchActivities } from "@/lib/api/resources";
import { DELIVERED } from "@/lib/constants/statuses";
import type { Carrier } from "@/lib/types";
import { TEAM_STATUS_ACTIVE } from "@/lib/constants/team-statuses";
import { formatDateShort } from "@/lib/utils/format-date";
import { formatPercent } from "@/lib/utils/format-percent";

type CarrierDetailViewProps = {
  carrier: Carrier;
};

export function CarrierDetailView({ carrier }: CarrierDetailViewProps) {
  const loadActivities = useCallback(
    () => fetchActivities({ carrierId: carrier.id }),
    [carrier.id],
  );
  const { data: activities = [] } = useApiData(loadActivities, [carrier.id]);

  const recentActivities = useMemo(() => activities.slice(0, 3), [activities]);
  const deliveredCount = recentActivities.filter(
    (activity) => activity.status === DELIVERED,
  ).length;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Carrier Profile</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
          <p>
            <span className="text-muted-foreground">Driver:</span> {carrier.driverName}
          </p>
          <p>
            <span className="text-muted-foreground">MC Number:</span> {carrier.mcNumber}
          </p>
          <p>
            <span className="text-muted-foreground">Truck Type:</span>{" "}
            {carrier.truckType.replaceAll("_", " ")}
          </p>
          <p>
            <span className="text-muted-foreground">Team:</span> {carrier.assignedTeamName}
          </p>
          <p>
            <span className="text-muted-foreground">Dispatcher:</span>{" "}
            {carrier.assignedDispatcherName}
          </p>
          <p>
            <span className="text-muted-foreground">Dispatch Fee:</span>{" "}
            {formatPercent(carrier.dispatchFeePercentage, 0, "—")}
          </p>
          <p>
            <span className="text-muted-foreground">Status:</span>{" "}
            <Badge
              variant={carrier.status === TEAM_STATUS_ACTIVE ? "default" : "secondary"}
            >
              {carrier.status}
            </Badge>
          </p>
          <p>
            <span className="text-muted-foreground">Created:</span>{" "}
            {formatDateShort(carrier.createdAt)}
          </p>
          {carrier.notes ? (
            <p className="sm:col-span-2">
              <span className="text-muted-foreground">Notes:</span> {carrier.notes}
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Performance Preview</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 text-sm sm:grid-cols-2">
          <p>
            <span className="text-muted-foreground">Recent Activities:</span>{" "}
            {recentActivities.length}
          </p>
          <p>
            <span className="text-muted-foreground">Recent Delivered:</span> {deliveredCount}
          </p>
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
                {activity.date} · {activity.status.replaceAll("_", " ")}
                {activity.loadAmount ? ` · $${activity.loadAmount.toLocaleString()}` : ""}
              </p>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
