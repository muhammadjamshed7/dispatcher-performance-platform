"use client";

import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";

import { DASHBOARD_CHART_CARD_CLASS } from "@/components/dashboard/admin/dashboard-chart-styles";

type LoadStatusDonutChartProps = {
  data: { name: string; value: number; percent: string; color: string }[];
  totalLoads: number;
};

export function LoadStatusDonutChart({
  data,
  totalLoads,
}: LoadStatusDonutChartProps) {
  const hasData = data.length > 0;

  return (
    <div className={DASHBOARD_CHART_CARD_CLASS}>
      <h3 className="mb-4 shrink-0 text-base font-semibold text-[#0F172A]">
        Load Status Breakdown
      </h3>
      <div className="flex min-h-[280px] flex-1 flex-col gap-6 md:flex-row md:items-center">
        <div className="relative mx-auto aspect-square w-full max-w-[220px] shrink-0 self-center">
          {hasData ? (
            <>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data}
                    dataKey="value"
                    nameKey="name"
                    innerRadius="55%"
                    outerRadius="80%"
                    stroke="none"
                  >
                    {data.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <p className="text-2xl font-semibold text-[#0F172A]">{totalLoads}</p>
                <p className="text-xs text-[#64748B]">Total Loads</p>
              </div>
            </>
          ) : (
            <div className="flex aspect-square w-full items-center justify-center rounded-full bg-[#F8FAFC]">
              <div className="text-center">
                <p className="text-2xl font-semibold text-[#0F172A]">{totalLoads}</p>
                <p className="mt-1 text-xs text-[#64748B]">Total Loads</p>
              </div>
            </div>
          )}
        </div>

        <div className="flex min-w-0 flex-1 flex-col justify-center">
          {!hasData ? (
            <div className="flex min-h-[120px] items-center justify-center md:min-h-[200px]">
              <p className="text-sm text-[#64748B]">No data available</p>
            </div>
          ) : (
            <div className="space-y-3">
              {data.map((item) => (
                <div
                  key={item.name}
                  className="flex items-center justify-between gap-3 text-sm"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <span
                      className="size-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="truncate text-[#475569]">{item.name}</span>
                  </div>
                  <div className="shrink-0 text-right">
                    <span className="font-medium text-[#0F172A]">{item.value}</span>
                    <span className="ml-2 text-[#64748B]">{item.percent}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
