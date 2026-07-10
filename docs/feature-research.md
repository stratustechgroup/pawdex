# Feature research: what to copy, what to refuse

Scope: this surveys consumer pet-health apps, breeder software, genetics/registries, pet research-data programs, and vet interoperability, then maps findings onto Pawdex's actual differentiator. That differentiator is not "another pet app." It is a verified health record that is born with the animal and travels with it through a custodianship transfer, accruing structured data the whole way, until a consented aggregate becomes sellable.

The spine of the product (the flywheel) is:

breeder creates litter, each puppy accrues a verified record from birth (vaccines, weights, deworming, microchip, genetics), at adoption the record transfers to the adopter through a signup link, the adopter inherits a complete history and keeps adding to it, and the consented aggregate becomes a research asset.

Everything below is ranked by how much it strengthens a link in that chain. Features that every competitor ships but that do not feed the chain (generic reminders, activity trackers, in-app telehealth) rank low or land in the anti-features list, no matter how common they are.

## (a) Ranked shortlist of features worth adding

### 1. Verified record provenance and citations that survive transfer (S, already core)
What it is: every extracted field keeps a link to the source document and page, plus who reviewed it, and that provenance rides along when custody changes hands. Pawdex already renders v6.1 source citations in review; the addition is making provenance a first-class attribute of the record object so it is intact on the adopter's side after transfer.
Who does it well: nobody fully. PadsPass does AI extraction with "team validation," and human-side clinical apps expose source docs, but breeder-to-buyer handoff today is a text message or a paper sheet with product stickers ([golden retriever forum](https://www.goldenretrieverforum.com/threads/puppys-medical-records-from-breeder.516812/), [American Breeder](https://www.americanbreeder.com/resources/american-breeder-blog/dogs/verify-dog-health-certificates)).
Why it fits: this is the ingestion pipeline's output. Nothing new to build ingestion-wise.
Compounds the flywheel: it is the trust primitive for the whole chain. California's AG names missing and falsified health records as the top puppy-market red flag ([CA DOJ](https://oag.ca.gov/news/press-releases/puppy-buyers-beware-attorney-general-bonta-issues-consumer-alert-cruel-puppy)). A record whose every claim points at a dated source document is exactly what a nervous adopter and a research buyer both want. Provenance is also what makes the aggregate saleable later, because de-identified data with traceable origin commands a premium (see section c).

### 2. Breeder litter ledger with per-puppy records from birth (M)
What it is: a litter object with N puppy sub-records, each accruing weights, deworming dates, first vaccines, microchip number, and photos before any buyer exists. This is task #1 and #5 territory.
Who does it well: BreederCloudPro, Breedera, BreederHQ, and BreederBuddy all ship litter management that tracks puppies birth-to-go-home with weights, medical history, and photos ([BreederCloudPro](https://breedercloudpro.com/blog/dog-breeding-software-guide), [BreederHQ](https://breederhq.com/compare/best-dog-breeding-software)).
Why it fits: the litter is the origin node of the flywheel. Records that "travel with the animal" have to start somewhere, and the breeder is the first custodian.
Compounds the flywheel: this is the top of the funnel. Every puppy that starts life as a Pawdex record is a future adopter account pre-populated with verified history. It is the single highest-leverage acquisition mechanism the product has, because the breeder does the data entry and the adopter inherits the value.

### 3. Transfer-at-adoption handoff (signup link that moves the record) (M)
What it is: at go-home, the breeder generates a link, the adopter signs up, and custody of that puppy's complete record transfers to them. The breeder retains a copy or reference for their own records; the adopter becomes the primary custodian.
Who does it well: breeder platforms have "Pet Portals" where buyers see medical records, contracts, and weight charts ([BreederCloudPro](https://breedercloudpro.com/blog/dog-breeding-software-guide)). But those portals are read-only windows into the breeder's account. They do not hand the record to the buyer as their own asset that keeps growing.
Why it fits: this is the literal meaning of "records that travel with the animal." It is the thing no competitor actually does.
Compounds the flywheel: the transfer is the conversion event. It turns a breeder's data-entry labor into an owned adopter account, and it is where the network grows one custodian at a time. It also cleanly seeds the consent chain: the adopter can be asked at signup whether to keep the record enrolled in anonymized research.

### 4. Microchip and permanent-ID registration as a record anchor (S)
What it is: capture microchip number as a structured field, link the record to it, and support the ID as the lookup key across a transfer.
Who does it well: Vet Envoy connects PIMS to microchip registries as one of its hub endpoints ([Puppilot](https://www.puppilot.co/blog/veterinary-data-interoperability-the-complete-guide-to-connecting-pims-labs-insurers)); breeder tools capture chip numbers in puppy records.
Why it fits: microchip is the closest thing to a durable primary key for an animal across owners, clinics, and countries.
Compounds the flywheel: it makes the "same animal, new custodian" claim verifiable, reduces duplicate-animal problems in the aggregate dataset, and is a natural de-identification anchor (hash the chip, keep the longitudinal thread without exposing identity).

### 5. Genetic and parentage data carried on the record (M)
What it is: store genetic test results (breed, COI, health-risk panel) and sire/dam links so parentage travels with the puppy. Ingest Embark/Wisdom-style PDFs through the existing pipeline.
Who does it well: Embark's Pair Predictor gives breeders COI and 270+ health-risk screening per planned litter ([Embark](https://embarkvet.com/breeders/tools-and-services/)). That data currently lives in Embark's account, not the dog's portable record.
Why it fits: genetics is high-value structured data that a document pipeline can extract, and parentage is the backbone of the litter/breeder model.
Compounds the flywheel: parentage links turn a flat record set into a pedigree graph, which is both a breeder-retention feature and a far more valuable research asset (heritability, breed-specific disease longitudinal studies are exactly what the Dog Aging Project and Mars Biobank are built to study, see section c).

### 6. Vaccine and deworming timeline with due-date logic (S)
What it is: a normalized vaccine/deworming schedule derived from extracted records, showing what is done, what is due, and what is overdue, keyed to the animal's DOB and species.
Who does it well: nearly everyone ships reminders (11pets, PetDesk, VitusVet), which is precisely why reminders alone are not a differentiator.
Why it fits: Pawdex already unifies the vaccine family in ingestion (task #2). The timeline is a thin presentation layer on data it already has.
Compounds the flywheel: it earns the daily-use habit that keeps a record alive between vet visits, and the structured vaccine series is one of the cleanest, most comparable fields in the future aggregate. Ranked below the transfer features because reminders are table stakes, not a wedge.

### 7. Travel and compliance packet generator (M)
What it is: given a destination and the animal's records, assemble the required documents (rabies proof, health certificate, import timelines) and flag gaps.
Who does it well: PadsPass pulls every requirement for a route (health certificates, import permits, vaccination timelines) from an AI-extracted record; the US-JP Pet Passport app does route-specific scanning ([PadsPass](https://www.padspass.com/), [App Store](https://apps.apple.com/us/app/pet-passport-us-jp-travel/id6762554040)).
Why it fits: this is a pure downstream consumer of the structured record. If the extraction is good, the packet is close to free.
Compounds the flywheel: it is a concrete, high-willingness-to-pay reason an owner keeps their record complete and current, which improves the data that flows into the aggregate. Ranks mid because it serves the individual owner more than the transfer chain.

### 8. Insurance claim and pre-existing-condition packet (M)
What it is: from the structured record, generate an itemized claim-ready summary, and let owners see what in their history could be flagged pre-existing.
Who does it well: MGA-side tools (Unstract, Insurnest vendors) do vet-invoice OCR to cut claim processing from 7-14 days to 24-72 hours ([Insurnest](https://insurnest.com/blog/ai-in-pet-insurance-for-claims-vendors/)). Trupanion runs AI pre-existing-condition scans against vet notes, which owners experience as denials ([Patify](https://patifyapp.com/en/content/detail/pet-insurance-pre-existing-condition-ai-scan-trupanion-2026-vet-notes-denial-guide)).
Why it fits: Pawdex sits on the owner's side of the same extraction problem the insurers automate against them.
Compounds the flywheel: owner-side claim tooling is a retention and trust feature, and a complete longitudinal record is worth more to the owner in disputes, which motivates completeness. See the insurance-strategy.md doc already in this repo for the deeper play.

### 9. Document Q&A over the animal's own record (S, already core)
What it is: ask questions of the full record ("when was the last bordetella," "what was the weight trend last year") answered with citations.
Who does it well: this is a genuine AI-native advantage; legacy pet apps have nothing comparable. Pet Capsule does OCR-searchable docs but not grounded Q&A ([Pet Capsule](https://petcapsule.app/)).
Why it fits: it is already a Pawdex surface.
Compounds the flywheel: it is the feature that makes a deep, complete record feel worth building, which motivates owners and breeders to keep feeding it. Ranked here rather than higher because it is a value-amplifier on the record, not a link in the transfer chain.

### 10. Multi-custodian household access (M)
What it is: multiple people (spouses, a pet sitter, a co-owner) share access to one animal's record with roles, and the owner controls invites.
Who does it well: breeder Pet Portals do buyer access; general apps are weak here. This is task #4.
Why it fits: real animals have multiple caretakers, and this is a prerequisite for the transfer model to feel natural (transfer is just custody handoff taken to its limit).
Compounds the flywheel: it exercises the same custodianship primitive that transfer relies on, and shared households mean more people invested in keeping the record current. Owner-only invite enforcement is the security boundary that keeps this from becoming a data-leak.

### 11. Consent and research-enrollment controls on the record (M)
What it is: per-animal, per-custodian opt-in to anonymized research use, revocable, with a clear statement of what is shared (de-identified aggregate) versus never shared (identity, contact info).
Who does it well: the model to copy is Mars Pet Insight and the Biobank: personal information is never shared, de-identified aggregate is used for research, participation is opt-in ([Mars](https://www.mars.com/news-and-stories/press-releases/mars-pet-insight-project)). PIMS-side access already runs on a revocable practice-consent basis via middleware ([markets search](https://www.marketsandmarkets.com/ResearchInsight/veterinary-software-market.asp)).
Why it fits: this is task #1's research-consent schema. Getting the consent object right now is far cheaper than retrofitting it.
Compounds the flywheel: consent is the valve between the record and the revenue. Without a clean, revocable, per-animal opt-in captured at natural moments (adoption signup, onboarding), the aggregate is not sellable. This is the last link in the chain and the one that monetizes all the others.

### 12. Vet-record import via forwarding and (later) PIMS hooks (S now, L later)
What it is: keep the email-forward and upload ingestion as the primary intake, and treat direct PIMS integration as a later, selective add for the highest-volume clinics.
Who does it well: aggregators like VetData/Covetrus and Vet Envoy pull from many PIMS and fan out to partners; modern cloud PIMS (ezyVet, Provet Cloud, Vetspire) expose APIs, but there is no universal standard, no HL7/FHIR equivalent ([Puppilot](https://www.puppilot.co/blog/veterinary-data-interoperability-the-complete-guide-to-connecting-pims-labs-insurers), [Today's Veterinary Business](https://todaysveterinarybusiness.com/why-veterinary-software-should-embrace-open-apis/)).
Why it fits: forward-and-extract is Pawdex's whole thesis and it sidesteps the integration swamp. IDEXX plus Covetrus control roughly 79% of North American PIMS installs, and their APIs are "closed, undocumented, or fee-gated" ([markets search](https://www.marketsandmarkets.com/ResearchInsight/veterinary-software-market.asp), [Puppilot](https://www.puppilot.co/blog/veterinary-data-interoperability-the-complete-guide-to-connecting-pims-labs-insurers)).
Compounds the flywheel: staying document-first keeps intake working across every clinic on day one instead of gating growth on integration deals. Rank the PIMS work as L and do it only where a clinic partner drives real volume. Do not let it become the roadmap.

### 13. Contracts and e-signature at adoption (M)
What it is: attach the sale/health contract to the transfer, e-signed, and store the signed copy on both custodians' sides.
Who does it well: BreederCloudPro, BreederBuddy, and peers ship custom contract builders with e-sign and deposit collection ([BreederCloudPro](https://breedercloudpro.com/blog/dog-breeding-software-guide)).
Why it fits: the contract is a document, and documents are what Pawdex handles. It naturally attaches to the transfer event.
Compounds the flywheel: it makes the transfer moment the complete handoff (record plus legal), which is a reason for breeders to run the go-home through Pawdex rather than a separate tool. Kept below the core transfer mechanics because it is a breeder-retention nicety, not the wedge itself.

## (b) Anti-features to refuse

### 1. Forced-subscription paywalls that lock users out of their own data
Evidence: 11pets moved to a subscription model that "blocked access to previously entered data," a paid "lifetime subscription" that failed to migrate information, and users calling it unusable ([Google Play](https://play.google.com/store/apps/details?id=com.m11pets.elevenpets), [Capterra/search](https://www.softwareadvice.com/veterinary/petdesk-profile/reviews/)). Pawprint's successor Great Pet Care drew "money grab" complaints after acquisition ([Great Pet Care](https://account.greatpetcare.com/app)). For a product whose entire promise is that the record belongs to the animal and its custodian, holding that record hostage behind a paywall detonates the trust the flywheel runs on. The record must always be exportable and readable, even for a lapsed account.

### 2. In-app telehealth, on-demand vet chat, and booking as core surface
Evidence: telehealth is a different business with its own economics. Airvet charges $35/month, Fuzzy ran a membership model and its physical clinic closed ([Yelp](https://www.yelp.com/biz/fuzzy-pet-health-san-francisco), [Catster](https://www.catster.com/lifestyle/most-popular-vet-apps/)), and PetDesk-style booking depends on selling clinics on the practice side ([PetDesk](https://petdesk.com/compatible-pims/)). This is not backed by churn data I could confirm, so the argument is scope, not abandonment: telehealth pulls Pawdex into a subscription-fatigue, clinic-sales-dependent market orthogonal to the record-that-travels thesis. It competes for the same attention as records without feeding the transfer or data chain. Refuse it as a core surface; a "share record to your vet" export is the on-thesis version.

### 3. Generic mood/behavior/activity trackers with fixed, uneditable taxonomies
Evidence: 11pets limits behavior tracking to six uneditable generic states (shy, sad, happy) and food tracking to a timestamp and note, which users specifically complained about ([Google Play](https://play.google.com/store/apps/details?id=com.m11pets.elevenpets)). These trackers generate low-signal, non-comparable data that clutters the UI, does not survive a transfer meaningfully, and is near-worthless in an aggregate because the taxonomy is arbitrary. They are the classic pet-app bloat that pads a feature list without compounding anything.

Three more to refuse, briefly: social feeds and pet-photo communities (attention sink, no chain contribution); overzealous reminder spam (VitusVet reviewers complain the reminder system is wrong and sends too many, [Capterra](https://www.capterra.com/p/143459/VitusVet/reviews/)); and settings that only staff can change (PetDesk reviewers cite settings only PetDesk can edit, and time-zone bugs with no fix, [Software Advice](https://www.softwareadvice.com/veterinary/petdesk-profile/reviews/)). Keep configuration in the user's hands.

## (c) The research-data market

Who buys: pharma and animal-health companies, academic and longitudinal-aging researchers, and diagnostics firms. The proven vehicles are Mars Petcare (the Biobank of 20,000 dogs and cats with paired biological, medical, and lifestyle data over ten years, built on Wisdom Panel DNA and Banfield Optimum Wellness Plan clinical data), the Dog Aging Project (38,000+ enrolled dogs, open data access on request), and clinical-scale aggregates like the Banfield life-expectancy tables drawn from 13.3M unique dogs and 2.4M cats ([Mars Biobank](https://link.springer.com/article/10.1186/s12917-023-03691-4), [Mars Pet Insight](https://www.mars.com/news-and-stories/press-releases/mars-pet-insight-project), [Dog Aging Project](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC12369580/), [life-expectancy tables](https://pmc.ncbi.nlm.nih.gov/articles/PMC9989186/)).

What format: longitudinal, structured, de-identified records with parentage/genetics where possible. Longitudinal data commands a premium over cross-sectional snapshots, and curated, standardized, cleaned data commands more than raw dumps. This is exactly why the provenance (feature 1), microchip anchoring (feature 4), and genetics/parentage (feature 5) features matter to the data play and not just the consumer product.

Consent expectations: the credible model, and the one to build into task #1's schema, separates two things that are easy to conflate. Personal and contact information is never shared or sold. De-identified aggregate clinical data is used and licensed for research, on an opt-in and revocable basis. Mars states plainly it will "never share personal information," while simultaneously licensing and publishing de-identified aggregate clinical data at scale; those are not in tension, they are the design ([Mars Pet Insight](https://www.mars.com/news-and-stories/press-releases/mars-pet-insight-project)). On the PIMS side, access already runs on a revocable practice-consent basis, where the practice owns the data and can withdraw authorization, and partners are contractually barred from reselling without consent ([Puppilot](https://www.puppilot.co/blog/veterinary-data-interoperability-the-complete-guide-to-connecting-pims-labs-insurers)). Pawdex's version pushes that consent down to the individual custodian, captured at natural moments (onboarding, and the adoption-transfer signup).

Pricing signals: there is no per-record price in either human or veterinary data; deals are bespoke, negotiated one-to-one, and shaped by exclusivity, longitudinality, and data quality. For a reference class, human real-world-data annual contracts run roughly $75K to $5M, and the human RWD/RWE market is projected to grow from about $4.6B to $13.6B by 2030 at ~14.6% CAGR ([CB Insights](https://www.cbinsights.com/research/pharma-real-world-data-vendors-cost/), [Forbes](https://www.forbes.com/sites/sethjoseph/2025/08/20/what-is-your-health-record-worth-the-unseen-economics-behind-your-medical-data/)). Veterinary data is a smaller market than human, so treat those figures as an upper reference, not a forecast. The honest read: revenue scales with cohort size, longitudinal depth, and curation quality, and none of it exists until there is a clean consent object and enough enrolled, de-duplicated, provenance-tagged animals to form a cohort a buyer would negotiate over. The data play is a consequence of the flywheel turning, not a launch feature.

## Sources
- [11pets on Google Play (subscription/data-lock complaints)](https://play.google.com/store/apps/details?id=com.m11pets.elevenpets)
- [PetDesk reviews, Software Advice](https://www.softwareadvice.com/veterinary/petdesk-profile/reviews/)
- [VitusVet reviews, Capterra](https://www.capterra.com/p/143459/VitusVet/reviews/)
- [Pawprint / Great Pet Care](https://account.greatpetcare.com/app)
- [BreederCloudPro dog breeding software guide](https://breedercloudpro.com/blog/dog-breeding-software-guide)
- [BreederHQ software comparison](https://breederhq.com/compare/best-dog-breeding-software)
- [Embark for breeders, tools and services](https://embarkvet.com/breeders/tools-and-services/)
- [AKC Breeder Toolkit](https://www.akc.org/breeder-programs/akc-breeder-toolkit/)
- [Puppilot: vet data interoperability guide](https://www.puppilot.co/blog/veterinary-data-interoperability-the-complete-guide-to-connecting-pims-labs-insurers)
- [Today's Veterinary Business: open APIs](https://todaysveterinarybusiness.com/why-veterinary-software-should-embrace-open-apis/)
- [Veterinary software market (IDEXX/Covetrus share)](https://www.marketsandmarkets.com/ResearchInsight/veterinary-software-market.asp)
- [Mars Petcare Biobank protocol](https://link.springer.com/article/10.1186/s12917-023-03691-4)
- [Mars Pet Insight Project](https://www.mars.com/news-and-stories/press-releases/mars-pet-insight-project)
- [Dog Aging Project environmental data](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC12369580/)
- [Life-expectancy tables from Banfield clinical data](https://pmc.ncbi.nlm.nih.gov/articles/PMC9989186/)
- [CB Insights: pharma real-world data cost](https://www.cbinsights.com/research/pharma-real-world-data-vendors-cost/)
- [Forbes: what is your health record worth](https://www.forbes.com/sites/sethjoseph/2025/08/20/what-is-your-health-record-worth-the-unseen-economics-behind-your-medical-data/)
- [PadsPass digital pet passport](https://www.padspass.com/)
- [Pet Passport US-JP travel app](https://apps.apple.com/us/app/pet-passport-us-jp-travel/id6762554040)
- [Insurnest: AI in pet insurance claims](https://insurnest.com/blog/ai-in-pet-insurance-for-claims-vendors/)
- [Patify: Trupanion pre-existing-condition AI scans](https://patifyapp.com/en/content/detail/pet-insurance-pre-existing-condition-ai-scan-trupanion-2026-vet-notes-denial-guide)
- [Pet Capsule](https://petcapsule.app/)
- [California DOJ: puppy-buyer consumer alert](https://oag.ca.gov/news/press-releases/puppy-buyers-beware-attorney-general-bonta-issues-consumer-alert-cruel-puppy)
- [Golden Retriever forum: breeder medical records](https://www.goldenretrieverforum.com/threads/puppys-medical-records-from-breeder.516812/)
- [American Breeder: verify health certificates](https://www.americanbreeder.com/resources/american-breeder-blog/dogs/verify-dog-health-certificates)
- [Fuzzy Pet Health, Yelp (SF clinic closed)](https://www.yelp.com/biz/fuzzy-pet-health-san-francisco)
- [Catster: most popular vet apps](https://www.catster.com/lifestyle/most-popular-vet-apps/)
