# Navigation performance — diagnosis and fixes (Task #24)

Founder report: "the nav bar takes forever to switch pages and move through each
page." This is the authenticated app, not marketing.

Bottom line: every authenticated navigation pays for (1) Vercel functions
serving from `iad1` (us-east-1) while Supabase lives in `us-west-2`, a
cross-country round trip on every query, and (2) an auth/session resolution that
ran its queries serially and re-ran once per render pass. The fixes pin the
functions next to the database, collapse the session resolution to the fewest
round trips, and add instant skeletons so a nav click feels immediate.

## 1. Measurements (before)

### Serving region (confirmed, not assumed)

`x-vercel-id` on live responses encodes the serving region. Both anonymous and
authenticated responses served from `iad1`:

```
$ curl -sI https://www.pawdex.co/login  | grep x-vercel-id
x-vercel-id: iad1::iad1::hnqcs-...
```

Supabase project `ozexfuawzqjcjgdhgrqx` runs in AWS `us-west-2`. So every query a
function makes crosses the country and back. Typical `iad1 <-> us-west-2` round
trip is ~60-70 ms, paid per query, per request.

### Authenticated per-route server TTFB (live, ZZTEST session)

Measured with a `zztest-perf-*` session against `https://www.pawdex.co` using the
CDP harness (`scripts/test-perf-nav.mjs` + `scripts/test-perf-measure.mjs`). Each
number is the time for an RSC navigation fetch (`RSC: 1` header) to return its
response headers — i.e. the exact request a nav-bar click makes, and its server
render time. 3 samples per route, all served from `iad1`.

| Route              | Samples (ms)      | Median (ms) | Region |
| ------------------ | ----------------- | ----------- | ------ |
| dashboard (`/`)    | 260, 242, 227     | **242**     | iad1   |
| pet page           | 406, 270, 458     | **406**     | iad1   |
| expiring           | 240, 217, 257     | **240**     | iad1   |
| insurance          | 287, 244, 241     | **244**     | iad1   |
| settings/household | 270, 423, 210     | **270**     | iad1   |

240-406 ms of server time before the browser can even start rendering, on every
click. That is the founder's complaint, quantified.

These numbers bundle three server costs, not just one: the middleware
`getUser()` (see below), the `requireSession()` resolution, and the page's own
queries. The changes here target the last two; the middleware term is called out
so the lead can attribute the live result correctly.

### Query analysis (from the code)

`requireSession()` (`lib/auth/household.ts`) runs on every authenticated render:

1. `auth.getUser()` — validates the JWT against the GoTrue auth endpoint (network).
2. `household_members` + `households` join (DB).
3. `profiles` display-name read (DB).

Before this change these ran **serially** — three sequential cross-region round
trips.

`requireSession()` is also called by both the `(app)` layout and each page. In
the App Router, a full document load renders the layout and the page in the same
pass, so `requireSession` ran **twice**. Proven empirically by instrumenting the
function and doing one document load of `/`:

- Without `cache()`: a single `GET /` render logged **2** invocations (layout + page).
- With `cache()`: the same render logged **1** invocation.

So a hard load of the dashboard paid `2 x 3 = 6` serial cross-region round trips
in session resolution alone, before any page-specific query ran.

The dashboard page itself (`app/(app)/page.tsx`) already wraps its own data
fetches in `Promise.all`, so the page layer was not the serial offender — the
session layer was, plus the region.

### Middleware adds a second `getUser()` per authenticated request (out of scope)

`lib/supabase/middleware.ts` (`updateSession`, invoked by `proxy.ts`) calls
`supabase.auth.getUser()` on every authenticated request. The anon fast path only
skips this for signed-out traffic, so the founder's case pays it on every nav.
This is a separate cross-region round trip to GoTrue, on top of the `getUser()`
inside `requireSession`. It is visible in the local dev logs as the `proxy.ts`
portion of each request (~100-280 ms from this machine to `us-west-2`):

```
GET / 200 in 922ms (next.js: 3ms, proxy.ts: 102ms, application-code: 817ms)
```

Middleware is explicitly outside this task's file ownership, so it is left
unchanged. It is named here because it is part of the before-numbers and because
whether the region pin helps it depends on where Vercel runs the proxy (see the
live-verify list).

## 2. Changes

### a. Pin functions to the database region — `vercel.json`

```json
{ "regions": ["pdx1"] }
```

`pdx1` (Portland, Oregon) is Vercel's `us-west-2` region, co-located with
Supabase. This is the single highest-leverage change: it turns every
cross-country query round trip (~60-70 ms) into an in-region one (~1-5 ms). Chose
`vercel.json` over the typed `vercel.ts` to avoid adding the `@vercel/config`
dependency and a `package.json` edit.

### b. Deduplicate + parallelize session resolution — `lib/auth/household.ts`

- Wrapped `requireSession` in React `cache()` (`import { cache } from "react"`,
  the request-scoped memoization primitive — already used in
  `lib/auth/auth-settings.ts`). The layout and page now share **one** resolution
  per request instead of re-running it. `cache()` memoizes within a single
  request only, never across users or requests, so there is no cross-user
  leak and no behavior change. (Deliberately React `cache()`, not Next's
  persistent `"use cache"` — the latter would cache one user's household/profile
  and serve it to another.)
- Combined the `household_members` and `profiles` reads into one `Promise.all`.
  Both key only off `user.id` and don't depend on each other, so they now run as
  one round trip instead of two. `getUser()` still runs first (it provides the
  `user.id`). The profile read stays best-effort exactly as before — a null still
  falls back to email downstream. Return shape is byte-for-byte identical.

Session round trips per render:

| Scenario                        | Before          | After           |
| ------------------------------- | --------------- | --------------- |
| Hard load (layout + page)       | 6 (2 x 3 serial)| 2 (1 x [getUser, then members‖profile]) |
| Client nav between siblings     | 3 (1 x 3 serial)| 2 (getUser, then members‖profile)       |

Each surviving round trip also gets ~60 ms cheaper from the region pin.

### c. Instant loading skeletons — `app/(app)/**/loading.tsx`

Added branded, token-driven (`--pw-*`, light/dark aware, reduced-motion aware)
skeletons so a nav click paints immediately while the destination's server work
runs:

- `app/(app)/loading.tsx` — dashboard shape, also the default fallback for any
  `(app)` route without its own.
- `app/(app)/pets/[petId]/loading.tsx`
- `app/(app)/expiring/loading.tsx`
- `app/(app)/insurance/loading.tsx`
- `app/(app)/inbox/loading.tsx`

Primitives live in `app/(app)/_skeleton.tsx` (an underscore-prefixed, non-route
module) with a self-contained shimmer keyframe, so they don't depend on a shared
stylesheet another agent may be editing.

On a client navigation between siblings under `(app)`, the shared layout is
already mounted, so the page-segment `loading.tsx` shows the instant the link is
clicked — this directly addresses "feels like it takes forever" even before the
server work finishes. These skeletons are **build-verified only** (they compile
and the routes build); confirming the flash-on-click is on the live checklist
below.

### d. Link prefetching — verified, no change needed

The top-nav links (`components/pawdex/top-nav.tsx`) use plain `next/link`
`<Link>` with no `prefetch={false}`, so Next's default viewport prefetching is
active in production. Nothing had disabled it.

## Note: full "instant navigation" (`unstable_instant`) is a larger, separate call

This Next 16 fork adds an `unstable_instant` route export that validates and
guarantees instant client navigations, but it **only works with
`cacheComponents: true`** (Cache Components / PPR). Enabling that is an
architectural change with real cross-user cache-leak risk for this
per-household, per-user app, and is out of scope for a safe perf pass. The
`loading.tsx` skeletons deliver the perceived-speed win today without it. Flag
for the lead as a possible follow-up to evaluate deliberately.

## 3. Validation

- `pnpm tsc --noEmit` — clean.
- `pnpm test` — pass (exit 0; insurance calc, first-year, billing entitlements,
  transfer logic all green).
- `pnpm build` — green.
- Return shape of `requireSession` unchanged; the two DB reads are the same
  queries, only parallelized.
- Session-resolution dedup (2 -> 1 per render) and parallelization proven with
  local instrumentation, then instrumentation removed.
- ZZTEST cleanup verified (`verify-clean` -> "CLEAN. no ZZTEST user remains").

## 4. What the lead must verify live post-deploy

The region change only takes effect on a real Vercel deploy; it cannot be
measured locally. After deploying:

1. **Confirm the region flipped.** `curl -sI https://www.pawdex.co/login | grep
   x-vercel-id` should now show `pdx1::`, not `iad1::`.
2. **Re-run the before table.** Recreate the ZZTEST session and re-measure the
   same five routes:
   ```
   node scripts/test-perf-nav.mjs setup
   # launch headless Chrome on :9222 with a persistent --user-data-dir
   E2E_ORIGIN=https://www.pawdex.co node scripts/test-perf-nav.mjs magiclink
   node scripts/test-perf-measure.mjs '<CALLBACK_URL>' '<PET_ID>' 'https://www.pawdex.co' 3
   node scripts/test-perf-nav.mjs cleanup && node scripts/test-perf-nav.mjs verify-clean
   ```
3. **Check the middleware term specifically.** In the re-measured logs (or via
   the live server timing), watch whether the `proxy.ts` / middleware portion of
   TTFB drops. Vercel may run the proxy in the pinned function region (in which
   case its `getUser()` also gets ~60 ms cheaper) or at the edge near the user
   (in which case its `getUser()` still crosses to `us-west-2` and becomes the
   latency floor). This determines how low the totals can go and is the main
   thing that could make the after-numbers land higher than predicted. If it
   stays flat and dominates, the follow-up is to move or trim the middleware
   getUser — a separate task, since middleware is out of scope here.
4. **Expected direction (predicted honestly, validate the magnitude):** the
   region pin removes ~2 cross-country round trips from the surviving session
   queries (~120-150 ms), and the dedup/parallelization removes more on hard
   loads. Realistic target is roughly **100-180 ms median**, down from 240-406
   ms — with the caveat that if the proxy stays at the edge, the middleware
   `getUser()` (~100 ms) sets the floor. The pet page (highest before) should
   see the largest absolute drop. The shape of the win is what to confirm.
5. **Sanity-check nav feel (skeletons).** These are build-verified only, not yet
   observed rendering. Click through the top nav on the live app — each click
   should paint a branded skeleton instantly, then fill in.
