// The mess, before it is a record.
//
// Fourteen vet documents rendered in DOM from the existing tokens: no raster
// images, no extra fonts, correct in dark mode, and cheap enough to sit behind
// the hero without costing LCP. They are the first thing a visitor sees, and
// they should read as "this is my kitchen drawer" before they read as anything
// else.
//
// Entirely decorative. The whole field is aria-hidden and none of the text is
// real, so a screen reader walks straight past it to the headline.

type Kind = "cert" | "invoice" | "discharge" | "fax" | "handwritten";

type Sheet = {
  kind: Kind;
  /** 1 = slowest and furthest back, 3+ = closest and fastest. */
  depth: number;
  x: number;
  y: number;
  rot: number;
  w: number;
};

// Spread deliberately: nothing lands on a grid, no two rotations match, and the
// depths interleave so the field reads as scattered rather than layered.
const SHEETS: Sheet[] = [
  { kind: "cert", depth: 3.0, x: 62, y: 6, rot: -9, w: 190 },
  { kind: "invoice", depth: 2.4, x: 79, y: 30, rot: 6, w: 210 },
  { kind: "discharge", depth: 1.8, x: 54, y: 58, rot: -4, w: 230 },
  { kind: "fax", depth: 2.9, x: 87, y: 71, rot: 11, w: 175 },
  { kind: "handwritten", depth: 1.2, x: 67, y: 18, rot: -14, w: 205 },
  { kind: "invoice", depth: 0.9, x: 49, y: 82, rot: 8, w: 195 },
  { kind: "cert", depth: 2.1, x: 92, y: 12, rot: -6, w: 165 },
  { kind: "discharge", depth: 1.5, x: 73, y: 88, rot: 3, w: 215 },
  { kind: "fax", depth: 3.2, x: 58, y: 38, rot: -11, w: 180 },
  { kind: "handwritten", depth: 2.6, x: 84, y: 50, rot: 9, w: 170 },
  { kind: "invoice", depth: 1.1, x: 95, y: 88, rot: -7, w: 200 },
  { kind: "cert", depth: 2.8, x: 51, y: 24, rot: 5, w: 175 },
  { kind: "discharge", depth: 0.8, x: 90, y: 40, rot: -13, w: 185 },
  { kind: "fax", depth: 1.9, x: 64, y: 76, rot: 10, w: 160 },
];

const HEADERS: Record<Kind, string> = {
  cert: "RABIES VACCINATION CERTIFICATE",
  invoice: "INVOICE · SMALL ANIMAL",
  discharge: "DISCHARGE SUMMARY",
  fax: "FAX TRANSMITTAL",
  handwritten: "WEIGHT LOG",
};

/** Ruled lines. Widths vary so no two sheets look stamped from one template. */
const LINES: Record<Kind, number[]> = {
  cert: [92, 64, 78],
  invoice: [88, 71, 95, 55],
  discharge: [95, 83, 68, 90, 47],
  fax: [76, 88, 61],
  handwritten: [58, 72, 49, 65],
};

function Sheet({ kind }: { kind: Kind }) {
  return (
    <>
      <div className="mk-paper-head">{HEADERS[kind]}</div>
      <div className="mk-paper-lines">
        {LINES[kind].map((w, i) => (
          <span key={i} style={{ width: `${w}%` }} />
        ))}
      </div>
      {kind === "cert" ? <div className="mk-paper-stamp" /> : null}
    </>
  );
}

export function PaperField({
  variant = "hero",
}: {
  variant?: "hero" | "scene";
}) {
  return (
    <div
      className={`mk-paper-field mk-paper-field--${variant}`}
      aria-hidden="true"
    >
      {SHEETS.map((s, i) => (
        <article
          key={i}
          className={`mk-paper mk-paper--${s.kind} mk-parallax`}
          style={
            {
              "--mk-depth": s.depth,
              "--mk-x": `${s.x}%`,
              "--mk-y": `${s.y}%`,
              "--mk-rot": `${s.rot}deg`,
              "--mk-w": `${s.w}px`,
            } as React.CSSProperties
          }
        >
          <Sheet kind={s.kind} />
        </article>
      ))}
    </div>
  );
}
