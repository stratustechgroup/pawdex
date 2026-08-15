# Pawdex Launch Readiness

A go-to-market checklist for a modern consumer SaaS, with Pawdex assessed against
each item. Written July 16, 2026. Verified against source and the live Vercel
production environment, not from memory. Status meanings:

- **READY** — done, no action needed to launch.
- **PARTIAL** — mostly there, a specific gap remains.
- **GAP** — standard practice, not done, should be before launch.
- **BLOCKER** — launch (of the relevant kind) should not happen without it.

There are two different "launches," and the bar is different for each:

- **Gate A — open the free product to the public** (beyond the current waitlist).
- **Gate B — charge money** (turn on paid plans).

## Top-line verdict

The engineering and security posture is strong for a pre-launch product; the gaps
are operational and commercial, not architectural.

**Gate A blockers (free public launch):**
1. Outbound email is off in production (`RESEND_API_KEY` unset). Reminders, the
   contact form notification, records requests, and insurer emails all silently
   do nothing. Reminders are a core feature, so this is the headline blocker.
2. No error monitoring or uptime alerting. You would not know the site was broken
   until a user told you.
3. Email-forward ingestion is refused in production (`RESEND_INBOUND_SECRET`
   unset), an advertised capability that currently no-ops. (Doc Q&A indexing was
   the other one; it is fixed by routing embeddings through OpenRouter and lights
   up on the next deploy.)
4. The deletion flows shipped but are runtime-unverified, and the OTP re-auth
   depends on a Supabase email template that has not been confirmed enabled.

**Gate B blockers (charging money):** billing is dormant (no Stripe keys,
enforcement hard-off), no legal entity is formed, and the Terms lack an
arbitration/class-waiver clause. None of these should be crossed until resolved.

---

## 1. Product readiness

Standard practice: the core loop works end to end for a new user; advertised
features actually function; empty and error states are handled; a new user can
reach first value without help.

- Core record loop (ingest, extract, review, commit, view). **READY.** Verified
  working; the human-in-the-loop commit gate is sound.
- Doc Q&A (Ask). **READY.** Shipped and verified Aug 15. Embeddings route
  through OpenRouter (`openai/text-embedding-3-small` via the existing
  `OPENROUTER_API_KEY`), indexing runs on every commit, and the 23 previously
  committed extractions were backfilled (359 chunks across 23 documents,
  all 1536-dim).

  Two defects had to be fixed to get here, both invisible until the feature was
  actually exercised end to end:
  1. Indexing had never run in production, because it required `OPENAI_API_KEY`
     which was never set. Routing through OpenRouter fixed it.
  2. Retrieval returned almost nothing even once chunks existed. The ivfflat
     index from 0010 was built on an empty table, so its centroids were
     meaningless and `probes = 1` searched one of 100 degenerate lists.
     Measured 1-of-50 recall. Migration 0037 drops it in favour of an exact
     scan within each household. Now 100% recall, verified by
     `scripts/test-qa-index-e2e.ts`.

  The lesson worth keeping: every earlier check confirmed the feature failed
  *safely*, and none confirmed it *worked*. Negative-space testing hid two
  separate defects behind a green board.
- Email-forward ingestion. **GAP.** The inbound webhook refuses events in
  production without `RESEND_INBOUND_SECRET`. Upload still works; forwarding does
  not.
- Deletion / restore / CCPA hard-delete. **PARTIAL/BLOCKER for the feature.**
  Shipped and schema applied, but never runtime-tested, and the account/household
  OTP needs the Supabase Reauthentication email template enabled. Treat as beta
  until `scripts/test-deletion-e2e.mjs` passes against a real DB.
- Onboarding to first value. **VERIFY.** Confirm a brand-new user can add a pet
  and commit a document without a dead end; the perceived-performance work
  (skeletons, prefetch) helps here.

## 2. Security

Standard practice: no critical/high vulns; auth enforced server-side; secrets not
in the client; dependencies patched; abuse throttled.

- Application security. **READY.** A multi-agent audit this session closed a
  privileged-column write escalation (migration 0035), a systemic viewer-role
  gap across 14 actions, a cross-household share-link IDOR, a stored XSS, and
  added security headers (CSP report-only), rate limiting, constant-time secret
  compares, and cookie flags.
- Dependencies. **READY.** `pnpm audit` clean after pinning five transitive CVEs.
- RLS / tenant isolation. **READY.** Fail-closed across all household tables;
  service-role clients constructed only after signature/secret verification.
- CSP. **PARTIAL.** Shipped as report-only. Flip to enforced after it soaks.
- Rate limiting. **PARTIAL.** In-process sliding window; not distributed, resets
  on cold start. Fine as defense-in-depth, thin against a coordinated flood.
- Penetration test / third-party review. **GAP (optional pre-launch).** Not
  required for a consumer beta; expected later for enterprise or research-data
  buyers.

## 3. Legal & compliance

Standard practice: enforceable Terms with liability limits and dispute terms;
privacy policy; correct licensing posture; entity formed.

- Terms assent. **READY.** Sign-in-wrap with Terms + Privacy links and an 18+
  attestation (upgraded from browsewrap this session).
- Arbitration + class-action waiver. **BLOCKER for Gate B, GAP for Gate A.**
  Missing entirely; the single biggest litigation-cost exposure. Needs a lawyer.
- Indemnification, venue specificity, DMCA designated agent. **GAP.** DMCA agent
  is a ~$6 filing; the rest are lawyer text. DMCA and the physical-address
  requirement are blocked on forming the entity.
- Legal entity. **BLOCKER for Gate B.** No LLC formed yet; this gates the DMCA
  agent, the required business address (also CAN-SPAM), and Stripe onboarding.
- Compliance posture (CCPA, CAN-SPAM, COPPA, vet-practice boundaries). **READY.**
  Documented in `docs/compliance-audit.md` (GREEN across the shipping surface;
  the future insurance claim-filing feature is flagged for public-adjuster review
  before it ships).
- Accessibility statement honesty. **PARTIAL.** The statement claims axe runs; the
  script exists but is not wired into CI. Run it before launch or wire it in.

## 4. Privacy & data governance

Standard practice: honest privacy policy; data-subject rights; subprocessor
agreements; a defined retention posture.

- Privacy policy + US-only GDPR posture. **READY.** Documented in
  `docs/gdpr-posture.md`; no third-party trackers, cookieless analytics, so no
  cookie banner needed.
- CCPA delete/export rights. **READY (mechanism), PARTIAL (verification).**
  Self-serve deletion + 30-day retention + export-before-delete implemented; the
  flows need the runtime test above.
- Subprocessor DPAs (Vercel, Supabase, OpenRouter, OpenAI, Resend, Stripe).
  **GAP/VERIFY.** Flagged in the compliance audit as unconfirmed. Confirm signed
  DPAs are on file before handling real user data at scale.
- Purge automation. **GAP.** The daily hard-purge cron (migration 0034) is
  written but deliberately not applied. Arm it (with the vault secrets) once
  deletion is verified, or soft-deleted data never actually purges.

## 5. Billing & monetization

Standard practice: payment provider live and tested; entitlements enforced;
subscription lifecycle (upgrade, downgrade, cancel, refund, dunning) handled;
auto-renew disclosures compliant.

- Payments. **BLOCKER for Gate B.** Stripe is wired but dormant: no
  `STRIPE_SECRET_KEY` in production, so `isBillingEnabled()` is false. You cannot
  charge anyone today.
- Entitlement enforcement. **BLOCKER for Gate B.** `canEnforce()` is hard-coded to
  return false. Limits (free = 2 pets, 10 AI extractions/mo) are computed and
  displayed but never block. Flip on with tests before charging.
- Subscription-law compliance (CA ARL, card-network rules). **PARTIAL.** Terms and
  checkout consent block are written and compliant per the audit; the refund
  policy still needs founder sign-off.
- Dunning / failed-payment handling. **GAP.** Verify the webhook path handles
  payment failures and subscription state transitions before charging.

## 6. Infrastructure & reliability

Standard practice: known scaling model; database backups with a tested restore;
a rollback path; secrets managed; region/latency understood.

- Hosting & region. **READY.** Vercel functions pinned to `pdx1`, co-located with
  Supabase `us-west-2`.
- Database backups / PITR. **VERIFY.** Supabase provides managed backups; confirm
  the plan's retention and, once, actually test a restore. Not documented today.
- Rollback. **PARTIAL.** Vercel keeps prior deployments (instant rollback), but
  deploys are run manually (`vercel --prod`) with no promote/preview gate.
- Migrations discipline. **READY.** Additive, versioned, applied via CLI with a
  dry-run; 0034 deliberately deferred.
- Secrets management. **READY.** Env-based, service-role server-only, vault for
  cron secrets. But see the missing-keys gaps in section 8.

## 7. Observability & operations

Standard practice: error tracking, uptime monitoring, structured logging,
alerting, a health check, and an incident process.

- Error tracking. **GAP (near-blocker for Gate A).** No Sentry or equivalent. You
  currently have no way to know a server action is throwing for real users.
- Uptime / synthetic monitoring. **GAP.** No external uptime check or alerting.
- Health endpoint. **GAP.** None; add a lightweight `/api/health` for monitors.
- Logging. **PARTIAL.** `console` logs land in Vercel logs; no structured logging
  or log retention strategy.
- Incident response. **GAP.** No runbook for "the site is down" or "a key
  leaked," and no status page. `DEPLOY.md` is a good operational base to extend.

## 8. Email & communications

Standard practice: a verified sending domain with SPF/DKIM/DMARC; transactional
email actually delivering; inbound handling; deliverability monitored.

- Outbound email. **BLOCKER for Gate A.** `RESEND_API_KEY` is not set in
  production. Every send path (reminders, contact notification, records requests,
  insurer clarifications) silently no-ops. This is the most surprising gap in the
  audit given reminders are a headline feature.
- Delivery + inbound webhook secrets. **GAP.** `RESEND_WEBHOOK_SECRET` and
  `RESEND_INBOUND_SECRET` are unset in production, so delivery tracking and
  email-forward ingestion are refused by the production fail-closed gates.
- Sending-domain auth (SPF/DKIM/DMARC). **VERIFY.** `RESEND_FROM_EMAIL` is set;
  confirm the domain is verified in Resend and DNS records are in place, or mail
  lands in spam.

## 9. Growth, SEO & analytics

Standard practice: discoverable pages, structured data, a measurable activation
funnel, and marketing content.

- SEO / AEO. **READY.** Sitemap, robots, per-page metadata, JSON-LD
  (Organization, WebSite, SoftwareApplication, FAQPage), and `llms.txt` shipped.
- Marketing site. **READY.** Home, pricing, about, contact live; positioning
  informed by `docs/competitive-landscape.md`.
- Product analytics. **GAP.** Only Vercel Web Analytics (page-level, cookieless).
  No funnel/event analytics (PostHog/Amplitude), so activation and retention are
  not measurable. Important the day you start acquiring users.
- Conversion instrumentation (waitlist to active). **GAP.** Tie to the analytics
  above.

## 10. Support & customer success

Standard practice: a support channel, a help center, and defined response
expectations.

- Support channel. **READY.** Contact page + form (persists to `contact_messages`
  and, once email is on, notifies support). A few in-app help pages exist.
- Help center / docs. **PARTIAL.** Thin. Fine for a small beta; expand as volume
  grows.
- Response SLA. **VERIFY.** The contact page promises "a few business days";
  make sure someone actually watches the inbox / table.

## 11. Accessibility & mobile

Standard practice: WCAG-reasonable, keyboard-navigable, mobile-usable, ideally
installable.

- Accessibility. **PARTIAL.** Decent posture on public pages (skip links,
  landmarks, labeled inputs); the authenticated app forms were not deeply
  audited, and axe is not in CI.
- Mobile web. **PARTIAL.** Audited (`docs/mobile-audit.md`); fixes not yet
  applied: sub-16px inputs cause iOS zoom, several touch targets under 44px,
  dialogs lack scroll caps, one fixed-width surface overflows at 360px, and the
  marketing header has no mobile hamburger.
- PWA / installable. **GAP.** No `manifest.json`, so Android will not offer
  Install. Relevant given the stated "web until a native app exists" plan.

## 12. Launch mechanics

Standard practice: CI gates on quality; a staging environment; a rollout plan; a
comms plan.

- CI. **PARTIAL.** `.github/workflows/ci.yml` runs typecheck, tests, and build on
  push/PR to main with dummy secrets. It does not run lint, and there is no
  deploy gate (deploys are manual). Add `eslint` to CI.
- Staging environment. **GAP.** No separate staging/preview database; migrations
  and the deletion e2e have nowhere safe to run before production.
- Rollout plan. **VERIFY.** Decide batch sizes for opening the waitlist and a
  kill-switch/feature-flag for anything risky (deletion, billing).

---

## The short list

**Before Gate A (open the free product):**
1. Set `RESEND_API_KEY` (+ `RESEND_WEBHOOK_SECRET`, `RESEND_INBOUND_SECRET`) in
   production and confirm domain auth. Email is a core feature and is off.
2. Deploy the embeddings-via-OpenRouter change so Ask indexing works, then
   backfill the index for already-committed documents.
3. Add error tracking (Sentry) and an uptime monitor with alerting.
4. Verify the deletion flows end to end and enable the Supabase Reauthentication
   template; arm the purge cron.
5. Add product analytics so you can see whether launch is working.
6. Apply the pending mobile fixes; wire axe into CI or soften the a11y statement.

**Before Gate B (charge money):**
1. Form the legal entity.
2. Lawyer pass on Terms: arbitration + class-action waiver, indemnification,
   refund policy sign-off; register a DMCA agent; add the business address.
3. Turn on Stripe (keys) and flip entitlement enforcement (`canEnforce`) with
   tests; verify dunning and subscription lifecycle.
4. Confirm subprocessor DPAs are signed.

**Strong today:** application security, tenant isolation, dependency hygiene,
SEO/AEO, the marketing surface, the core record loop, and the compliance posture
for the shipping feature set.
