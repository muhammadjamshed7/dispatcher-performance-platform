"use client";

import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type TeamCount = {
  team: string;
  count: number;
};

type UtilizationSlice = {
  name: string;
  value: number;
  color: string;
  percent: number;
};

type KpiDispatchersPanelProps = {
  byTeam: TeamCount[];
  utilization: UtilizationSlice[];
  activePercent: number;
};

export function KpiDispatchersPanel({
  byTeam,
  utilization,
  activePercent,
}: KpiDispatchersPanelProps) {
  const hasTeamData = byTeam.length > 0;
  const hasUtilizationData = utilization.some((slice) => slice.value > 0);

  return (
    <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 lg:grid-cols-2">
      <div className="flex min-h-[240px] min-w-0 flex-col rounded-xl border border-[#E5E7EB] bg-[#FCFCFD] p-3">
        <p className="mb-2 text-center text-xs font-semibold text-[#475569]">
          By Team
        </p>
        {hasTeamData ? (
          <>
            <div className="min-h-[170px] w-full flex-1">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={byTeam}
                  layout="vertical"
                  margin={{ top: 4, right: 12, left: 4, bottom: 4 }}
                >
                  <XAxis
                    type="number"
                    allowDecimals={false}
                    tick={{ fill: "#64748B", fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                    domain={[0, "dataMax + 1"]}
                  />
                  <YAxis
                    type="category"
                    dataKey="team"
                    width={72}
                    tick={{ fill: "#475569", fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#FFFFFF",
                      border: "1px solid #E2E8F0",
                      borderRadius: 10,
                      fontSize: 12,
                    }}
                    formatter={(value) => [
                      Number(value).toLocaleString(),
                      "Dispatchers",
                    ]}
                  />
                  <Bar
                    dataKey="count"
                    fill="#F97316"
                    radius={[0, 6, 6, 0]}
                    maxBarSize={16}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-1 space-y-1">
              {byTeam.map((item) => (
                <div
                  key={item.team}
                  className="flex items-center justify-between text-[11px] text-[#64748B]"
                >
                  <span className="truncate">{item.team}</span>
                  <span className="font-semibold text-[#0F172A]">
                    {item.count}
                  </span>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center text-xs text-[#64748B]">
            No team data
          </div>
        )}
      </div>

      <div className="flex min-h-[240px] min-w-0 flex-col rounded-xl border border-[#E5E7EB] bg-[#FCFCFD] p-3">
        <p className="mb-2 text-center text-xs font-semibold text-[#475569]">
          Utilization
        </p>
        {hasUtilizationData ? (
          <>
            <div className="relative mx-auto min-h-[150px] w-full max-w-[180px] flex-1">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={utilization}
                    dataKey="value"
                    nameKey="name"
                    innerRadius="58%"
                    outerRadius="82%"
                    stroke="none"
                    paddingAngle={2}
                  >
                    {utilization.map((slice) => (
                      <Cell key={slice.name} fill={slice.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <p className="text-lg font-semibold text-[#0F172A]">
                  {activePercent}% Active
                </p>
              </div>
            </div>
            <div className="mt-2 space-y-1.5">
              {utilization.map((slice) => (
                <div
                  key={slice.name}
                  className="flex items-center justify-between gap-2 text-[11px]"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <span
                      className="size-2.5 shrink-0 rounded-[2px]"
                      style={{ backgroundColor: slice.color }}
                    />
                    <span className="truncate text-[#64748B]">
                      {slice.name} ({slice.percent}%)
                    </span>
                  </div>
                  <span className="shrink-0 font-semibold text-[#0F172A]">
                    {slice.value}
                  </span>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center text-xs text-[#64748B]">
            No utilization data
          </div>
        )}
      </div>
    </div>
  );
}
