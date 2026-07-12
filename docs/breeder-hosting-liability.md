# Breeder Hosting Liability Analysis

Prepared for a founder go/no-go decision on the proposed breeder hosting tier.
Pawdex is US-based (South Carolina founder) with a California-first compliance
posture. This document maps the legal exposure of hosting breeder storefronts,
buyer onboarding, custom e-signed adoption contracts, and the adoption handoff,
and it recommends a v1 that keeps exposure low.

This is risk analysis to inform a business decision. It is not legal advice, it
is not a substitute for a licensed attorney, and no part of it creates an
attorney-client relationship. Section "When a real lawyer becomes non-optional"
marks the points where outside counsel is required before shipping.

It builds on the house posture already set in `docs/compliance-audit.md`
(CCPA/CPRA GREEN, money-transmission GREEN because Pawdex holds no funds,
platform-not-party framing, versioned-consent authorizations pattern in
`lib/auth/authorizations.ts`).

---

## The decision that drives everything: tooling vs marketplace

Almost every liability question below resolves on one product choice, so it goes
first. There are two ways to build this feature, and they carry very different
risk.

TOOLING (white-label). Pawdex gives each breeder a hosted site under the
breeder's own brand and domain, with the breeder's own documents. Buyers arrive
because the breeder sent them there. Pawdex does not curate breeders, does not
rank them, does not run a directory buyers browse, never takes possession of an
animal, and never touches the sale money. Pawdex is plumbing. To a buyer, the
site is the breeder's site.

MARKETPLACE (Pawdex-branded discovery). Pawdex runs a directory where buyers
browse and compare breeders, Pawdex makes or curates representations about them
(verified badges, health guarantees, "trusted breeder"), and Pawdex sits in the
transaction (deposits, handoff, dispute mediation). To a buyer, Pawdex is the
place they found and vetted the breeder.

Why this is the spine, not one section among many:

- The pet-purchaser-protection statutes ("puppy lemon laws") attach to the
  breeder or pet dealer who sells the animal, defined by volume of animals sold.
  None of them reach a website that merely advertises or hosts. Tooling stays
  entirely outside the regulated-party definition. See "Marketplace and
  facilitation liability."
- Section 230 immunizes Pawdex for a breeder's own words on a breeder-authored
  listing (third-party content). It does not immunize Pawdex's own
  representations, and it does not immunize a strict-product-liability theory
  built on Pawdex being "integral to the distribution chain"
  ([Bolger v. Amazon, 2020](https://law.justia.com/cases/california/court-of-appeal/2020/d075738.html)).
  The more Pawdex curates and vouches, the more it authors and the more it looks
  like a link in the chain.
- The Bolger factors that made Amazon strictly liable (accepted possession,
  controlled the terms, received the payment, shipped the goods) are exactly the
  factors a marketplace accumulates and a white-label host avoids.

The recommendation, defended through the rest of this document, is to ship v1 as
tooling only. That single decision converts most of the high-severity items
below into low or negligible exposure.

---

## 1. E-signatures (ESIGN Act + UETA)

Legal basis. Electronic signatures and records are valid and enforceable under
the federal ESIGN Act, [15 U.S.C. § 7001](https://www.law.cornell.edu/uscode/text/15/7001),
and the state Uniform Electronic Transactions Act (UETA), adopted by nearly
every state, with New York a notable holdout that instead uses its Electronic
Signatures and Records Act (ESRA), which reaches the same result. Section 7001(a) says a signature or
contract "may not be denied legal effect, validity, or enforceability solely
because it is in electronic form." An electronic signature is "an electronic
sound, symbol, or process, attached to or logically associated with a contract
or other record and executed or adopted by a person with the intent to sign the
record" (§ 7006). Enforceability in practice turns on execution discipline, not
on ink versus screen: courts uphold e-signatures backed by a detailed audit
trail and reject them when the record cannot show who signed, that they intended
to, and that the document was not altered
([DocuSign, admissibility](https://www.docusign.com/blog/are-electronic-signatures-admissible-in-court)).

Three things an enforceable e-signature needs, and what an audit trail must
capture:

- Intent to sign. A discrete, affirmative signing act tied to the specific
  document, not a passive checkbox.
- Attribution. Evidence the signer is who they claim: authenticated account,
  IP, user agent, device, timestamps for send/view/sign.
- Integrity. Proof the signed document is the exact version presented: a hash
  of the rendered document, a tamper-evident seal, and a retained copy kept with
  its audit trail
  ([e-signature audit-trail elements](https://boldsign.com/blogs/e-signature-audit-trails-why-they-matter/)).

The consumer-consent layer that a buyer contract triggers. ESIGN § 7001(c) bites
whenever a law requires a record to be provided to a consumer in writing and that
record is delivered electronically. That trigger is present here, not merely
because the buyer is a consumer: the puppy lemon laws impose written
health-disclosure duties on the breeder (California and New York both, see
"Marketplace and facilitation liability"), so when those statutorily required
disclosures are delivered through Pawdex's electronic flow, § 7001(c) applies.
Before using electronic records to satisfy such a writing requirement, the
business must
obtain the consumer's affirmative consent after a clear-and-conspicuous
disclosure that states the right to a paper copy and how to get one, any fee,
how to withdraw consent, and the scope of consent; must provide a statement of
the hardware and software required to access and retain the records; and must
obtain the consent (or a confirmation of it) electronically "in a manner that
reasonably demonstrates that the consumer can access" the records in the format
used ([15 U.S.C. § 7001(c)](https://www.law.cornell.edu/uscode/text/15/7001)).

Does the existing authorizations pattern suffice? It is a strong foundation, but
it does not suffice as-is, and the gap matters. `lib/auth/authorizations.ts`
captures consent to a standing scope: a household grants an authorization type,
and the row freezes `scope_text`, a versioned `SCOPE_VERSION`, `granted_by`,
`granted_at`, `ip_address`, `user_agent`, plus an audit entry. That is the right
shape for "I authorize Pawdex to email my vets." It is not the shape for signing
a specific contract instance bound to a specific animal. Signing a breeder's
adoption contract needs additions the current table does not have:

- A discrete intent-to-sign act tied to that document instance, not a scope
  grant. The signer is agreeing to a contract, not toggling a permission.
- A cryptographic hash of the exact rendered contract version signed, so the
  stored copy can be proven identical to what the signer saw. Freezing
  `scope_text` freezes the scope wording, not the whole contract document.
- Binding to the `animal_id` (and the breeder party and buyer party), because
  the contract is about one animal's sale.
- The ESIGN § 7001(c) consumer consent-to-electronic-records disclosure and its
  own captured acceptance, which the authorizations flow does not present.
- A retainable, downloadable copy of the executed contract plus its completion
  certificate delivered to both parties.

Recommendation. Model the contract signature as its own record type (for
example a `document_signatures` table: document hash, version, signer identity,
animal_id, party role, intent event, IP/UA/timestamps, and the § 7001(c) consent
acceptance), reusing the versioning and audit discipline the authorizations
pattern already demonstrates. Do not overload the standing-scope authorizations
table to carry contract execution.

---

## 2. Hosting third-party contracts (unauthorized practice of law)

Legal basis. Unauthorized practice of law (UPL) is providing legal advice or
drafting legal instruments for another without a license. The line that matters
here is well established: creating a completed, original legal document tailored
to a person's situation is practicing law; filling in the blanks on a form
someone else drafted ("scrivening") is not
([Texas Law Help, UPL](https://texaslawhelp.org/article/unauthorized-practice-of-law)).
LegalZoom faced and settled UPL challenges in several states and survived by
positioning itself as a self-help tool, not a law firm; North Carolina went
further and passed legislation stating that software generating legal documents
from a user's questionnaire answers is not UPL
([Gavel, legal-product UPL issues](https://www.gavel.io/resources/legal-information-unauthorized-practice-of-law-legal-apps)).

Exposure for Pawdex. The risk scales with how much of the document Pawdex
authors:

- Hosting a breeder-authored document (the breeder uploads their own adoption
  contract, Pawdex stores it and runs the signature) is not UPL. Pawdex is a
  document host and an e-signature rail, the same role DocuSign plays.
- Supplying contract TEMPLATES that Pawdex wrote, especially ones that adapt to
  the breeder's answers, moves toward authoring legal instruments for others and
  is where UPL risk concentrates. HoneyBook, Rocket Lawyer, and LegalZoom all
  ship templates but wrap them in "not a law firm / not legal advice / no
  attorney-client relationship" disclaimers, attorney-reviewed positioning, and
  in Rocket Lawyer's case an actual attorney network.

The safe line for v1. Host breeder-authored documents only. Do not ship
Pawdex-authored contract templates in v1. If breeders ask for a starting point,
the lower-risk path is to point them to their own counsel or to a clearly
labeled third-party template, not to generate the contract inside Pawdex. If
templates are added later, they should carry the standard "Pawdex is not a law
firm, this is not legal advice, no attorney-client relationship" disclaimer, be
attorney-reviewed, and ideally be presented as optional starting points the
breeder edits and adopts as their own.

---

## 3. Marketplace and facilitation liability (the sick-puppy scenario)

This is the highest-severity area and the one the tooling-vs-marketplace choice
controls most directly.

### Do pet-purchaser-protection acts reach the platform?

More than twenty states have "puppy lemon laws." The consistent structure: the
warranty and remedy run against the seller, defined by animal-sale volume, and
nothing in the statutes reaches a website that advertises or hosts.

- California, the Polanco-Lockyer Pet Breeder Warranty Act,
  [Health & Safety Code § 122045 et seq.](https://leginfo.legislature.ca.gov/faces/codes_displayText.xhtml?lawCode=HSC&division=105.&title=&part=6.&chapter=5.&article=1.)
  A "breeder" is a person or entity that sold, transferred, or gave away three
  or more litters or 20 or more dogs in the prior 12 months. The Act applies to
  breeders (Article 1) and pet dealers (Article 2). The statutory text contains
  no provision reaching a website, platform, or intermediary that advertises or
  facilitates a sale rather than being the seller.
- New York, General Business Law Article 26-A, § 753. A "pet dealer" is one who
  sells more than nine animals a year for profit; hobby breeders who breed and
  raise on their residential premises and sell no more than 25 a year are
  exempt. The 14-day unfit-for-purchase remedy runs against the dealer/retailer,
  not a host
  ([NY AG pet lemon law](https://ag.ny.gov/pet-lemon-law-form)).
- The pattern holds across states; the regulated party is the seller/dealer
  defined by volume
  ([Animal Legal & Historical Center, table of acts](https://www.animallaw.info/topic/table-pet-purchaser-protection-acts)).

Conclusion. A white-label host is not a "breeder," "dealer," or "seller" under
any of these statutes and is not reached by them. This is the strongest single
fact in favor of the tooling posture.

### Section 230 and platform-liability trends

Section 230 immunizes an interactive computer service for content provided by
another (the breeder's own listing text, health claims, and photos). It has two
important limits here:

- Own representations. When a platform makes its own affirmative
  representations (a "verified" or "trusted breeder" badge, a Pawdex health
  guarantee), that content is Pawdex's own, making Pawdex an information content
  provider and opening the door to misrepresentation and consumer-protection
  claims that Section 230 does not block
  ([ABA, platform/marketplace liability](https://www.americanbar.org/groups/business_law/resources/business-lawyer/2024-winter/liability-of-social-media-platforms/)).
- Product-liability / distribution-chain theory. Courts have held Section 230
  does not apply to strict product liability, because the claim is about the
  platform's role in the transaction, not the publication of content. In
  [Bolger v. Amazon (Cal. Ct. App. 2020, review denied)](https://law.justia.com/cases/california/court-of-appeal/2020/d075738.html),
  Amazon was strictly liable for a defective battery sold by a third party
  because it was "integral" to the distribution chain: it accepted possession,
  controlled the terms of the sale, received the payment, and shipped the goods,
  and "whatever term is used to describe Amazon's role, be it retailer,
  distributor, or merely facilitator, it was pivotal in bringing the product to
  the consumer."

The Bolger factors are a checklist of what to avoid. A white-label host takes no
possession of the animal, does not set the sale terms, does not receive the
sale money, and does not effect the handoff of the animal itself; it is not in
the distribution chain. A branded marketplace that curates breeders, vouches
for them, takes deposits, and mediates the handoff accumulates those exact
factors. (Whether strict product liability even applies to a living animal is
itself contested and varies by state; the point is that the marketplace posture
invites the theory and the tooling posture forecloses it.)

### Tooling vs marketplace, made explicit

| Factor | Tooling (white-label) | Marketplace (Pawdex-branded) |
| --- | --- | --- |
| Who the buyer thinks they dealt with | The breeder | Pawdex |
| Puppy-lemon-law "seller/dealer"? | No, not the seller | Still the breeder legally, but Pawdex looks like part of the sale |
| Section 230 for listing content | Applies (breeder's content) | Applies to breeder content, not to Pawdex badges/guarantees |
| Own representations exposure | None (Pawdex vouches for nothing) | High (verification, ratings, guarantees are Pawdex's own speech) |
| Bolger distribution-chain risk | Outside the chain | Edges into the chain as deposits/handoff/curation are added |
| Net exposure | Low | Medium-to-high, and it compounds |

Recommendation. v1 is tooling. No Pawdex-branded directory, no buyer-facing
discovery, no verification badges or health guarantees authored by Pawdex, no
Pawdex ratings of breeders.

---

## 4. Payments and deposits

Legal basis. Holding or transmitting a consumer's money for transfer to a third
party is money transmission and triggers state money-transmitter licensing (a
50-state, expensive, slow regime). The house posture is already GREEN on money
transmission precisely because Pawdex holds no funds
(`docs/compliance-audit.md` section 5). A breeder deposit feature is the thing
that could break that, so it must be designed to preserve it.

The safe rail. Stripe Connect direct charges keep Pawdex out of the flow of
funds: the charge is created on the connected account (the breeder), the money
moves buyer to breeder, and the platform's balance is never touched
([Stripe, direct charges](https://docs.stripe.com/connect/direct-charges);
[Stripe, how charges work](https://docs.stripe.com/connect/charges)).
Destination charges and separate-charges-and-transfers, by contrast, route the
money through the platform, which increases platform liability and pulls Pawdex
toward the flow of funds. If deposits are ever built, direct charges are the
posture that keeps the money-transmission analysis GREEN.

Chargeback and refund position. With direct charges, the connected breeder
account is the merchant of record and bears chargebacks and refund
obligations, which is correct: Pawdex is not a party to the sale and should not
be underwriting deposit disputes.

Recommendation for v1: no payments. Deposits, application fees, and sale money
stay entirely off-platform in v1. This keeps the money-transmission analysis
untouched and keeps Pawdex out of the Bolger "received the payment" factor. When
payments are added later, use Stripe Connect direct charges with the breeder as
the connected merchant of record, never destination charges, and never a
Pawdex-held balance.

---

## 5. Breeder-regulation spillover

The concern: does giving a breeder an online storefront change the breeder's own
regulatory status, and what must Pawdex tell them?

USDA/APHIS retail-pet-store rule (the real one). The 2013 final rule narrowed
the Animal Welfare Act "retail pet store" exemption. Sellers who ship animals
sight unseen (internet and mail-order sellers where the buyer does not physically
observe the animal before purchase) lost the exemption and must be USDA-licensed
and inspected, unless they maintain four or fewer breeding females and sell only
the offspring born and raised on their premises
([APHIS final rule announcement](https://www.aphis.usda.gov/aphis/newsroom/news/sa_by_date/sa_2013/sa_09/ct_retail_pet_final_rule);
[Federal Register, final rule of Sept. 18, 2013](https://www.federalregister.gov/documents/2013/09/18/2013-22616/animal-welfare-retail-pet-stores-and-licensing-exemptions)).

This is a genuine spillover. A breeder who previously sold only face-to-face
(exempt as a retail pet store) and who now, via a Pawdex storefront, sells sight
unseen to buyers who never see the animal in person before purchase, can lose
the exemption. If that breeder also maintains more than four breeding females,
they may be pushed into federal USDA licensing. The risk lands on the breeder,
not on Pawdex, but the platform enables the behavior and should give notice.

Notice the platform should give. At storefront setup, a clear notice: selling
animals sight unseen may require a USDA license under the Animal Welfare Act
unless you qualify for the small-breeder exemption (four or fewer breeding
females, selling only offspring born and raised on your premises); it is your
responsibility to determine and maintain your own licensing. Optionally, keep
sales in-person by default (buyer confirms an in-person meeting or pickup) so the
sight-unseen trigger is not the platform's default path.

State and local retail-sale bans do not reach breeder-direct sales.

- California AB 485 bans retail pet stores from selling dogs, cats, and rabbits
  that do not come from a shelter or rescue. It does not touch breeder-direct
  sales; buying directly from a breeder remains legal
  ([AB 485 bill text](https://leginfo.legislature.ca.gov/faces/billTextClient.xhtml?bill_id=201720180AB485);
  [ALDF summary](https://aldf.org/article/california-becomes-first-state-ban-retail-sale-companion-animals/)).
- New York's Puppy Mill Pipeline Act, effective December 15, 2024, bans retail
  pet shops from selling dogs, cats, and rabbits. The law expressly does not
  impact responsible breeders who sell directly to families
  ([Gov. Hochul signing release](https://www.governor.ny.gov/news/governor-hochul-signs-legislation-end-puppy-mill-pipeline);
  [ASPCA summary](https://www.aspca.org/barred-from-love/laws-rules/new-york-puppy-mill-pipeline-law)).

The consistent theme is that these bans target the retail pet store as an
intermediary reselling commercially bred animals. A breeder selling their own
animals directly is outside the ban, and a white-label tool that helps a breeder
sell their own animals directly does not convert the breeder into a banned
retail store. A Pawdex-branded marketplace reselling other breeders' animals is
the fact pattern these laws were written about, which is a second, independent
reason to avoid the marketplace posture.

---

## 6. Data and privacy

Controller/processor roles. On a white-label storefront, buyer PII flows through
an application form the breeder is the merchant behind. The cleanest and most
defensible arrangement is that the breeder is the controller/business for buyer
application data (it is their prospective customer, their decision), and Pawdex
is the service provider/processor handling that data on the breeder's behalf
under a use-restricted contract. This mirrors the service-provider posture
already documented for Vercel, Supabase, and others in the compliance audit and
keeps buyer data out of Pawdex's own controller obligations. It requires a data
processing addendum in the breeder agreement (see clause 3 below).

CCPA/CPRA fit. The existing California-first privacy posture extends to this so
long as Pawdex stays a processor for breeder-collected buyer data and does not
sell or share it. If Pawdex ever aggregates buyer data across breeders for its
own purposes (a cross-breeder buyer profile, marketing), it becomes a business
for that data and the analysis changes. Do not do that in v1.

Families and children. COPPA does not apply (the product is not directed to
children under 13), but adoption applications commonly collect household
information including children's names and ages. Keep application fields to what
the breeder needs, do not build child-specific data collection, and let the
breeder (controller) own the retention decision. The existing privacy policy's
"not directed to under-13, no knowing collection" posture remains correct.

Privacy policy fit. The current policy covers account holders and their pet
records. A breeder-hosting tier introduces a new data subject (the breeder's
prospective buyer) and a new role (Pawdex as processor for the breeder). The
policy, or a distinct hosted-storefront privacy notice presented on the breeder
site, needs to describe this. On a custom domain especially, the buyer will not
have read pawdex.co's policy, so the storefront needs its own visible privacy
notice.

---

## 7. Other material areas

DMCA designated agent (becomes required once Pawdex hosts third-party content).
Hosting breeder-uploaded photos, text, and documents makes Pawdex an online
service provider storing user material. To keep the 17 U.S.C. § 512 safe harbor
against copyright claims over breeder-uploaded content, Pawdex must designate an
agent with the U.S. Copyright Office through its online system, publish the
agent's contact information on the site, operate notice-and-takedown, and renew
the designation every three years
([Copyright Office, § 512 resources](https://www.copyright.gov/512/);
[DMCA designated agent directory](https://www.copyright.gov/dmca-directory/)).
This is cheap and simple and should be done as part of shipping any hosting
feature.

Trademark and custom domains (UDRP/ACPA). Letting breeders run custom domains or
subdomains introduces a small contributory-infringement and cybersquatting
surface if a breeder picks a name that infringes a third party's mark. Mitigate
by starting with pawdex subdomains only in v1 (Pawdex controls the namespace),
deferring custom domains, and building a trademark/abuse takedown path before
custom domains ship. Requiring the breeder to warrant they have the right to any
name and domain they use (clause 2 below) pushes this risk to the breeder.

Discrimination in adoption-denial workflows. If Pawdex builds application and
waitlist tooling that helps breeders accept or deny buyers, be aware that
housing-style anti-discrimination law does not govern pet sales, but general
consumer-protection and public-accommodation exposure is not zero, and an
automated screening feature that filters buyers could draw scrutiny. Keep the
accept/deny decision the breeder's, do not build Pawdex-authored scoring or
automated denial, and this stays the breeder's call on the breeder's customers.

Insurance / E&O. Standard technology errors-and-omissions coverage typically
addresses failures of the software itself; it does not automatically cover the
new exposures a hosting tier creates (a claim that Pawdex's e-signature failed
and voided a contract, a buyer suing over a sick puppy and naming Pawdex, a
misrepresentation claim on a badge). Before launch, confirm with the carrier
whether the E&O policy covers hosted third-party contracts, e-signature
reliance, and marketplace/facilitation claims, and consider media/tech E&O
endorsements. This is a founder action item, not a code change.

---

## One-page summary

### (a) Risk-ranked table

| Area | Severity if realized | Likelihood at v1 (tooling) | Mitigation cost |
| --- | --- | --- | --- |
| Marketplace / facilitation liability (sick-puppy, own representations, Bolger distribution-chain) | High | Low, if tooling only; Medium-High if marketplace | Low: it is a product-scope decision, not a build |
| E-signature enforceability (contract void, or unenforceable against a buyer) | Medium-High | Medium | Medium: build a proper document-signature record with hash, intent, animal binding, and § 7001(c) consent |
| UPL from Pawdex-authored contract templates | Medium | Low if templates are excluded from v1 | Low: exclude templates; host breeder-authored docs only |
| Money transmission from holding deposits | High | Low, if no payments in v1 | Low now (do nothing); later use Stripe Connect direct charges |
| Breeder USDA-licensing spillover (sight-unseen sales) | Medium (lands on breeder) | Medium | Low: a setup-time notice; default to in-person confirmation |
| Data/privacy processor role for buyer PII | Medium | Medium | Medium: DPA in breeder agreement; storefront privacy notice |
| DMCA safe harbor for hosted content | Low-Medium | Medium | Low: register a designated agent, post it, run takedowns |
| Trademark / custom-domain abuse | Low | Low if subdomains only | Low: subdomains in v1; defer custom domains |
| State retail-sale bans (AB 485, NY Puppy Mill Pipeline) | Low | Low (they do not reach breeder-direct) | None for tooling; do not build a reseller marketplace |

### (b) The v1 feature set that keeps exposure low

- Tooling only. White-label breeder storefronts, no Pawdex-branded directory, no
  buyer-facing discovery, no verification badges, ratings, or health guarantees
  authored by Pawdex. Pawdex vouches for nothing.
- Breeder-authored documents only. Host and e-sign the breeder's own contracts.
  Ship no Pawdex-authored contract templates.
- Compliant e-sign rails. A dedicated document-signature record capturing intent,
  attribution (IP/UA/auth/timestamps), a hash of the exact signed document, the
  animal binding, the ESIGN § 7001(c) consumer consent, and a retainable copy
  plus completion certificate delivered to both parties.
- No payments. Deposits and sale money stay off-platform in v1.
- Subdomains before custom domains. Pawdex controls the namespace in v1.
- Processor posture for buyer data. Breeder is the controller; Pawdex is a
  service provider under a DPA; no cross-breeder aggregation for Pawdex's own use.
- Clear platform-not-a-party terms, plus a DMCA designated agent and a
  storefront privacy notice.

### (c) Three clauses the breeder agreement must contain

1. Platform is not a party to the sale. Pawdex provides hosting and software
   tools only. The adoption/sale contract is solely between the breeder and the
   buyer. Pawdex is not the seller, dealer, broker, or agent of either party,
   makes no representation or warranty about any animal, and is not responsible
   for the health, condition, or delivery of any animal or for the performance of
   any contract signed through the platform.
2. Breeder warranties and indemnification. The breeder warrants that it authored
   or has the right to use every document, name, domain, image, and
   representation it publishes; that it is solely responsible for its own legal
   and regulatory compliance (including any USDA/APHIS licensing and any state or
   local pet-sale laws); and the breeder indemnifies and holds Pawdex harmless
   against claims arising from the breeder's animals, sales, contracts, content,
   and compliance.
3. Data processing addendum. For buyer application and onboarding data, the
   breeder is the controller/business and Pawdex is the service provider/processor
   acting only on the breeder's documented instructions, with no secondary use,
   no sale or share, and defined retention and deletion, consistent with Pawdex's
   existing service-provider commitments.

### (d) When a real lawyer becomes non-optional

Outside counsel is required, before shipping, at any of these points:

- Before adding Pawdex-authored contract templates (UPL review, state by state).
- Before adding any Pawdex-branded marketplace, directory, verification badge,
  rating, or health guarantee (this changes the Section 230 and
  distribution-chain analysis and is the single biggest risk multiplier).
- Before touching deposit or sale money in any way other than Stripe Connect
  direct charges with the breeder as merchant of record.
- To draft or review the breeder agreement, the buyer-facing terms, and the DPA
  before the first real contract is signed on the platform.
- Before enabling custom domains (trademark/UDRP takedown process).

The through-line: v1 as a white-label tool that hosts breeder-authored documents,
signs them on compliant rails, touches no money, and vouches for nothing keeps
Pawdex out of every regulated-party definition surveyed here. Each capability
that makes Pawdex look more like the seller, the vouching curator, or the money
handler is where the exposure, and the need for counsel, begins.
