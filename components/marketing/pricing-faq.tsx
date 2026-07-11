import { Icon } from "@/components/brand/icon";

type QA = { q: string; a: React.ReactNode };

const ITEMS: QA[] = [
  {
    q: "Do I need a credit card to start?",
    a: "No. Free is free forever, no card required. And right now everyone is on early access, which includes every feature at no cost while Pawdex is in beta.",
  },
  {
    q: "Can I cancel anytime?",
    a: "Yes. You can cancel online at any time from Settings, Billing, no phone call, no email, no retention maze. When you cancel, paid features stay active through the end of the period you already paid for, then your account moves to the free tier. Your records never lock: viewing and exporting your data stay free, forever, including after you cancel.",
  },
  {
    q: "What happens to my records if I downgrade?",
    a: "Nothing is deleted, hidden, or held back. Every pet, document, and timeline entry stays exactly where it is, and viewing and exporting your records is always free on every plan. A lower tier simply limits new capacity (like adding more pets), never access to what you already have.",
  },
  {
    q: "How does billing work when I change plans?",
    a: "Upgrades take effect immediately and are prorated for the rest of your billing period. Downgrades take effect at the end of the current period, so you keep what you paid for until then.",
  },
  {
    q: "What is early access pricing?",
    a: "Everyone using Pawdex today, and everyone on the waitlist, gets every feature free during the beta. When paid plans go live, early-access members are grandfathered onto a standing discount as thanks for trusting us first.",
  },
  {
    q: "How does auto-renewal work?",
    // COMPLIANCE-OWNED: final wording supplied and graded by the compliance
    // agent (CA ARL). Renews at the price consented to, never a silent
    // then-current-price bump; increases require 7-30 day advance notice.
    a: "Paid plans renew automatically at the price you signed up for, for the plan and interval you chose (monthly or yearly), until you cancel. If we ever change that price, we'll email you 7 to 30 days before it takes effect and tell you how to cancel. We email you a receipt each renewal, and you can cancel anytime from Settings, Billing.",
  },
  // COMPLIANCE-OWNED: a refund FAQ item is deliberately omitted for now. The
  // proposed 14-day annual cooling-off refund is pending founder sign-off, and
  // this FAQ renders to the public (not gated), so we do not publish an
  // unconfirmed refund commitment. Ready-to-add wording, once confirmed:
  // "Monthly plans aren't prorated: cancel mid-month and you keep access until
  //  the period ends, with no further charge. Annual plans have a 14-day
  //  cooling-off period: cancel within 14 days of a charge or renewal and we
  //  refund it in full."
];

export function PricingFaq() {
  return (
    <section className="mk-section" id="pricing-faq">
      <div className="mk-container">
        <div className="mk-faq-grid">
          <div>
            <div className="mk-faq-sticky">
              <span className="mk-eyebrow">Pricing questions</span>
              <h2 className="mk-h2" style={{ marginTop: 16 }}>
                Fair, and <em>honest</em> about it.
              </h2>
              <p className="mk-lead" style={{ marginTop: 16 }}>
                No lock-in, no dark patterns, and your records are never the
                thing we hold over you.
              </p>
            </div>
          </div>
          <div>
            {ITEMS.map((item, i) => (
              <details key={item.q} className="mk-faq-item">
                <summary>
                  <span className="mk-faq-num">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="mk-faq-q">{item.q}</span>
                  <span className="mk-faq-x" aria-hidden>
                    <Icon name="plus" size={14} />
                  </span>
                </summary>
                <div className="mk-faq-a mk-lead" style={{ fontSize: 15.5 }}>
                  {item.a}
                </div>
              </details>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
