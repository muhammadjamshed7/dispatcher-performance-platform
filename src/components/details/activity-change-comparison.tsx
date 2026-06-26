import {
  LOAD_ACTIVITY_STATUS_LABELS,
  getLoadActivityStatusLabel,
} from "@/lib/constants/status-labels";
import type { LoadActivityStatus } from "@/lib/db/types";
import { formatCurrency } from "@/lib/utils/format-currency";

const CHANGE_FIELD_LABELS: Record<string, string> = {
  activityDate: "Date",
  status: "Load Status",
  origin: "Origin",
  destination: "Destination",
  totalMiles: "Total Miles",
  miles: "Total Miles",
  loadAmount: "Load Amount",
  ratePerMile: "Rate Per Mile",
  dispatchFee: "Dispatch Fee",
  notes: "Notes",
  reason: "Reason",
  carrierId: "Carrier",
};

// Snapshot-only metadata that is not a user-editable field; hidden from the
// comparison so Admin sees only meaningful changes.
const IGNORED_CHANGE_FIELDS = new Set([
  "id",
  "carrierNameSnapshot",
  "dispatcherNameSnapshot",
  "teamNameSnapshot",
  "dispatchFeePercentageSnapshot",
  "truckTypeSnapshot",
]);

export function humanizeChangeField(key: string): string {
  if (CHANGE_FIELD_LABELS[key]) {
    return CHANGE_FIELD_LABELS[key];
  }

  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (char) => char.toUpperCase())
    .trim();
}

export function formatChangeValue(key: string, value: unknown): string {
  if (value === null || value === undefined || value === "") {
    return "—";
  }

  if (key === "loadAmount" || key === "dispatchFee") {
    return formatCurrency(Number(value), { nullLabel: "—" });
  }

  if (key === "activityDate") {
    return String(value).slice(0, 10);
  }

  if (key === "status") {
    const label = String(value) as LoadActivityStatus;
    return LOAD_ACTIVITY_STATUS_LABELS[label]
      ? getLoadActivityStatusLabel(label)
      : String(value);
  }

  return String(value);
}

export type ActivityChangeRow = {
  field: string;
  previous: string;
  updated: string;
};

export function buildActivityChangeRows(
  previousData: Record<string, unknown> | null | undefined,
  proposedChanges: Record<string, unknown> | null | undefined,
): ActivityChangeRow[] {
  const previous = previousData ?? {};
  const proposed = proposedChanges ?? {};
  const keys = Object.keys(proposed).filter(
    (key) => !IGNORED_CHANGE_FIELDS.has(key),
  );

  return keys
    .map((key) => ({
      field: humanizeChangeField(key),
      previous: formatChangeValue(key, previous[key]),
      updated: formatChangeValue(key, proposed[key]),
    }))
    .filter((row) => row.previous !== row.updated);
}

type ActivityChangeComparisonProps = {
  previousData: Record<string, unknown> | null | undefined;
  proposedChanges: Record<string, unknown> | null | undefined;
  emptyMessage?: string;
};

export function ActivityChangeComparison({
  previousData,
  proposedChanges,
  emptyMessage = "No field-level changes were detected for this edit.",
}: ActivityChangeComparisonProps) {
  const rows = buildActivityChangeRows(previousData, proposedChanges);

  if (rows.length === 0) {
    return <p className="text-muted-foreground text-sm">{emptyMessage}</p>;
  }

  return (
    <div>
      <div className="space-y-3 md:hidden">
        {rows.map((row) => (
          <div key={row.field} className="rounded-md border p-4">
            <p className="font-medium">{row.field}</p>
            <dl className="mt-3 space-y-3 text-sm">
              <div>
                <dt className="text-muted-foreground text-xs font-medium">
                  Previous Value
                </dt>
                <dd className="text-muted-foreground mt-1 break-words line-through">
                  {row.previous}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground text-xs font-medium">
                  Updated Value
                </dt>
                <dd className="mt-1 font-medium break-words text-emerald-700">
                  {row.updated}
                </dd>
              </div>
            </dl>
          </div>
        ))}
      </div>
      <table className="hidden w-full table-fixed border-collapse text-left text-sm md:table">
        <thead>
          <tr className="text-muted-foreground border-b text-xs uppercase">
            <th className="w-[24%] py-3 pr-5 font-medium">Field</th>
            <th className="w-[38%] py-3 pr-5 font-medium">Previous Value</th>
            <th className="w-[38%] py-3 font-medium">Updated Value</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.field} className="border-b last:border-0">
              <td className="py-3 pr-5 align-top font-medium break-words">
                {row.field}
              </td>
              <td className="text-muted-foreground py-3 pr-5 align-top break-words whitespace-pre-wrap line-through">
                {row.previous}
              </td>
              <td className="py-3 align-top font-medium break-words whitespace-pre-wrap text-emerald-700">
                {row.updated}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
