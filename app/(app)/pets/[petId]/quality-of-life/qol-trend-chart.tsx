"use client";

import { format } from "date-fns";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export function QolTrendChart({
  data,
  max,
}: {
  data: { date: string; total: number }[];
  max: number;
}) {
  if (data.length === 0) return null;

  return (
    <div style={{ width: "100%", height: 220, minWidth: 0 }}>
      <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
        <LineChart
          data={data}
          margin={{ top: 12, right: 16, bottom: 8, left: 8 }}
        >
          <CartesianGrid stroke="var(--pw-border)" strokeDasharray="3 3" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11, fill: "var(--pw-text-muted)" }}
            tickFormatter={(value: string) => format(new Date(value), "MMM d")}
          />
          <YAxis
            domain={[0, max]}
            tick={{ fontSize: 11, fill: "var(--pw-text-muted)" }}
            allowDecimals={false}
          />
          <Tooltip
            labelFormatter={(label) =>
              typeof label === "string"
                ? format(new Date(label), "EEE, MMM d, yyyy")
                : ""
            }
            formatter={(value) => [`${value} / ${max}`, "Total score"]}
            contentStyle={{
              background: "var(--pw-surface)",
              border: "1px solid var(--pw-border)",
              borderRadius: 6,
              fontSize: 12,
            }}
          />
          <ReferenceLine
            y={35}
            stroke="#c9a227"
            strokeDasharray="4 3"
            label={{
              value: "Discuss with vet ≤ 35",
              position: "insideTopRight",
              fontSize: 10,
              fill: "#c9a227",
            }}
          />
          <Line
            type="monotone"
            dataKey="total"
            stroke="var(--pw-accent)"
            strokeWidth={2}
            dot={{ r: 3, fill: "var(--pw-accent)" }}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
