// The extraction ladder. Every document starts on the cheapest model and only
// climbs when confidence is too low or the document is legally significant.
// Size caps bound the climb so an oversized doc fails loudly instead of paying
// for a call that cannot succeed.

function Tier({
  x,
  n,
  model,
  role,
  cost,
}: {
  x: number;
  n: string;
  model: string;
  role: string;
  cost: number;
}) {
  return (
    <g>
      <rect x={x} y={70} width={224} height={104} rx={10} className="arch-node-fill arch-node-stroke" strokeWidth={1.2} />
      <text x={x + 18} y={98} className="arch-mono" style={{ fontSize: 11 }}>
        {n}
      </text>
      <text x={x + 18} y={122} className="arch-node-label" style={{ fontSize: 15 }}>
        {model}
      </text>
      <text x={x + 18} y={144} className="arch-node-sub">
        {role}
      </text>
      {/* cost dots: 1..3 */}
      {[0, 1, 2].map((i) => (
        <circle
          key={i}
          cx={x + 18 + i * 12}
          cy={160}
          r={4}
          className={i < cost ? "arch-tick" : "arch-node-sub"}
          style={i < cost ? undefined : { fill: "var(--pw-border-strong)" }}
        />
      ))}
      <text x={x + 60} y={164} className="arch-node-sub">
        relative cost
      </text>
    </g>
  );
}

export function ExtractionLadder() {
  return (
    <svg viewBox="0 0 900 268" width="900" role="img" aria-label="Extraction model ladder: Gemini 2.5 Flash Lite, then Gemini 2.5 Flash on low confidence, then Claude Sonnet 4.5 on hard or legally significant documents, bounded by per-tier size caps.">
      <defs>
        <marker id="lad" markerWidth="9" markerHeight="9" refX="7" refY="4.5" orient="auto">
          <path d="M0,0 L9,4.5 L0,9 z" className="arch-arrowhead-primary" />
        </marker>
      </defs>

      <Tier x={16} n="Tier 1 · first pass" model="Gemini 2.5 Flash Lite" role="most documents settle here" cost={1} />
      <Tier x={338} n="Tier 2 · escalate" model="Gemini 2.5 Flash" role="low confidence / PIMS floor" cost={2} />
      <Tier x={660} n="Tier 3 · hard + legal" model="Claude Sonnet 4.5" role="uncertain or rabies certs" cost={3} />

      {/* escalation arrows */}
      <path d="M240,122 L338,122" className="arch-edge-primary" strokeWidth="2.2" markerEnd="url(#lad)" />
      <text x="289" y="112" textAnchor="middle" className="arch-mono">low conf</text>
      <path d="M562,122 L660,122" className="arch-edge-primary" strokeWidth="2.2" markerEnd="url(#lad)" />
      <text x="611" y="112" textAnchor="middle" className="arch-mono">still unsure</text>

      {/* forced-tier-3 entry for legal docs */}
      <path d="M772,40 L772,70" className="arch-edge-primary" strokeWidth="2.2" markerEnd="url(#lad)" />
      <text x="772" y="30" textAnchor="middle" className="arch-mono" style={{ fill: "var(--pw-accent)" }}>
        rabies cert -&gt; forced Tier 3
      </text>

      {/* size-cap note */}
      <rect x="16" y="206" width="868" height="46" rx="8" className="arch-node-fill arch-node-stroke" strokeWidth={1} />
      <text x="32" y="226" className="arch-node-label" style={{ fontSize: 12.5 }}>
        Size caps bound the climb
      </text>
      <text x="32" y="243" className="arch-node-sub">
        A normal doc too big for Tier 3 is capped at Tier 2 up front. A must-run-Tier-3 doc that is oversized fails loudly, never a guaranteed-to-fail paid call.
      </text>
    </svg>
  );
}
