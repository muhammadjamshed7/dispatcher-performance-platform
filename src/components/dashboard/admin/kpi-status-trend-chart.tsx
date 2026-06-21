"use client";

import type { LabelProps } from "recharts";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { KpiChartEmptyState } from "@/components/dashboard/admin/kpi-stat-card-shell";
import { computeYAxisMaxFromRows } from "@/lib/dashboard/kpi-chart-utils";
import type { AdminDashboardStatusTrendPoint } from "@/lib/types";

const STATUS_LINES = [
  { key: "delivered", label: "Delivered", color: "#22C55E", labelOffset: 10 },
  { key: "cancelled", label: "Cancelled", color: "#EF4444", labelOffset: 16 },
  { key: "booked", label: "Booked", color: "#2563EB", labelOffset: 22 },
  { key: "notBooked", label: "Not Booked", color: "#F97316", labelOffset: 28 },
  {
    key: "bookedButCancelled",
    label: "Booked but Cancelled",
    color: "#8B5CF6",
    labelOffset: 34,
  },
] as const;

type StatusLineKey = (typeof STATUS_LINES)[number]["key"];

function makePointLabel(color: string, yOffset: number) {
  return (props: LabelProps) => {
    const { x, y, value } = props;
    const count = Number(value);

    if (typeof x !== "number" || typeof y !== "number" || !count) {
      return null;
    }

    return (
      <text
        x={x}
        y={y - yOffset}
        fill={color}
        fontSize={9}
        fontWeight={600}
        textAnchor="middle"
      >
        {count}
      </text>
    );
  };
}

type KpiStatusTrendChartProps = {
  data: AdminDashboardStatusTrendPoint[];
};

export function KpiStatusTrendChart({ data }: KpiStatusTrendChartProps) {
  if (data.length === 0) {
    return <KpiChartEmptyState />;
  }

  const yMax = computeYAxisMaxFromRows(
    data,
    STATUS_LINES.map((line) => line.key),
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-[260px] flex-1 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={data}
            margin={{ top: 36, right: 12, left: 0, bottom: 4 }}
          >
            <CartesianGrid stroke="#E2E8F0" strokeDasharray="4 4" vertical={false} />
            <XAxis
              dataKey="date"
              tick={{ fill: "#64748B", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              allowDecimals={false}
              tick={{ fill: "#64748B", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              width={32}
              domain={[0, yMax]}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#FFFFFF",
                border: "1px solid #E2E8F0",
                borderRadius: 10,
                fontSize: 12,
              }}
              formatter={(value, name) => [
                Number(value).toLocaleString(),
                STATUS_LINES.find((line) => line.key === name)?.label ?? name,
              ]}
            />
            <Legend
              verticalAlign="bottom"
              iconType="plainline"
              wrapperStyle={{
                fontSize: 11,
                color: "#64748B",
                paddingTop: 12,
              }}
            />
            {STATUS_LINES.map((line) => (
              <Line
                key={line.key}
                type="monotone"
                dataKey={line.key}
                name={line.label}
                stroke={line.color}
                strokeWidth={2.25}
                dot={{ r: 3, fill: line.color, stroke: "#FFFFFF", strokeWidth: 2 }}
                activeDot={{ r: 4 }}
                label={makePointLabel(line.color, line.labelOffset)}
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export type { StatusLineKey };
