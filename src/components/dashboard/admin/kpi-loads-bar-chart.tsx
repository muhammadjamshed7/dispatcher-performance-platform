"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  KpiChartEmptyState,
  KpiChartLegend,
} from "@/components/dashboard/admin/kpi-stat-card-shell";
import {
  computeYAxisMax,
  type KpiChartPoint,
} from "@/lib/dashboard/kpi-chart-utils";

type KpiLoadsBarChartProps = {
  data: KpiChartPoint[];
  color?: string;
};

export function KpiLoadsBarChart({
  data,
  color = "#8B5CF6",
}: KpiLoadsBarChartProps) {
  if (data.length === 0) {
    return <KpiChartEmptyState />;
  }

  const yMax = computeYAxisMax(data.map((point) => point.value));

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-[240px] w-full flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{ top: 24, right: 8, left: 0, bottom: 0 }}
          >
            <CartesianGrid
              stroke="#E2E8F0"
              strokeDasharray="4 4"
              vertical={false}
            />
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
              formatter={(value) => [Number(value).toLocaleString(), "Loads"]}
            />
            <Bar
              dataKey="value"
              fill={color}
              radius={[6, 6, 0, 0]}
              maxBarSize={28}
            >
              <LabelList
                dataKey="value"
                position="top"
                offset={8}
                formatter={(value) => {
                  const count = Number(value);
                  return count > 0 ? String(count) : "";
                }}
                className="fill-[#8B5CF6] text-[10px] font-semibold"
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <KpiChartLegend label="Loads" color={color} />
    </div>
  );
}
