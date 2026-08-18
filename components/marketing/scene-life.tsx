import { Icon } from "@/components/brand/icon";
import {
  DayOneVignette,
  EveryVisitVignette,
} from "@/components/marketing/lifecycle";

// Chapter 2. The scroll becomes one animal's timeline.
//
// This is the structural idea the whole page turns on: the sections that used
// to sit side by side as interchangeable feature strips (breeders, lifecycle,
// travel, insurance) become moments in a single life. A visitor is not reading
// a feature list, they are watching an animal get older, and the product is
// only ever the thing keeping the record.
//
// The discipline, and it matters more than any of the CSS: Maple gets no
// adjectives. No "beloved", no personality, no story about how much she means
// to anyone. Dates, weights, doses, clinic names. The feeling comes entirely
// from the reader supplying their own animal. Break that rule and the whole
// chapter curdles.

export const LIFE_AGES = [
  { id: "life-8w", age: "8 weeks" },
  { id: "life-6m", age: "6 months" },
  { id: "life-3y", age: "3 years" },
  { id: "life-9y", age: "9 years" },
];

function TripVignette() {
  return (
    <div className="mk-vignette" aria-hidden="true">
      <div className="mk-card" style={{ padding: 18 }}>
        <div className="mk-life-card-head">
          <Icon name="fileText" size={15} style={{ color: "var(--pw-accent)" }} />
          <span className="mk-life-card-title">APHIS 7001 · draft</span>
          <span className="mk-mono-tag mk-life-card-meta">
            pre-filled from her record
          </span>
        </div>

        {[
          { label: "Rabies · 3-year", meta: "2024-03-11 · within window", ok: true },
          { label: "Microchip · 985141", meta: "ISO 11784, registry verified", ok: true },
          { label: "Titer test", meta: "not required for this destination", ok: true },
          { label: "Vet signature", meta: "outstanding · book by 2027-04-02", ok: false },
        ].map((r) => (
          <div key={r.label} className="mk-life-row">
            <span
              className="mk-status-dot"
              style={{
                background: r.ok
                  ? "var(--pw-status-up-dot)"
                  : "var(--pw-status-due-dot)",
              }}
            />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="mk-life-row-label">{r.label}</div>
              <div className="mk-small" style={{ fontSize: 11.5 }}>
                {r.meta}
              </div>
            </div>
          </div>
        ))}

        <div className="mk-life-card-foot">
          <Icon name="link" size={13} style={{ color: "var(--pw-text-muted)" }} />
          One link sent to the boarder. Expires 2027-04-19.
        </div>
      </div>
    </div>
  );
}

function NightVignette() {
  return (
    <div className="mk-vignette" aria-hidden="true">
      <div className="mk-card mk-life-night-card" style={{ padding: 18 }}>
        <div className="mk-life-card-head">
          <Icon name="shield" size={15} style={{ color: "#8fc7a6" }} />
          <span className="mk-life-card-title">Emergency card</span>
          <span className="mk-mono-tag mk-life-card-meta">9:42pm</span>
        </div>

        {[
          { label: "Rabies · 3-year", meta: "2024-03-11 · Lakeside Animal Hospital" },
          { label: "Apoquel · 16mg daily", meta: "since 2026-01-08, ongoing" },
          { label: "Known reaction", meta: "carprofen · vomiting, 2025-05-19" },
          { label: "Insurer", meta: "policy active · pre-existing review attached" },
        ].map((r) => (
          <div key={r.label} className="mk-life-row">
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="mk-life-row-label">{r.label}</div>
              <div className="mk-small" style={{ fontSize: 11.5 }}>
                {r.meta}
              </div>
            </div>
            <span className="mk-cite">cited</span>
          </div>
        ))}

        <div className="mk-life-card-foot">
          <Icon name="link" size={13} />
          Nine years of history handed over in one link.
        </div>
      </div>
    </div>
  );
}

const BEATS = [
  {
    ...LIFE_AGES[0],
    lede: "She arrives already knowing things.",
    body: "Transferred from the kennel with the litter record attached: weights from birth, first vaccines, dewormings. All of it already in the record on day one.",
    visual: <DayOneVignette />,
  },
  {
    ...LIFE_AGES[1],
    lede: "The series finishes itself.",
    body: "Forward the visit summary and the record updates. DHPP dose three lands, the weight curve extends, rabies at sixteen weeks is already on the calendar.",
    visual: <EveryVisitVignette />,
  },
  {
    ...LIFE_AGES[2],
    lede: "You take her somewhere.",
    body: "Crossing a border means rabies timing, microchip format, titer windows and a federal form. Pawdex holds the records those rules are checked against, so it can tell you what is done, what is missing, and what can no longer be fixed in time.",
    visual: <TripVignette />,
  },
  {
    ...LIFE_AGES[3],
    lede: "9:42pm. Someone asks when her last rabies was. You already know.",
    body: "The whole history, handed to a vet who has never met her, in one link. Including the reaction she had to carprofen in 2025, which nobody would have thought to mention.",
    visual: <NightVignette />,
  },
];

export function SceneLife() {
  return (
    <section
      className="mk-scene mk-life"
      id="scene-life"
      style={{ "--mk-beats": 4 } as React.CSSProperties}
      aria-label="One animal's life, from litter to senior"
    >
      <div className="mk-scene-stage">
        {/* The spine. Decorative, but it is what makes four separate tableaux
            read as one continuous life rather than four slides. */}
        <div className="mk-life-spine" aria-hidden="true">
          <span className="mk-life-spine-dot" />
        </div>

        {BEATS.map((b, i) => (
          <article
            key={b.id}
            id={b.id}
            className="mk-beat mk-life-beat"
            style={{ "--mk-beat-index": i } as React.CSSProperties}
          >
            <div className="mk-life-copy">
              <span className="mk-life-age">{b.age}</span>
              <h3 className="mk-h3 mk-life-lede">{b.lede}</h3>
              <p className="mk-lead mk-life-body">{b.body}</p>
            </div>
            {b.visual}
          </article>
        ))}
      </div>
    </section>
  );
}
