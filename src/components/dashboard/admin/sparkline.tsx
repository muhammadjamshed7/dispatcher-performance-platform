"use client";

import { useId, useMemo } from "react";
import { Area, AreaChart, ResponsiveContainer, Tooltip } from "recharts";

type SparklineProps = {
  data: number[];
  color?: string;
  className?: string;
  valueFormatter?: (value: number) => string;
};

function buildDayLabels(count: number): string[] {
  const today = new Date();
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(
      Date.UTC(
        today.getUTCFullYear(),
        today.getUTCMonth(),
        today.getUTCDate() - (count - 1 - index),
      ),
    );
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  });
}

export function Sparkline({
  data,
  color = "#2563EB",
  className,
  valueFormatter = (value) => value.toLocaleString(),
}: SparklineProps) {
  const gradientId = useId().replace(/:/g, "");

  const chartData = useMemo(() => {
    const labels = buildDayLabels(data.length);
    return data.map((value, index) => ({
      value,
      label: labels[index] ?? "",
    }));
  }, [data]);

  if (data.length === 0) return null;

  return (
    <div className={className}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={chartData}
          margin={{ top: 6, right: 2, left: 2, bottom: 0 }}
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.28} />
              <stop offset="95%" stopColor={color} stopOpacity={0.04} />
            </linearGradient>
          </defs>
          <Tooltip
            cursor={{
              stroke: color,
              strokeWidth: 1,
              strokeDasharray: "3 3",
              strokeOpacity: 0.35,
            }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const point = payload[0]?.payload as { label?: string; value?: number };
              if (point?.value == null) return null;

              return (
                <div className="rounded-lg border border-[#E2E8F0] bg-white px-2.5 py-1.5 text-[11px] shadow-sm">
                  <p className="font-medium text-[#64748B]">{point.label}</p>
                  <p className="mt-0.5 font-semibold text-[#0F172A]">
                    {valueFormatter(point.value)}
                  </p>
                </div>
              );
            }}
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={2.25}
            fill={`url(#${gradientId})`}
            dot={false}
            activeDot={{
              r: 3.5,
              fill: color,
              stroke: "#FFFFFF",
              strokeWidth: 2,
            }}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
