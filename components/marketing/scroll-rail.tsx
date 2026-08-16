// The one piece of chrome that makes a very long page read as a single
// document rather than a stack of unrelated sections. It also answers the
// standard complaint about scroll-driven sites, "where am I and how much is
// left", which is worth more than any animation on the page.
//
// Pure CSS and pure markup: the fill is driven by a scroll progress timeline on
// the root, and the labels are ordinary anchors, so the rail doubles as
// navigation and costs zero client JS.

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
            <a href={`#${c.id}`} className="mk-rail-link">
              {c.label}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
