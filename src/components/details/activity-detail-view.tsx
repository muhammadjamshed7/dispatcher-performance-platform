import { StatusBadge } from "@/components/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DELIVERED } from "@/lib/constants/statuses";
import type { DailyActivity } from "@/lib/types";
import { formatCurrency } from "@/lib/utils/format-currency";
import { formatNullableText } from "@/lib/utils/format-display";
import { formatRatePerMile } from "@/lib/utils/format-rate-per-mile";

type ActivityDetailViewProps = {
  activity: DailyActivity;
};

export function ActivityDetailView({ activity }: ActivityDetailViewProps) {
  const isDelivered = activity.status === DELIVERED;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Activity Summary</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
          <p>
            <span className="text-muted-foreground">Date:</span> {activity.date}
          </p>
          <p>
            <span className="text-muted-foreground">Status:</span>{" "}
            <StatusBadge status={activity.status} />
          </p>
          <p>
            <span className="text-muted-foreground">Carrier:</span>{" "}
            {activity.carrierName}
          </p>
          <p>
            <span className="text-muted-foreground">Dispatcher:</span>{" "}
            {activity.dispatcherName}
          </p>
          <p>
            <span className="text-muted-foreground">Team:</span>{" "}
            {activity.teamName}
          </p>
          <p>
            <span className="text-muted-foreground">Truck Type:</span>{" "}
            {activity.truckType.replaceAll("_", " ")}
          </p>
        </CardContent>
      </Card>

      {isDelivered ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Delivery Details</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
            <p>
              <span className="text-muted-foreground">Origin:</span>{" "}
              {formatNullableText(activity.origin, "—")}
            </p>
            <p>
              <span className="text-muted-foreground">Destination:</span>{" "}
              {formatNullableText(activity.destination, "—")}
            </p>
            <p>
              <span className="text-muted-foreground">Total Miles:</span>{" "}
              {activity.miles ?? "—"}
            </p>
            <p>
              <span className="text-muted-foreground">Load Amount:</span>{" "}
              {formatCurrency(activity.loadAmount, { nullLabel: "—" })}
            </p>
            <p>
              <span className="text-muted-foreground">Rate Per Mile:</span>{" "}
              {formatRatePerMile(activity.ratePerMile, "—")}
            </p>
            <p>
              <span className="text-muted-foreground">
                Dispatch Fee Earned:
              </span>{" "}
              {formatCurrency(activity.dispatchFee, { nullLabel: "—" })}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Status Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>
              <span className="text-muted-foreground">Reason:</span>{" "}
              {formatNullableText(activity.reason, "—")}
            </p>
            <p>
              <span className="text-muted-foreground">Notes:</span>{" "}
              {formatNullableText(activity.notes, "—")}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
