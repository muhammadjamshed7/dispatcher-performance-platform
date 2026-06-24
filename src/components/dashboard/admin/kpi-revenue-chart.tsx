"use client";

import { useId } from "react";
import {
  Area,
  AreaChart,
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
  formatKpiCurrencyAxis,
  formatKpiCurrencyLabel,
  type KpiChartPoint,
} from "@/lib/dashboard/kpi-chart-utils";

type KpiRevenueChartProps = {
  data: KpiChartPoint[];
  color?: string;
};

export function KpiRevenueChart({
  data,
  color = "#2563EB",
}: KpiRevenueChartProps) {
  const gradientId = useId().replace(/:/g, "");

  if (data.length === 0) {
    return <KpiChartEmptyState />;
  }

  const yMax = computeYAxisMax(data.map((point) => point.value));

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-[240px] w-full flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={data}
            margin={{ top: 24, right: 8, left: 0, bottom: 0 }}
          >
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.22} />
                <stop offset="100%" stopColor={color} stopOpacity={0.03} />
              </linearGradient>
            </defs>
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
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke={color}
              strokeWidth={2.5}
              fill={`url(#${gradientId})`}
              dot={{ r: 3, fill: color, stroke: "#FFFFFF", strokeWidth: 2 }}
              activeDot={{ r: 4 }}
            >
              <LabelList
                dataKey="value"
                position="top"
                offset={10}
                formatter={(value) => {
                  const amount = Number(value);
                  return amount > 0 ? formatKpiCurrencyLabel(amount) : "";
                }}
                className="fill-[#2563EB] text-[10px] font-semibold"
              />
            </Area>
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <KpiChartLegend label="Revenue (USD)" color={color} />
    </div>
  );
}
