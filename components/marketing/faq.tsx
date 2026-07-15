import { Icon } from "@/components/brand/icon";
import { WaitlistForm } from "@/components/marketing/waitlist-form";

export const FAQS = [
  {
    q: "Is my data private?",
    a: "Yes, and structurally so. Your name, contact details and location are never shared with anyone; there is no toggle that changes that. Contributing de-identified medical records to veterinary research is a separate opt-in, off by default, revocable anytime, and it strips every direct identifier before anything leaves Pawdex.",
  },
  {
    q: "What documents can it actually read?",
    a: "Vaccine certificates, visit summaries, discharge notes, lab reports, invoices, rabies certificates, EU pet passports and insurance policies, as PDFs, photos or forwarded emails. The pipeline recognizes the export formats of the major clinic systems (Cornerstone, AVImark, ezyVet and friends) and tunes itself per format. A messy phone photo of a crumpled certificate is a normal Tuesday.",
  },
  {
    q: "Do I have to trust the AI blindly?",
    a: "No. That is the point of the review screen. Every fact the AI finds is shown to you with a citation to the exact page and paragraph it came from, and nothing is saved until you approve it. If it misread something, you fix it in place, and the correction teaches the pipeline.",
  },
  {
    q: "What does it cost?",
    a: "Free during early access, for real: no card required. Long term the plan is a straightforward subscription for power features. What we will not do is hold your own records hostage behind a paywall; your data stays exportable, always.",
  },
  {
    q: "We're a two-person household with three pets. Does that work?",
    a: "That is the default shape, not an edge case. A household holds any number of pets and people, with roles: your partner gets full access, the pet sitter can get read-only. Every record, reminder and document is shared across the household automatically.",
  },
  {
    q: "What happens when I rehome or adopt out a pet?",
    a: "You generate a transfer link. The new family opens it, sees the pet and the history that comes along, signs up in one step, and custody moves over, records, citations and all. You keep your other pets and documents; they start with a complete history instead of a shrug.",
  },
  {
    q: "I board my dog a lot. How does Pawdex help?",
    a: "Kennels care about exactly one thing: current vaccines. Pawdex tracks expirations against real requirements (Bordetella's short window included), warns you before a stay is at risk, and produces a boarding packet or share link the facility can check directly.",
  },
  {
    q: "When can I get in?",
    a: "We are onboarding the waitlist in small batches so every household gets a fast, attentive start. Join below and you will get an email the moment your spot opens, and nothing else in between.",
  },
];

export function Faq() {
  return (
    <section id="faq" className="mk-section" style={{ background: "var(--pw-surface)" }}>
      <div className="mk-container">
        <div className="mk-faq-grid">
          <div className="mk-faq-sticky">
            <span className="mk-eyebrow">Questions</span>
            <h2 className="mk-h2" style={{ margin: "18px 0 0" }}>
              Fair questions, straight answers.
            </h2>
            <p className="mk-lead" style={{ margin: "16px 0 0", maxWidth: "36ch" }}>
              The two we hear most: is my data safe, and does the AI make
              things up. Both answered below, plainly.
            </p>
            <div style={{ marginTop: 28 }}>
              <WaitlistForm source="faq" />
            </div>
          </div>

          <div>
            {FAQS.map((f, i) => (
              <details key={f.q} className="mk-faq-item" name="mk-faq">
                <summary>
                  <span className="mk-faq-num">{String(i + 1).padStart(2, "0")}</span>
                  <span className="mk-faq-q">{f.q}</span>
                  <span className="mk-faq-x">
                    <Icon name="plus" size={13} />
                  </span>
                </summary>
                <div className="mk-faq-a">
                  <p className="mk-lead" style={{ margin: 0, fontSize: 15.5 }}>
                    {f.a}
                  </p>
                </div>
              </details>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
