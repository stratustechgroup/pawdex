# Competitive landscape, August 2026

Status: research memo for founder review. Produced by a five-segment
multi-agent sweep (80 products: consumer record apps, vet clinic platforms,
breeder and shelter software, AI and insurance tools, and record-for-life
analogs outside the pet vertical). Companion to `docs/pricing-strategy.md`,
which it argues against in places.

Prices marked verified were read off an official page or App Store IAP block.
Anything unverified is flagged inline; treat those as leads, not facts.

Three repo claims in this memo were checked against the codebase before filing,
and all three hold as of this commit:

- No machine-readable export exists. There is no CSV, JSON, or zip download
  route, and no `Content-Disposition` anywhere in `app/`, `lib/`, or
  `components/`. The packet surface is `window.print()`
  (`app/(app)/pets/[petId]/packet/print-button.tsx`). Meanwhile `lib/billing/plans.ts`
  advertises "Export & view, always free" and the pricing page promises records
  are "always free to view and export." That gap is the memo's headline finding.
- No push notifications. No service worker, no `PushSubscription`, no
  `Notification.requestPermission`. Reminders are email-only.
- No deceased-pet state and no legacy contact or record steward.

---

# Pawdex Competitive Positioning Memo
**Date:** August 2026
**Basis:** 80 products across five segments, plus repo-verified feature inventory
**Bottom line:** Our feature surface is ahead of every direct competitor. That has never been what wins this category. We have one promise we do not currently keep, one tier we cannot justify on delivered value, and one bet that nobody in a decade has won.

---

## 1. Where We Align

We have cleared the table-stakes block. None of it is a talking point.

Universal across the segment, present even in zero-rating hobby apps: vaccination records with booster reminders, medication tracking with dosing schedules, weight history, multi-pet accounts, photos, appointment and expiry reminders, cloud sync, share-with-vet.

Also parity, and we should stop calling these differentiators:

- Multi-caregiver access with per-member identity, roles, expiring invitations, revocation and an audit log. This is exactly GreatPetCare's organizing concept and 11pets Premium's model. Our edge is that it is free, which is a pricing edge, not a feature edge.
- Scoped, time-boxed share links. Functionally Epic's Share Everywhere pattern.
- Self-serve account and pet deletion with a retention window and purge cron. One of four 2026 table-stakes items in the records-for-life segment. Clears the bar, wins nothing.
- Free entry tier with no credit card. This is simply how the entire segment acquires users.
- A records vault that keeps original PDFs alongside structured values. VetCore and Vet Record both ship this.
- Plain-English AI explanation of an uploaded vet document. VetLens does this free with no card. It is a hook, not a business.
- Standalone analysis of an insurance policy the user already holds. PetCoverage.ai (free) and PetInsureNow's Policy Decoder both ship it.
- Free record, paid intelligence as the business model shape. This is the Huckleberry and Day One default.

---

## 2. Where We Differentiate

Ranked by defensibility, not by how good the feature is.

**1. Ownership transfer that carries the full medical history and creates the recipient's account.**
Checked product by product across all 80. No consumer pet health record app supports it. The only transfer machinery in pet software lives in microchip registries and moves identity only. AKC's registry transfer is the sole real two-party primitive and it costs $37.50, requires a signed paper certificate, and carries pedigree rather than health history. Embark transfers a DNA profile but requires the recipient to already have an account, which strands the handoff at the exact moment of sale. Petstablished silently re-points a chip. Nobody moves the record.

This is defensible at the data-model level, not the feature level. Every incumbent welds animal identity to the account of whoever created it. Copying us means a schema migration they have no commercial reason to run, because their buyer is the breeder or the clinic, not the animal's next owner. This is our one genuine structural position.

The caveat: it is worth nothing without retained originator access after transfer, which we have not confirmed we ship. Embark has a shared-owner checkbox; Petstablished keeps the org as secondary contact. Without it, breeders will refuse to release records and the wedge never opens.

**2. The policy-to-record join.**
We ingest the pet's actual chart and analyze the owner's actual policy including pre-existing-condition review. The research searched specifically for this and found the intersection empty as of August 2026. PetCoverage.ai and PetInsureNow read the policy and never the chart. Pawlicy scores plans in the abstract. Embrace's Medical History Review is opt-in, initiated by the owner emailing a claims inbox, and adjudicated by a human reading PDFs.

Defensible because it requires owning both halves, and neither the carriers nor the comparison tools can acquire the other half cheaply. Half-life is moderate, not permanent: Trupanion already has the deepest clinic-side record pipe in the category and could build the record half if it wanted to.

**3. Records-request-on-your-behalf, with authorization and cron follow-up.**
This turns the owner's statutory right to a copy into software. Most states entitle the owner to a copy on request (PA 3 business days, NC 10 business days, WA 10 working days). There is no technical mechanism anywhere to exercise it. This was Pawprint's signature feature and Pawprint is dead. We are the only living implementation.

Ranked third and not first deliberately: it is shipped but entirely unproven. Its value is a function of clinic response rate, which we do not measure. See section 5.

**4. Multi-channel ingest that needs zero clinic cooperation.**
Email-forwarding inbox, AI extraction, PIMS classifier, dedup. Every owner-entered competitor is pure manual typing. Real advantage, moderate defensibility: the extraction model is commoditizing fast and everyone hits the same accuracy ceiling (roughly 97% on typed electronic records, an estimated 65 to 80% on handwritten diagnostic notes). The durable parts are the email channel and the dedup, not the model.

**5. A breeder tier that terminates in a consumer account.**
The combination is unique. Every competitor's handoff dead-ends because the buyer has no account anywhere. But every individual breeder feature we ship is at parity or behind. See section 3 and 4.

**6. EU travel packets and APHIS 7001, medication price comparison, quality-of-life tracking.**
All genuinely absent from every product in every segment researched. All are features, not moats, and all are cheap to copy. Medication price comparison is the most interesting of the three because we have no pharmacy to protect, which Dutch and Vetster structurally do.

**7. Free-forever view and export as a hard brand promise.**
Strategically strong. Whistle, Mars-owned, bricked devices and deleted health timelines on 30 days' notice in August 2025, and that is the segment's defining trust event. VetVault's $149 lifetime tier is the only competing attempt to align pricing with a lifetime claim and it comes from a one-person shop.

But as of today the promise is honored only in its weakest form. We ship a print-to-PDF packet and no machine-readable export. A record you can print but cannot migrate is not portable. This is the one item in this memo where our marketing claim is currently false.

### Things we think are differentiation and are not

- Multi-caretaker sharing. GreatPetCare's entire organizing concept. Our edge is price.
- Emergency card. Red Cross has one, VitusVet markets record download for exactly this scenario, and ByteTag sells the QR version as a standalone product with 9,409 ratings. Ours is also weaker on the axis that matters, because it needs connectivity.
- AI Q&A over the record. VetVault ships AI insights over stored health data. Our edge is depth of record, which is unproven, and model access is not defensible.
- AI document extraction as such. Free from VetLens with no account.
- Unlimited pets at $6. Dutch covers 5 pets, Pawp covers 6. Competitive, not novel.
- Breeder multi-user with no per-seat charge. ZooEasy already ships admin, breeder and member roles. It just charges for them. Pricing edge.
- Consumer lab storage. VetVault and every clinic-fed app has it.
- "Nobody touches insurance." True inside consumer record apps. Not true across the landscape. Only the record join is ours.

---

## 3. Pricing Placement

### Consumer: Free / $6 mo / $60 yr

Verified in-category comps (read off the App Store IAP block or an official page): Vet Record $6.99/mo and $24.99/yr. VetVault $6.99/mo, $49.99/yr, $149 lifetime. Pet Care Tracker $4.49/mo and $39.99/yr. Adjacent band context: Huckleberry $68.88 to $119.88/yr, Day One $49.99 to $74.99/yr, 1Password Families $53.88/yr promotional, Dutch $132/yr, Tractive $108 to $300/yr.

**Monthly is correct. Annual is wrong, in two ways at once.**

$60/yr is the highest annual price in the owner-entered pet-record category, 2.4x Vet Record's $24.99. And our annual discount off our own monthly is 17%, against a category median near 40% (Vet Record 70%, VetVault 40%, Pet Care Tracker 26%, Huckleberry Plus 52%). We are simultaneously the most expensive annual plan in category and the one with the weakest reason to take it. That is the worst of both positions. Recommend $48/yr, which is a 33% discount and puts us between Pet Care Tracker and VetVault.

The honest caveat on all of this: consumer price is not our binding constraint. The entire owner-entered category spans 1 to 2,162 US ratings. Nobody has proven willingness to pay for a pet records app at any price. Getting from $60 to $48 is a conversion optimization, not a strategy.

### Breeder: $29/mo flat

Verified comps: Breeder Cloud Pro $6.99/mo (capped at 10 active breeding females), $13.99/mo unlimited, $130/yr. ZooEasy Single $6.16 to $7.70/mo, Multi (2+ users) $20.68 to $25.85/mo. Breedera reported at £9.99/mo with a real free tier (unverified, site returned 403). Shelter-side anchors for context: Shelterluv $2/adoption, 24PetShelter $5/adoption, 24PetRescue free, RescueGroups $75/yr, Petstablished $24 to $49/mo waivable to zero on chip volume.

**Overpriced on delivered value today.** $348/yr against Breeder Cloud Pro's $130/yr is 2.7x, and we are behind Breeder Cloud Pro on pedigree, contracts, deposits and website, behind Breedera on heat prediction and whelp forecasting, and behind ZooEasy on genetics math. Nothing on our breeder parity list can carry a 2.7x premium. The price is defensible only if transfer is the entire purchase reason, and transfer is precisely what a breeder cannot evaluate before buying.

Two structural problems beyond the number. First, there is no breeder annual SKU at all, which is indefensible for a workflow with two litters a year. Breedera lets breeders downgrade to free between litters because that is how the work actually runs. A flat monthly against seasonal usage is a churn machine. Second, on a seat-normalized basis $29 is fine for a four-person kennel against ZooEasy Multi at $20.68 to $25.85 for two users, and terrible for the solo hobby breeder who is most of the market.

### Pricing models in the market we are not using

- **One-time permanence.** VetVault sells a $149 lifetime tier. Permanent.org sells $10/GB once into a nonprofit endowment whose earnings fund storage in perpetuity. This is the only pricing model researched that is structurally honest about a lifetime promise rather than contingent on an indefinite subscription. Given our positioning and the Whistle trust event, its absence is conspicuous.
- **Per-outcome / per-event pricing.** Shelterluv $2 per adoption, 24PetShelter $5 per adoption. This is the dominant shape on the operator side and subscription pricing to shelters is effectively dead. Relevant to any breeder repricing and mandatory if we ever enter shelters.
- **Fee waiver against volume.** Petstablished waives its monthly fee for orgs processing 5 to 10 monthly chip registrations.
- **Metered overage on our own metered cost.** AI extraction is our single variable cost and it has no price. A free-tier user at 11 extractions this month has exactly one option, which is a $6 subscription. A $2 pack of 10 extractions would convert the user who churns instead.
- **Distribution subsidy.** Vetsource gives away its owner app because pharmacy margin funds it, setting the segment price floor at zero. Pawlicy takes carrier commission. Good Dog takes 6.5% of every deposit. We forgo all of these deliberately, and that is correct for trust, but it should be named as a chosen cost, not assumed away.

---

## 4. What We Are Missing

Deduped from 32 raw gaps. Effort key: S = days to two weeks, M = one to two months, L = a quarter or more, XL = a different business.

### Table stakes we lack

| # | Gap | Who has it | Severity | Effort | Conflicts with the promise? |
|---|---|---|---|---|---|
| 1 | Machine-readable export (JSON/CSV/zip). Verified absent in repo: the packet surface is `window.print()`, and no `text/csv`, `application/zip` or `application/json` download exists anywhere in `app/` or `lib/`. | Epic MyChart ships PDF and computer-readable deliberately. Day One ships JSON, PDF, text, CSV. Ancestry ships GEDCOM plus raw DNA. | Promise-breaking | S | It *is* the promise. Must be free tier, every pet, day one. Paywalling it behind Household would breach the brand promise outright. |
| 2 | Push notifications. Reminders and expiring items are email-only; no push, SMS or native shell in the codebase. | Every product in the segment. PetDesk 497,871 ratings, Banfield 119,151, VitusVet 10,775, all mobile-native with push. | Table stakes for retention | S for web push on the existing PWA, L for a native shell | No. Do not paywall push, or the promise gets fuzzy at the edges. |
| 3 | Breeder core: multi-generation pedigree rendering, heat and mating logs, whelp-date prediction, e-signature contracts, deposit collection. | Breeder Cloud Pro, Breedera, ZooEasy all ship some or all. AKC sells a 4-generation pedigree for $36. | Table stakes for the buyer we charge $29 | S for pedigree (derived from data we already hold), M for cycle planning, M/L for contracts and payments | No, provided money rides the transaction and never the record. Gating a record behind an unsigned contract or unpaid invoice would breach it. |
| 4 | Source document shown beside every extracted value, with confidence and an owner correction path. **Verify before building** — this may partially exist in the documents surface and simply not be named in the inventory. | VetCore keeps lab values alongside the original PDF. | Correctness and trust | S/M | No. It is the promise applied to extraction: the owner can always check the machine against the paper. |
| 5 | Offline access to the emergency card. All routes are `force-dynamic` with no service worker. | VitusVet markets 24/7 downloadable records; Red Cross Pet First Aid works fully offline. | High-stakes, low-frequency | S/M | Strengthens it. An on-device copy is the purest form of "the record is always yours." |
| 6 | Legacy contact and per-record steward, plus a deceased-pet state. Verified absent in repo. | Apple (cryptographic split-key), Ancestry, Permanent.org (account-level contact plus per-archive steward). | Table stakes in the records-for-life segment | S. Death-triggered stewardship is a transfer over the existing `app/transfer/[token]` mechanism, not a new subsystem. | Must be free. Charging for succession is charging for continued access. A memorial SKU is fine only if it buys permanence or a physical artifact, never viewability. |
| 7 | Microchip registry integration. We store a chip number; we are not connected to the registry a shelter or vet actually queries. | Petstablished auto-re-points at adoption, 24PetShelter bundles a free chip, AKC Reunite has a dedicated transfer flow (fees unverified). | Competitive, and it undercuts differentiator #1: our transfer moves the history and leaves legal identity pointing at the prior owner. | M, partner-gated | No. Integrate without adopting registry lock-in, which would itself be a soft form of charging for access. |
| 8 | Retained originator access after transfer. | Embark's shared-owner checkbox, Petstablished's org-as-secondary-contact. | Competitive, and the cheapest item on this list | S | No. It is more free viewing. The only question is consent design on the new owner's side. |
| 9 | Proof-of-ownership fallback for contested, abandoned or orphaned records. | Embark alone: a recent dated vet or insurance bill grants shared ownership. | Competitive. We will hit this early because transfer is the whole thesis. | S to build, ongoing ops cost | Yes, indirectly. A slow or manual claims process effectively withholds viewing from someone who owns the animal. It must be free and fast, which makes it a cost center. |
| 10 | Public plain-language rights page, separate from privacy and terms. | b.well, Ancestry, Zus. | Nice to have | S | It is the promise's natural home. Publishing the guarantee there converts a marketing claim into something users can cite back. |

### Opportunities nobody has taken

| Gap | Why it is open | Effort | Notes |
|---|---|---|---|
| Record-aware insurance shopping: compute which carrier's curable-PEC window this pet already satisfies (Pumpkin 180 days, Embrace 12 months, AKC 365 days including incurable, Nationwide case-by-case) and flag bilateral and body-system exclusions (Healthy Paws cruciate, Pumpkin knee and hind-leg) against conditions actually in the chart. | Confirmed empty as of August 2026. We already hold both halves. | M | Take no carrier commission and say so. Every existing comparison tool is commission or referral funded and structurally conflicted. |
| Consent transparency log for the research direction, plus a consent-does-not-transfer-on-change-of-control clause. | Apple is the only product in any of the five segments with a transmission log. The 23andMe Chapter 11, database auction and $305M TTAM acquisition made the change-of-control question live for regulators. | S/M | Costs nothing today and cannot be retrofitted credibly later. Decide before the data line ships. |
| Pedigree graph derived from the transfer graph. | Nobody else can produce it, because nobody else has transfers. | S | Free to view and export like everything else; genetics math (test mating, coefficients) is the paid leverage layer. |
| Product recall alerts. | GreatPetCare only, and it is the credible leader among owner-entered apps. | S | Solves the between-visits retention hole. Belongs on the free tier as a trust builder. |
| QR rendering of the existing share link. | We already ship `app/share/[token]`. ByteTag sells the tag-to-profile bridge as a standalone product with 9,409 ratings. | S | Free viewing, made faster. |
| Structured ingest of OFA/CHIC and Embark results. | Unclaimed by every product in the set. | M | OFA's per-result consent model is the closest existing precedent for our research consent and is worth copying nearly verbatim. |
| One-time permanent memorial SKU on the Permanent.org model. | VetVault's $149 lifetime is the only attempt, from a one-person shop. | M | Only compatible if the fee buys permanence or a printed artifact. The moment it becomes what keeps a deceased pet's record viewable, the promise is broken. |

### Deliberately not doing

Live telehealth (Chewy sets the consumer price of vet Q&A at $0 with Autoship; Fuzzy raised roughly $80M selling exactly this and shut down in June 2023 with employees unpaid). Real-time clinic booking and two-way clinic messaging (drags the clinic in as buyer, which is the model our promise depends on avoiding). Shelter operations suite (wrong revenue shape entirely; per-adoption or free). Flat-rate emergency fund (capital and regulatory, XL, and Pawp's own public pricing is inconsistent enough to suggest recent repackaging). Passive sensor telemetry (blocked, not deferred: Tractive and Fi export GPS only, no health data, and HealthKit has no pet data types).

---

## 5. The Biggest Strategic Risk

**We are a records product in a category where no records product has ever reached scale, and the one thing that has ever produced scale is the one thing our positioning forbids us from taking.**

Sort this segment by US App Store ratings and it separates on exactly one axis. Clinic-tethered or hardware-tethered: PetDesk 497,871, Banfield 119,151, Tractive 43,434, Fi 39,525, VitusVet 10,775, PetPage 5,583, Digitail 3,442. Owner-entered: GreatPetCare 2,162, Pet Care Tracker 938, 11pets 77, VetVault 2, Vet Record 1, the species-specific apps at 0 and 1. Three orders of magnitude, no exceptions, across a decade of attempts.

Every product with real consumer scale is attached to something that generates data without the owner doing anything: a clinic's PIMS or a sensor on the collar. We cannot take either. Taking the clinic feed means the clinic becomes our buyer, which means the record is a permission the clinic grants and can revoke, which is the exact thing our positioning exists to break. Taking the sensor feed is blocked outright, because no wearable exports health telemetry.

So we are betting on a third path nobody has ever won: owner-authorized retrieval. Documents forwarded to an inbox, AI extraction, and statutory records requests emailed to clinics on the owner's behalf. Pawprint bet on exactly the retrieval half and is dead. VitusVet had the founding story, 10,775 ratings at 4.86, and has not shipped since April 2023. This is not a marketing problem or an execution problem. It is the category's structural defeat, and our answer to it is shipped but has produced no evidence.

The bet is falsifiable, and we should be measuring it today. What fraction of records requests we send actually return a usable document, and how long does it take? If the answer is materially below half, or if the median turnaround runs past a few weeks, then we are a manual-entry app with a better UI and an insurance feature, which is precisely the graveyard the ratings data describes. Every other decision in this memo is downstream of that number, and right now it is unknown.

A consequence worth naming: our strongest differentiator, transfer, is a two-sided market whose cold-start sits on the side we currently serve worst. Breeders will not run a program on a $29 tool that cannot draw a pedigree or predict a whelp date, and adopters do not exist as a channel until breeders do.

---

## 6. Recommendations

**1. Ship machine-readable export on the free tier, for every pet, this quarter. Publish the rights page alongside it.**
This is the only item in the memo where a stated brand promise is currently false. Effort is small; the data is already structured. Copy Ancestry's ritual on the export moment (re-authentication, an emailed link with a short expiry, a forced acknowledgment that we cannot protect the file once it leaves). Friction at the exposure moment is compatible with free. Paywalling is not.

**2. Instrument the records-request funnel and treat it as the company's leading indicator.**
Request sent, clinic responded, usable document received, successfully extracted, with median latency at each stage. Report it weekly. If the pass-through rate is under roughly 50%, that finding outranks every roadmap item in this memo and the strategy needs to change, not the backlog. We are currently making the category's hardest bet with no telemetry on it.

**3. Fix the breeder tier before defending its price, then reprice it.**
Build order: pedigree rendering (small, derived from data we already hold), retained originator access after transfer (small, and without it breeders will not release records at all), heat and whelp planning, then contract signing and deposit collection at the placement moment. Then reprice: add an annual SKU, consider a lower entry near the $13.99 category anchor, and put any transaction fee on the contract or deposit and never on the transfer itself. Shelterluv zero-rates every non-adoption outcome and that is exactly why shelters move animals freely.

**4. Make the record-aware insurance answer the flagship paid feature.**
Which specific conditions in this dog's chart get denied under this specific contract, and which carrier's curable-PEC window this pet already satisfies today. Confirmed unoccupied, we hold both inputs, and it is the only place in the product where the record produces money for the owner. That is the only durable answer to "why pay $6 between two annual vet visits." Take no carrier commission and say so in the copy, because every competing tool is conflicted and cannot say it.

**5. Decide the research-consent architecture now, before the data line ships.**
Opt-in fully decoupled from product access, where declining costs the user nothing. Local de-identification before transmission. A user-visible log of exactly what was sent. Self-serve withdrawal with a stated cessation window and no expiry on the consent. Named never-disclose adversaries: pet insurers and breed-restriction underwriters, by name. Disclosure of who pays us and how much. And a consent-does-not-survive-change-of-control clause, which costs nothing today and is the single most credible trust signal a small company asking for research consent can offer. End-to-end encryption and an aggregate research product are structurally incompatible, and since server-side AI reading is our paid product, the Apple shape is the only one available to us. This is an architecture decision with a short window, not a policy document to write later.

Fold the small items into ordinary sprint capacity rather than treating them as strategy: web push on the existing PWA, offline emergency card, QR rendering of the share link, recall alerts on the free tier, legacy contact over the existing transfer mechanism, and the extraction verification UI once we confirm what already exists in the documents surface.