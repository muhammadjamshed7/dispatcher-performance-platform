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
  formatKpiCurrencyLabel,
} from "@/lib/dashboard/kpi-chart-utils";

type DispatcherLoadPoint = {
  dispatcherId: string;
  dispatcher: string;
  team: string;
  loads: number;
  revenue: number;
};

type KpiLoadsBarChartProps = {
  data: DispatcherLoadPoint[];
  color?: string;
};

export function KpiLoadsBarChart({
  data,
  color = "#8B5CF6",
}: KpiLoadsBarChartProps) {
  if (data.length === 0) {
    return <KpiChartEmptyState message="No approved loads found" />;
  }

  const xMax = computeYAxisMax(data.map((point) => point.loads), 1.2);
  const chartHeight = Math.max(240, data.length * 42);
  const dispatcherNames = new Map(
    data.map((point) => [point.dispatcherId, point.dispatcher]),
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-[240px] w-full flex-1 overflow-y-auto pr-1">
        <ResponsiveContainer width="100%" height={chartHeight}>
          <BarChart
            layout="vertical"
            data={data}
            margin={{ top: 12, right: 28, left: 0, bottom: 8 }}
          >
            <CartesianGrid
              stroke="#E2E8F0"
              strokeDasharray="4 4"
              horizontal={false}
            />
            <XAxis
              type="number"
              allowDecimals={false}
              tick={{ fill: "#64748B", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              domain={[0, xMax]}
            />
            <YAxis
              type="category"
              dataKey="dispatcherId"
              tickFormatter={(dispatcherId) =>
                formatDispatcherName(dispatcherNames.get(dispatcherId) ?? "")
              }
              tick={{ fill: "#64748B", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              width={96}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#FFFFFF",
                border: "1px solid #E2E8F0",
                borderRadius: 10,
                fontSize: 12,
              }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;

                const row = payload[0]?.payload as
                  | DispatcherLoadPoint
                  | undefined;
                if (!row) return null;

                return (
                  <div className="rounded-[10px] border border-[#E2E8F0] bg-white px-3 py-2 text-xs shadow-sm">
                    <p className="font-semibold text-[#0F172A]">
                      {row.dispatcher}
                    </p>
                    <p className="mt-0.5 text-[#64748B]">{row.team}</p>
                    <p className="mt-2 text-[#475569]">
                      Loads:{" "}
                      <span className="font-semibold text-[#0F172A]">
                        {row.loads.toLocaleString()}
                      </span>
                    </p>
                    <p className="mt-1 text-[#475569]">
                      Revenue:{" "}
                      <span className="font-semibold text-[#0F172A]">
                        {formatKpiCurrencyLabel(row.revenue)}
                      </span>
                    </p>
                  </div>
                );
              }}
            />
            <Bar
              dataKey="loads"
              fill={color}
              radius={[0, 8, 8, 0]}
              maxBarSize={22}
            >
              <LabelList
                dataKey="loads"
                position="right"
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
      <KpiChartLegend label="Approved loads by dispatcher" color={color} />
    </div>
  );
}

function formatDispatcherName(value: string) {
  return value.length > 14 ? `${value.slice(0, 13)}...` : value;
}
