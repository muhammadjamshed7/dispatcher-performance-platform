"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  KpiChartEmptyState,
} from "@/components/dashboard/admin/kpi-stat-card-shell";
import {
  computeYAxisMax,
  formatKpiCurrencyAxis,
  formatKpiCurrencyLabel,
} from "@/lib/dashboard/kpi-chart-utils";

type DispatcherRevenuePoint = {
  dispatcherId: string;
  dispatcher: string;
  team: string;
  revenue: number;
};

type KpiRevenueChartProps = {
  data: DispatcherRevenuePoint[];
};

export function KpiRevenueChart({ data }: KpiRevenueChartProps) {
  if (data.length === 0) {
    return <KpiChartEmptyState message="No dispatcher revenue available" />;
  }

  const yMax = computeYAxisMax(data.map((point) => point.revenue));
  const highestRevenue = data.reduce(
    (max, point) => Math.max(max, point.revenue),
    0,
  );
  const dispatcherNames = new Map(
    data.map((point) => [point.dispatcherId, point.dispatcher]),
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-[240px] w-full flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{ top: 24, right: 8, left: 0, bottom: 8 }}
          >
            <CartesianGrid
              stroke="#E2E8F0"
              strokeDasharray="4 4"
              vertical={false}
            />
            <XAxis
              dataKey="dispatcherId"
              tickFormatter={(dispatcherId) =>
                formatDispatcherName(dispatcherNames.get(dispatcherId) ?? "")
              }
              tick={{ fill: "#64748B", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              interval={0}
            />
            <YAxis
              tickFormatter={formatKpiCurrencyAxis}
              tick={{ fill: "#64748B", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              width={42}
              domain={[0, yMax]}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#FFFFFF",
                border: "1px solid #E2E8F0",
                borderRadius: 10,
                fontSize: 12,
              }}
              formatter={(value) => [
                formatKpiCurrencyLabel(Number(value)),
                "Revenue",
              ]}
              labelFormatter={(_, payload) => {
                const row = payload?.[0]?.payload as
                  | DispatcherRevenuePoint
                  | undefined;
                return row ? `${row.dispatcher} - ${row.team}` : "";
              }}
            />
            <Bar
              dataKey="revenue"
              radius={[8, 8, 0, 0]}
              maxBarSize={42}
            >
              {data.map((point) => (
                <Cell
                  key={point.dispatcherId}
                  fill={resolveRevenueBarColor(point.revenue, highestRevenue)}
                />
              ))}
              <LabelList
                dataKey="revenue"
                position="top"
                offset={10}
                formatter={(value) => {
                  const amount = Number(value);
                  return amount > 0 ? formatKpiCurrencyLabel(amount) : "";
                }}
                className="fill-[#2563EB] text-[10px] font-semibold"
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-3 pt-2 text-xs font-medium text-[#64748B]">
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-[2px] bg-[#15803D]" />
          High
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-[2px] bg-[#A3E635]" />
          Medium
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-[2px] bg-[#F97316]" />
          Low
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-[2px] bg-[#EF4444]" />
          Weak
        </span>
      </div>
    </div>
  );
}

function formatDispatcherName(value: string) {
  return value.length > 11 ? `${value.slice(0, 10)}...` : value;
}

function resolveRevenueBarColor(revenue: number, highestRevenue: number) {
  if (revenue <= 0 || highestRevenue <= 0) return "#EF4444";

  const ratio = revenue / highestRevenue;

  if (ratio >= 0.9) return "#15803D";
  if (ratio >= 0.7) return "#22C55E";
  if (ratio >= 0.45) return "#A3E635";
  if (ratio >= 0.25) return "#F97316";
  return "#EF4444";
}
