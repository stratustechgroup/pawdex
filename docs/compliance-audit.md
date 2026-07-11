# Pawdex Compliance Audit

Prepared by the compliance team for the pre-launch review. Pawdex is a US-based
(South Carolina founder), California-first compliance posture, pre-launch
waitlist product at https://www.pawdex.co. This audit covers the public surface
and the outbound-email machinery as of July 10, 2026.

Status legend: GREEN (compliant, no action needed), YELLOW (compliant but with a
condition or a watch item), RED (must not ship without work).

Top-line posture: GREEN across privacy, analytics, email, COPPA, and veterinary
boundaries. YELLOW on the future claim-filing feature (insurance-producer /
public-adjuster question) and on the subscription flow (depends on the
pricing-billing agent building to the checklist that was sent). No RED items in
the current shipping surface.

---

## 1. CCPA / CPRA (California Consumer Privacy Act, as amended)

| Requirement | Status | Evidence | Action |
| --- | --- | --- | --- |
| Notice at collection: categories, purposes, sources | GREEN | `app/(marketing)/privacy/page.tsx` "Notice at collection" lists account identifiers, pet medical documents, usage/device data with purposes and sources | None |
| Right to know / delete / correct | GREEN | Privacy "Your California privacy rights" enumerates know, delete, correct, opt out, non-discrimination; request channel privacy@pawdex.co | None |
| Do-not-sell / do-not-share; GPC honored | GREEN | Privacy "We do not sell or share" plus GPC paragraph; no ad network in product | None |
| Sensitive PI handling | GREEN | No use of sensitive personal information for inference about the consumer. Pet medical data is about the animal, not the consumer's own health | None |
| Service-provider contracts, no secondary use | GREEN | Privacy "Service providers" lists Vercel, Supabase, OpenRouter, Resend as service providers under use-restricted contracts | Confirm signed DPAs exist with each provider (operational, not a page change) |
| De-identified data commitment | GREEN | Privacy "De-identified research" carries the no-re-identification commitment required to treat data as de-identified under CA law; consent is off by default and revocable (`components/onboarding/consent-step.tsx`) | None |
| Authorized-agent requests | GREEN | Privacy allows authorized-agent requests with proof and identity verification | None |
| 2026 CCPA regs: ADMT opt-out, risk assessments, cybersecurity audits | GREEN | New CPPA regs (approved Sept 23, 2025; phasing in from Jan 1, 2026) apply to automated decisionmaking for "significant decisions," selling/sharing, and training ADMT for significant decisions. Pawdex's AI extracts facts from the user's own documents for the user's own benefit. It makes no significant decision about the consumer, does not sell or share, does not profile the consumer, and does not train ADMT for significant decisions. Outside the ADMT and risk-assessment triggers | No action now. Re-check if a future feature scores, ranks, or decides something about the person (for example insurance eligibility) |

Sources: [CPPA final regulations announcement](https://cppa.ca.gov/announcements/2025/20250923.html); [Skadden summary](https://www.skadden.com/insights/publications/2025/10/california-finalizes-cppa-regulations); [Mayer Brown 2026 update](https://www.mayerbrown.com/en/insights/publications/2026/01/updates-to-the-ccpa-regulations-what-businesses-need-to-know-now-about-automated-decision-making-cybersecurity-audits-and-risk-assessments).

---

## 2. Analytics disclosure (Vercel Web Analytics + Speed Insights)

| Requirement | Status | Evidence | Action |
| --- | --- | --- | --- |
| Disclose analytics and whether cookies / fingerprinting are used | GREEN | Both mounted in `app/layout.tsx` (`<Analytics />`, `<SpeedInsights />`). Vercel Web Analytics is cookieless: no third-party cookies, visitors identified by a hash of the incoming request that is discarded after 24 hours, no cross-site profile, aggregate data only. Verified against Vercel's privacy docs | None. Disclosure added to Privacy ("Analytics, and why there is no cookie banner") |
| Cookie-consent banner needed? | GREEN | No advertising or cross-site tracking cookies are set; no sale or share; US-only posture. No consent banner is required. The Privacy page states this honestly and commits to updating if that ever changes | None |

Source: [Vercel Web Analytics privacy and compliance](https://vercel.com/docs/analytics/privacy-policy). Note: this conclusion rests on two legs, cookieless analytics AND the existing no-sale/no-share, US-only posture. If a marketing/advertising pixel (Meta, Google Ads, etc.) is ever added, this flips to YELLOW/RED and a consent mechanism becomes necessary.

---

## 3. CAN-SPAM (outbound email)

CAN-SPAM's commercial-message duties (unsubscribe mechanism, physical postal
address, honoring opt-outs within 10 business days) attach to email whose
primary purpose is commercial. Transactional or relationship messages, and
messages sent by the user's agent to carry out a transaction the user requested,
are not "commercial" for this purpose.

| Message | Classification | Evidence | Action |
| --- | --- | --- | --- |
| Vaccine reminders (`supabase/functions/reminders-cron/index.ts`) | Relationship / arguably marketing-adjacent; treated conservatively as needing opt-out | Sent only to the account holder about their own pet's due dates. Already carries a working Unsubscribe link (HMAC-signed token, `/api/unsubscribe/<token>`) and a "Manage reminder preferences" link, and honors `email_enabled=false` | None. Unsubscribe present; this exceeds what a pure relationship message requires |
| Records request to vet clinic (`lib/outbound/records-request.ts`, `records-request-template.ts`) | Transactional, sent as the owner's agent | Fired only with the `records_request_to_vets` authorization; body states it is sent under the owner's documented authorization; recipient is a clinic records desk, not a consumer marketing target; one-to-one, user-initiated | None. Not commercial email. Document classification here |
| Vet quote / estimate request (`lib/outbound/vet-quote-request.ts`) | Transactional, owner's agent | Same authorization gate (`records_request_to_vets`); one-to-one estimate request to a named clinic | None |
| Insurer clarification (`lib/outbound/insurer-clarification.ts`) | Transactional, owner's agent | Gated on `insurer_clarification_emails` authorization; neutral policy-question content; signed on behalf of the policyholder; one-to-one to the insurer | None |

Classification rationale (documented per the audit mandate): the records-request,
vet-quote, and insurer-clarification emails are not marketing. They are one-to-one
messages Pawdex sends as the owner's authorized agent to carry out a specific task
the owner asked for, each behind an explicit per-feature authorization
(`lib/auth/authorizations.ts`). They are the electronic equivalent of the owner
mailing the clinic themselves. They carry clear attribution ("sent through Pawdex
under the owner's documented authorization") and reply to the owner's inbox. No
unsubscribe link is required on these, and adding one would be semantically wrong
(the recipient is not a subscriber). The reminder email, which does go to the
consumer on a recurring basis, already has unsubscribe and preference controls, so
the whole outbound surface is clear of CAN-SPAM exposure.

Watch item (YELLOW, minor): if Pawdex ever sends promotional email to waitlist
members or users (product announcements, upsell), that mail is commercial and
must carry an unsubscribe link and a valid physical postal address. The reminder
template's footer is a good place to also add a postal address for belt-and-suspenders.

---

## 4. COPPA (children's privacy)

| Requirement | Status | Evidence | Action |
| --- | --- | --- | --- |
| Not directed to children; state minimum age; no knowing collection under 13 | GREEN | Terms "Your account": "the service is not directed to children under 13." Privacy "Children": not directed to under-13, no knowing collection, deletion path via privacy@pawdex.co | None. Adequate. Pawdex is a pet-records product for adult owners with no child-directed content, so the under-13 line meets COPPA |

Note: COPPA's threshold is under 13, which both pages use correctly. A 16+ line
is not required for COPPA and is not recommended here, since it would only narrow
the audience without a legal driver.

---

## 5. Money transmission / insurance-producer licensing

| Concern | Status | Reasoning | Action |
| --- | --- | --- | --- |
| Money transmission | GREEN | Pawdex moves no consumer money, holds no funds, processes no payments between parties. (Subscription payments, when added, are Pawdex charging its own customers via a processor, which is ordinary merchant activity, not money transmission.) | None |
| Insurance-producer licensing (current features) | GREEN | Pawdex does not sell, solicit, negotiate, or bind insurance, and takes no commission. The insurer-clarification feature only drafts a neutral policy-language question and sends it as the owner's messenger (`insurer-clarification.ts` system prompt forbids advocacy, demands, admissions, and medical or coverage opinions). The vet-quote feature gathers a cost estimate to help the owner plan. Neither transacts insurance | None. Document why current features stay clear of producer licensing |
| Public-adjuster licensing (FUTURE claim-filing feature) | YELLOW / flag before ship | A future feature that files or negotiates insurance claims on the owner's behalf could implicate "public adjuster" licensing. Several states define a public adjuster broadly as anyone who, for compensation, advises on or negotiates the settlement of a claim on behalf of an insured. Even without a per-claim fee, a paid product that actively negotiates claim outcomes may fall within some states' definitions | DO NOT ship claim-filing without a state-by-state review of public-adjuster definitions (CA, NY, FL, TX at minimum) and a decision on whether to (a) stay strictly clerical/pass-through, (b) restrict the feature by state, or (c) license. Keep any near-term feature limited to organizing documents and drafting neutral, owner-signed correspondence, which is what the current build does |

Rationale for the current GREEN: the line that keeps Pawdex clear of insurance
licensing is that it never acts as a party to the insurance relationship. It
organizes the owner's records and, only with explicit authorization, carries a
neutral message the owner could have written themselves. The moment a feature
starts advocating a claim outcome or settling for the insured, that line is
crossed in some states. The system prompt in `insurer-clarification.ts` is the
technical control that enforces neutrality today; it should stay.

---

## 6. Veterinary practice boundaries (no unlicensed practice of veterinary medicine)

| Requirement | Status | Evidence | Action |
| --- | --- | --- | --- |
| Product does not practice veterinary medicine / give medical advice | GREEN | Terms "Pawdex is not veterinary or medical advice": records-organization tool, not a provider, nothing is advice/diagnosis/treatment, verify against originals, emergencies go to a vet | None |
| First-year plan disclaimers | GREEN | `components/onboarding/first-year-timeline.tsx` shows an inline banner: "A typical schedule to plan around, not medical advice. Always confirm timing with your vet." Dates are labeled "projected." State-law-sensitive items (for example rabies timing) carry a "Check state law" badge. The scheduled-note copy reiterates the plan is a guide | None. Copy is adequate and honest |
| Breed / risk content | GREEN | Positioned as information, not diagnosis; the overall medical-advice disclaimer in Terms covers extracted facts, summaries, reminders, and risk information | None |

The first-year plan copy was read directly and is adequate: it frames the
timeline as a typical schedule to plan around, explicitly says "not medical
advice," and tells the user to confirm timing with their vet in the same view
where the dates appear, not buried in a policy.

---

## 7. GDPR / geographic posture

| Requirement | Status | Evidence | Action |
| --- | --- | --- | --- |
| EEA/UK posture during US-only pre-launch | GREEN (as scoped) | Recommended and applied a minimal, honest geo note rather than over-building GDPR machinery. Privacy "Where Pawdex is offered" states Pawdex is offered in the US, not directed to or marketed in the EEA/UK, and will update the policy before opening those markets | None now. Do not build DSAR/DPO/SCC machinery pre-launch. Revisit if/when marketing to or onboarding EEA/UK users |

Recommendation: keep the US-only posture explicit and avoid inadvertently
targeting the EEA (no EEA-language marketing, no EEA-targeted ads). The honest
"not offered there yet" note is the right level of effort for a pre-launch
US waitlist.

---

## 8. Subscription law readiness (CA ARL + card networks + FTC status)

The pricing-billing agent is introducing paid tiers. A full requirements
checklist was sent to that agent (SendMessage to pricing-billing) within the
first hour of this audit. Summary of the legal floor:

- California Automatic Renewal Law, as amended by AB 2863 (effective July 1,
  2025): clear-and-conspicuous auto-renewal terms in visual proximity to the
  consent, express affirmative consent to the auto-renewal, total price before
  authorization, a retainable post-enrollment acknowledgment, online
  same-medium cancellation as easy as signup, and a price-change notice no fewer
  than 7 and no more than 30 days before the change.
- Card networks (Visa/Mastercard): full cost shown before authorization,
  post-enrollment confirmation of terms, a pre-billing reminder at least 7 days
  before charge for trial-converting subscriptions, and an easy online
  self-service cancel.
- FTC Negative Option / "click-to-cancel" Rule: vacated by the Eighth Circuit on
  July 8, 2025 (Custom Communications, Inc. v. FTC) and not currently in force.
  This is NOT relief. CA ARL and the card networks independently require the
  above, and ROSCA plus FTC Act Section 5 plus state UDAP still apply. The FTC
  submitted a new ANPRM on Jan 30, 2026, so the trend is tightening.

Terms updated: `app/(marketing)/terms/page.tsx` now has a "Subscriptions,
billing, and cancellation" section covering billing cycles, auto-renewal, online
cancellation effective at end of period, the permanent free tier, the
records-never-hostage commitment (viewing and export free forever, including
after cancellation), refunds, price-change notice, and early-access
grandfathering.

| Item | Status | Note |
| --- | --- | --- |
| Terms Subscriptions section | GREEN | Written and effective July 10, 2026 |
| Checklist delivered to pricing-billing | GREEN | Sent early per mandate |
| Pricing page disclosure (per-tier line + FAQ) | GREEN / PASS | Re-graded the shipped files after fixes. The "How does auto-renewal work?" FAQ (`components/marketing/pricing-faq.tsx`) now states renewal is at the price you signed up for with 7-to-30-day notice of any change, replacing the earlier "then-current price" language. The "Can I cancel anytime?" FAQ carries records-never-lock, online cancel, no retention maze; the downgrade FAQ keeps records free to view and export; the per-tier TIER_DISCLOSURE line passes. The refund FAQ was intentionally NOT published to the public page because the 14-day annual cooling-off term is still pending founder sign-off; the ready wording is preserved in a COMPLIANCE-OWNED comment for a one-line re-add on confirmation. Note the deliberate asymmetry: the Terms of Service states the full refund policy (also flagged for sign-off), while the marketing FAQ omits it until confirmed. Both are defensible; the binding document is Terms. Renders publicly and reads correctly |
| Checkout consent block (/settings/billing) | GREEN / PASS (dormant until billing enabled) | Verified in `app/(app)/settings/billing/page.tsx` (PlanCard, ~line 300). CA-ARL consent block is inline visible text (a paragraph, not behind a link), sits immediately above the subscribe button, renders the real amount (`formatUsd(plan.priceMonthlyCents)`), frequency, and plan name, and states cancel-anytime-online plus a post-enrollment confirmation. Gated behind `isBillingEnabled() && canManage && isPaidPlan && !isCurrent`, so it is dormant now. Forward note: when an annual interval is wired, the block must switch the amount and "every month" to the annual figure and "every year" to stay accurate |
| Refund policy | NEEDS FOUNDER SIGN-OFF | Proposed: monthly not pro-rated, annual gets a 14-day cooling-off full refund. Honest and simple, but it is a business decision, not a legal mandate |

Sources: [CA AB 2863 bill text](https://leginfo.legislature.ca.gov/faces/billTextClient.xhtml?bill_id=202320240AB2863); [Davis Wright Tremaine on AB 2863](https://www.dwt.com/insights/2024/10/ab-2863-updates-california-automatic-renewal-law); [8th Circuit vacatur (Mayer Brown)](https://www.mayerbrown.com/en/insights/publications/2025/07/click-to-cancelled-eighth-circuit-vacates-federal-trade-commissions-revised-negative-option-rule); [Sidley on the vacatur](https://www.sidley.com/en/insights/newsupdates/2025/07/us-ftc-click-to-cancel-rule-struck-down); [Visa subscription-merchant policy](https://usa.visa.com/dam/VCOM/global/support-legal/documents/subscription-merchants-visa-public.pdf); [Mastercard subscription/negative-option standards](https://www.mastercard.us/content/dam/public/mastercardcom/na/global-site/documents/subscription_recurring-payments-and-negative-option-billing-merchants.pdf).

---

## Founder decisions required

1. Refund policy sign-off: monthly non-pro-rated, annual 14-day cooling-off full
   refund. Adjust or approve.
2. Confirm signed DPAs are on file with Vercel, Supabase, OpenRouter, and Resend.
3. Acknowledge the pre-launch US-only posture and hold marketing out of the
   EEA/UK until the policy is expanded.

## The one thing that must not ship without more work

The FUTURE insurance claim-filing feature. Filing or negotiating claims on an
insured's behalf can trigger public-adjuster licensing in several states. It must
get a state-by-state legal review before it ships. Everything currently in the
build stays on the safe side of that line by staying clerical and neutral; the
claim-filing feature is where that changes.
