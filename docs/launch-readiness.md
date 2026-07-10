# Launch readiness

Owner: launch-readiness team (Task #17). Scope: legal, accessibility, performance,
analytics, CI, waitlist rate limiting, SEO/sharing, domain strings, ops scripts.

All verification was done against a local production build (`pnpm build && pnpm start`
on port 3500) pointed at the live Supabase project. No code was committed, no
migrations pushed, nothing deployed. The lead owns commit and deploy.

## Status by workstream

| # | Stream | Status | Evidence |
|---|--------|--------|----------|
| 1 | Legal (CCPA/CPRA) | Done | `/privacy`, `/terms`, `/accessibility` render 200 anonymously, prerendered static. Written honest to the product (see notes). |
| 2 | Accessibility (WCAG 2.1 AA) | Done | axe-core: 0 serious / 0 critical on all audited pages, light and dark, anon and authed. Before/after below. |
| 3 | Performance | Done | Middleware fast path for anonymous traffic; fonts and static prerender assessed. Numbers below. |
| 4 | Analytics | Done | `@vercel/analytics` + `@vercel/speed-insights` mounted in `app/layout.tsx`. Founder must enable Web Analytics in Vercel. |
| 5 | CI | Done | `.github/workflows/ci.yml`. Dry-run of tsc + test + build with dummy env and no `.env.local` all passed. |
| 6 | Waitlist rate limiting | Done | No-migration global-window throttle in `lib/db/waitlist.ts`. Behavioral test passes, rows self-cleaned. |
| 7 | SEO / sharing | Done | `metadataBase`, canonical, OG + Twitter tags, `opengraph-image` (renders, verified visually), `apple-icon`, `icon.svg`, `sitemap.xml`, `robots.txt` all render. |
| 8 | Domain strings (pawdex.app to pawdex.co) | Done | Every code/test/doc occurrence migrated; zero residual `pawdex.app`. One pre-existing bug flagged (below). |
| 9 | Ops scripts | Done | `scripts/backup-storage.ts` (25 objects / 21 MB downloaded, read-only) and `scripts/waitlist-export.ts` (clean CSV) both run against prod. |

## 1. Legal

Three server components in the marketing shell: `app/(marketing)/privacy/page.tsx`,
`/terms/page.tsx`, `/accessibility/page.tsx`, sharing `components/marketing/legal-shell.tsx`
and readable prose styles in `marketing.css`. Footer now links all three.

Claims were checked against what the code actually does before being written:

- **De-identified research**: the product implements this (`research_consents` table,
  migration 0027; opt-in in the transfer flow, off by default, revocable). The policy
  describes it exactly that way, plus the public commitment never to re-identify
  de-identified data (the CPRA condition for de-identified treatment).
- **Global Privacy Control**: there is no GPC handling in code, and there does not
  need to be, because Pawdex does not sell or share personal information. The policy
  states this honestly: with nothing to sell or share, a GPC signal has nothing to
  opt out of, and we honor it as a matter of course. This is truthful, not a claim of
  a code path that does not exist.
- **Service providers**: Vercel, Supabase, OpenRouter, Resend, matching the real stack.

## 2. Accessibility

Audited with axe-core (WCAG 2.0/2.1 A + AA rules) over CDP against the local prod
build, in both light and dark themes, anonymous and authenticated (ZZTEST session via
admin magic link). Runner: `scripts/launch-axe.mjs`.

Serious + critical counts, before and after:

| Page | Before (serious/critical) | After |
|------|---------------------------|-------|
| Marketing home (`/home`, dark) | 1 critical + 15 serious nodes | 0 / 0 |
| Marketing home (`/home`, light) | 8 serious nodes | 0 / 0 |
| Privacy / Terms / Accessibility | n/a (new) | 0 / 0 |
| Login | 0 / 0 | 0 / 0 |
| Dashboard (`/`, empty state, light + dark) | 1 serious node | 0 / 0 |
| Dashboard (`/`, populated: pet card + reminders + policy, light + dark) | not separately audited before | 0 / 0 |
| Account (`/settings/account`, light + dark) | up to 3 serious nodes | 0 / 0 |

What was fixed:

- Skip-to-content link + `main` landmark on both shells (`.mk-skip`, `.pw-skip`).
- `role="tablist"` removed from the lifecycle CSS-radio tabs (it required `role="tab"`
  children it never had). Native radios carry the semantics.
- Dark-theme accent buttons: the dark `--pw-accent` (#4A9472) is too light for white
  text at small sizes (about 3.3 to 3.6:1). Added `.pw-accent-fill` (app) and dark-mode
  `.mk-btn` / active-tab overrides (marketing) that pin the darker brand green. Token
  values were not changed, only usage.
- Marketing amber (`--mk-amber`) made theme-aware: darker on the cream surface (was
  3.65 to 3.85:1 for eyebrows and claim indices), warmer on the dark surface.
- FAQ numbers and tab indices moved from `--pw-text-subtle` to `--pw-text-muted` /
  full opacity to clear AA on the dark surface.
- Account page: support mailto underlined (link-in-text distinguishability), connected-
  accounts subtext moved from muted to secondary (was 4.45:1 on surface-2).

`app/(app)` edits were accessibility-only (attributes, class, single color token), no
visual redesign.

## 3. Performance

Measured, not assumed. Local prod build, anonymous `/`:

| | TTFB (warm) | Notes |
|-|-------------|-------|
| Live `https://www.pawdex.co/` before | ~150 to 220 ms warm, ~1.1 s cold | serverless invocation + network; cold start is the visible cost |
| Local `/` before (anon) | ~4 to 6 ms | already fast |
| Local `/` after (anon, fast path) | ~2.5 to 3.5 ms | rewrite preserved, gate preserved |

Honest finding that corrected the original hypothesis: `supabase.auth.getUser()` does
**not** make a network round trip for an anonymous visitor, because with no `sb-*`
auth cookie there is no token to validate and supabase-js returns null immediately.
So the middleware was not making a per-request Supabase call for marketing traffic in
the first place. The fast path (`lib/supabase/middleware.ts`) still helps: for any
request with no auth cookie it reproduces the signed-out routing (rewrite `/` to
`/home`, gate protected paths, pass through public ones) without constructing the
Supabase client at all. The measurable win is small at the median and real at p99 and
at scale (no client construction or cookie parsing on anon requests, and the anon path
is provably independent of Supabase auth availability). The cookie-present path is
unchanged; a logged-in session still refreshes and reaches the app (verified: the
authenticated dashboard renders "Good afternoon, ..." with a live session).

Other findings:

- `/home` is already statically prerendered (`○` in the build). The middleware rewrite
  serves that static page, so there was no per-request marketing render to fix.
- Fraunces axes (opsz/SOFT/WONK): **kept.** The design actively uses SOFT (40/60/30)
  and WONK (1) across every display heading (`marketing.css`), so dropping them is a
  real visual change, not dead weight. The 118 KB variable woff2 is load-bearing.
- The ~1.1 s cold start on the live site is the more visible "feels slow" signal. That
  is infrastructure (keep-warm, function cold boot), not a code change for this pass.
  Recommended as a founder/infra follow-up.

## 4. Analytics

`<Analytics />` and `<SpeedInsights />` mounted in `app/layout.tsx` via the v2 `/next`
subpaths. If events 404 after deploy, the founder must flip on Web Analytics (and Speed
Insights) in the Vercel dashboard for the project.

## 5. CI

`.github/workflows/ci.yml`: checkout, pnpm (via `packageManager` field added to
`package.json`), Node 20 with pnpm cache, `install --frozen-lockfile`, `tsc --noEmit`,
`pnpm test`, `pnpm build`. Triggers on push and PR to `main`. Dummy env vars are set at
the job level so the build and tests run without any real secrets.

Dry-run locally with `.env.local` hidden and only the dummy vars set: tsc PASS, test
PASS (65 assertions, RESULT PASS), build exit 0. The unsubscribe-token test needs
`REMINDER_UNSUBSCRIBE_SECRET`; it reads env first, so the CI dummy value satisfies it.

## 6. Waitlist rate limiting

Chose the no-migration option. `lib/db/waitlist.ts` counts signups across the whole
table in the last 10 minutes; at 30 or more it returns `rate_limited` and the action
shows a polite "try again in a few minutes" message. Per-email dedup (unique index) and
the form honeypot are unchanged. Fails open if the count query errors (the throttle is a
backstop, not the gate).

Behavioral test: `scripts/test-waitlist-ratelimit.ts` (wired into `pnpm test:live`).
Seeds 30 ZZTEST rows, asserts the 31st is throttled, asserts signups resume after the
window clears, and cleans up in a `finally`. Verified 0 `zztest-ratelimit` rows remain.

## 7. SEO / sharing

- `metadataBase = https://www.pawdex.co` in the root layout; canonical + OG + Twitter
  card in the marketing layout.
- `app/(marketing)/opengraph-image.tsx`: 1200x630 PNG, brand shield-paw mark + wordmark
  + tagline on the cream field with the green base bar. Rendered and inspected visually
  (the paw mark is embedded as a data-URI image to avoid Satori's path-rendering limits).
- `app/apple-icon.tsx` (180x180 PNG), `app/icon.svg` (PawdexMark).
- `app/sitemap.ts` (marketing URLs only), `app/robots.ts` (allow marketing, disallow API
  and every authed/token path, sitemap ref). Both render and were curl-verified.

## 8. Domain strings

`pawdex.app` to `pawdex.co` across sender defaults (`records@`, `insurance@`,
`vet-requests@`, `invites@`, `reminders@`), the inbound-domain default
(`inbound.pawdex.app` to `inbound.pawdex.co`), the inbound webhook comment, DEPLOY.md,
README.md, email-architecture.md, and the two test assertions coupled to the string
(`test-insurance-live.ts`, `test-email-webhooks.ts`). Zero residual `pawdex.app` in application code, tests, and active docs. One comment in
already-applied migration `0010_phase5_foundations.sql` still reads `pawdex.app`; left as
historical (applied migrations are not edited here) and it has no runtime effect.

## Flags for the lead

1. **Pre-existing bug, out of my a11y-only lane in `app/(app)`**: `app/(app)/pets/[petId]/upload/page.tsx`
   builds the inbox address as `` inbox+${slug(householdName)}@pawdex.co `` using a
   display-name slug and the bare domain. The correct address is
   `inboxAddressFor(<household inbound slug>)` at `@inbound.pawdex.co`
   (`lib/db/inbound-addresses.ts`). I migrated the domain string but did not rework the
   address logic. This page likely shows the wrong forwarding address today. Recommend a
   real fix that reuses the shared builder.
2. **Edge function**: `supabase/functions/reminders-cron/index.ts` sender default changed
   to `reminders@pawdex.co`. If you accept it, the edge function must be redeployed for
   the change to take effect.
3. **Systemic dark-mode primary-button contrast**: white text on `--pw-accent` in dark
   mode is below AA at small sizes app-wide, not just the one CTA axe caught on the
   audited page. I seeded a pet and re-audited the populated dashboard (pet card,
   reminder rail, status pills, action buttons) in both themes: it came back 0/0, so the
   pattern did not instantiate on the main authenticated screen. It could still appear on
   pet-detail or other pages the task did not scope. `.pw-accent-fill` is a ready
   primitive; consider applying it to other primary buttons (or revisiting the dark
   accent) in a follow-up.
4. **Onboarding agent's files** are also in the working tree (`app/auth/callback/route.ts`,
   `app/onboarding/**`, `components/onboarding/**`). Not mine; noted only so the diff is
   not a surprise.

## Founder-only remaining actions

- Add `RESEND_API_KEY` (empty by design here) to enable outbound + inbound email.
- Configure Google OAuth (Connected Accounts references it; provider must be enabled).
- Vercel dashboard: enable Web Analytics and Speed Insights if events 404.
- DNS: confirm `inbound.pawdex.co` MX/TXT and the Resend sending domain per DEPLOY.md.
- Optional: address the live cold-start latency (keep-warm) if the site still feels slow.

## Ops runbook

- **Storage backup**: `pnpm dlx tsx scripts/backup-storage.ts [outDir]`. Downloads the
  whole `documents` bucket to `./backups/documents-<timestamp>/`, re-runnable, read-only.
  Recommended schedule: nightly (launchd/cron or a scheduled GitHub Action with the
  service-role key in secrets). Keep output off any public host: these are medical records.
- **Waitlist export**: `pnpm dlx tsx scripts/waitlist-export.ts > waitlist.csv`.
