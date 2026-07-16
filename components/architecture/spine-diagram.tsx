// The spine. A pet's identity is an Animal, decoupled from any household.
// Ownership is a time-ranged custodianship, not a column on the record. That is
// what lets a single security-definer RPC hand the whole clinical record to a
// new owner atomically at a change of custody.

export function SpineDiagram() {
  return (
    <svg viewBox="0 0 900 372" width="900" role="img" aria-label="Animal identity is decoupled from household ownership. A time-ranged custodianship moves from household A to household B at a transfer point, and the clinical record follows the animal. The handshake is a hashed-token link accepted through the transfer_animal security-definer RPC.">
      <defs>
        <marker id="sp" markerWidth="9" markerHeight="9" refX="7" refY="4.5" orient="auto">
          <path d="M0,0 L9,4.5 L0,9 z" className="arch-arrowhead-primary" />
        </marker>
        <marker id="spd" markerWidth="9" markerHeight="9" refX="7" refY="4.5" orient="auto">
          <path d="M0,0 L9,4.5 L0,9 z" className="arch-arrowhead" />
        </marker>
      </defs>

      {/* identity anchor */}
      <rect x="352" y="20" width="196" height="52" rx="10" className="arch-node-accent arch-node-stroke" strokeWidth={1.4} />
      <text x="450" y="42" textAnchor="middle" className="arch-node-label" style={{ fontSize: 15 }}>Animal</text>
      <text x="450" y="59" textAnchor="middle" className="arch-node-sub">stable identity, never re-keyed</text>

      {/* line to custodianship */}
      <line x1="450" y1="72" x2="450" y2="104" className="arch-edge" strokeWidth="1.4" />

      {/* custodianship timeline */}
      <text x="150" y="100" className="arch-boundary-label">custodianship · time-ranged</text>
      <rect x="150" y="106" width="300" height="34" rx="17" className="arch-node-fill arch-node-stroke" strokeWidth={1} />
      <rect x="450" y="106" width="300" height="34" rx="17" className="arch-node-accent arch-node-stroke" strokeWidth={1} />
      <text x="300" y="127" textAnchor="middle" className="arch-node-sub">Household A · was</text>
      <text x="600" y="127" textAnchor="middle" className="arch-node-label" style={{ fontSize: 12 }}>Household B · now</text>
      {/* transfer point */}
      <line x1="450" y1="98" x2="450" y2="148" className="arch-edge-primary" strokeWidth="2.4" />
      <text x="450" y="92" textAnchor="middle" className="arch-mono" style={{ fill: "var(--pw-accent)" }}>transfer</text>

      {/* clinical record follows the animal */}
      <line x1="450" y1="140" x2="450" y2="172" className="arch-edge" strokeWidth="1.4" />
      <rect x="330" y="172" width="240" height="56" rx="10" className="arch-node-fill arch-node-stroke" strokeWidth={1.2} />
      <text x="450" y="196" textAnchor="middle" className="arch-node-label" style={{ fontSize: 13.5 }}>Clinical record</text>
      <text x="450" y="213" textAnchor="middle" className="arch-node-sub">pets + weight, vaccines, meds, labs, notes</text>

      {/* handshake row */}
      <g>
        <rect x="40" y="278" width="230" height="66" rx="10" className="arch-node-fill arch-node-stroke" strokeWidth={1} />
        <text x="56" y="302" className="arch-mono" style={{ fontSize: 11 }}>1 · origin creates link</text>
        <text x="56" y="322" className="arch-node-sub">raw token leaves once;</text>
        <text x="56" y="335" className="arch-node-sub">only its SHA-256 is stored</text>

        <rect x="335" y="278" width="230" height="66" rx="10" className="arch-node-fill arch-node-stroke" strokeWidth={1} />
        <text x="351" y="302" className="arch-mono" style={{ fontSize: 11 }}>2 · recipient opens link</text>
        <text x="351" y="322" className="arch-node-sub">/transfer/[token];</text>
        <text x="351" y="335" className="arch-node-sub">service role re-hashes to match</text>

        <rect x="630" y="278" width="230" height="66" rx="10" className="arch-node-accent arch-node-stroke" strokeWidth={1.4} />
        <text x="646" y="302" className="arch-mono" style={{ fontSize: 11, fill: "var(--pw-accent)" }}>3 · transfer_animal()</text>
        <text x="646" y="322" className="arch-node-sub">security-definer, one</text>
        <text x="646" y="335" className="arch-node-sub">transaction, atomic re-parent</text>
      </g>

      <path d="M270,311 L335,311" className="arch-edge" strokeWidth="1.4" markerEnd="url(#spd)" />
      <path d="M565,311 L630,311" className="arch-edge" strokeWidth="1.4" markerEnd="url(#spd)" />
      {/* the RPC drives the custody swap */}
      <path d="M745,278 C745,210 620,150 452,146" className="arch-edge-primary" strokeWidth="2.2" markerEnd="url(#sp)" />
    </svg>
  );
}
