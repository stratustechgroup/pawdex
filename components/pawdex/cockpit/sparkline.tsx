// Pure inline-SVG sparkline. No charting dependency, renders on the server, and
// scales with the token color passed in. Used on the pet health tiles to show
// weight direction at a glance.

export function Sparkline({
  values,
  width = 68,
  height = 22,
  stroke = "var(--pw-accent)",
  strokeWidth = 1.5,
}: {
  values: number[];
  width?: number;
  height?: number;
  stroke?: string;
  strokeWidth?: number;
}) {
  if (values.length < 2) return null;

  const pad = strokeWidth + 1;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const innerW = width - pad * 2;
  const innerH = height - pad * 2;

  const points = values.map((v, i) => {
    const x = pad + (i / (values.length - 1)) * innerW;
    // Invert Y so higher weight is visually higher.
    const y = pad + (1 - (v - min) / span) * innerH;
    return [x, y] as const;
  });

  const line = points.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area =
    `${pad.toFixed(1)},${(height - pad).toFixed(1)} ` +
    line +
    ` ${(width - pad).toFixed(1)},${(height - pad).toFixed(1)}`;
  const last = points[points.length - 1];
  const gradId = `spark-${Math.round(min * 100)}-${values.length}`;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      fill="none"
      aria-hidden
      style={{ display: "block", flexShrink: 0 }}
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.18" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={area} fill={`url(#${gradId})`} />
      <polyline
        points={line}
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={last[0]} cy={last[1]} r={strokeWidth + 0.8} fill={stroke} />
    </svg>
  );
}
