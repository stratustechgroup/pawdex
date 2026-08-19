import { Icon } from "@/components/brand/icon";
import { StatusBadge } from "@/components/pawdex/status-badge";

// Four moments, in the second person.
//
// Everything else on this page argues in the abstract: a record, a citation,
// a transfer. This section puts the visitor in the four situations where a
// pet's paperwork actually gets demanded, because that is when this product
// is bought. Each moment pairs the situation with the artifact Pawdex
// produces in it, and every artifact shown maps to a shipped feature: the
// emergency card, the boarding packet and its share links, the insurance
// claim tooling, and the transfer flow. Nothing here markets a roadmap.
//
// Mechanically this is the CSS-only tab pattern already proven elsewhere in
// marketing.css: four radio inputs, labels as the tab strip, :checked sibling
// selectors showing one panel. A server component with zero JavaScript
// shipped; it works before hydration and without it. Radios give arrow-key
// group navigation for free, and the focus ring is painted on the label via
// input:focus-visible + label, because a ring on a visually hidden input is
// a ring nobody sees.
//
// The sample data is sample data, same convention as product-preview.tsx:
// shapes of real records, invented names that read as names, no invented
// claims about the business.

const MOMENTS = [
  {
    id: "mk-mo-1",
    tab: "Emergency vet",
    title: "7 p.m. The regular clinic is closed.",
    body: "The emergency vet asks what she takes, what she reacts to, and when her last rabies shot was. You are not scrolling your camera roll in the waiting room. You open her card and read it off.",
    point: "One screen: medications with doses, allergies, rabies date, microchip. It prints to a single page for the glovebox.",
  },
  {
    id: "mk-mo-2",
    tab: "Boarding drop-off",
    title: "The kennel wants proof of Bordetella.",
    body: "Bordetella has the shortest window of anything on the card, and it expires quietly. Pawdex checks every requirement against the dates of the stay and warns you while there is still time to fix it.",
    point: "Hand the front desk a read-only link instead of a paper folder. They see current proof; they see nothing else.",
  },
  {
    id: "mk-mo-3",
    tab: "The claim",
    title: "The insurer wants the paper trail.",
    body: "Every line of the invoice is already extracted, dated and tied to the page it came from. Pawdex assembles the claim packet and estimates what comes back under your actual policy terms.",
    point: "Deductible, reimbursement rate and exclusions read from the policy you uploaded, applied to the visit you just paid for.",
  },
  {
    id: "mk-mo-4",
    tab: "Going-home day",
    title: "One of the puppies goes home tonight.",
    body: "The new family opens a link, sees the pup and everything that comes along, and signs up in one step. Custody moves, and the record moves with it: first shots, deworming, the weight curve since birth.",
    point: "They start with a complete history instead of a shrug. You keep your other pets and nothing of theirs.",
  },
] as const;

/* ── Artifacts ─────────────────────────────────────────────────────────────
   One per moment. Ruled rows in an .mk-card, mono for every value, the same
   material as the product because it is the product. */

function EmergencyCardArtifact() {
  return (
    <figure className="mk-mo-artifact" aria-hidden="true">
      <div className="mk-card mk-mo-doc">
        <div className="mk-mo-doc-head">
          <span className="mk-mo-doc-kind">Emergency card</span>
          <span className="mk-mo-doc-meta">Maple &middot; Golden Retriever &middot; 60.8 lb</span>
        </div>
        <ul className="mk-mo-rows">
          <li>
            <span className="mk-mo-row-label">Reacts to</span>
            <span className="mk-mo-row-value">chicken &middot; severe</span>
            <span className="mk-cite mk-cite--alert">allergy</span>
          </li>
          <li>
            <span className="mk-mo-row-label">Apoquel 16 mg</span>
            <span className="mk-mo-row-value">twice daily, with food</span>
            <span className="mk-cite">p. 3</span>
          </li>
          <li>
            <span className="mk-mo-row-label">Rabies, 3 year</span>
            <span className="mk-mo-row-value">2024-03-11</span>
            <span className="mk-cite">p. 2</span>
          </li>
          <li>
            <span className="mk-mo-row-label">Microchip</span>
            <span className="mk-mo-row-value">985 113 012 345 678</span>
            <span className="mk-cite">HomeAgain</span>
          </li>
        </ul>
        <div className="mk-mo-doc-foot">
          <Icon name="fileText" size={13} />
          <span>Prints to one page. Lives in the glovebox.</span>
        </div>
      </div>
    </figure>
  );
}

function BoardingArtifact() {
  return (
    <figure className="mk-mo-artifact" aria-hidden="true">
      <div className="mk-card mk-mo-doc">
        <div className="mk-mo-doc-head">
          <span className="mk-mo-doc-kind">Boarding check</span>
          <span className="mk-mo-doc-meta">stay Sep 12 to Sep 15</span>
        </div>
        <ul className="mk-mo-rows">
          <li>
            <span className="mk-mo-row-label">Bordetella</span>
            <span className="mk-mo-row-value">expires Sep 13, mid-stay</span>
            <StatusBadge kind="due" />
          </li>
          <li>
            <span className="mk-mo-row-label">Rabies, 3 year</span>
            <span className="mk-mo-row-value">through 2027-03-11</span>
            <StatusBadge kind="up" />
          </li>
          <li>
            <span className="mk-mo-row-label">DHPP</span>
            <span className="mk-mo-row-value">through 2027-04-15</span>
            <StatusBadge kind="up" />
          </li>
        </ul>
        <div className="mk-mo-doc-foot">
          <Icon name="link" size={13} />
          <span className="mk-mo-mono">pawdex.co/share/kx3&hellip;</span>
          <span>read-only, revocable</span>
        </div>
      </div>
    </figure>
  );
}

function ClaimArtifact() {
  return (
    <figure className="mk-mo-artifact" aria-hidden="true">
      <div className="mk-card mk-mo-doc">
        <div className="mk-mo-doc-head">
          <span className="mk-mo-doc-kind">Claim packet</span>
          <span className="mk-mo-doc-meta">emergency visit &middot; Aug 2</span>
        </div>
        <ul className="mk-mo-rows">
          <li>
            <span className="mk-mo-row-label">Radiographs, 2 views</span>
            <span className="mk-mo-row-value">$182.00</span>
            <span className="mk-cite">p. 1</span>
          </li>
          <li>
            <span className="mk-mo-row-label">Exam, emergency</span>
            <span className="mk-mo-row-value">$95.00</span>
            <span className="mk-cite">p. 1</span>
          </li>
          <li>
            <span className="mk-mo-row-label">Carprofen 75 mg</span>
            <span className="mk-mo-row-value">$34.50</span>
            <span className="mk-cite">p. 2</span>
          </li>
        </ul>
        <div className="mk-mo-doc-foot">
          <Icon name="receipt" size={13} />
          <span>
            Estimated back, after the $200 deductible at 90%:{" "}
            <span className="mk-mo-mono">$100.35</span>
          </span>
        </div>
      </div>
    </figure>
  );
}

function TransferArtifact() {
  return (
    <figure className="mk-mo-artifact" aria-hidden="true">
      <div className="mk-card mk-mo-doc">
        <div className="mk-mo-doc-head">
          <span className="mk-mo-doc-kind">Transfer</span>
          <span className="mk-mo-doc-meta">Biscuit &rarr; the Alvarez family</span>
        </div>
        <ul className="mk-mo-rows">
          <li>
            <span className="mk-mo-row-label">DHPP, first dose</span>
            <span className="mk-mo-row-value">6 weeks</span>
            <span className="mk-cite">litter record</span>
          </li>
          <li>
            <span className="mk-mo-row-label">Deworming, pyrantel</span>
            <span className="mk-mo-row-value">2, 4 and 6 weeks</span>
            <span className="mk-cite">litter record</span>
          </li>
          <li>
            <span className="mk-mo-row-label">Weight curve</span>
            <span className="mk-mo-row-value">8 entries since birth</span>
            <span className="mk-cite">charted</span>
          </li>
        </ul>
        <div className="mk-mo-doc-foot">
          <Icon name="check" size={13} />
          <span>Custody moves in one tap. The history arrives intact.</span>
        </div>
      </div>
    </figure>
  );
}

const ARTIFACTS = [
  <EmergencyCardArtifact key="1" />,
  <BoardingArtifact key="2" />,
  <ClaimArtifact key="3" />,
  <TransferArtifact key="4" />,
];

export function Moments() {
  return (
    <section id="moments" className="mk-section mk-mo">
      <div className="mk-ledger">
        <div className="mk-entry-rule" />
        <div className="mk-ledger-body">
          <h2 className="mk-h2 mk-mo-title">You have been here.</h2>
          <p className="mk-lead mk-mo-lead">
            Four moments every owner knows, and what is in your hand when they
            arrive.
          </p>

          {/* role=group + the fieldset-style label gives the radio cluster an
              accessible name without a visible legend fighting the heading. */}
          <div
            className="mk-mo-tabs"
            role="group"
            aria-label="Pick a moment"
          >
            {MOMENTS.map((m, i) => (
              <input
                key={m.id}
                type="radio"
                name="mk-mo"
                id={m.id}
                defaultChecked={i === 0}
              />
            ))}
            <div className="mk-mo-labels">
              {MOMENTS.map((m) => (
                <label key={m.id} htmlFor={m.id} className="mk-mo-label">
                  {m.tab}
                </label>
              ))}
            </div>
            <div className="mk-mo-panels">
              {MOMENTS.map((m, i) => (
                <div key={m.id} className="mk-mo-panel">
                  <div className="mk-mo-copy">
                    <h3 className="mk-h3 mk-mo-panel-title">{m.title}</h3>
                    <p className="mk-lead mk-mo-panel-body">{m.body}</p>
                    <p className="mk-small mk-mo-panel-point">{m.point}</p>
                  </div>
                  {ARTIFACTS[i]}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
