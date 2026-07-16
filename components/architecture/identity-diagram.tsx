// Where authorization is actually enforced. The UI hides controls a viewer
// cannot use, but that is presentation. The boundary that holds is RLS in
// Postgres, with the server-action role gate as the belt to its suspenders on
// the service-role write paths that bypass RLS by design.

function Gate({
  x,
  title,
  lines,
  tag,
  primary,
}: {
  x: number;
  title: string;
  lines: string[];
  tag: string;
  primary?: boolean;
}) {
  return (
    <g>
      <rect
        x={x}
        y={56}
        width={168}
        height={184}
        rx={10}
        className={primary ? "arch-node-accent arch-node-stroke" : "arch-node-fill arch-node-stroke"}
        strokeWidth={primary ? 1.6 : 1}
      />
      <text x={x + 84} y={84} textAnchor="middle" className="arch-node-label" style={{ fontSize: 13.5 }}>
        {title}
      </text>
      {lines.map((l, i) => (
        <text key={l} x={x + 84} y={112 + i * 18} textAnchor="middle" className="arch-node-sub">
          {l}
        </text>
      ))}
      <rect x={x + 34} y={206} width={100} height={22} rx={11} className="arch-node-fill arch-node-stroke" strokeWidth={1} />
      <text
        x={x + 84}
        y={221}
        textAnchor="middle"
        className="arch-mono"
        style={primary ? { fill: "var(--pw-accent)", fontSize: 10 } : { fontSize: 10 }}
      >
        {tag}
      </text>
    </g>
  );
}

export function IdentityDiagram() {
  return (
    <svg viewBox="0 0 900 300" width="900" role="img" aria-label="A member request passes a route-level middleware check, then a server-action role gate, then row-level security in Postgres, which is the enforcing boundary and fails closed for anonymous callers.">
      <defs>
        <marker id="id" markerWidth="9" markerHeight="9" refX="7" refY="4.5" orient="auto">
          <path d="M0,0 L9,4.5 L0,9 z" className="arch-arrowhead-primary" />
        </marker>
      </defs>

      <rect x="16" y="128" width="128" height="56" rx="10" className="arch-node-fill arch-node-stroke" strokeWidth={1} />
      <text x="80" y="152" textAnchor="middle" className="arch-node-label" style={{ fontSize: 13 }}>Member</text>
      <text x="80" y="169" textAnchor="middle" className="arch-node-sub">wants to write a row</text>

      <Gate x={184} title="Middleware" lines={["has a session?", "on the allowlist?"]} tag="routes" />
      <Gate x={378} title="Server Action" lines={["role gate:", "viewer is read-only"]} tag="enforces · code" />
      <Gate x={572} title="RLS · Postgres" lines={["is_household_member", "has_household_write", "anon fails closed"]} tag="enforces · db" primary />

      <rect x="762" y="128" width="118" height="56" rx="10" className="arch-node-accent arch-node-stroke" strokeWidth={1.4} />
      <text x="821" y="159" textAnchor="middle" className="arch-node-label" style={{ fontSize: 13 }}>Row</text>

      <path d="M144,156 L184,152" className="arch-edge-primary" strokeWidth="2" markerEnd="url(#id)" />
      <path d="M352,148 L378,148" className="arch-edge-primary" strokeWidth="2" markerEnd="url(#id)" />
      <path d="M546,148 L572,148" className="arch-edge-primary" strokeWidth="2" markerEnd="url(#id)" />
      <path d="M740,150 L762,152" className="arch-edge-primary" strokeWidth="2" markerEnd="url(#id)" />
    </svg>
  );
}
