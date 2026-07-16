// System topology and trust boundaries. One thick accent path (app -> Postgres)
// is the hot path; dashed edges to vendors fire only on specific flows.

function Node({
  x,
  y,
  w = 130,
  h = 48,
  label,
  sub,
  accent,
}: {
  x: number;
  y: number;
  w?: number;
  h?: number;
  label: string;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx={8}
        className={accent ? "arch-node-accent arch-node-stroke" : "arch-node-fill arch-node-stroke"}
        strokeWidth={1}
      />
      <text x={x + w / 2} y={sub ? y + h / 2 - 3 : y + h / 2 + 4} textAnchor="middle" className="arch-node-label">
        {label}
      </text>
      {sub ? (
        <text x={x + w / 2} y={y + h / 2 + 13} textAnchor="middle" className="arch-node-sub">
          {sub}
        </text>
      ) : null}
    </g>
  );
}

export function TopologyDiagram() {
  return (
    <svg viewBox="0 0 900 452" width="900" role="img" aria-label="System topology across three trust zones: browser, Vercel functions, and the Supabase data plane plus external vendor APIs.">
      <defs>
        <marker id="ah" markerWidth="9" markerHeight="9" refX="7" refY="4.5" orient="auto">
          <path d="M0,0 L9,4.5 L0,9 z" className="arch-arrowhead" />
        </marker>
        <marker id="ahp" markerWidth="9" markerHeight="9" refX="7" refY="4.5" orient="auto">
          <path d="M0,0 L9,4.5 L0,9 z" className="arch-arrowhead-primary" />
        </marker>
      </defs>

      {/* trust boundaries */}
      <rect x="8" y="150" width="170" height="150" rx="12" className="arch-boundary" />
      <text x="18" y="168" className="arch-boundary-label">Untrusted</text>

      <rect x="210" y="34" width="330" height="384" rx="12" className="arch-boundary" />
      <text x="222" y="52" className="arch-boundary-label">Vercel · pdx1</text>

      <rect x="580" y="34" width="312" height="156" rx="12" className="arch-boundary" />
      <text x="592" y="52" className="arch-boundary-label">External vendors</text>

      <rect x="580" y="212" width="312" height="206" rx="12" className="arch-boundary" />
      <text x="592" y="230" className="arch-boundary-label">Supabase · us-west-2</text>

      {/* browser */}
      <Node x={30} y={196} w={126} h={66} label="Browser" sub="React 19 client" />

      {/* vercel */}
      <Node x={232} y={72} w={286} h={46} label="Middleware gate" sub="session + public-path allowlist" accent />
      <Node x={232} y={150} w={134} h={60} label="RSC pages" sub="60 routes" />
      <Node x={384} y={150} w={134} h={60} label="Server Actions" sub="mutations" />
      <Node x={232} y={238} w={134} h={60} label="Route handlers" sub="6 · webhooks + cron" />
      <Node x={384} y={238} w={134} h={60} label="AI pipeline" sub="extract · embed · answer" />

      {/* vendors */}
      <Node x={596} y={70} w={132} h={44} label="OpenRouter" sub="Gemini · Claude" />
      <Node x={744} y={70} w={132} h={44} label="OpenAI" sub="embeddings" />
      <Node x={596} y={128} w={132} h={44} label="Resend" sub="email" />
      <Node x={744} y={128} w={132} h={44} label="Stripe" sub="billing (dormant)" />

      {/* supabase */}
      <Node x={596} y={250} w={132} h={46} label="Postgres" sub="+ RLS" accent />
      <Node x={744} y={250} w={132} h={46} label="Auth" sub="GoTrue" />
      <Node x={596} y={316} w={132} h={46} label="Storage" sub="2 buckets" />
      <Node x={744} y={316} w={132} h={46} label="pg_cron" sub="scheduled jobs" />

      {/* edges: browser -> gate (every request) */}
      <path d="M156,222 C190,222 200,95 232,95" className="arch-edge-primary" strokeWidth="2" markerEnd="url(#ahp)" />
      {/* gate -> app */}
      <path d="M330,118 L299,150" className="arch-edge" strokeWidth="1.4" markerEnd="url(#ah)" />
      <path d="M420,118 L451,150" className="arch-edge" strokeWidth="1.4" markerEnd="url(#ah)" />
      <path d="M300,118 C270,130 270,225 299,238" className="arch-edge" strokeWidth="1.4" markerEnd="url(#ah)" />

      {/* app -> postgres (hot path) */}
      <path d="M518,180 C560,190 560,262 596,268" className="arch-edge-primary" strokeWidth="2.4" markerEnd="url(#ahp)" />
      {/* app -> auth */}
      <path d="M518,95 C700,95 690,250 776,250" className="arch-edge" strokeWidth="1.4" markerEnd="url(#ah)" />
      {/* AI pipeline -> vendors (optional) */}
      <path d="M518,262 C560,240 580,110 596,100" className="arch-edge-optional" strokeWidth="1.4" markerEnd="url(#ah)" />
      <path d="M518,268 C620,250 700,120 744,100" className="arch-edge-optional" strokeWidth="1.4" markerEnd="url(#ah)" />
      {/* handlers -> resend (optional) */}
      <path d="M518,150 C560,140 570,150 596,150" className="arch-edge-optional" strokeWidth="1.4" markerEnd="url(#ah)" />
      {/* handlers -> stripe (optional/dormant) */}
      <path d="M518,288 C640,300 700,160 744,152" className="arch-edge-optional" strokeWidth="1.4" markerEnd="url(#ah)" />
      {/* pg_cron -> route handlers (callback) */}
      <path d="M810,362 C810,410 420,420 366,298" className="arch-edge-optional" strokeWidth="1.4" markerEnd="url(#ah)" />
      {/* storage <- app */}
      <path d="M518,200 C540,320 560,340 596,338" className="arch-edge" strokeWidth="1.4" markerEnd="url(#ah)" />
    </svg>
  );
}
