# The one-stop shop: what a pet owner manages outside the medical record

Scope: the founder wants Pawdex to be the one-stop shop for pet ownership. The two prior reports answered "what health-record features do we add" (`feature-research.md`) and "where does the owner's medical-record journey stop one step short" (`product-roadmap.md`). This report asks the question neither did: what does an owner manage *outside* the medical record that Pawdex's two assets, a document-extraction engine and a permanent record that transfers at a change of custody, could own with an advantage no incumbent can copy?

The honest frame up front, because it is also the strength: almost every opportunity below is one extraction engine pointed at a new output surface. Pawdex already parses the rabies certificate, the itemized invoice, the microchip number, the genetics panel, and the vaccine series, and it already owns the custody-transfer event. The wins outside the record are the moments where that same already-extracted data has to *do a non-medical job on a deadline*: renew a license, prove ownership to a registry, survive the owner's death, satisfy an airline, back a tax deduction. Where the engine gives no edge (grooming bookings, food commerce, fake service-dog certificates), the idea is killed in section (b), not dressed up.

Deliberately not re-pitched here: microchip capture as a record anchor, the travel compliance packet, the insurance claim packet, the cost/spending dashboard, and the completeness score are already owned by the two prior reports (`feature-research.md` items 4, 7, 8; `product-roadmap.md` items 8 and 9). Where an opportunity below borders one of those, the boundary is drawn explicitly.

## (a) Top eight opportunities, ranked by pain times architectural fit

### 1. Continuity of custody: the record that survives the owner (M)

What it is: a designated successor custodian, care instructions, and the animal's complete record, all of which transfer automatically if the owner dies or is incapacitated. The owner names who takes the pet, records the standing care (medications, diet, vet, quirks, end-of-life wishes), and the full verified history hands off to that person the way it already hands off at adoption. Pawdex holds the operational continuity document; the legal instrument (the pet trust or will provision) stays with a lawyer, and Pawdex simply attaches and references it.

The pain is real and universal. Without a plan a pet becomes property of the estate and the executor decides its fate, up to and including surrender or euthanasia ([LegalClarity](https://legalclarity.org/what-happens-to-your-pets-when-you-die/)). All fifty states now recognize pet trusts, and the standard advice is to name both an emergency and a permanent caregiver and to write down the care standards ([Best Friends](https://bestfriends.org/pet-care-resources/estate-planning-pets-preparing-will-or-trust), [Nolo](https://www.nolo.com/legal-encyclopedia/estate-planning-pets.html)). Who solves it today: estate attorneys draft the trust, and services like Trust & Will sell the legal document ([Trust & Will](https://trustandwill.com/learn/pets-taken-care-of-after-you-die)). Nobody connects that legal document to the living, verified record the successor actually needs on day one. A pet trust that says "care for Bella as she is accustomed" is worthless if the caregiver does not know Bella is on 5mg of enalapril twice daily and allergic to a vaccine adjuvant.

The specific Pawdex data that makes it unfair: this is the transfer primitive applied to the one custody change every pet eventually faces. Pawdex is the only pet platform whose core object is a record built to change hands intact, with provenance, at a custody event. Death and incapacity are custody events. No competitor is architected for this; a records app treats the record as the owner's, and it dies with the account. Effort M: the transfer mechanics, the household roles, and the packet renderer already exist; the new work is a successor-designation object, a trigger flow, and an attach-legal-document slot.

### 2. Microchip registration and lost-pet mode, driven at the transfer moment (M)

What it is: two linked jobs. First, when custody transfers inside Pawdex, drive or pre-fill the microchip registry update in the same flow, at the exact moment it is otherwise forgotten. Second, an acute lost-pet mode that assembles what a search needs instantly: a current photo, physical description, the microchip number, the primary vet, and proof of ownership, rendered as a flyer and a shelter-ready report, with the microchip flagged lost.

Boundary with `feature-research.md` item 4: that item captures the chip number as a durable record anchor and de-dup key. This is the operational layer on top: the registration update, the lost flag, and the current-owner truth. Different job.

The pain is notorious. There is no national US registry, the registries are not required to talk to each other, and rescues routinely find chips registered to a previous owner or to nobody ([Whole Dog Journal](https://www.whole-dog-journal.com/blog/a-registered-microchip-helps-but-doesnt-solve-everything/), [Dr. Patty Khuly](http://www.drpattykhuly.com/columns-and-posts/2015/9/20/ten-more-reasons-why-our-pets-microchip-system-needs-fixing-part-2)). Annual-fee confusion leads owners to assume a chip is useless unless they pay ([Peeva](https://peeva.co/blog/do-i-need-to-pay-for-this/)). In the first 24 hours of a lost pet the checklist is exactly the data Pawdex holds: contact the registry and flag lost, alert shelters and vets, and distribute a flyer with a clear photo and the note that the pet is chipped ([PetPlace](https://www.petplace.com/article/general/pet-care/lost-pet-first-steps), [Best Friends](https://bestfriends.org/pet-care-resources/using-pet-microchips-find-lost-pets)). Who solves it today: the individual chip registries, and DocuPet, whose HomeSafe service ties a lost-pet profile and recovery brigade to its own tag ([DocuPet](https://www.docupet.com/post/how-the-lost-pet-service-works/)).

The specific Pawdex data that makes it unfair, and its honest limit: the registry mess exists because there is no trusted, portable proof of who owns the animal now. Pawdex's custody-transfer chain *is* that proof, so at the breeder-to-adopter or owner-to-owner handoff, where Pawdex controls both ends, it can update registration at the forgotten moment without integrating anything. That is the unfair slice. Be honest that it is a slice: for a dog adopted with a mystery chip registered to a stranger, Pawdex faces the same uncooperative registries everyone else does and should not pretend to be a national lookup (see the kill list). The lost-pet packet, by contrast, is unfair everywhere, because Pawdex already holds the photo, description, chip number, and ownership proof. Effort M.

### 3. Municipal licensing and rabies-tag renewal (M)

What it is: track each pet's license status and its renewal date, computed from the rabies certificate Pawdex already extracted, warn before it lapses, and pre-fill the renewal with the proof the jurisdiction requires. Start as a reminder plus a pre-filled packet, not a payment rail.

The pain: dog licensing is annual, legally mandatory in most jurisdictions, keyed to the rabies-vaccine anniversary, and penalized when late (a late fee, or in some counties a penalty equal to the license cost plus a field-enforcement fee) ([Maricopa County](https://www.maricopa.gov/226/Dog-License), [San Diego County](https://www.sddac.com/content/sdc/das/license-laws/license.html)). Every renewal requires current proof of rabies vaccination, which is the single document Pawdex is best at extracting and dating. Who solves it today: DocuPet runs licensing for 100-plus municipalities, but the owner still hand-enters the rabies information DocuPet then has to verify ([DocuPet](https://us.docupet.com/en_US/)).

The specific Pawdex data that makes it unfair: the renewal trigger *is* the rabies-certificate expiration, and Pawdex already computes that in the expiration radar. Pawdex knows the license is renewable before the city does and can hand the owner the exact dated proof the form asks for. Effort M, and deliberately bounded: pre-fill and remind, do not try to build the e-file-and-pay rail across thousands of jurisdictions (that is the integration swamp, noted in the kill list).

### 4. Prescription and therapeutic-diet authorization tracking (S/M)

What it is: the same running clock `product-roadmap.md` item 6 builds for take-home medications, pointed at therapeutic diets. Track the veterinary authorization on a prescription food, warn before it expires, and draft the re-authorization request to the vet. Not a storefront.

The pain: therapeutic diets for kidney disease, allergies, diabetes, and obesity require a vet authorization that expires, and when it lapses the reorder stalls until the vet is re-contacted ([Chewy veterinary-diet authorization](https://www.chewy.com/customer-care/prescriptions-and-veterinary-diets/filling-prescriptions-or-veterinary-diets/veterinary-diet-authorization)). Who solves it today: Chewy silently re-contacts the vet when an authorization expires, which works only if you buy from Chewy and leaves the owner blind to the clock ([Chewy prescription approval](https://www.chewy.com/customer-care/prescriptions-and-veterinary-diets/filling-prescriptions-or-veterinary-diets/prescription-approval)). The owner has no vendor-neutral view of what is authorized, until when.

The specific Pawdex data that makes it unfair: Pawdex extracts the invoice that shows the diet was dispensed and the authorization behind it, and it already owns the outbound records-request rail to the clinic. This is an expiration-and-document problem, which is Pawdex's core competence, decoupled from where the owner actually buys the food. Effort S/M, reusing the medication scheduler's supply arithmetic.

### 5. Working-dog document vault: service, therapy, and titled dogs (S)

What it is: a portable, permanent home for the legitimate documents a working-dog owner has to produce and currently scatters: task-training logs, temperament-test and Canine Good Citizen certificates, therapy-visit logs, and the vaccination and health records those roles require. It travels with the animal like the rest of the record.

The pain: therapy-dog programs require documented visits with date, location, and a facility signature, or a certifying letter, kept over years ([AKC Therapy Dog Program](https://www.akc.org/products-services/training-programs/akc-therapy-dog-program/)). Owner-trainers of service dogs are advised to keep a training log and to photograph and store their documents online so they can be produced from anywhere ([Ella's Animals](https://ellasanimals.org/uncategorized/documenting-owner-training-of-a-service-dog/)). Who solves it today: a swamp of online "registries" that sell meaningless certificates and ID cards, which the industry itself admits confer no legal rights ([Service Dog Certifications](https://www.servicedogcertifications.org/service-dog-documentation/)). Owners otherwise use a shoebox or a personal cloud drive.

The specific Pawdex data that makes it unfair: this is a document-vault-plus-provenance job, and Pawdex ingests documents and holds them portably and verifiably. The honest, on-thesis version holds the owner's real documents and credential expiry dates; it never issues a certificate (that scam is on the kill list). Narrower audience than items 1 through 4, but high willingness to keep records complete because the stakes (housing, air travel, facility access) are high. Effort S.

### 6. Deduction-ready expense packet for the two owners who can actually deduct (S)

What it is: point the extracted-invoice data at the small set of owners for whom pet expenses are legitimately deductible, and generate an audit-ready, itemized, dated export: service-animal owners claiming a medical deduction, and breeders running an actual business.

The pain and the honesty: for most people pet costs are not deductible, and any pitch that implies otherwise is wrong ([Kiplinger](https://www.kiplinger.com/taxes/can-i-deduct-my-pet-on-my-taxes)). But two groups genuinely qualify and are told to keep meticulous receipts, invoices, and logs: service-animal owners whose expenses count toward the medical deduction above the 7.5%-of-AGI floor, and breeders whose profit-intent business can deduct food, vet care, grooming, and training ([TaxAct](https://blog.taxact.com/service-animals-what-counts-and-what-doesnt-on-my-taxes/), [Mark J. Kohler](https://markjkohler.com/blog/10-ways-to-write-off-your-pet-on-your-taxes)). Who solves it today: nobody in pet software; the owner hand-sorts a shoebox for a CPA or a Schedule C.

The specific Pawdex data that makes it unfair: Pawdex has already extracted, dated, and categorized every invoice, and it retains the source document behind each line. That is exactly a deduction packet, and the breeder half of the audience is already a Pawdex user through the litter ledger. This is the cost dashboard from `product-roadmap.md` item 8 pointed at Schedule C and the medical-deduction worksheet, so it should reuse that aggregation rather than rebuild it. Effort S.

### 7. Breeder waitlist to deposit to transfer, as one funnel (M)

What it is: the pre-litter buyer pipeline (waitlist, applications, deposits, pick order) wired into the litter ledger and the adoption transfer, so a waitlisted buyer becomes the exact person who receives the puppy's record at go-home.

The pain: breeders juggle waitlists, deposits, pick order, and buyer communication, often in a spreadsheet ([Built By Dusty](https://www.builtbydusty.com/blog/puppy-waitlist-software-what-breeders-need)). Who solves it today, and well: BreederBuddy, BreederHQ, and BreedTracker all ship waitlist matching, deposit collection, and buyer CRMs ([BreederHQ](https://breederhq.com/), [BreedTracker](https://www.breedtracker.com/)). This is the most commoditized opportunity on the list, and the CRM mechanics carry no extraction advantage, so it is ranked here and not higher.

The specific Pawdex data that makes it unfair, and only this: the connection no incumbent has is that Pawdex's waitlisted buyer is the same identity that receives the verified record at transfer and becomes a new custodian account seeded with a complete history. The waitlist is the top of the same funnel `feature-research.md` calls the flywheel's origin node. Build the funnel only as the on-ramp to the transfer, not as a general CRM competing with the incumbents on features. Effort M.

### 8. Airline and route pet-travel policy matcher (S/M)

What it is: given a specific airline, route, and date, match the animal's already-extracted certificate and vaccine dates against that carrier's actual rules and flag what is missing or mistimed.

Boundary with `feature-research.md` item 7: that item assembles the destination's required documents and flags gaps. The net-new job here is the airline layer, which is a separate source of pain from the government's import rules. Health-certificate requirements swing wildly by carrier and cabin: American requires an original certificate within 20 days for cargo but none in-cabin, Alaska wants 10 days for cargo, Hawaiian wants 14, and a carrier can demand a certificate even when the destination country does not ([AKC airline guide](https://www.akc.org/expert-advice/travel/dog-airline-travel/), [American Airlines pets](https://www.aa.com/i18n/travel-info/special-assistance/pets.jsp)). Who solves it today: the owner cross-checks each airline's page by hand.

The specific Pawdex data that makes it unfair: Pawdex holds the dated certificate and vaccine records, so matching them against a per-carrier rule set is a pure computation over data it already has, the same shape as the boarding-readiness gate in `product-roadmap.md` item 3. Effort S/M: the rule set is the work, not the data.

## (b) Kill list: adjacent domains Pawdex should refuse

Grooming scheduling and booking. The entire grooming-software market is a groomer-side business tool (booking, reminders, CRM, payments) with the owner as an afterthought ([DaySmart Pet](https://www.daysmart.com/pet/solution/scheduling-software/), [Arrively](https://arrively.app/industries/grooming)). Owner-side, grooming is a recurring calendar reminder Pawdex's existing radar already covers for free. The extraction engine gives zero edge over an incumbent that owns the appointment, and the data (a haircut cadence) does not travel or compound. Refuse it as a product; expose grooming only as one more line in the reminder radar if at all.

Becoming a national microchip lookup or selling chips. The strong microchip play (item 2) rides the transfer moment Pawdex owns. The trap is drifting into "be the registry that finally unifies them all," which means either integrating with dozens of uncooperative registries or becoming the 25th non-interoperable island, the exact swamp `feature-research.md` item 12 warns about for PIMS. DocuPet already spent years building a national registry and it still cannot force the others to interoperate ([DocuPet National Pet Registry](https://partnerships.docupet.com/national-pet-registry/)). Own the moment, not the swamp.

Selling food or issuing prescriptions and diets. Item 4 tracks the *authorization clock*. The moment Pawdex sells the food or takes an affiliate cut for steering the reorder, it becomes a store and inherits the ecommerce-marketplace trust problem `product-roadmap.md` already killed. The whole value proposition is that Pawdex is on the owner's side of the invoice, not selling against it.

Issuing service-dog, ESA, or therapy-dog certificates. Item 5 holds the owner's real documents. Issuing or reselling "certification," ID cards, or vests is a market built on documents that confer no legal rights and that the reputable industry actively warns against ([Service Dog Certifications](https://www.servicedogcertifications.org/)). It is legally meaningless and reputationally toxic for a product whose entire asset is that its records are *trustworthy*. Refuse outright.

Horses and exotics as a near-term expansion. This is the honest multi-species answer, and it is a refusal-for-now, not forever. Cats are already in the model at no cost (same vaccine and rabies structure). Horses are a genuine document-pain market (the annual Coggins/EIA test, interstate health certificates, and barn-boarding proof are exactly Pawdex-shaped), but the document types, the rules, the boarding gatekeepers, and the buyer are a different vertical with an existing incumbent ([HorseBook](https://www.horsebook.app/blog/coggins-test-complete-guide), [Penn State Extension](https://extension.psu.edu/what-is-a-coggins-test)). Exotics break the vaccine-and-schedule model that the whole extraction pipeline assumes. Chasing either now dilutes the dog-and-cat flywheel before it is turning. Note horses as a deliberate future vertical, refuse exotics.

General "spending dashboard" as a new build. Not a moral kill, a de-duplication one: the cross-owner cost and budgeting surface is already `product-roadmap.md` item 8. Item 6 above should be a *view* on that data (the deductible slice), not a second aggregation.

## (c) The sleeping giant: continuity of custody

The one to bet on first is item 1, the record that survives the owner. It is the sleeping giant precisely because the founder did not prime it (the brief pointed at microchip, which is why microchip is the safe, salient pick and this is the one nobody asked for), and because it is the cleanest possible expression of the only thing Pawdex has that no competitor can copy.

Every other pet app treats the record as the owner's possession, so it dies with the account and the owner. Pawdex is the one product whose core object is built to change custody intact, with provenance, at a handoff. Death and incapacity are simply the custody change that every single pet eventually faces, and the moment when a complete, verified, immediately-transferable record is worth the most it will ever be worth, to a grieving caregiver who otherwise inherits an animal and no information. The play needs no integration with anyone (unlike microchip, whose unfair slice is bounded to the transfer moment and hits the registry swamp beyond it), it reuses the transfer mechanics, household roles, and packet renderer that already exist, and it compounds the flywheel directly: the successor custodian is one more transfer, one more account seeded with a full verified history, one more consented record in the aggregate. It turns the product's grimmest scenario into its strongest proof that a record which truly belongs to the animal outlives any one owner. That is the bet.

## Sources

- [LegalClarity: what happens to your pets when you die](https://legalclarity.org/what-happens-to-your-pets-when-you-die/)
- [Best Friends: estate planning for pets](https://bestfriends.org/pet-care-resources/estate-planning-pets-preparing-will-or-trust)
- [Nolo: estate planning for pets](https://www.nolo.com/legal-encyclopedia/estate-planning-pets.html)
- [Trust & Will: who will care for your pet](https://trustandwill.com/learn/pets-taken-care-of-after-you-die)
- [Whole Dog Journal: a registered microchip does not solve everything](https://www.whole-dog-journal.com/blog/a-registered-microchip-helps-but-doesnt-solve-everything/)
- [Dr. Patty Khuly: why the microchip system needs fixing](http://www.drpattykhuly.com/columns-and-posts/2015/9/20/ten-more-reasons-why-our-pets-microchip-system-needs-fixing-part-2)
- [Peeva: microchip registration is not free](https://peeva.co/blog/do-i-need-to-pay-for-this/)
- [PetPlace: lost pet first 24 hours](https://www.petplace.com/article/general/pet-care/lost-pet-first-steps)
- [Best Friends: using microchips to find lost pets](https://bestfriends.org/pet-care-resources/using-pet-microchips-find-lost-pets)
- [DocuPet: how the lost pet service works](https://www.docupet.com/post/how-the-lost-pet-service-works/)
- [DocuPet home](https://us.docupet.com/en_US/)
- [DocuPet National Pet Registry](https://partnerships.docupet.com/national-pet-registry/)
- [Maricopa County dog license](https://www.maricopa.gov/226/Dog-License)
- [San Diego County dog license](https://www.sddac.com/content/sdc/das/license-laws/license.html)
- [Chewy veterinary-diet authorization](https://www.chewy.com/customer-care/prescriptions-and-veterinary-diets/filling-prescriptions-or-veterinary-diets/veterinary-diet-authorization)
- [Chewy prescription approval](https://www.chewy.com/customer-care/prescriptions-and-veterinary-diets/filling-prescriptions-or-veterinary-diets/prescription-approval)
- [AKC Therapy Dog Program](https://www.akc.org/products-services/training-programs/akc-therapy-dog-program/)
- [Ella's Animals: documenting owner-training of a service dog](https://ellasanimals.org/uncategorized/documenting-owner-training-of-a-service-dog/)
- [Service Dog Certifications: documentation](https://www.servicedogcertifications.org/service-dog-documentation/)
- [Kiplinger: can I deduct my pet on my taxes](https://www.kiplinger.com/taxes/can-i-deduct-my-pet-on-my-taxes)
- [TaxAct: service animals and taxes](https://blog.taxact.com/service-animals-what-counts-and-what-doesnt-on-my-taxes/)
- [Mark J. Kohler: ways to write off your pet](https://markjkohler.com/blog/10-ways-to-write-off-your-pet-on-your-taxes)
- [Built By Dusty: puppy waitlist software](https://www.builtbydusty.com/blog/puppy-waitlist-software-what-breeders-need)
- [BreederHQ](https://breederhq.com/)
- [BreedTracker](https://www.breedtracker.com/)
- [AKC: airline travel requirements for dogs](https://www.akc.org/expert-advice/travel/dog-airline-travel/)
- [American Airlines: traveling with pets](https://www.aa.com/i18n/travel-info/special-assistance/pets.jsp)
- [DaySmart Pet grooming software](https://www.daysmart.com/pet/solution/scheduling-software/)
- [Arrively grooming scheduling](https://arrively.app/industries/grooming)
- [HorseBook: Coggins test guide](https://www.horsebook.app/blog/coggins-test-complete-guide)
- [Penn State Extension: what is a Coggins test](https://extension.psu.edu/what-is-a-coggins-test)
