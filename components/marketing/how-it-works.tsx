import {
  IngestingPreview,
  StatusRowPreview,
} from "@/components/marketing/product-preview";

// What the product does, in one screen.
//
// This replaces two pinned scroll scenes that between them ran to ten screens
// of scrolling before a visitor reached a price. The scenes told the same story
// this section tells: paper goes in, a dated cited record comes out. Told at
// this length it is a section. Told at ten screens it is a tax.
//
// Three steps, but not three cards in a row: a numbered ledger on the left with
// the real product on the right, so the claim and the evidence sit next to each
// other rather than the evidence being a caption under a card.

const STEPS = [
  {
    n: "01",
    title: "Forward it",
    body: "Email any vet document to your pet's address, or snap a photo of the paper you were handed.",
  },
  {
    n: "02",
    title: "It gets read",
    body: "Dates, doses, weights and vaccine types come out structured, each one carrying the page it came from.",
  },
  {
    n: "03",
    title: "You approve it",
    body: "Nothing joins the record until you say so. Duplicates are flagged, never silently merged.",
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="mk-section mk-how">
      <div className="mk-ledger">
        <div className="mk-entry-rule" />
        {/* The rail carries what an eyebrow used to. It is the same
            information, moved into the margin where a record keeps it. */}
        <div className="mk-margin">
          <span className="mk-margin-n">&sect; 01</span>
          <span className="mk-margin-label">How it works</span>
        </div>
        <div className="mk-ledger-body mk-how-grid">
        <div>
          <h2 className="mk-h2 mk-how-title">
            Paper in. A dated, cited record out.
          </h2>
          <ol className="mk-how-steps">
            {STEPS.map((s) => (
              <li key={s.n}>
                <span className="mk-how-n">{s.n}</span>
                <div>
                  <h3 className="mk-how-step-title">{s.title}</h3>
                  <p className="mk-how-step-body">{s.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>

        <div className="mk-how-visuals">
          <IngestingPreview />
          <StatusRowPreview />
        </div>
        </div>
      </div>
    </section>
  );
}
