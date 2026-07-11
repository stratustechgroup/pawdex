# Pawdex pricing strategy

Status: proposal for founder review. Prices are set in code at
`lib/billing/plans.ts` (single source of truth). Nothing here is billed until
Stripe keys are present; see `docs/billing.md`.

## The one-sentence version

Three tiers. **Free forever** is a real home for one or two pets, not a trial.
**Household** at $6/mo (or $60/yr) unlocks unlimited pets and unlimited
document AI for the multi-pet family. **Breeder** at $29/mo flat is the
operator tier: litters, placement transfers with full history, kennel branding,
and multi-user, priced against breeder software rather than against consumer
apps. Everyone on today's waitlist gets **Early access**: everything free
during beta, with a grandfathered discount at launch.

## What comparable products charge

| Product | Shape | Price | Notes |
|---|---|---|---|
| 11pets | Consumer pet care, freemium | Free + ~€69/yr (~$6/mo) premium | Free tier is generous; premium adds storage, vet support |
| Breedera | Breeder software, freemium | Free + £9.99/mo (~$12.50) or £99.99/yr | Free plan covers adult profiles, matings, export; paid adds litters/puppies |
| ZooEasy | Pedigree/breeder, per-seat | From ~$6/mo; free ≤25 animals | Multi-user is per-account add-ons (management €10.63, breeder €1.34, reader €0.58 each), the nickel-and-diming we want to avoid |
| BreederCloud Pro | Breeder software | Tiered monthly (mid-tens) | Kennel-scale operators |
| Flighty | Prosumer consumer SaaS | ~$4/mo billed annually (~$48/yr) | The anchor for "a personal app worth paying for" |
| 1Password Family | Prosumer household SaaS | ~$5/mo | Household-priced, unlimited members |

Two anchors matter. On the **consumer** side, prosumer apps that people
genuinely pay for (Flighty, 1Password) sit at $4-6/mo, that is the ceiling for
a pet-records app aimed at a family. On the **breeder** side, dedicated
software runs $10-40/mo and buyers already expect a monthly business expense,
which is why Breeder can be a multiple of Household without friction.

Note ZooEasy's per-account model as a cautionary tale: an individual breeder
who adds a co-breeder and a puppy-buyer "reader" is billed three separate line
items. It optimizes revenue per seat and taxes exactly the collaboration a
breeder tool should encourage. We do the opposite (see Breeder, below).

## The record is never the product we charge for

This is a hard rule, already promised in the FAQ and Terms: **viewing and
exporting a pet's record is always free, on every tier, forever.** Downgrading
from Household to Free never deletes a pet, never hides history, never holds an
export hostage. What paid tiers sell is *leverage over the record*, unlimited
document AI, priority ingestion, insurance tooling, breeder operations, not
access to the data itself. Entitlements enforce capacity and convenience, never
retention. `lib/billing/entitlements.ts` encodes this: a pet over the Free cap
is read-only-add-blocked at most, never deleted or locked.

## Free (forever)

The default home for a one- or two-pet household. Generous on purpose: this is
the tier that has to be good enough that most people never feel squeezed, so
that the ones who upgrade do it because they have three pets or want unlimited
AI, not because we crippled the free product.

- Up to **2 pets**
- Full records, reminders, and sharing, no caps, no watermark
- **10 document AI extractions / month** (forwarded or uploaded)
- Export and view: unlimited, always free

The document-AI allowance is the one metered thing, because AI extraction is
our real per-unit cost. Ten a month covers a typical pet's vet cadence with
headroom; a multi-pet or heavy-forwarding household bumps into it and that is
the honest upgrade trigger.

## Household, $6/mo, or $60/yr (2 months free)

For the multi-pet family that wants Pawdex to be the system of record.

- **Unlimited pets**
- **Unlimited** document AI extractions
- Priority ingestion (front of the extraction queue)
- Insurance tools (policy analysis, PEC review, claim tracking)
- Travel packets (EU passport / health-certificate bundles)
- Everything in Free

$6/mo lands between 11pets' ~$6 and Flighty's ~$4, and the $60 annual (a clean
"2 months free") is the price we actually want people on, annual reduces churn
and prepays the AI cost we carry. Naming: **Household**, not "Pro" or "Plus."
It says who it is for (a family with pets), matches the app's core noun
(households already exist in the schema), and pairs cleanly with Breeder as
"the two things Pawdex is for."

## Breeder, $29/mo flat

The operator tier. Priced against breeder software, not against consumer apps,
because the buyer is running a business and evaluates it next to Breedera and
ZooEasy, not next to a free phone app.

- **Litters**: whelping records, per-puppy weights, feeding/treatment logs
- **Placement transfers** with full medical history handed to the new owner
- **Kennel branding** on transfer documents and buyer-facing packets
- **Multi-user**: co-breeders and staff at no per-seat charge
- Everything in Household (unlimited pets, unlimited AI, insurance, travel)
- Soft cap: **50 active animals**, then a friendly "let's talk" (never a hard lock)

### Flat vs per-pet vs per-user, the pricing-model decision

The lead asked us to argue this honestly, not just assert it. Three candidates:

**Per-pet (or per-litter).** Revenue scales with the customer's success, which
sounds fair. It is the worst choice for *this* product. A breeder's animal
count swings hard and seasonally, a spring litter of eight puppies can 3x the
active-animal count for two months. Per-pet billing turns "I had a good litter"
into "my bill tripled," which punishes exactly the event the tool exists to
manage and makes the monthly cost impossible to predict. It also creates a
perverse incentive to *not* record animals to keep the bill down, corrupting
the completeness of the record that is our whole value. Rejected.

**Per-user (seat-based).** This is ZooEasy's model, and it taxes
collaboration: every co-breeder, kennel partner, or puppy-buyer you invite is
another line item. For a small breeder operation, usually a couple, maybe one
helper, seat pricing is friction with no upside to the customer, and it
discourages the multi-user workflows that make the tool sticky. Rejected for
the core price (multi-user is *included*).

**Flat monthly with a soft active-animal cap.** One predictable number.
Litters don't change it, inviting a co-breeder doesn't change it, a good season
doesn't punish you. The soft cap (50 active animals) exists only so a genuine
commercial kennel at a different scale becomes a conversation rather than an
unbounded free-rider, and it is soft, meaning we surface a prompt, never lock
the record. This is the trust-maximizing choice: the breeder can predict the
cost, grows into the tool instead of away from it, and never feels metered on
the thing they came to record. **Recommended.**

$29/mo sits below BreederCloud Pro and above Breedera's single-plan price,
which is the right position: cheaper than the heavyweight, more capable
(placement transfers, medical-history handoff, kennel branding) than the
lightweight, and a rounding error against the price of a single puppy.

## Early access (current users and waitlist)

Everyone using Pawdex today, and everyone on the waitlist, is on **Early
access**: every feature of every tier, free, for the duration of the beta. At
launch, early-access users are grandfathered onto a standing discount on
Household/Breeder as thanks for trusting us first. This is stated on the
pricing page and is the honest reason the page leads with a waitlist CTA rather
than a checkout button, there is nothing to buy yet, and we are not going to
pretend otherwise.

In the data model, `households.plan = 'early_access'` maps to unlimited
entitlements (see `entitlements.ts`), independent of `households.kind`. A
personal household and a breeder household are both `early_access` today; the
`kind` flag governs which *features* show up (breeder tooling), while `plan`
will govern *entitlements* once billing goes live. Keeping them separate is
deliberate: a breeder can exist during early access without a paid Breeder
plan, and at launch a breeder household simply needs the Breeder plan to keep
its breeder features unlocked.

## Why these numbers, in one paragraph

Free has to be a real home or the trust promise ("your records, for life") is a
lie, so it is genuinely generous and only meters the one thing that costs us
money (AI). Household is priced where proven prosumer apps live ($4-6) so the
multi-pet family upgrades without deliberation. Breeder is priced where its
buyer already shops ($10-40 breeder software) and uses a flat rate so the tool
never punishes a good litter or a new collaborator. Every tier keeps the record
itself free to view and export, forever, because that promise is the product.
