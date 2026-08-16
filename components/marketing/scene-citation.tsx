// Scene C. Small, sharp, and it exists to make one abstract claim physical.
//
// "100% of extracted facts link back to the exact page" is a number nobody will
// ever verify. Here the visitor watches it happen: a fact in the timeline, its
// citation badge, and then the source page itself with the exact line lit up.
// The connector is drawn, not implied.
//
// Two beats only. This is a proof, not a story, and it should be over quickly.

const PAGE_LINES = [
  { w: 82, hl: false },
  { w: 64, hl: false },
  { w: 91, hl: false },
  { w: 74, hl: false },
  { w: 88, hl: true },
  { w: 57, hl: false },
  { w: 79, hl: false },
  { w: 45, hl: false },
];

export function SceneCitation() {
  return (
    <section
      className="mk-scene mk-cit"
      id="scene-citation"
      style={{ "--mk-beats": 2 } as React.CSSProperties}
      aria-label="Every fact links back to its source page"
    >
      <div className="mk-scene-stage">
        <div className="mk-cit-grid">
          {/* The source. Present in both beats, revealed in the second. */}
          <figure
            className="mk-beat mk-cit-source"
            style={{ "--mk-beat-index": 1 } as React.CSSProperties}
          >
            <div className="mk-card mk-cit-page">
              <div className="mk-cit-page-head">Vaccination history</div>
              <div className="mk-cit-page-lines" aria-hidden="true">
                {PAGE_LINES.map((l, i) => (
                  <span
                    key={i}
                    className={l.hl ? "mk-cit-line mk-cit-line--hl" : "mk-cit-line"}
                    style={{ width: `${l.w}%` }}
                  />
                ))}
              </div>
            </div>
            <figcaption className="mk-cit-page-label">page 14 of 41</figcaption>
          </figure>

          {/* The connector. Drawn as the source arrives. */}
          <svg
            className="mk-cit-link"
            viewBox="0 0 120 40"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <path
              className="mk-cit-link-path"
              d="M120 20 C 84 20, 36 20, 0 20"
              fill="none"
            />
          </svg>

          {/* The fact. Present from the first beat. */}
          <div className="mk-cit-fact">
            <div className="mk-card mk-cit-fact-card">
              <span className="mk-cit-fact-label">Rabies · 3-year</span>
              <time className="mk-cit-fact-date">2024-03-11</time>
              <span className="mk-cite">p. 14</span>
            </div>
            <p className="mk-small mk-cit-fact-note">
              Every fact keeps the page it came from. Forever, and checkable by
              you.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
