// The primary flow: a document becomes trusted record data. The ordering is the
// point. AI extracts, but nothing touches the medical record until a human
// approves it, and indexing happens after commit, out of band.

const LANES = [
  { x: 92, label: "You" },
  { x: 330, label: "Server Action" },
  { x: 566, label: "AI" },
  { x: 800, label: "Postgres + Storage" },
];

function Msg({
  from,
  to,
  y,
  label,
  dashed,
  accent,
}: {
  from: number;
  to: number;
  y: number;
  label: string;
  dashed?: boolean;
  accent?: boolean;
}) {
  const x1 = LANES[from].x;
  const x2 = LANES[to].x;
  const dir = x2 > x1 ? 1 : -1;
  const mid = (x1 + x2) / 2;
  return (
    <g>
      <text
        x={mid}
        y={y - 8}
        textAnchor="middle"
        className={accent ? "arch-node-label" : "arch-mono"}
        style={accent ? { fontSize: 11.5 } : undefined}
      >
        {label}
      </text>
      <line
        x1={x1 + dir * 4}
        y1={y}
        x2={x2 - dir * 8}
        y2={y}
        className={accent ? "arch-edge-primary" : "arch-edge"}
        strokeWidth={accent ? 2.2 : 1.4}
        strokeDasharray={dashed ? "4 4" : undefined}
        markerEnd={accent ? "url(#sqp)" : "url(#sq)"}
      />
    </g>
  );
}

export function IngestSequence() {
  const top = 74;
  const bottom = 520;
  return (
    <svg viewBox="0 0 892 548" width="892" role="img" aria-label="Sequence diagram: upload or email-forward a document, store it, run the AI extraction ladder, return cited facts as pending review, human approves to commit clinical rows, then embed chunks out of band into the vector index.">
      <defs>
        <marker id="sq" markerWidth="9" markerHeight="9" refX="7" refY="4.5" orient="auto">
          <path d="M0,0 L9,4.5 L0,9 z" className="arch-arrowhead" />
        </marker>
        <marker id="sqp" markerWidth="9" markerHeight="9" refX="7" refY="4.5" orient="auto">
          <path d="M0,0 L9,4.5 L0,9 z" className="arch-arrowhead-primary" />
        </marker>
      </defs>

      {/* lanes */}
      {LANES.map((l) => (
        <g key={l.x}>
          <rect x={l.x - 68} y={40} width={136} height={30} rx={7} className="arch-node-fill arch-node-stroke" strokeWidth={1} />
          <text x={l.x} y={59} textAnchor="middle" className="arch-node-label" style={{ fontSize: 12 }}>
            {l.label}
          </text>
          <line x1={l.x} y1={top} x2={l.x} y2={bottom} className="arch-boundary" />
        </g>
      ))}

      <Msg from={0} to={1} y={110} label="upload / email-forward" />
      <Msg from={1} to={3} y={152} label="store file · documents bucket" />
      <Msg from={1} to={2} y={210} label="extract (tier ladder)" />
      <Msg from={2} to={1} y={252} label="facts + per-fact citations" dashed />

      {/* pending review band */}
      <rect x="150" y="278" width="360" height="26" rx="6" className="arch-node-fill arch-node-stroke" strokeWidth={1} />
      <text x="330" y="295" textAnchor="middle" className="arch-mono">status = pending_review · nothing in the record yet</text>

      <Msg from={1} to={0} y={340} label="review screen · facts beside their source" />
      <Msg from={0} to={1} y={392} label="approve = commit" accent />
      <Msg from={1} to={3} y={434} label="write clinical rows" accent />

      {/* after commit, out of band */}
      <line x1="60" y1="458" x2="832" y2="458" className="arch-boundary" />
      <text x="60" y="452" className="arch-boundary-label">after commit · out of band</text>
      <Msg from={1} to={2} y={492} label="embed chunks · after() hook" dashed />
      <Msg from={2} to={3} y={520} label="extraction_chunks · pgvector" dashed />
    </svg>
  );
}
