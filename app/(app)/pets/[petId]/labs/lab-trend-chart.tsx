"use client";

import { format } from "date-fns";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type Point = {
  date: string;
  value: number;
  flag: string | null;
};

export function LabTrendChart({
  data,
  referenceLow,
  referenceHigh,
  units,
}: {
  data: Point[];
  referenceLow: number | null;
  referenceHigh: number | null;
  units: string | null;
}) {
  if (data.length === 0) return null;

  const values = data.map((d) => d.value);
  const dataMin = Math.min(...values, referenceLow ?? Infinity);
  const dataMax = Math.max(...values, referenceHigh ?? -Infinity);
  const yDomain = [
    Number.isFinite(dataMin) ? dataMin * 0.9 : 0,
    Number.isFinite(dataMax) ? dataMax * 1.1 : 100,
  ];

  return (
    <div style={{ width: "100%", height: 200, minWidth: 0 }}>
      <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
        <LineChart data={data} margin={{ top: 12, right: 16, bottom: 8, left: 8 }}>
          <CartesianGrid stroke="var(--pw-border)" strokeDasharray="3 3" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11, fill: "var(--pw-text-muted)" }}
            tickFormatter={(v: string) => format(new Date(v), "MMM d")}
          />
          <YAxis
            domain={yDomain}
            tick={{ fontSize: 11, fill: "var(--pw-text-muted)" }}
          />
          {referenceLow !== null && referenceHigh !== null && (
            <ReferenceArea
              y1={referenceLow}
              y2={referenceHigh}
              fill="var(--pw-accent-soft)"
              fillOpacity={0.4}
            />
          )}
          <Tooltip
            labelFormatter={(label) =>
              typeof label === "string"
                ? format(new Date(label), "EEE, MMM d, yyyy")
                : ""
            }
            formatter={(value) => [`${value}${units ? ` ${units}` : ""}`, "Value"]}
            contentStyle={{
              background: "var(--pw-surface)",
              border: "1px solid var(--pw-border)",
              borderRadius: 6,
              fontSize: 12,
            }}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke="var(--pw-accent)"
            strokeWidth={2}
            dot={(props) => {
              const { cx, cy, payload } = props as {
                cx: number;
                cy: number;
                payload: Point;
                key?: string | number;
              };
              const flag = payload.flag;
              const color =
                flag === "H" || flag === "L" ? "#b54a4a" : "var(--pw-accent)";
              return (
                <circle
                  key={`${payload.date}-${cx}-${cy}`}
                  cx={cx}
                  cy={cy}
                  r={4}
                  fill={color}
                  stroke="var(--pw-surface)"
                  strokeWidth={1.5}
                />
              );
            }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
