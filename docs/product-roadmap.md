# Product roadmap: owner-journey gaps and high-reception additions

Scope: this is the founder-asked companion to `feature-research.md`. That report ranked features by how much they strengthen the breeder-to-adopter-to-research flywheel. This one walks the individual owner's journey end to end and finds the moments Pawdex has nothing for, or stops one step short. It deliberately does not re-pitch the flywheel shortlist (litter ledger, transfer-at-adoption, microchip anchoring, genetics, consent, PIMS hooks, insurance-claim packet, travel packet, Q&A). Everything here is net-new relative to both that report and the ~50 routes already shipped.

The owner journey, as a spine: new pet on day one, first vet visit, everyday between-visit life, boarding or a sitter, moving cities, a 2am emergency, chronic-condition medication management, the aging pet, end of life. Pawdex is strong at ingesting and structuring the record. It is weak at the moments where the owner needs the record to *do something* on a deadline, and at the moments before there is much of a record at all (day one).

A note on what "compounds the core" means below: Pawdex's wedge is a verified record that travels with the animal. A feature compounds that wedge when it either pulls more structured data into the record, gives the owner a reason to keep it complete and current, or makes the record readable by the next custodian (a boarder, a new vet, an ER, an adopter). Features that just decorate the app without doing one of those three things are in the "do not build" section.

## (a) Top 10 additions, ranked by reception versus effort

Ordered best-ratio-first: the cheap, self-evidently wanted wins lead.

### 1. Calendar sync for reminders and expirations (S)
What it is: a per-household subscribable ICS feed (and Google Calendar push) so every vaccine expiry, insurance renewal, and scheduled reminder lands on the calendar the owner actually looks at. One toggle in `/settings`, one signed feed URL, read-only.
Journey moment: everyday life between visits, where an email that arrives at 8am ET and is gone by 8:05 is the entire current reminder surface.
Evidence: reminder-tracking is the single most requested pet-app job, and owners specifically want the schedule to live where they already look rather than in a siloed app ([PetNudge vaccine-tracking guide](https://petnudge.fr/blog/how-to-track-pet-vaccinations-app/), [PawTrack](https://www.pawtrackapp.com/blog/pet-s-vaccination-schedule-made-simple)). Boarding vaccine timing (see item 3) is a calendar problem before it is anything else.
Effort: S. The expiration radar (`/expiring`) already computes every dated event; this is a serialization layer plus a signed feed route. No new schema.
Compounds the core: a live reminder the owner keeps acting on is what keeps the record current between vet visits, which is what makes it worth anything to the next custodian. Email-only reminders decay; calendar entries are sticky.

### 2. Camera-first quick capture (S/M)
What it is: a phone-native "snap the discharge paper" path. Installable PWA with a share-target and camera intent so from the parking lot after a visit the owner photographs the printout, picks the pet, and extraction runs. No desktop, no email forward, no file picker.
Journey moment: the end of every single vet visit, when the paper is in hand and the intent to file it is at its peak and will never be higher.
Evidence: "no ability to scan in documents received from the vet" and broken photo-attach are among the top complaints in pet-record app reviews, and the apps that do offer clean document capture are the ones users say they will pay for ([Pet Health Record and Pet Parents app reviews](https://apps.apple.com/us/app/pet-parents-easy-pet-records/id1616308024), [VitusVet](https://apps.apple.com/us/app/vitusvet-pet-medical-records/id955252538)). The moment-of-visit capture window is where records are won or lost.
Effort: S/M. The extraction pipeline, HEIC handling, and upload action all exist. The new work is a mobile-first capture UI and PWA manifest/share-target, not new backend.
Compounds the core: every document captured at the moment of care is a document that would otherwise have been lost, and volume of clean source documents is the raw material the entire record, and later the aggregate, is built from.

### 3. Boarding and daycare readiness gate (S)
What it is: a boarding-specific view layered on the expiration radar that answers one question, "is this pet cleared to board on this date," by checking rabies, DHPP, and specifically Bordetella against typical facility windows, and flags the ones that need a booster with enough lead time. Pairs with the existing boarding share-link so the owner sends proof in the same flow.
Journey moment: booking boarding or daycare, usually days before a trip, under time pressure.
Evidence: boarding vaccine rules are "vague, poorly written, open to interpretation," Bordetella is only good for six months and wants 10 to 14 days of lead time (three days absolute minimum), and last-minute owners get turned away or charged for on-site boosters ([Hemopet on boarding vaccine law confusion](https://hemopet.org/boarding-kennels-and-grooming-vaccination-laws-and-issues/), [The Wright Pet on Bordetella timing](https://thewrightpet.com/pet-boarding-vaccines-everything-you-need-to-know/), [PetSmart PetsHotel requirements](https://services.petsmart.com/content/PetsHotel-Requirements)). The Bordetella six-month window is shorter than the annual cadence the radar is tuned for, so a general radar misses it.
Effort: S. Pure computation over existing vaccine rows, reusing the `/expiring` and share-link infrastructure. The only new logic is boarding-specific windows for Bordetella and a lead-time warning.
Compounds the core: it turns "here is your record" into "here is your record clearing you for a real deadline," which is exactly the kind of concrete, dated payoff that makes owners keep vaccines logged and current.

### 4. Push and SMS reminder channels with a weekly digest (S)
What it is: extend the reminder system beyond email to web-push and optional SMS, plus a single opt-in "here is everything coming up this week across all your pets" digest instead of one email per expiring item.
Journey moment: everyday, and especially the multi-pet household juggling different schedules per animal.
Evidence: managing multiple pets means "handling multiple cards with different schedules and different due dates," and owners want one unified view of what is coming up rather than per-item noise ([multi-pet vaccine management](https://www.pawtrackapp.com/blog/pet-s-vaccination-schedule-made-simple), [VetDex "who is due"](https://www.vetdex.app/)). The report's own anti-feature list flags reminder spam as a churn driver, so consolidation is the on-thesis version of more channels.
Effort: S. Reuses the reminder computation and the Resend integration; adds a push subscription table and a digest template.
Compounds the core: reliable, non-annoying nudges are what keep the record alive, and a household-level digest reinforces the multi-pet, multi-custodian model the flywheel depends on.

### 5. New-pet first-year plan (S/M)
What it is: at pet creation, if the animal is a puppy or kitten (or newly adopted with an unknown history), generate the projected first-year schedule, the DHPP or FVRCP series at 6, 12, 16 weeks, rabies at 14 to 16 weeks, spay/neuter window, the socialization-window note, and let the owner check items off as records arrive. A guided path, not a blank record.
Journey moment: day one with a new puppy, the single most overwhelming moment in the journey and the one where Pawdex currently shows an empty record.
Evidence: "there is so much to keep track of for your puppy that it can be quite overwhelming," the core series runs across three staggered visits, and the socialization window closes before vaccination finishes ([AKC puppy vaccination guide](https://www.akc.org/expert-advice/health/puppy-shots-complete-guide/), [VCA puppy schedule](https://vcahospitals.com/pediatric/puppy/health-wellness/puppy-vaccine-schedule)). New-owner overwhelm is a documented, universal moment with no current Pawdex answer.
Effort: S/M. The vaccine-duration catalog (`lib/clinical/vaccine-catalog.ts`) and first-dose heuristic already encode the schedule math; this projects it forward from DOB into a checklist rather than only validating records after the fact.
Compounds the core: it captures the owner on day one, before there is any record, and turns Pawdex into the plan the puppy grows into. Every checked-off item is a structured record entered at its earliest possible moment, which is the most complete a record can ever be.

### 6. Medication refill and supply radar (M)
What it is: track days-of-supply-remaining for active take-home medications (quantity dispensed, dose, frequency), warn before a pet runs out, and for chronic drugs surface the "your vet may need a recheck before refilling" reality. One tap drafts the refill request to the clinic through the existing outbound flow.
Journey moment: chronic-condition medication management, the recurring low-grade stress of a pet on lifelong thyroid, seizure, heart, or diabetes medication.
Evidence: the AVMA is explicit, "do not wait until you are out of medication," refills need three to five days of lead time, and chronic drugs often require a recheck or bloodwork before the vet will authorize more ([AVMA prescriptions FAQ](https://www.avma.org/resources-tools/animal-health-and-welfare/animal-health/pharmacy/prescriptions-and-pharmacies-faq-pet-owner)). Missed doses on seizure or cardiac medication are a real safety event, not an inconvenience.
Effort: M. The medication scheduler and dose-logging table (Phase 6.12) already log administration; the delta is supply arithmetic (dispensed minus logged doses) and a refill-request action, not a new subsystem.
Compounds the core: it converts the medication list from a static record into a running clock the owner checks, which is a daily-use retention loop, and it ties directly into the outbound records/request rail the platform already owns.

### 7. New-clinic switch kit and second-opinion packet (S/M)
What it is: a one-action "share my pet's complete history with a clinic I am about to visit" export, as a live link and a clean intake PDF, for two cases: moving to a new city and starting fresh with a new vet, and getting a second opinion or specialist referral. Complements the existing request-records-from-old-vet flow by handling the other direction, handing the record to the new provider.
Journey moment: moving cities, and any specialist or second-opinion visit within a city.
Evidence: a new vet "must have all the records from a pet's previous vet," the transfer is manual and takes 7 to 10 business days, and owners are told to physically carry copies to the first appointment ([PetHub on getting records](https://www.pethub.com/articles/70424/getting-my-pet-s-medical-records), [VCA on why sharing records matters](https://vcahospitals.com/know-your-pet/the-importance-of-sharing-medical-records)). The switching-vets moment is documented friction with a clear willingness to act.
Effort: S/M. Reuses the compliance-packet renderer and the tokenized share-link system (Phase 6.6); the new work is a "full clinical history" packet variant rather than the boarding-scoped one.
Compounds the core: this is the literal payoff of "records that travel." A move is exactly when a siloed record fails the owner and a portable one wins, and delivering that win at the move is the strongest possible proof of the thesis to a new user.

### 8. Cost ledger and records completeness score (M)
What it is: aggregate what the owner has spent (from invoice extractions and logged estimates) into a running per-pet and per-household total, and render a Carfax-style completeness indicator, "verified vaccines, N visits documented, genetics on file, X years of continuous history," that travels with the animal.
Journey moment: budgeting and cost anxiety throughout ownership, and the rehoming or adoption handoff where a documented history has value.
Evidence: vet-cost anxiety is one of the loudest owner complaints, with emergency visits running $800 to $1,500 and often demanding payment upfront ([Money on emergency vet cost](https://money.com/how-much-is-an-emergency-vet-visit/), [WXYZ on upfront-deposit demands](https://www.wxyz.com/news/why-some-veterinarians-ask-for-thousands-of-dollars-upfront-for-emergency-care)). The Carfax mapping is direct, documented service history "can add hundreds or even thousands" to resale value and buyers "pay a premium for documented upkeep" ([Carfax on service history and value](https://cooksrepair.com/BlogCarfax)).
Effort: M. Invoice and cost data are already extracted and the cost-estimate table exists; the work is aggregation plus a completeness heuristic, no new ingestion.
Compounds the core: the completeness score is a direct incentive to keep the record full, and it makes the record a legible asset at transfer, which is precisely the "records raise resale value" framing that motivates breeders and adopters to run the handoff through Pawdex.

### 9. Condition-linked episode log (M)
What it is: for a pet with an active diagnosis, a fast one-tap log tied to that condition, seizure count and duration for epilepsy, flare frequency for GI or skin conditions, a mobility or pain score for arthritis, with optional video. Not a generic mood tracker: every entry attaches to a named condition, is comparable over time, and rolls up into a trend the owner shares with the vet.
Journey moment: the aging pet and any chronic diagnosis, where the owner is the only monitor between monthly rechecks.
Evidence: structured seizure and condition diaries are a standard veterinary ask, the RVC ships a dedicated epilepsy tracker, and vets want monthly updates to titrate treatment ([RVC Pet Epilepsy Tracker](https://apps.apple.com/us/app/rvc-pet-epilepsy-tracker/id992917809), [Pieper Veterinary epilepsy tracker](https://pieperveterinary.com/specialty-services/neurology/pet-epilepsy-tracker/)). This is the same retention mechanic that makes baby-tracking apps daily-use tools, applied to medical signal rather than mood ([Huckleberry pattern-recognition retention](https://huckleberrycare.com/blog/how-to-use-a-baby-tracker-to-support-your-routine)).
Effort: M. New table and a light logging UI, sharing the QoL tracker's charting and tone discipline.
Why this escapes the report's anti-feature: `feature-research.md` refuses generic mood/behavior trackers because their taxonomy is arbitrary, the data does not survive transfer, and it is worthless in aggregate. Condition-linked episodes are the opposite on all three counts, they are tied to a clinical diagnosis (comparable taxonomy), they are the exact longitudinal signal a specialist reads and a research cohort values, and they travel with the record because they are attached to a canonical condition, not a free-floating emoji.
Compounds the core: it is high-value, comparable, longitudinal structured data, the kind the aggregate is actually built to hold, and it earns the daily-use habit that keeps a senior pet's record alive through the highest-stakes phase of the journey.

### 10. Proactive record insights (M)
What it is: turn the existing Q&A engine from reactive to proactive. Instead of only answering asked questions, surface unprompted signals the owner would not think to query, "Bella has lost 8% of body weight since March," "this lab value is trending toward the top of range across three visits," "rabies lapses before your August trip." A small set of deterministic, cited nudges on the dashboard.
Journey moment: everyday, and the slow-onset problems of the aging pet that no single visit catches.
Evidence: pattern recognition across data the owner cannot hold in their head is the single most-praised feature of daily-tracking apps, "it might seem like the pet hasn't changed, but the data is actually super useful" ([Huckleberry on trend surfacing](https://huckleberrycare.com/blog/how-to-use-a-baby-tracker-to-support-your-routine)). Longitudinal lab-trend detection is already on the deferred list in the README; this generalizes it.
Effort: M. Weight, lab, and vaccine data are already structured and the lab-trend charts exist; this is a rules layer plus a dashboard surface, grounded in the same citation discipline already shipped.
Compounds the core: it is the feature that makes a deep, complete record visibly pay off, which is the strongest possible argument for keeping it complete. A record that tells you something you did not know is a record you keep feeding.

## (b) Five "do better" refinements of what exists

### 1. Make the expiration radar actionable, not just a list
`/expiring` renders a beautifully sorted list of what is overdue and what is coming, and then stops. Each row should carry the next action inline: book, request records, add to calendar, mark done, send proof to a boarder. Right now the owner reads the list, feels the anxiety, and then has to go do the work somewhere else. The data to act is all present; the affordances are missing.

### 2. Share everything as a live link, not just the boarding packet
The tokenized share-link is excellent and currently lives only on the compliance packet. The pre-visit briefing, the emergency card, the QoL trend, and the full clinical history all want the same treatment, a revocable live URL the owner can text to a sitter, a specialist, or a family member. Print-and-PDF is the 2010 answer; a live link that stays current after you send it is the on-thesis one, and the infrastructure already exists.

### 3. Close the loop on records requests
The platform can send a records request to a clinic, but the owner has no view of whether it was fulfilled. Given the documented 7-to-10-day turnaround, a simple status ("requested 6 days ago, no reply yet, resend?") on the request would turn a fire-and-forget action into something the owner trusts. The outbound and inbound rails both exist; they just are not stitched into a status the owner can see.

### 4. Pull the QoL tracker out of its silo
The quality-of-life tracker is well built and tone-disciplined, but it is an island: no shareable trend link, no caregiver entries, no attached photos. End-of-life is the moment an owner most wants to show the trend to their vet and share the load with family, and the tracker currently supports neither. A share link (see refinement 2) and multi-caregiver entry would let it do the emotional work it is clearly meant for.

### 5. Render the conflict pills the pipeline already computes
The README's own deferred gap: the dedup helpers compute per-record "already on file" candidates, but the review form's entity cards do not yet show them inline. This is the difference between the owner trusting the ingest ("it caught the duplicate") and quietly accumulating doubled records. The computation is done; it needs to reach the card. This is the cheapest trust win on the list.

## (c) "Completely missed" structural opportunities

Three from the owner journey, plus one (item 4) surfaced by a build-state cross-check of the code, not the journey.

### 1. Vet-facing read access at the point of care
The headline miss. The entire product rests on records that travel with the animal, but a record that travels is dead weight if the treating clinician cannot read it in the room. Today the owner can print a packet or forward a link, but there is no clinician-shaped view: no "the vet scans a code on the pet's collar tag or the owner's phone and sees allergies, current meds, chronic conditions, vaccine status, and recent labs, structured and citable." Human health has already proven the shape: Apple Health's "Share with Provider" lets a patient push their record into the clinician's system on the SMART-on-FHIR standard, and the industry treats it as a milestone ([Apple Share with Provider](https://support.apple.com/guide/healthregister/health-app-data-share-with-provider-faq-apd531bc6215/web), [Fierce Healthcare on SMART/FHIR](https://www.fiercehealthcare.com/digital-health/excited-to-share-apple-health-records-a-doctor-thank-industry-data-standards-like)). Veterinary medicine has no equivalent and no universal standard to wait for, which is the opening. Start owner-permissioned and read-only (the owner grants a time-boxed clinician view), and the two-way version later lets the vet push a visit summary straight back into the record, which closes the ingestion loop at the source instead of chasing PDFs after the fact. This is the mirror image of the whole thesis and the strongest answer to "what did we completely miss."

### 2. Emergency mode
The offline emergency card (Phase 6.7) is a printed wallet card. The missed opportunity is the interactive, high-stakes version for the moment it is actually needed. At 2am in an ER waiting room, panicked, the owner needs one screen: allergies, current medications and doses, chronic conditions, microchip, primary vet, insurance policy and its deductible status, and a one-tap "share this pet's full record with this hospital right now" that works even on bad signal. It should also front-load the money reality the owner is about to hit, emergency visits run $800 to $1,500 and most ERs demand a deposit upfront ([Spot Pet Insurance on emergency costs](https://spotpet.com/blog/why-pet-insurance/how-much-does-an-emergency-vet-visit-cost), [WebMD on emergency care costs](https://www.webmd.com/pets/what-to-know-costs-emergency-veterinary-care)), so surfacing the insurance card and OOP estimate in the same screen is genuinely useful, not decorative. A printed card cannot update, cannot share the full record, and cannot show live insurance status. An emergency mode can, and it is the moment of maximum trust to earn.

### 3. Pet-sitter and caregiver active handoff
The boarding share-link already hands a sitter a read-only packet, so passive sharing is solved. The missed structural piece is the active care layer: a time-boxed delegated mode where a named sitter or boarder gets the feeding and medication schedule, can log doses given (which flow back into the real record), holds standing emergency-vet authorization, and optionally a spending cap for treatment decisions while the owner is unreachable. Sitter instruction sheets are a universal ritual done today in a Google Doc or a printout taped to the fridge, covering exactly this, meds, feeding, the nearest 24-hour ER, and treatment authority ([AAHA essential pet-sitter instructions](https://www.aaha.org/resources/preparing-for-the-unexpected-essential-pet-sitter-instructions/), [Hill's pet-sitter checklist](https://www.hillspet.com/pet-care/routine-care/pet-sitter-checklist-essentials)). This is the same custodianship primitive the transfer flow is built on, taken to a temporary, scoped limit, and it means the record keeps growing (dose logs, incidents) even while the owner is away, instead of going dark for a week.

### 4. Full-record export and data portability
What it is: a "download everything about this pet" surface, structured data plus the original source documents, as a single archive the owner can take with them. There is no such surface in the app today (verified in code: every "export/download" path is either the vet records-request flow or the print packet, none of which hands the owner their whole record).
Journey moment: leaving the service, a lapsed account, or simply the owner's peace of mind that the record is theirs. It is the quiet question under the entire value proposition, "if I stop paying, do I lose my pet's history?"
Evidence: the platform's own anti-feature research (`feature-research.md`) refuses subscription paywalls that lock users out of their data and states plainly that "the record must always be exportable and readable, even for a lapsed account." The research-consent copy already promises revocability. Both commitments are unbacked until export exists. Competitor churn is driven precisely by apps that trapped data behind a lapsed subscription ([11pets data-lock complaints, cited in feature-research.md](https://play.google.com/store/apps/details?id=com.m11pets.elevenpets)).
Effort: S. All the data is already structured and the documents are already in storage; this is a packaging-and-download route, not new capture.
Compounds the core: a record you can always walk away with is the strongest possible version of "this record belongs to the animal and its custodian," which is the trust the entire flywheel runs on. Portability is not in tension with retention here; it is what makes owners trust the record enough to keep feeding it. It is placed in this section rather than (a) because it is less a feature owners will ask for by name than a structural promise the product has already made and not yet kept.

## (d) What NOT to build next

These are traps specific to this product's moment, chosen to not restate the report's existing anti-feature list (telehealth, social feeds, generic mood trackers, reminder spam, PIMS-integration-as-roadmap all still stand and are not repeated here).

### A native iOS/Android app before the capture flow proves demand
The pull toward "we need a real app" is strong, and app-store distribution is seductive. But the actual unmet need is fast capture at the vet, which an installable PWA with a camera share-target (item 2) delivers at a fraction of the cost and with no app-review gatekeeper. Build the capture flow, prove owners use it at the moment of the visit, and let that usage, not a hunch, decide whether a native shell is worth the multiplied maintenance surface.

### A hardware or wearable play
Activity collars, smart feeders, and GPS trackers are an obvious-looking extension and a graveyard of margin, inventory, and support load. They also generate exactly the low-signal, non-comparable activity data the report already warned against, now with a returns policy attached. Pawdex's asset is the document-derived structured record; hardware dilutes focus and does not compound it.

### An e-commerce or pet-products marketplace
The Rx pharmacy shopper (Phase 6.13) is correctly scoped as owner-curated price comparison. The trap is letting it grow into affiliate storefronts, food sales, or a supplements marketplace. The moment Pawdex earns money by steering what the owner buys, the "this record belongs to you and we are on your side" trust that the entire flywheel runs on is compromised, and that trust is worth far more than the affiliate cut.

### Predictive or diagnostic breed-risk claims, again
Breed risk was already pulled for good reasons (Phase 6.37): narrow coverage plus asymmetric liability on "this might happen to your pet" claims without a clinician reviewer. Resist the temptation to reintroduce any predictive health scoring, "your pet's health risk score," AI-diagnosed conditions, end-of-life predictions, through a side door. The QoL tracker's tone discipline (Pawdex never recommends, it surfaces and defers to the vet) is the line, and every proactive-insight feature (item 10) must stay on the descriptive side of it.

### Becoming the pet's social identity
Profiles, badges, "gotcha day" feeds, and follower counts look like engagement and are actually a different product competing for the same build hours. Pawdex's retention should come from the record doing real work at real deadlines (boarding clearance, refill timing, emergency access), not from gamified vanity. Every hour spent on social identity is an hour not spent making the record more complete or more portable.

## Sources
- [PetNudge: how to track pet vaccinations](https://petnudge.fr/blog/how-to-track-pet-vaccinations-app/)
- [PawTrack: pet vaccination schedule made simple](https://www.pawtrackapp.com/blog/pet-s-vaccination-schedule-made-simple)
- [VetDex pet health records app](https://www.vetdex.app/)
- [Pet Parents easy pet records (App Store reviews)](https://apps.apple.com/us/app/pet-parents-easy-pet-records/id1616308024)
- [VitusVet pet medical records (App Store)](https://apps.apple.com/us/app/vitusvet-pet-medical-records/id955252538)
- [Hemopet: boarding kennels and grooming vaccination laws](https://hemopet.org/boarding-kennels-and-grooming-vaccination-laws-and-issues/)
- [The Wright Pet: pet boarding vaccines and Bordetella timing](https://thewrightpet.com/pet-boarding-vaccines-everything-you-need-to-know/)
- [PetSmart PetsHotel required vaccinations](https://services.petsmart.com/content/PetsHotel-Requirements)
- [AVMA: prescriptions and pharmacies FAQ for pet owners](https://www.avma.org/resources-tools/animal-health-and-welfare/animal-health/pharmacy/prescriptions-and-pharmacies-faq-pet-owner)
- [AKC: puppy vaccination schedule guide](https://www.akc.org/expert-advice/health/puppy-shots-complete-guide/)
- [VCA: puppy vaccine schedule](https://vcahospitals.com/pediatric/puppy/health-wellness/puppy-vaccine-schedule)
- [PetHub: getting my pet's medical records](https://www.pethub.com/articles/70424/getting-my-pet-s-medical-records)
- [VCA: the importance of sharing medical records](https://vcahospitals.com/know-your-pet/the-importance-of-sharing-medical-records)
- [Money: how much is an emergency vet visit](https://money.com/how-much-is-an-emergency-vet-visit/)
- [WXYZ: why vets ask for thousands upfront for emergency care](https://www.wxyz.com/news/why-some-veterinarians-ask-for-thousands-of-dollars-upfront-for-emergency-care)
- [Spot Pet Insurance: emergency vet visit cost](https://spotpet.com/blog/why-pet-insurance/how-much-does-an-emergency-vet-visit-cost)
- [WebMD: costs of emergency veterinary care](https://www.webmd.com/pets/what-to-know-costs-emergency-veterinary-care)
- [Carfax service history and resale value](https://cooksrepair.com/BlogCarfax)
- [RVC Pet Epilepsy Tracker (App Store)](https://apps.apple.com/us/app/rvc-pet-epilepsy-tracker/id992917809)
- [Pieper Veterinary: pet epilepsy tracker](https://pieperveterinary.com/specialty-services/neurology/pet-epilepsy-tracker/)
- [Huckleberry: how to use a baby tracker to support your routine](https://huckleberrycare.com/blog/how-to-use-a-baby-tracker-to-support-your-routine)
- [Apple Health: share data with provider FAQ](https://support.apple.com/guide/healthregister/health-app-data-share-with-provider-faq-apd531bc6215/web)
- [Fierce Healthcare: Apple Health, SMART and FHIR](https://www.fiercehealthcare.com/digital-health/excited-to-share-apple-health-records-a-doctor-thank-industry-data-standards-like)
- [AAHA: essential pet-sitter instructions](https://www.aaha.org/resources/preparing-for-the-unexpected-essential-pet-sitter-instructions/)
- [Hill's Pet: pet-sitter checklist essentials](https://www.hillspet.com/pet-care/routine-care/pet-sitter-checklist-essentials)
