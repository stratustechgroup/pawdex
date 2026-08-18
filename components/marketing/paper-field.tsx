// An abstract motif for "many loose pieces of paper", and deliberately nothing
// more than that.
//
// An earlier version drew fake vet documents here: mock headers reading RABIES
// VACCINATION CERTIFICATE, mock ruled lines standing in for body text, a mock
// stamp. That is a fake screenshot, and a fake screenshot is worse than no
// image at all: it invites the visitor to read something that does not exist,
// and it tells them nobody involved has seen the real product.
//
// What remains is unmistakably a geometric abstraction. Blank sheets, one rule
// each, no words. The real product is shown elsewhere on the page by rendering
// the real components (see product-preview.tsx). This is the "before", and the
// "before" is a pile of paper, not a document you are meant to read.
//
// Entirely decorative and aria-hidden.

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

/* Sheet proportions vary so the pile does not look stamped from one template.
   That is the only thing that differs between them now. */
const RULE_INSET: Record<Kind, number> = {
  cert: 30,
  invoice: 22,
  discharge: 38,
  fax: 26,
  handwritten: 34,
};

function Sheet({ kind }: { kind: Kind }) {
  // One rule near the top, at a height that varies per sheet. No text, no
  // stamp, no fake fields.
  return (
    <span
      className="mk-paper-rule"
      style={{ top: `${RULE_INSET[kind]}%` }}
      aria-hidden="true"
    />
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
              // Unitless twins of x and y. Scene A converges every sheet on the
              // middle of the stage, and a transform is the only compositor-safe
              // way to move them. Percentages in a translate resolve against the
              // element's own box, not the field's, so the distance has to be
              // computed from these numbers in viewport units instead.
              "--mk-x-n": s.x,
              "--mk-y-n": s.y,
            } as React.CSSProperties
          }
        >
          <Sheet kind={s.kind} />
        </article>
      ))}
    </div>
  );
}
