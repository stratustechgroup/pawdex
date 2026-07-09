"use client";

import { useMemo } from "react";
import { format } from "date-fns";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { kgToLbs } from "@/lib/utils";

type Point = {
  recorded_on: string;
  weight_kg: number;
};

type ChartPoint = {
  date: string;
  ts: number;
  label: string;
  weight_lbs: number;
  weight_kg: number;
};

export function WeightTrendChart({ data }: { data: Point[] }) {
  const series = useMemo<ChartPoint[]>(() => {
    return data
      .map((d) => {
        const dt = new Date(d.recorded_on);
        return {
          date: d.recorded_on,
          ts: dt.getTime(),
          label: format(dt, "MMM d, yyyy"),
          weight_lbs: kgToLbs(Number(d.weight_kg)),
          weight_kg: Number(d.weight_kg),
        };
      })
      .sort((a, b) => a.ts - b.ts);
  }, [data]);

  const { yMin, yMax } = useMemo(() => {
    if (series.length === 0) return { yMin: 0, yMax: 10 };
    const lbs = series.map((s) => s.weight_lbs);
    const min = Math.min(...lbs);
    const max = Math.max(...lbs);
    // Pad ~8% on each side so the line never hugs the chart edges.
    const span = Math.max(1, max - min);
    const pad = Math.max(0.5, span * 0.08);
    return {
      yMin: Math.max(0, Math.floor(min - pad)),
      yMax: Math.ceil(max + pad),
    };
  }, [series]);

  return (
    <div
      className="pw-card"
      style={{
        padding: 16,
        height: 320,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          font: "500 12px var(--font-inter)",
          color: "var(--pw-text-muted)",
          letterSpacing: "0.04em",
          textTransform: "uppercase",
          marginBottom: 8,
        }}
      >
        Weight trend (lbs)
      </div>
      <div style={{ flex: 1, width: "100%", minWidth: 0, minHeight: 0 }}>
        <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
          <LineChart
            data={series}
            margin={{ top: 8, right: 16, left: 0, bottom: 4 }}
          >
            <CartesianGrid
              stroke="var(--pw-border)"
              strokeDasharray="3 3"
              vertical={false}
            />
            <XAxis
              dataKey="ts"
              type="number"
              scale="time"
              domain={["dataMin", "dataMax"]}
              tickFormatter={(value: number) => format(new Date(value), "MMM d")}
              tick={{
                fill: "var(--pw-text-muted)",
                fontSize: 12,
                fontFamily: "var(--font-inter)",
              }}
              tickLine={{ stroke: "var(--pw-border)" }}
              axisLine={{ stroke: "var(--pw-border)" }}
              minTickGap={24}
            />
            <YAxis
              domain={[yMin, yMax]}
              tick={{
                fill: "var(--pw-text-muted)",
                fontSize: 12,
                fontFamily: "var(--font-inter)",
              }}
              tickLine={{ stroke: "var(--pw-border)" }}
              axisLine={{ stroke: "var(--pw-border)" }}
              width={44}
            />
            <Tooltip
              cursor={{ stroke: "var(--pw-border-strong)", strokeWidth: 1 }}
              contentStyle={{
                background: "var(--pw-surface)",
                border: "1px solid var(--pw-border-strong)",
                borderRadius: 6,
                font: "400 12px var(--font-inter)",
                color: "var(--pw-text)",
                padding: "8px 10px",
              }}
              labelStyle={{
                color: "var(--pw-text-muted)",
                marginBottom: 4,
                font: "500 11.5px var(--font-inter)",
              }}
              itemStyle={{
                color: "var(--pw-text)",
                padding: 0,
              }}
              labelFormatter={(value) =>
                format(new Date(Number(value)), "MMM d, yyyy")
              }
              formatter={(_value, _name, item) => {
                const p = item?.payload as ChartPoint | undefined;
                if (!p) return ["", "Weight"];
                return [`${p.weight_lbs} lbs (${p.weight_kg} kg)`, "Weight"];
              }}
            />
            <Line
              type="monotone"
              dataKey="weight_lbs"
              stroke="var(--pw-accent)"
              strokeWidth={2}
              dot={{
                r: 3,
                fill: "var(--pw-accent)",
                stroke: "var(--pw-accent)",
              }}
              activeDot={{
                r: 5,
                fill: "var(--pw-accent)",
                stroke: "var(--pw-surface)",
                strokeWidth: 2,
              }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
