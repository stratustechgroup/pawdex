// The one piece of chrome that makes a very long page read as a single
// document rather than a stack of unrelated sections, and the answer to the
// standard complaint about scroll-driven sites: where am I, how much is left.
//
// Ticks, not text. An earlier version printed the chapter names beside the
// track and they collided with the body copy at every viewport width the
// content column got close to. Chapter names now live in a tooltip that only
// appears on hover or keyboard focus, so the rail can never overlap anything,
// at any width, no matter how long a chapter is named.
//
// Pure CSS and pure markup: the fill is driven by a scroll progress timeline on
// the root and the ticks are ordinary anchors, so it doubles as navigation and
// costs zero client JS.

export type ScrollRailChapter = { id: string; label: string };

export function ScrollRail({ chapters }: { chapters: ScrollRailChapter[] }) {
  return (
    <nav className="mk-rail" aria-label="Page sections">
      <div className="mk-rail-track" aria-hidden="true">
        <div className="mk-rail-fill" />
      </div>
      <ol className="mk-rail-list">
        {chapters.map((c) => (
          <li key={c.id}>
            <a href={`#${c.id}`} className="mk-rail-tick">
              <span className="mk-rail-label">{c.label}</span>
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
