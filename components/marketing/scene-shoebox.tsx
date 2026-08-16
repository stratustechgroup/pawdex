import { Icon } from "@/components/brand/icon";
import { PaperField } from "@/components/marketing/paper-field";

// Chapter 1, Scene A. The product's entire thesis with almost no copy.
//
// The hero's drifting paper is not replaced here, it is resolved: the same
// field converges, squares up, gets read, and lands as one dated record. That
// makes the hero image a setup rather than a decoration, and it means a visitor
// never has to learn a second visual language.
//
// Four beats:
//   0  scattered      the mess, inherited from the hero
//   1  stacked        a tidy pile, which is still useless
//   2  read           facts lift off the page, each one cited
//   3  record         the facts land as a dated timeline, reviewed by a human
//
// Beats 0 to 2 are decorative and aria-hidden. Beat 3 is real, ordered text and
// is the ONLY thing that renders without scroll-driven animation support or
// with reduced motion on. A visitor in that path sees the finished record and
// misses nothing but the theatre.

const FACTS = [
  {
    icon: "syringe",
    label: "Rabies · 3-year",
    date: "2024-03-11",
    cite: "p. 14",
  },
  {
    icon: "pill",
    label: "Apoquel · 16mg daily",
    date: "2024-03-11",
    cite: "p. 22",
  },
  {
    icon: "scale",
    label: "Weight · 28.4 kg",
    date: "2024-06-02",
    cite: "p. 3",
  },
  {
    icon: "calendar",
    label: "Next rabies due",
    date: "2027-03-11",
    cite: "derived",
  },
];

const CAPTIONS = ["a shoebox", "a tidy shoebox", "read, cited", "a record"];

function RecordCard() {
  return (
    <div className="mk-card mk-shoebox-record-card">
      <div className="mk-shoebox-record-head">
        <span className="mk-sim-avatar">M</span>
        <div>
          <div className="mk-shoebox-record-name">Maple</div>
          <div className="mk-small">
            4 documents · 41 pages · one timeline
          </div>
        </div>
      </div>

      <ol className="mk-shoebox-record-rows">
        {FACTS.map((f) => (
          <li key={f.label}>
            <Icon
              name={f.icon}
              size={15}
              style={{ color: "var(--pw-accent)", flexShrink: 0 }}
            />
            <span className="mk-shoebox-record-label">{f.label}</span>
            <time className="mk-shoebox-record-date">{f.date}</time>
            <span className="mk-cite">{f.cite}</span>
          </li>
        ))}
      </ol>

      <p className="mk-shoebox-reviewed">
        <span className="mk-status-dot" />
        Reviewed and approved by you before anything was saved.
      </p>
    </div>
  );
}

export function SceneShoebox() {
  return (
    <section
      className="mk-scene mk-shoebox"
      id="scene-shoebox"
      style={{ "--mk-beats": 4 } as React.CSSProperties}
      aria-label="From a shoebox of paper to one record"
    >
      <div className="mk-scene-stage">
        {/* Beats 0 and 1. One field, two behaviours: the sheets drift, then
            converge on the middle of the stage and square up. Both are pure
            transform and rotate, so the whole thing composites. */}
        <div className="mk-shoebox-fx mk-shoebox-papers" aria-hidden="true">
          <PaperField variant="scene" />
        </div>

        {/* Beat 2. The read: a scan line crosses the stack and facts lift off
            it, each carrying the citation that will follow it forever. */}
        <div
          className="mk-shoebox-fx mk-beat mk-shoebox-read"
          style={{ "--mk-beat-index": 2 } as React.CSSProperties}
          aria-hidden="true"
        >
          <div className="mk-shoebox-scan" />
          <ul className="mk-shoebox-chips">
            {FACTS.map((f, i) => (
              <li
                key={f.label}
                className="mk-shoebox-chip"
                style={{ "--mk-chip-i": i } as React.CSSProperties}
              >
                <span>{f.label}</span>
                <span className="mk-cite">{f.cite}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Beat 3. The record. Always in the DOM, always readable, and the only
            thing visible when motion is off. */}
        <div
          className="mk-beat mk-shoebox-record"
          style={{ "--mk-beat-index": 3 } as React.CSSProperties}
        >
          <RecordCard />
        </div>

        {/* One mono line per beat. Four words to four words: any more and the
            picture has failed and the caption is apologising for it. */}
        <div className="mk-shoebox-captions" aria-hidden="true">
          {CAPTIONS.map((c, i) => (
            <span
              key={c}
              className="mk-shoebox-fx mk-beat mk-shoebox-caption"
              style={{ "--mk-beat-index": i } as React.CSSProperties}
            >
              {c}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
