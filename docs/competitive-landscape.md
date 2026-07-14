# Competitive Landscape: Consumer Pet Health Records (US, July 2026)

Method: multi-agent web research. 5 search angles, 21 sources fetched, 95 claims extracted, top 25 adversarially verified with 3-vote panels (25 confirmed, 0 refuted). Nearly all evidence is vendor marketing pages and app-store listings, verified live in July 2026; treat feature claims as self-reported. Perishable: PetRecord.ai launches "Summer 2026," MyPetID's free-forever posture has no visible monetization.

## Verdict

The market splits into three camps, and Pawdex sits in the newest one:

1. **Legacy consumer apps**: Pawprint, the best-known standalone, no longer exists. getpawprint.com 307-redirects to Great Pet Care (utm_source=pawprint-rebrand); same app-store identifiers rebranded. Great Pet Care keeps manual record upload/share positioned around proof-of-vaccination, no AI extraction. 11pets survives but torched its user base converting free users to a subscription that paywalled their existing data (review evidence, not panel-verified).
2. **Vet-connected B2B apps**: PetDesk (12,000+ practices self-reported, free consumer app, read-only clinic-synced records, no owner ingestion, no portability) and VitusVet (free to owners, clinics pay ~$319-399/mo, record completeness depends on clinic policy, consumer app dormant since April 2023). These win on distribution, not product.
3. **AI-first entrants since 2024**: MyPetID (live, free forever, AI ingestion of uploaded docs plus records-grounded AI Q&A: Pawdex's two headline features at $0), PetRecord.ai (pre-launch waitlist, $9/mo or $88/yr, no free tier, upload-based AI extraction with claimed 95%+ accuracy and human review of low-confidence fields), PetVax AI (vaccine-only OCR scanning, ad-supported freemium, mobile-only), Vet Record (Jan 2026, manual entry, family sync at $6.99/mo, ~zero traction).

## Competitor matrix

| Product | Price to owner | AI ingestion | AI Q&A | Family/multi-user | Native app | Vet sync | Insurance | Transfer/portability |
|---|---|---|---|---|---|---|---|---|
| Pawdex | Free / $6/mo | Yes (upload + email-forward) | Yes, cited | Yes | No | No | Policy analysis + claims | Owner-to-owner, full record |
| MyPetID | Free forever | Yes (upload) | Yes | Caregiver sharing | Yes | No | No | No |
| PetRecord.ai (pre-launch) | $9/mo, no free tier | Yes (upload, PDF) | Timeline/search | No evidence | Web-only | No | No | No |
| Great Pet Care (ex-Pawprint) | Free | No (manual upload) | No | Sharing | Yes | No | No | No |
| PetDesk | Free (clinic pays) | No | No | No | Yes | Yes (partner clinics) | No | No (records stay clinic-fed) |
| VitusVet | Free (clinic pays $319-399/mo) | No (photo upload) | No | Yes (share with providers) | Yes (dormant) | Yes (partner clinics) | Photo claim submission (Nationwide) | No |
| PetVax AI | Freemium + ads | OCR vaccine cards only | Symptom chat | No evidence | Yes, mobile-only | No | No | No |
| Vet Record | Free 1 pet / $6.99/mo | No (manual) | No | Yes (premium) | Yes | No | No | Share links/QR/PDF |
| Petstablished (rescue side) | Free to adopter | No | No | n/a | n/a | n/a | No | Rescue-to-adopter record transfer at adoption |

## What is commoditized vs actually differentiated

Commoditized or commoditizing fast (do not lead marketing with these): AI document extraction, records-grounded AI Q&A, family sharing, reminders, native mobile apps. MyPetID ships the first three free today.

Genuinely differentiated for Pawdex:
1. **Owner-to-owner adoption transfer of the full medical record.** Closest analog is Petstablished, which transfers records rescue-to-adopter at adoption into a basic PetLover account; there is no owner-to-owner chain, no re-transfer, no AI ingestion on top. Pawdex's consumer-initiated portable-record chain has no direct competitor found.
2. **Email-forward ingestion** (competitors are upload-only).
3. **Insurance policy analysis** (VitusVet does photo claim submission for one insurer; nobody found does policy/PEC analysis).
4. **EU travel packets / emergency cards.**

## Gap list, ranked by competitive importance

1. **No native mobile app.** Every AI-first entrant ships iOS/Android; two are mobile-only. Table stakes for the category. (Mitigation until then: PWA installability and flawless mobile web, in progress.)
2. **No clinic-side distribution channel.** The volume winners acquire users because the vet's front desk pushes the app. Pawdex has no B2B2C loop; its analog is the breeder/adoption transfer loop, which is unproven but structurally similar (a trusted party hands the app to a new owner at an emotional moment).
3. **Free direct substitute exists.** MyPetID anchors AI ingestion + Q&A at $0 with unknown monetization. Pawdex's $6/mo must be justified by the things MyPetID lacks: email-forward, insurance, travel, transfer, trust posture.
4. **No vet clinic record sync.** Clinic-connected apps get records without user effort. Pawdex's email-forward is the partial answer; a "request records from your vet" flow (already partly built as pending_records_requests) narrows it further.
5. Minor: multi-species posture (several entrants are dogs-and-cats only, so this is parity or better for Pawdex), microchip registry links (present in VitusVet's tracking fields).

## Willingness to pay (medium confidence)

Asking prices bracket Pawdex: $0 (MyPetID, all clinic-subsidized apps), $6.99/mo (Vet Record), $9/mo (PetRecord.ai, untested pre-launch). The category norm is the owner pays nothing because a clinic or advertiser subsidizes. Direct consumer subscriptions for records alone are unproven asking prices, not demonstrated demand. Supporting context from search (not panel-verified): TGM's 2026 pet-tech survey reports 79% of owners say pet tech is poor value for cost; 11pets reviews show violent churn when existing data was paywalled. Two implications: (a) Pawdex's records-never-hostage stance is a marketable trust asset, the exact opposite of the 11pets failure; (b) the $6 tier should be sold on the bundle (insurance analysis, travel, transfer, email-forward) rather than on record storage, which the market prices at $0.

## Positioning recommendation

Do not position as "AI pet records app" (crowded, free-anchored). Position as **the pet's permanent, portable medical record that survives changes of owner, vet, and insurer**: records in by any path (email-forward, upload, soon vet request), records out always (export free forever), record travels at adoption. The adoption-transfer loop doubles as the acquisition channel breeders/rescues hand to new owners, which is the closest thing a consumer app has to PetDesk's clinic channel. The $29 breeder tier is coherent with this: breeders pay for tooling, buyers arrive free, some convert to $6 household.

## Open questions for a follow-up pass

1. Structured review-mining of PetDesk/VitusVet/Great Pet Care/AI entrants for churn drivers (not completed this pass).
2. Hands-on evaluation of MyPetID's extraction and Q&A quality, and its monetization intent. Biggest pricing threat.
3. Great Pet Care's pricing/traction post-Pawprint; whether 11pets, Airvet, or Banfield-style chain portals change the table-stakes picture (not covered by surviving claims).
4. Breeder/rescue channel economics to validate the $29 tier and the transfer acquisition loop (e.g. Petstablished install base).

## Key sources

Primary: getpawprint.com (redirect), account.greatpetcare.com, mypetid.ai, petrecord.ai, petvax.ai, vetrecord.app, petdesk.com (+ App Store id631377773), vitusvet.com (+ App Store id955252538), petstablished.com, tgmresearch.com/pet-tech-report.html. Secondary: Newsweek Readers' Choice 2026. Review forums: justuseapp.com (11pets, PetDesk).
