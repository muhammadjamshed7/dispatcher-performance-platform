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

import { KpiChartEmptyState } from "@/components/dashboard/admin/kpi-stat-card-shell";
import type { AdminDashboardDispatcherOutcomeRatio } from "@/lib/types";

type RatioMode = "load" | "cancellation";

type DispatcherOutcomeRatioChartProps = {
  data: AdminDashboardDispatcherOutcomeRatio[];
  mode: RatioMode;
  emptyMessage: string;
};

type RatioChartRow = AdminDashboardDispatcherOutcomeRatio & {
  chartValue: number;
  barColor: string;
};

const STATUS_LEGEND = [
  { label: "Delivered", color: "#22C55E" },
  { label: "Cancelled", color: "#EF4444" },
  { label: "Not Booked", color: "#F59E0B" },
  { label: "Not Working", color: "#64748B" },
  { label: "In Transit", color: "#06B6D4" },
] as const;

const MODE_CONFIG = {
  load: {
    dataKey: "loadRatio",
    label: "Load Ratio",
    resolveBarColor: resolveLoadRatioColor,
  },
  cancellation: {
    dataKey: "cancellationRatio",
    label: "Cancellation Ratio",
    resolveBarColor: resolveCancellationRatioColor,
  },
} as const;

export function DispatcherOutcomeRatioChart({
  data,
  mode,
  emptyMessage,
}: DispatcherOutcomeRatioChartProps) {
  const config = MODE_CONFIG[mode];

  if (data.length === 0) {
    return <KpiChartEmptyState message={emptyMessage} />;
  }

  const chartData: RatioChartRow[] = data.map((row) => {
    const chartValue = row[config.dataKey];

    return {
      ...row,
      chartValue,
      barColor: config.resolveBarColor(chartValue),
    };
  });
  const chartWidth = Math.max(180, chartData.length * 32);
  const dispatcherNames = new Map(
    chartData.map((point) => [point.dispatcherId, point.dispatcher]),
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-[300px] w-full flex-1 overflow-x-auto pb-1">
        <div className="mx-auto h-[300px]" style={{ width: chartWidth }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              barCategoryGap="6%"
              margin={{ top: 28, right: 8, left: 0, bottom: 32 }}
            >
              <CartesianGrid
                stroke="#E2E8F0"
                strokeDasharray="4 4"
                vertical={false}
              />
              <XAxis
                dataKey="dispatcherId"
                interval={0}
                tickFormatter={(dispatcherId) =>
                  formatDispatcherLastName(
                    dispatcherNames.get(dispatcherId) ?? "",
                  )
                }
                tick={{ fill: "#64748B", fontSize: 10 }}
                angle={-35}
                axisLine={false}
                tickLine={false}
                textAnchor="end"
                height={54}
              />
              <YAxis
                type="number"
                tickFormatter={(value) => `${value}%`}
                tick={{ fill: "#64748B", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={42}
                domain={[0, 100]}
              />
              <Tooltip
                cursor={{ fill: "#F8FAFC" }}
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;

                  const row = payload[0]?.payload as RatioChartRow | undefined;
                  if (!row) return null;

                  return <RatioTooltip row={row} mode={mode} />;
                }}
              />
              <Bar dataKey="chartValue" radius={[6, 6, 0, 0]} maxBarSize={16}>
                {chartData.map((point) => (
                  <Cell key={point.dispatcherId} fill={point.barColor} />
                ))}
                <LabelList
                  dataKey="chartValue"
                  position="top"
                  offset={8}
                  formatter={(value) => formatPercent(Number(value))}
                  className="fill-[#0F172A] text-[10px] font-semibold"
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2 pt-3 text-xs font-medium text-[#64748B]">
        {STATUS_LEGEND.map((item) => (
          <span key={item.label} className="flex items-center gap-1.5">
            <span
              className="size-2.5 rounded-[2px]"
              style={{ backgroundColor: item.color }}
            />
            {item.label}
          </span>
        ))}
      </div>
    </div>
  );
}

function RatioTooltip({ row, mode }: { row: RatioChartRow; mode: RatioMode }) {
  const config = MODE_CONFIG[mode];
  const ratio = mode === "load" ? row.loadRatio : row.cancellationRatio;

  return (
    <div className="min-w-[220px] rounded-[10px] border border-[#E2E8F0] bg-white px-3 py-2 text-xs shadow-sm">
      <p className="font-semibold text-[#0F172A]">{row.dispatcher}</p>
      <p className="mt-0.5 text-[#64748B]">{row.team || "Unassigned"}</p>
      <p className="mt-2 text-[#475569]">
        Total assigned carriers:{" "}
        <span className="font-semibold text-[#0F172A]">
          {row.assignedCarriers.toLocaleString()}
        </span>
      </p>
      <div className="mt-2 space-y-1.5">
        <TooltipLine label="Delivered" value={row.delivered} color="#22C55E" />
        <TooltipLine label="Cancelled" value={row.cancelled} color="#EF4444" />
        <TooltipLine label="Not Booked" value={row.notBooked} color="#F59E0B" />
        <TooltipLine
          label="Not Working"
          value={row.notWorking}
          color="#64748B"
        />
        <TooltipLine label="In Transit" value={row.inTransit} color="#06B6D4" />
      </div>
      <div className="mt-2 border-t border-[#E2E8F0] pt-2 text-[#475569]">
        {config.label}:{" "}
        <span className="font-semibold text-[#0F172A]">
          {formatPercent(ratio)}
        </span>
      </div>
    </div>
  );
}

function TooltipLine({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="flex min-w-0 items-center gap-2 text-[#475569]">
        <span
          className="size-2.5 shrink-0 rounded-full"
          style={{ backgroundColor: color }}
        />
        <span className="truncate">{label}</span>
      </span>
      <span className="font-semibold text-[#0F172A]">
        {value.toLocaleString()}
      </span>
    </div>
  );
}

function resolveLoadRatioColor(value: number) {
  if (value >= 70) return "#16A34A";
  if (value >= 40) return "#F59E0B";
  return "#EF4444";
}

function resolveCancellationRatioColor(value: number) {
  if (value >= 40) return "#EF4444";
  if (value >= 15) return "#F59E0B";
  return "#22C55E";
}

function formatPercent(value: number) {
  return `${Number.isInteger(value) ? value : value.toFixed(1)}%`;
}

function formatDispatcherLastName(value: string) {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  const lastName = parts.at(-1) ?? value;

  return lastName.length > 12 ? `${lastName.slice(0, 11)}...` : lastName;
}
