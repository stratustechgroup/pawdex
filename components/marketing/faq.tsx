import { Icon } from "@/components/brand/icon";

const FAQS = [
  {
    q: "Is my data private?",
    a: "Yes. Personally identifying information about you and your pets is never shared or sold, and that is a rule the product is built around, not a setting. Contributing de-identified, aggregate data to animal-health research is a completely separate opt-in that is off by default and revocable at any time.",
  },
  {
    q: "What documents actually work?",
    a: "Almost anything a vet gives you: vaccine certificates, SOAP and exam notes, lab and bloodwork panels, invoices, prescriptions and discharge papers. PDFs, photos of paper records, and scans from any clinic in any layout. If it is a vet document, Pawdex is built to read it.",
  },
  {
    q: "Do I have to re-type anything?",
    a: "No. You forward or photograph the document and Pawdex does the reading. Your only job is a quick review, confirming the facts it pulled out, each shown next to the source line it came from. Approve in one tap or fix a detail before it saves.",
  },
  {
    q: "What does it cost?",
    a: "Pawdex is free during early access. Everyone on the waitlist gets in at no cost while we build. When paid plans arrive, early members get plenty of notice and a founding-member rate. No card is required to join.",
  },
  {
    q: "I have multiple pets and a family. Does that work?",
    a: "Yes. Keep every pet in one household, and invite a partner or family member so you are both looking at the same up-to-date records. Reminders and history stay shared, so nothing depends on one person's phone.",
  },
  {
    q: "What happens when I adopt a dog out or rehome a pet?",
    a: "You transfer the animal to its new owner and the full medical history goes with it. They pick up exactly where you left off, with vaccines, weights and vet visits intact, instead of starting from a blank record and a shoebox of paper.",
  },
];

export function Faq() {
  return (
    <section id="faq" className="mk-section">
      <div
        className="mk-container"
        style={{
          display: "grid",
          gap: 40,
          gridTemplateColumns: "1fr",
          alignItems: "start",
        }}
      >
        <div className="mk-reveal" style={{ maxWidth: 620 }}>
          <span className="mk-eyebrow">Questions</span>
          <h2
            className="mk-serif mk-h2"
            style={{ margin: "20px 0 0", color: "var(--pw-text)" }}
          >
            The honest answers, up front.
          </h2>
        </div>

        <div className="mk-faq mk-reveal" style={{ borderTop: "1px solid var(--pw-border)" }}>
          {FAQS.map((f) => (
            <details key={f.q}>
              <summary>
                {f.q}
                <span className="mk-faq-plus">
                  <Icon name="plus" size={18} />
                </span>
              </summary>
              <div className="mk-faq-body">{f.a}</div>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
