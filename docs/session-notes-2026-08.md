# Session notes — launch verification pass (Jul 30 – Aug 15, 2026)

Working notes from a pre-launch verification session. Complements
`docs/launch-readiness.md` (the checklist) with what was actually run and found.

## Repo state at end of session

`origin/main` == local `main` == `04847fa` (Jul 16). Nothing committed-but-unpushed.
Production deploy matches HEAD.

Uncommitted work in the tree:

| File | Change | Verified |
|------|--------|----------|
| `lib/ai/embeddings.ts` | Embeddings routed OpenAI → OpenRouter | Yes, live |
| `lib/ai/extraction-indexer.ts` | Key guard now checks `OPENROUTER_API_KEY` | Yes |
| `DEPLOY.md` | Env table updated for OpenRouter embedding vars | n/a |
| `docs/launch-readiness.md` | Full rewrite: 12-section Gate A/Gate B checklist | n/a |
| `scripts/test-households-e2e.mjs` | Retry-until-ready click (fixed test race) | Yes, 38/38 |
| `scripts/test-embeddings-live.ts` | New: live OpenRouter embedding check | Yes, 5/5 |

Deploying the embeddings change turns on doc Q&A (Ask) indexing, which has
never run in production. Already-committed documents need a one-time backfill
afterward.

## Verification results (Aug 4)

All green:

- `tsc --noEmit` clean; 10 unit suites pass; production build clean
- Households e2e 38/38 (login, bootstrap, multi-household, isolation, invites, audit, self-clean)
- Cockpit walk: dashboard, pets, inbox, expiring, reminders, insurance all render with seeded data
- Email webhooks 17/17; billing webhooks 12/12 (incl. idempotent redelivery)
- Waitlist throttle 4/4; insurance live (real LLM) 72/72
- Embeddings via OpenRouter 5/5, 1536-dim, ~400ms
- Live site: 12 public pages 200, sitemap/robots/OG/llms.txt good, TTFB ~161ms

Two failures found and fixed, neither a product bug:
1. Households flip-back failure was a test race (action succeeded; test clicked
   before `router.refresh()` repainted).
2. Local `.env.local` had stale `RESEND_FROM_EMAIL=reminders@pawdex.app`; fixed
   to `@pawdex.co`.

Not verified: deletion flows (`scripts/test-deletion-e2e.mjs` has never run
against a real DB). Known Gate A item.

## Security audit (Aug 4)

0 critical, 1 high, 2 medium, 2 low.

- **HIGH** — Next.js 16.2.6 has 4 high advisories, patched in 16.2.11. Includes
  App Router middleware bypass and Server Actions SSRF. Impact blunted by
  per-action auth + RLS, but upgrade before launch.
- **MED** — 29 transitive vulns re-accumulated since July. Extend `pnpm.overrides`:
  `brace-expansion>=1.1.17`, `fast-uri>=3.1.5`, `js-yaml>=5.2.2`,
  `postcss>=8.5.18`, `sharp>=0.35.0`, `ip-address>=10.3.1`.
- **MED** — CSP still report-only with `'unsafe-inline'` scripts.
- **LOW** — Rate limiter in-process, resets on cold start (acceptable; tokens are 192-bit).
- **LOW** — `path.includes(".")` in `lib/supabase/middleware.ts:63` marks any dotted
  path public. Not exploitable (RLS + per-page checks) but widens middleware surface.

Verified strong: RLS on all 45 tables fail-closed (live-confirmed anonymous reads
return zero rows), service-role server-only across 30 files, svix HMAC with
`timingSafeEqual` on webhooks, 192-bit hashed tokens with expiry/revocation,
open-redirect guarded in `app/auth/callback/route.ts:38`, 31 viewer-role guards,
security headers live incl. HSTS.

## Production env gaps (checked against Vercel, 13 vars set)

Missing entirely: `RESEND_API_KEY`, `RESEND_WEBHOOK_SECRET`, `RESEND_INBOUND_SECRET`,
all Stripe keys, any error-tracking DSN.

Set but empty: `RESEND_FROM_EMAIL=""`. Set it when adding the API key or sends
fail even with a valid key.

`OPENROUTER_API_KEY` is set, so the embeddings change works on deploy.

## Monitoring plan (discussed, not built)

Token tracking: all 10 LLM call sites (`extract-document.ts`, `extract-policy.ts`,
`pec-refine.ts`, `qa.ts`) discard `result.usage`. Extractions table stores `model`
but no tokens or cost. Proposed `ai_usage` table (feature, model, input/output
tokens, `cost_microusd`, latency, household_id, document_id) written
fire-and-forget via service client. OpenRouter returns exact cost in provider
metadata, so no price tables needed. Answers: cost per document, per household
per month, tier-escalation rate, spend by feature.

Related risk: `canEnforce()` in `lib/billing/entitlements.ts:118` returns false,
so the 10-extraction/month free limit displays but never blocks. No ceiling on
LLM spend from a hostile uploader. A per-household daily ingestion cap is cheap
insurance even with billing off.

Priority order for the rest: (1) Sentry, (2) cron dead-man's-switch via
healthchecks.io — a cron that never runs throws no error, (3) uptime monitor +
`/api/health` endpoint (neither exists), (4) email bounce/complaint rates once
Resend is on, (5) Vercel function duration/error/CPU + log drain, (6) Supabase
size/connections/egress, (7) 429 counts and webhook signature rejections.

Sentry: confirmed not installed (no package, no `instrumentation.ts`, no capture
calls). Setup is `npx @sentry/wizard@latest -i nextjs` plus a DSN in Vercel env;
requires the user to create the account/project first.

## Aug 15 — shipped, and what it cost to learn

Pushed and deployed: OpenRouter embeddings + tooling, households test fix, docs,
Next.js 16.2.6 -> 16.2.12, and migration 0037.

**Push auto-deploys.** A Vercel Git integration exists on this project. An
earlier note here said deploys were manual CLI only; that was wrong. The check
that produced it (`vercel ls` immediately after a push) ran before Vercel had
registered the build. The tell is the `pawdex-git-main-*` alias on the
deployment. Consequence: the pre-push gate is the only gate, so lint and the
e2e suites belong in CI, or work should go through a PR branch.

**Ask needed two fixes, not one.** Deploying the embeddings change turned
indexing on, but retrieval was still broken by the ivfflat index (see
launch-readiness section 1). Found only by re-running the retrieval test after
the backfill — the bug is invisible while the table is small, because the
planner picks a seq scan and gets the right answer.

**Applying a migration without dragging 0034 along:** `supabase db push` applies
everything pending, and 0034 (purge cron) must stay unapplied until deletion is
verified. Procedure used: move 0034 out of `supabase/migrations/`, run
`supabase db push --dry-run` and confirm the list, push, move it back. Verified
after: `supabase migration list` shows 0034 as the only unapplied one.

**Verification limit worth stating:** retrieval was proven end to end against
the production database using a throwaway ZZTEST household. The founder's real
household was not queried, because that needs their session. The 359 real
chunks were verified structurally (count, coverage, dimensions, no nulls).

## Launch gates

**Gate A (free public launch):** email keys + domain auth; deploy embeddings and
backfill; error tracking + uptime; verify deletion e2e, enable Supabase
Reauthentication template, arm purge cron (migration 0034, written but
deliberately unapplied); product analytics; mobile fixes from `docs/mobile-audit.md`.

**Gate B (charge money):** form the legal entity first (gates DMCA agent,
business address, Stripe onboarding); lawyer pass on Terms for
arbitration/class-waiver; Stripe keys + flip `canEnforce()`; confirm subprocessor DPAs.

## Open decisions

- Commit strategy for the uncommitted work (suggested: embeddings change and
  docs rewrite as separate commits)
- Whether to build `ai_usage` + `/api/health` now
- Sentry account creation (blocked on user)
