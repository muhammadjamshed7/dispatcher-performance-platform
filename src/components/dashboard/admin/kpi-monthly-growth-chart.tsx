"use client";

import { useId } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  LabelList,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { KpiChartEmptyState } from "@/components/dashboard/admin/kpi-stat-card-shell";
import {
  computeGrowthYAxisDomain,
  formatGrowthPercentAxis,
  formatGrowthPercentLabel,
} from "@/lib/dashboard/kpi-chart-utils";
import type { AdminDashboardMonthlyGrowthPoint } from "@/lib/types";

type KpiMonthlyGrowthChartProps = {
  data: AdminDashboardMonthlyGrowthPoint[];
  color?: string;
};

export function KpiMonthlyGrowthChart({
  data,
  color = "#14B8A6",
}: KpiMonthlyGrowthChartProps) {
  const gradientId = useId().replace(/:/g, "");

  if (data.length === 0) {
    return <KpiChartEmptyState />;
  }

  const [yMin, yMax] = computeGrowthYAxisDomain(data.map((point) => point.growth));

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-[220px] w-full flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={data}
            margin={{ top: 28, right: 8, left: 0, bottom: 0 }}
          >
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.24} />
                <stop offset="100%" stopColor={color} stopOpacity={0.03} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="#E2E8F0" strokeDasharray="4 4" vertical={false} />
            <XAxis
              dataKey="month"
              tick={{ fill: "#64748B", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tickFormatter={formatGrowthPercentAxis}
              tick={{ fill: "#64748B", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              width={40}
              domain={[yMin, yMax]}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#FFFFFF",
                border: "1px solid #E2E8F0",
                borderRadius: 10,
                fontSize: 12,
              }}
              formatter={(value, _name, item) => {
                const point = item.payload as AdminDashboardMonthlyGrowthPoint;
                return [
                  formatGrowthPercentLabel(Number(value)),
                  `Growth (Revenue: $${point.revenue.toLocaleString()})`,
                ];
              }}
            />
            <Legend
              verticalAlign="bottom"
              iconType="plainline"
              wrapperStyle={{
                fontSize: 11,
                color: "#64748B",
                paddingTop: 10,
              }}
            />
            <Area
              type="monotone"
              dataKey="growth"
              name="Growth %"
              stroke={color}
              strokeWidth={2.5}
              fill={`url(#${gradientId})`}
              dot={{ r: 3.5, fill: color, stroke: "#FFFFFF", strokeWidth: 2 }}
              activeDot={{ r: 4 }}
              isAnimationActive={false}
            >
              <LabelList
                dataKey="growth"
                position="top"
                offset={10}
                formatter={(value) => formatGrowthPercentLabel(Number(value))}
                className="fill-[#14B8A6] text-[10px] font-semibold"
              />
            </Area>
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
