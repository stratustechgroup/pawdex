# Pet passport deep-dive

Synthesis of five internal audits (live verification walk of the travel surfaces, EU rules-engine read, schema capability audit, packet/share read, positioning/billing read) and seven research reports with primary-source quotes (APHIS/VEHCS, EU entry, UK + Japan, Australia + NZ, US re-entry, airlines, competitive). Research retrieved 2026-08-15/16. The verification walk ran against the production build (`next start`, headless Chrome, seeded ZZTEST household, full teardown verified).

---

## 1. Verdict

The architecture is sound. The centerpiece rule is wrong for the only users we have.

The EU engine is a clean, pure, testable checklist function reading household-scoped data, and the readiness page renders seeded records with correct dates. But its highest-friction requirement, the rabies titer BLOCKER telling every owner to ship blood to Kansas State and wait 3 months, does not apply to US-origin pets under the regime the page itself claims to implement. The US is listed in Annex II of Implementing Regulation (EU) 2026/636, and the Commission states: "The test is not required for pet animals (dogs, cats or ferrets) moved into an EU country from a territory or a third country listed in Annex I and Annex II." Every US household that opens `/eu-travel` today is told to do an expensive procedure the EU dropped for them. Details in §3.

Compounding that: the "Ready to travel" badge is unreachable by construction (an unconditional `todo` row forces overall to `partial` forever), the share-link creation flow is broken end to end for the user while silently minting live public tokens, all three document pages overflow at 360px, and dates on the legal-looking documents render one day off under non-UTC server timezones. None of this is launch-quality for a flagship.

**Minimum credible "pet passport" launch scope:**

1. The four internal defects fixed (§2).
2. EU outbound corrected against the 2026 regime: titer removed for US origin, 21-day wait computed, chip-before-rabies actually checked (the schema already supports it), EHC row relabeled (§3).
3. GB moved out of the EU list onto its own verified regime (§4).
4. US re-entry basics (CDC Dog Import Form, 6-month minimum age, microchip) as a checklist row on every outbound trip (§3, "not modeled").
5. Airlines as curated dated links, not encoded rules (§5).
6. Per-rule "last verified" stamps and a re-verification calendar, including the hard EU certificate changeover dates of Sep 30 / Oct 1, 2026 (§6).

Japan is a fast-follow (content + derivation code, no migration). Australia/NZ are deferred: they are the only destinations with genuine schema gaps (§4). Gate A delta for the full scope above: **roughly +13 days** (§9).

---

## 2. What exists and whether it works

Surface status from the live walk (production build, seeded data, 2026-08-15):

- `/pets/[petId]/eu-travel`: **WORKS** (desktop). Reads seeded rabies data correctly for both pets, switches destinations, shows correct action items, lists all 29 destinations with tapeworm markers. **BROKEN at 360px** (+228px overflow).
- `/pets/[petId]/packet`: **PARTIAL.** Renders letterhead, patient grid, deduplicated latest-per-family vaccination table. Every date one day earlier than stored; weight shows "—" while the header on the same page shows 60.8 lb.
- `/pets/[petId]/packet/aphis-7001`: **PARTIAL.** All five worksheet sections render, Sections I-IV prefilled, Section V blank signature lines as designed. Same one-day date shift. **BROKEN at 360px** (+184px).
- Share-panel "Create link": **BROKEN.** See defect 1.
- `/share/[token]` public page: **WORKS** cookie-less (token minted via service client since the UI could not produce one). Correctly dies with household deletion. Carries the same date shift.
- `/pets/[petId]/emergency-card`: **WORKS.** Front/back render including the seeded medication.

Defects, plainly:

1. **Share-link creation is broken end to end for the user.** Every click leaves the button on "Creating…" indefinitely (>10 min observed, 4-5 attempts). The server action succeeds every time: HTTP 200 in ~1.5s, `share_links` + `audit_log` rows inserted. The client `useActionState` never resolves, the one-time URL never renders, and no error is shown. Worse: each retry silently mints another live public token the owner has never seen and can only revoke blind from the links list on a later page load. Zero console errors or hydration failures; suspect Next 16.2.12 action-response handling with `revalidatePath` in `app/(app)/pets/[petId]/packet/share-actions.ts`.
2. **Mobile overflow on all three document pages at 360px**, confirmed broken after the c4a68f3 mobile fix (these pages were never re-measured): eu-travel +228px (DestinationSelector's fixed `1fr 1fr auto` grid), packet +148px (6-column vaccination table with no `overflow-x: auto` wrapper), aphis-7001 +184px (worksheet section grids).
3. **Date display off-by-one on packet, aphis-7001, and /share.** Stored DATE values (rabies expires 2026-08-28, DOB 2022-08-17) render one day earlier because `format(new Date('YYYY-MM-DD'))` parses UTC midnight and formats in server-local time. eu-travel prints the same rows correctly (raw strings), so the pet header and packet letterhead disagree on the same page. Caveat carried honestly: this reproduces only when the server TZ is west of UTC; on UTC production (Vercel) it will not manifest. It is still a code-level inconsistency on legally sensitive fields (rabies administered/expiry, DOB) and gets fixed regardless.
4. **Weight "—" on the documents while the app header shows 60.8 lb.** The documents read `pets.current_weight_kg` (null, nothing populates it) while the header derives from `weight_log`. Documents handed to vets omit a weight the app clearly knows.
5. **Copy:** an already-expired rabies vaccine with no travel date reads "Will be expired at travel" (future tense for a past expiry). Classification and action item are correct.

Engine-level findings from the code read (latent, not user-visible yet):

- **"Ready to travel" is unreachable.** The EHC row is pushed unconditionally with status `todo` (`eu-passport.ts:473-481`), and any `todo` forces overall to `partial`. The success state the page defines can never render.
- The titer row **silently disappears** when no rabies vaccine is on file, and titer event selection is **DB-order nondeterministic** (first keyword match, query has no `.order()`).
- Titer detection **keyword-matches free text** in `medical_events` ("favn", "rabies titer"...) and ignores the structured `lab_values` table entirely, which stores draw date, numeric value, and units (migration 0021).
- The chip-before-rabies row hardcodes "Pawdex doesn't store the chip-implant date," **stale since migration 0023** added `pets.microchip_implanted_on` for exactly this check. The page never selects the column.
- No species gating: a cat (or rabbit) receives dog rules identical to a dog. Dead code (`void minTravel`), inert `asOf` parameter, and `medications.ended_on` / `medical_events.event_type` fetched but never used.
- **Billing:** travel is triply ungated (zero call sites for `hasTravelPackets`, `canEnforce()` returns false, every current user is on `early_access` which includes it) while the pricing page advertises it as a paid Household differentiator struck out on Free. `settings/billing` will tell a post-launch Free user "Not on this plan" while serving the pages normally. The billing test suite asserts insurance and breeder gates but never `hasTravelPackets`. Decision in §7.

---

## 3. Regulatory accuracy audit

The regime citation itself is right: the page claims "post-2026-04-22 EU entry requirements," and the framework did change on 22 April 2026 (Delegated Regulation (EU) 2026/131 and Implementing Regulation (EU) 2026/636: "It shall apply from 22 April 2026."). The problem is that two of the engine's rules contradict the regime it names.

Per-rule verdicts against the retrieved primary sources:

- **Microchip required: CONFIRMED.** "The pet animal (dog, cat or ferret) must be identified by the implantation of a microchip (see technical specifications in Article 70a, point (a), of Commission Delegated Regulation (EU) 2019/2035, as amended)." (food.ec.europa.eu). ISO detail per Finland's food authority: "Microchips must comply with ISO 11784 standard and use HDX or FDX-B technology ... must be readable with a reader according to ISO 11785 standard." The engine's 15-digit regex is a reasonable proxy.
- **Chip before rabies vaccination: rule CONFIRMED, implementation NEEDS-UPDATE.** "The date of administration of the vaccine does not precede the date of identification or reading of the microchip." (food.ec.europa.eu). The engine flags this as a permanent `todo` claiming the implant date is not stored; it has been stored since migration 0023. This is a one-line select change plus a date comparison.
- **Current rabies vaccination: CONFIRMED.** Reg 2026/131 Art 14(b): "they have received a complete primary course of anti-rabies vaccination at least 21 days prior to the date of movement." Latest-by-date selection and expiry check are sound (minor: strict `<` lets a vaccine expiring on the travel day pass).
- **21-day post-vaccination wait: NEEDS-UPDATE.** The rule is real (Art 14(b) above; APHIS agrees: "All pets must wait at least 21 days, or the time designated by the rabies vaccine manufacturer prior to traveling to the port of entry."), but the engine never computes it. It exists only in two advisory strings, so a vaccine administered yesterday with travel tomorrow produces status `ok`. Also not modeled from the same APHIS page: "For all pets vaccinated in the United States, a 'primary' rabies vaccination is only valid for 1 year" even if labeled 3-year.
- **Rabies titer (FAVN) for US-origin pets: WRONG.** The engine renders a BLOCKER ("ship to an EU-approved lab (Kansas State Rabies Lab, Auburn, etc.). Travel must be ≥ 3 months after the draw.") for every pet, and the verification walk confirmed it showing for Luna → France. Under the current regime: "The test is not required for pet animals (dogs, cats or ferrets) moved into an EU country from a territory or a third country listed in Annex I and Annex II," and the US is in Annex II of Reg 2026/636 ("US | United States of America | ..."). The 0.5 IU/ml threshold is confirmed only for when the test does apply (unlisted origins/transits): "equal to or greater than 0,5 IU/ml ... on a sample collected ... at least 30 days after the date of the primary vaccination." Fix: drop the titer requirement for US origin, or gate it behind an origin-country input that does not exist yet.
- **Tapeworm treatment: window CONFIRMED, scope NEEDS-UPDATE.** Reg 2026/131 Art 14(d): "within a period of not more than 120 hours and not less than 24 hours prior to the time of entering that Member State or zone." Two corrections: the destination set is Finland, Ireland, Malta, Norway, and Northern Ireland ("If you are travelling with your dog to Finland, Ireland, Malta, Norway or Northern Ireland ... between 24 and 120 hours (1-5 days) before travel," europa.eu), and it is dogs only; the engine applies it to every species. The engine's GB marker is coincidentally right because GB has its own tapeworm rule (§4), but it applies it under EU logic. Also: the hour math runs on date-only fields, so an hour-precision window can never truly be verified; `medication_administrations.administered_at` (timestamptz) exists for the cases where the dose is logged.
- **Minimum age ~15 weeks: CONFIRMED, with a caveat.** "The pet animal was at least 12 weeks old at the date the vaccine was administered" plus the 21-day wait yields ~15 weeks; Finland's page states pets must be "at least 15 weeks old when entering the EU." The absence of a young-pet derogation for third-country entry is an absence-of-provision finding from the EUR-Lex extraction, not a quoted prohibition; get legal confirmation before hard-blocking on it.
- **"EU Animal Health Certificate (USDA APHIS 7001)": WRONG. These are two different documents, and the label conflates them.** The EU certificate is EU-specific: "The EU has two versions of the pet health certificate: the 'non-commercial' and the 'commercial.' Both health certificate versions require an Accredited Veterinarian to issue ... and then USDA to endorse ... the health certificate" (APHIS, retrieved via direct.aphis.usda.gov). Form 7001 survives only as an unknown-requirements fallback and airline paperwork, and APHIS says outright: "Don't submit the APHIS Form 7001 or other form required per an airline to USDA if it's not required by the destination country." VEHCS is the operative workflow ("APHIS' secure online system for creating, issuing ..., submitting, and endorsing health certificates"), electronic vet issuance is accepted for the EU but "USDA must ink-sign and emboss the health certificate" (no digital endorsement for the EU). The engine label, the worksheet framing, and the eu-travel footer all need rewording. The standalone APHIS 7001 worksheet page can stay as an honest vet-visit prep sheet, but must stop implying it is the EU pathway.
- **Certificate timing: partially CONFIRMED, copy NEEDS-UPDATE.** Confirmed: issued "not more than 10 days prior to the date of entry into the Union" (Reg 2026/131 Art 19(b)) and "The 'non-commercial' health certificate is valid for 30 days after the Accredited Veterinarian issues it" (APHIS). NEEDS-UPDATE: onward intra-EU validity is now "a total period of six months from the date of the documentary and identity checks" (Art 18(1)), not the old 4 months that still circulates in stale text. None of this arithmetic is modeled; the engine's cert row is text-only.
- **Worksheet internal contradiction: WRONG copy.** The aphis-7001 page claims rabies must be "administered at least 30 days before travel (most destinations)" while the EU engine's strings cite the verified 21-day wait. The 21-day figure is the sourced one for the EU; the 30-day claim should be removed or destination-scoped.
- **Imminent staleness (calendar item).** "The new non-commercial health certificates will go into effect on October 1, 2026. The current certificates can be endorsed on or before September 30, 2026. The commercial dogs, cats, and ferrets certificate will go into effect on October 17, 2026." (APHIS). Any copy describing the "current" EU certificate needs scheduled re-verification around those dates. That is six weeks after today.

**Not modeled at all** (the engine is one-way outbound to the EU):

- **US re-entry.** Every dog re-entering the US needs a CDC Dog Import Form: "All importers of dogs must submit a complete and accurate CDC dog import form to CDC via a CDC-approved system prior to the dogs arriving in the United States" (42 CFR 71.51(h)(1)). Minimum age is a trap for puppies taken abroad: "All dogs presented for admission into the United States must be at least six (6) months old at the time of their arrival" (71.51(f)(1)). Microchip "must have been implanted on or before the date the current rabies vaccine was administered" (71.51(g)(2)). From low-risk countries (all EU, UK, Japan) the form receipt is the only document: "the only required documentation for dogs entering or returning to the United States that have been only in dog rabies-free or low-risk countries in the past 6 months is the CDC Dog Import Form," valid "for 6 months from when it's issued" for the same departure country, any port of entry. Trap worth encoding: Spain's Ceuta and Melilla ARE on the high-risk list per its Apr 15, 2026 version. Cats: "Cats are not required to have proof of rabies vaccination for importation into the United States." A US re-entry checklist row is cheap, high-value, and belongs in the launch scope.
- **Booster-chain continuity.** Only the latest rabies vaccine is considered, so a pet with a valid old titer that gets a routine booster earns a false BLOCKER (draw date lands under 30 days after the newest vaccine). Matters mainly for the unlisted-origin titer path if kept.
- **Titer numeric validation.** No field holds the result; ">= 0.5 IU/ml" is advisory text only, while `lab_values` sits unused.
- **Endorsement cost and turnaround.** Current fees, effective January 10, 2025 (first adjustment since 2012): "$101 per certificate" with 0 tests, "$160" with 1-2 tests, "$206" with 3-6, "$275" with 7+, plus per-additional-pet add-ons; "Vaccines are not considered tests." The pre-2025 figures ($38/$121/$150) that the competitive research surfaced are obsolete. No processing-time SLA exists on any official page; APHIS says only "Give adequate time and proper planning." Never publish a turnaround number.
- Sedation/crate/IATA rules, carrier embargoes, the EU 5-pet non-commercial limit, and species gating, as noted above.

---

## 4. Destination expansion analysis

Structural blocker first: `CountryCode` is a closed union type, there is no rule data structure, and the EU AHC/titer/15-week logic applies to every destination unconditionally. No destination can be "added as data" until the engine is refactored into per-destination rule modules. That refactor is a prerequisite for everything below and is priced in §9.

**United Kingdom: content + small code. Currently mislabeled.** GB sits inside `EU_DESTINATIONS` and is processed under EU post-2026 logic with EU-AHC wording. The real regime (gov.uk, all quote-verified): microchip first ("They must be microchipped before they get their rabies vaccination"), vaccinate at 12+ weeks ("Your vet needs proof that your pet's at least 12 weeks old before vaccinating them") and "wait at least 21 full days after the first rabies vaccination"; dogs need praziquantel "no less than 24 hours ... no more than 5 days (120 hours) before you enter Great Britain"; the document from the US is the **Great Britain pet health certificate** ("USA ... | Great Britain pet health certificate"), signed by an official veterinarian, and "Your pet must enter Great Britain within 10 days of the pet health certificate being issued"; **no titer from the US** (the blood test applies only to unlisted countries, and the USA is listed); entry only via approved routes, "Pets have to travel as cargo on a plane unless: you're flying on a chartered private plane or you're travelling with a guide or assistance dog." Schema: everything EXISTS or is DERIVABLE. Note the task's working term "GB AHC" is not the official name; an AHC is the EU document.

**Japan: content + derivation code on the existing schema. No migration strictly required.** MAFF (quote-verified): microchip (ISO 11784/11785) before the first vaccination; first rabies vaccination "At least 91days old at the time of vaccination"; second "30 days or more apart from the first vaccination ... Within the effective period of the first vaccination"; FAVN at a MAFF-designated lab, "equal to or greater than 0.5 IU/ml," result valid 2 years; arrival "after 180 days have passed from the date of blood sampling" or the shortfall is served in detention; advance notification "not less than 40 days before arrival"; Form AC endorsed by the official government vet; clinical inspection "within 10 days before boarding"; failures mean quarantine "up to 180 days." Schema: the two-vaccination chain is DERIVABLE from `vaccinations` rows ordered by `vaccine_family`/`administered_on` (one ambiguity: `expires_on` is nullable, so "within the effective period" needs a policy for null expiries); titer draw date and numeric value EXIST in `lab_values` (`collected_on`, `value`, `units`), which the engine must start reading instead of keyword-matching; the 40-day notification is trip-level date arithmetic that can ride the existing URL-param design. Fast-follow, not launch.

**Australia / New Zealand: schema + content. Defer.** These are the only destinations with genuine schema gaps, both identified by the capability audit:

1. **Import permits have no home** anywhere in migrations 0001-0038: no table, no `document_type` enum value, no issue/expiry columns on `documents`. Both countries require one. AU: "Most permits are issued in 20-40 business days. It can take up to 123 business days in some cases," fees "First cat or dog in a consignment $130.00 $473.00 $603.00" AUD. NZ: "we will be extending our permit processing time from 20 to 30 working days," fee "$233.25* $268.24*" NZD.
2. **Qualitative serology does not fit** `lab_values.value numeric NOT NULL`. NZ's dog panel is largely negative/positive: "an IFA or ELISA test for Babesia gibsoni with a negative result in the 16 days prior ... a rapid slide agglutination test (RSAT) with a negative result ... a heartworm antigen ELISA test with a negative result in the 30 days prior."

The timelines are also a different product shape: AU requires an RNATT "between 12 months and 180 days before the date of export" with "no exceptions to this mandatory 180-day waiting period" and "at least 30 days at the Mickleham post entry quarantine facility" (reducible to 10 only with pre-RNATT identity verification); DAFF says "Allow at least 6 months." NZ requires residency "for at least the six months (or since birth) immediately preceding the date of shipment," an RNATT "not less than three months and not more than 24 months prior to the date of shipment, with a result of at least 0.5 IU/ml," and quarantine "for a minimum of 10 days." Also worth noting when this ships: neither country currently requires an Ehrlichia canis test, contrary to circulating third-party content, and dogs from the USA must be vaccinated against canine influenza for AU ("Dogs from the United States of America (USA), the Republic of South Korea must be fully vaccinated against Canine influenza (CIV)"). All AU/NZ rules were verified against Wayback captures of the official pages because both live sites block non-browser clients; re-verify live before shipping, especially fees (both fee years roll July 1).

---

## 5. Airline rules

What the research established: airline pet policies are high-churn and mostly undated. No consumer-facing page checked displays a visible last-updated date, yet Alaska's embedded CMS shows `"updated_at":"2026-08-13T19:55:36.679Z"` (three days before retrieval) and a live dated embargo ("From Friday, July 31, 2026, through Wednesday, September 30, 2026, we can't accept French Bulldogs or English Bulldogs for transport in the cargo hold"); AA runs a recurring seasonal station embargo ("Pets not traveling in cabin cannot travel to / through / from Phoenix (PHX), Tucson (TUS), Las Vegas (LAS) or Palm Springs (PSP) May 1 - September 30"); Delta's fee is keyed to ticket-issue date ("$95 USD/CAD for tickets issued before April 8, 2025 ... $150 USD/CAD for tickets issued on/after April 8, 2025"). Two of six carriers sit behind bot walls: **United is entirely UNVERIFIED** (SPA shell, no policy text obtainable) and **Lufthansa is UNVERIFIED-current** (live pages 403; quotes are from Wayback snapshots of the official pages).

Structural facts that are stable enough to state, each quote-verified: Southwest carries no pets in cargo at all ("No pets are transported in the cargo compartment"); AA and Delta restrict checked/cargo pets to military/State Department personnel ("We only accept checked pets at the ticket counter for active-duty U.S. Military and U.S. State Department Foreign Service personnel"; "Until further notice, we are only allowing the shipment of pets for active U.S. Military or U.S. State Department Foreign Service Offices (FSO)"); Alaska still sells baggage-compartment carriage to the public ("a fee of $200 each way per kennel").

**Recommendation: hybrid, weighted heavily toward curated links at launch.**

- **Encode nothing for United** until manually verified from united.com. Do not substitute memory.
- **Launch scope: a curated per-airline link card** (official policy URL + retrieval-dated two-line summary of the structural facts above + "verify with the airline"). This is a half-day of content and cannot go stale in a damaging way.
- **Post-launch, if airline data earns a deeper slot:** encode hard numbers as versioned rules carrying `source_url` + `retrieved_at`, re-verified on a 30-60 day cadence; model temperature/seasonal/breed embargoes as rules with explicit start/expiry dates; keep genuine "contact airline" items as links (AA per-aircraft under-seat dimensions, Lufthansa route-priced fees, Alaska temperature advisories, Southwest carrier dimensions, which are unpublished). Key regional-carrier trap to preserve: Delta Connection's "Live animals are prohibited on all flights operating outside of the U.S. except Canada" applies to the operating carrier, not the marketing carrier.

---

## 6. Liability and freshness

Current posture is decent: the eu-travel footer says the page "is not a substitute for a USDA-accredited vet's sign-off," the packet footer says Pawdex "does not verify the authenticity of records," and the worksheet header/footer disclaim legal status twice. Keep all of it. Two fixes: the footer's "EU Animal Health Certificate" sentence inherits the §3 relabel, and disclaimers do not excuse encoding a wrong rule; the titer defect is exactly the failure mode a disclaimer will not cover reputationally.

**Concrete mechanism: rules as data with provenance.** Every requirement the engine renders becomes a record shaped like:

```
{ rule_id, jurisdiction, requirement, source_url, source_quote, retrieved_at, verify_by, status }
```

- The UI renders a per-requirement "Last verified <date> against <source domain>" stamp. This is a trust feature, not just hygiene; no competitor surfaced in the research does it.
- **Cadence:** government sources every 60-90 days; airline pages (if ever encoded) every 30-60 days; the CDC high-risk country list on its own faster check since it is the most change-prone page in the US re-entry set.
- **Hard calendar items now:** re-verify EU certificate content on **Sep 30 / Oct 1, 2026** (non-commercial changeover; "The current certificates can be endorsed on or before September 30, 2026") and **Oct 16/17, 2026** (commercial). APHIS states the new certificate formats were not yet published at retrieval time, so this cannot be pre-written.
- Never publish an endorsement turnaround number (no official SLA exists) and never revive the obsolete pre-2025 fee figures.
- A small public "rules changelog" page when a verification changes an answer converts the maintenance burden into visible credibility.

---

## 7. Pricing contradiction

The state today: `travelPackets` is excluded from Free and included in Household ($6/mo) and Breeder in `plans.ts`, the pricing page advertises it that way, and none of it is enforced anywhere (`hasTravelPackets` has zero call sites, `canEnforce()` returns false, all current users are on `early_access`). Meanwhile commit d5c5351 made travel the homepage wedge with no plan annotation, and the strip bundles paid-definition surfaces (readiness, worksheet) with Free-core surfaces (share link, emergency card). The FAQ has staked out "no dark patterns" and grandfathers early-access users a discount, not features.

Options, with tradeoffs:

- **A. Free readiness checker, paid packet generation.** The eu-travel readiness view is free on all tiers as the acquisition hook; the packet, worksheet prefill, and (later) hard-destination flows are Household. Converts at the moment of highest willingness to pay; keeps the Household feature list honest; matches the wedge (the checker is the anxiety-killer the viral post described). Costs: split the single `travelPackets` flag into two entitlements, redraw the Free card row, wire the gate before enforcement flips, and accept that a mid-deadline paywall on packet export will annoy some users.
- **B. Travel fully free at launch, decide later.** Matches today's effective behavior exactly, zero wiring. But Household then rests on capacity + insurance alone, and clawing back a launch-free flagship later is precisely the move the "no dark patterns" copy brands against.
- **C. Keep gated as designed, wire the upsell first.** Preserves pricing integrity, but kills the wedge: a hard-deadline visitor will not start a subscription for one trip, and the travel strip would be advertising a paid feature to every Free user with no annotation.
- **C-variant worth pricing: per-trip one-time purchase.** Travel is episodic; subscriptions are not. A per-trip packet fee sidesteps the "subscribe for one trip" objection but adds payment-flow work that does not exist yet.

**Recommended: A**, with the per-trip variant held as a pricing experiment after launch. It is the only option consistent simultaneously with the wedge strategy, the published FAQ posture, and an honest Household tier. Whichever way this goes, three items are mandatory before payments go live: draw the entitlement boundary across the four travel surfaces (which of them IS `travelPackets`), fix the `settings/billing` "Not on this plan" label-vs-reality contradiction, and add the missing `hasTravelPackets` assertions to the billing test suite. **This is the founder's decision; the audit only prices the tradeoffs.**

---

## 8. Competitive position

"Your real records checked against real rules" is no longer an empty category: PadsPass does exactly that on the owner side ("analyze[s] 140+ data points across your trip, your pet, and your destination," "upload a PDF or snap a photo of your vet records") at "$99.99/year," and GlobalVetLink and Passpaw do it through the veterinarian channel; PadsPass was named Pet Start Up of the Year in the 2026 Pet Innovation Awards. What survives as Pawdex's edge: the records are already resident from everyday use rather than uploaded at trip time; destination breadth is winnable fast (PadsPass certificate generation is "Bermuda and Puerto Rico live, more coming soon"); price and channel (travel included in a $6/mo household record system vs. a $99.99/yr travel-only product); and owner-initiated early warning months before a trip, which vet-channel tools only start once the vet engages. Positioning: "the record system you already use can also clear you for travel," never "nobody checks records against rules," because that claim is now false.

---

## 9. Pre-launch plan

> **Status (2026-08-16): Phases 0–3 SHIPPED** (commits 446d2cd, 28c13b5,
> b453432 + the Phase 3 commit). All defects in §2 fixed and re-verified, the
> §3 corrections encoded with a 57-assertion suite, GB + US re-entry live,
> provenance stamps and the airline card rendering, pricing wired per §7
> option A (checker free on every plan; documents remain the Household gate;
> enforcement still off). Remaining from this plan: Japan (fast-follow),
> AU/NZ + trips persistence + QR card (deliberately cut), and the §6
> re-verification calendar — first hard date 2026-09-30.

Estimates are working days for one person. Phases 0-3 are the launch scope; the Gate A delta is their sum.

**Phase 0: fix what's broken (~3 days). Non-negotiable before any travel marketing.**

- Share-link client resolution (debug the `useActionState` + `revalidatePath` interaction; add an error state so failure is never silent) and revoke the blind-minted tokens from the walk's retries: 1 day.
- Mobile overflow on eu-travel, packet, aphis-7001 (grid fixes + `overflow-x: auto` table wrappers, then re-measure at 360px per the mobile-audit method): 1 day.
- Date rendering: format stored DATE strings without a UTC round-trip everywhere the packet family renders them: 0.5 day.
- Weight: derive from `weight_log` like the header does (or populate `current_weight_kg` on insert): 0.5 day. Tense copy fix rides along.

**Phase 1: make the EU engine true (~3.5 days).**

- Remove the titer BLOCKER for US origin (drop it, or gate behind an explicit origin input; default origin US): 1 day including tests.
- Compute the 21-day post-vaccination wait as date arithmetic, not advisory text: 0.5 day.
- Select `microchip_implanted_on` and turn chip-before-rabies into a real check with the stale copy removed: 0.5 day.
- Species-gate the rules (tapeworm dogs-only; rabies logic dogs/cats/ferrets): 0.5 day.
- Copy pass: EHC row relabel per §3, worksheet 30-day claim, cert-window wording, eu-travel footer: 1 day.

**Phase 2: minimum credible destination scope (~5 days).**

- Refactor to per-destination rule modules (open the closed union, stop applying EU logic unconditionally): 2 days.
- GB on its own regime (rules in §4; remove GB from the EU list; correct document naming): 1.5 days.
- US re-entry checklist row on every outbound destination (CDC form, 6-month age trap, microchip, high-risk-itinerary caveat): 1.5 days.

**Phase 3: freshness, airlines, pricing wiring (~2.5 days).**

- Rules-as-data manifest with `source_url` / `source_quote` / `retrieved_at` / `verify_by`, per-row "Last verified" stamps, and the two EU changeover calendar entries: 1.5 days.
- Airline curated-links card (structural facts + dated links, per §5): 0.5 day.
- Pricing decision wiring per §7 (entitlement split or plan-copy change, billing-page label fix, `hasTravelPackets` test assertions): 0.5 day (option A wiring grows to ~1 day when enforcement actually flips).

**Gate A delta: +13 days to launch (range 11-16).**

**Deliberately CUT from launch:**

- **Australia/NZ** (the only destinations needing migrations: permits table, qualitative serology).
- **Japan** (fast-follow: content + derivation code once the Phase 2 refactor lands).
- **Encoded airline rule tables** (curated links only; United stays unencoded until manually verified).
- **PDF generation** (HTML + print CSS is fine; "Save as PDF" is the browser's dialog and says so).
- **Trips persistence** (URL params hold for launch; a trips table only pays off with permit linkage, which is cut with AU/NZ).
- **QR/wallet pet card: OUT.** It depends on the share-link flow that is broken today plus a `share_scope` enum migration and renderer branching; the printable emergency card already covers the launch-scope need.

---

## 10. Sources

All retrievals 2026-08-15/16 (several sessions rolled past midnight; per-source dates below are the actual fetch dates recorded by the research).

**USDA APHIS / VEHCS** (live pages hang non-browser clients at the www CDN; retrieved 2026-08-16 from direct.aphis.usda.gov, the same official origin, canonical-tag verified):

- https://www.aphis.usda.gov/pet-travel/vehcs (Last Modified June 09, 2026)
- https://www.aphis.usda.gov/live-animal-export/vehcs-countries (Last Modified January 13, 2026; digital-endorsement country list is JS-rendered and was not capturable)
- https://www.aphis.usda.gov/pet-travel/us-to-another-country-export/pet-travel-us-germany (Last Modified May 15, 2026; EU-template country page)
- https://www.aphis.usda.gov/pet-travel/us-to-another-country-export/unknown-requirements (Last Modified July 29, 2026)
- https://www.aphis.usda.gov/pet-travel/accredited-veterinarians (Last Modified April 01, 2026)
- https://www.aphis.usda.gov/pet-travel/us-to-foreign-country/cost-to-endorse (Last Modified June 18, 2026)
- https://www.aphis.usda.gov/pet-travel/us-to-another-country-export/pet-travel-process-overview (Last Modified June 18, 2026)
- https://www.aphis.usda.gov/news/agency-announcements/aphis-announces-updated-veterinary-services-user-fees (announcement January 8, 2025)

**EU entry** (retrieved 2026-08-15/16, direct fetches):

- https://eur-lex.europa.eu/eli/reg_del/2026/131/oj/eng (Reg (EU) 2026/131, applies from 22 April 2026)
- https://eur-lex.europa.eu/eli/reg_impl/2026/636/oj/eng (Reg (EU) 2026/636 country lists; US in Annex II)
- https://food.ec.europa.eu/animals/movement-pets/eu-legislation/non-commercial-movement-non-eu-countries_en
- https://europa.eu/youreurope/citizens/travel/carry/pets-and-other-animals/index_en.htm (last updated 15/06/2026)
- https://www.ruokavirasto.fi/en/themes/import-and-export/import/animals-and-animal-products/animals-and-gametes/dogs-cats-and-ferrets/non-commercial-movement/ (last updated 4/21/2026)
- https://www.gov.ie/en/publication/21d40-pet-travel/ (HTTP 403 to direct fetch; search-surfaced only; praziquantel active-ingredient wording UNVERIFIED by direct fetch for Ireland)

**UK + Japan** (retrieved 2026-08-15/16, direct fetches; no last-updated dates shown on fetched pages):

- https://www.gov.uk/bring-pet-to-great-britain (plus subpages: rabies-vaccination-and-boosters, tapeworm-treatment-dogs, travel-routes-pets, great-britain-pet-health-certificate, which-pet-travel-document)
- https://www.maff.go.jp/aqs/english/animal/dog/import-other.html
- https://www.maff.go.jp/aqs/animal/dog/lab.html (designated-laboratory list, link-out target, not enumerated)

**Australia + New Zealand** (live sites blocked non-browser clients; verified against Wayback captures of official pages, retrieved 2026-08-15/16; re-verify live before publishing numbers, fees especially):

- https://www.agriculture.gov.au/biosecurity-trade/cats-dogs/how-to-import/step-by-step-guides/category-3-step-by-step-guide-for-dogs (page dated 20 Feb 2026; capture 2026-04-13; cats guide capture 2026-05-17)
- https://www.agriculture.gov.au/biosecurity-trade/cats-dogs/how-to-import/permit (page dated 19 Aug 2025; capture 2026-03-13)
- https://www.agriculture.gov.au/biosecurity-trade/cats-dogs/quarantine-facilities-and-fees/fees (page dated 02 Jan 2026; capture 2026-03-10)
- https://www.mpi.govt.nz/bring-send-to-nz/pets-travelling-to-nz/bringing-cats-and-dogs-to-nz/step-by-step-guide-to-bringing-cats-and-dogs-to-nz (capture 2025-11-15)
- https://www.mpi.govt.nz/dmsdocument/1574-cats-and-dogs-import-health-standard (IHS in force 7 April 2021; capture 2025-04-24)
- https://www.mpi.govt.nz/dmsdocument/1575-cats-and-dogs-import-health-standard-guidance-document (17 Oct 2022; capture 2026-02-26)
- https://www.mpi.govt.nz/bring-send-to-nz/pets-travelling-to-nz/fees-and-charges-when-bringing-pets-to-nz/ (capture 2025-01-14)

**US re-entry** (cdc.gov returned 403 to all direct fetches; CDC text from Wayback captures of official pages, captures Jan-Jul 2026; regulation from the official eCFR API):

- https://www.ecfr.gov/current/title-42/chapter-I/subchapter-F/part-71/subpart-D/section-71.51 (current as of 2026-08-13)
- https://www.federalregister.gov/documents/2024/05/13/2024-09676/control-of-communicable-diseases-foreign-quarantine-importation-of-dogs-and-cats (effective 2024-08-01)
- https://www.cdc.gov/importation/dogs/rabies-free-low-risk-countries.html (page dated Jul 22, 2024; capture 2026-04-23)
- https://www.cdc.gov/importation/dogs/high-risk-countries.html (page dated Apr 15, 2026; capture 2026-05-16; most change-prone page in this set)
- https://www.cdc.gov/importation/dogs/us-vaccinated-high-risk-countries.html (page dated Jul 31, 2025; capture 2026-01-02)
- https://www.cdc.gov/importation/dogs/foreign-vaccinated-high-risk-countries.html (page dated Jul 22, 2024; capture 2026-01-08)
- https://www.cdc.gov/importation/dogs/dog-import-form-instructions.html (page dated Apr 28, 2026; capture 2026-07-27)
- https://www.cdc.gov/importation/bringing-an-animal-into-the-us/index.html (page dated Aug 22, 2025; capture 2026-04-30)

**Airlines** (retrieved 2026-08-15/16; no visible last-updated dates on any consumer page):

- https://www.aa.com/i18n/travel-info/special-assistance/pets.html (direct fetch)
- https://www.delta.com/us/en/pet-travel/overview, /shipping-your-pet, /international-connection-pet-travel (direct fetches)
- https://www.alaskaair.com/content/travel-info/policies/pets-traveling-with-pets/pets-in-cabin, /pets-in-baggage-compartment, and /pets-traveling-international (direct fetches; embedded CMS updated_at 2026-08-13 and 2026-08-03)
- https://support.southwest.com/helpcenter/s/article/pet-policy (+ destination/airport/onboard articles) and https://www.southwest.com/html/customer-service/travel-fees.html (direct fetches)
- https://www.lufthansa.com/us/en/travelling-with-animals (UNVERIFIED-current; Wayback snapshot 2026-07-29; cabin/hold detail snapshots 2025-09-16 and 2025-09-11)
- https://www.united.com/en/us/fly/travel/traveling-with-pets.html (UNVERIFIED; SPA shell only, no policy text obtainable)

**Competitive** (retrieved 2026-08-16):

- https://www.padspass.com and https://www.padspass.com/pricing (direct fetches)
- https://travelreadypets.com/pet-travel-compliance/ (no pricing published)
- https://passpaw.com/ (direct fetch)
- https://www.globalvetlink.com/compliance-assistant/ and /myvetlink (search snippets; not fetched directly)
- https://www.petrelocation.com/thirdpartycosts, https://citizenshipper.com/pet-transportation, https://www.starwoodpet.com/international-pet-relocation-costs, https://www.pettravel.com/, https://www.11pets.com/en/feature
- https://www.manilatimes.net/2026/08/06/tmt-newswire/globenewswire/padspass-awarded-pet-start-up-of-the-year-in-2026-pet-innovation-awards-program/2400245 (award announcement 2026-08-06)