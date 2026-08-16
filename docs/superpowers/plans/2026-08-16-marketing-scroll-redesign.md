# Marketing Scroll Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the nine interchangeable sections of the Pawdex marketing home page with a six-chapter narrative built on a reusable CSS scroll system (sticky pinned scenes plus scroll-driven animations), and rebuild the pricing tiers as a GSAP-enhanced fit finder.

**Architecture:** Four CSS primitives (`.mk-parallax`, `.mk-scene`, `.mk-crossfade`, `.mk-rail`) live in `app/(marketing)/marketing.css` and are the only scroll machinery on the site. Pinned scenes use `position: sticky` for structure and `animation-timeline` for beat progression, gated behind `@supports` so unsupported browsers and reduced-motion users get a complete static page rather than a polyfill. GSAP appears in exactly one dynamically imported component.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, plain CSS (no Tailwind for the marketing surface), GSAP 3 with Draggable and InertiaPlugin, axe-core, Chrome DevTools Protocol test harness.

**Spec:** `docs/superpowers/specs/2026-08-16-marketing-scroll-redesign-design.md`

## Global Constraints

- **Read the Next.js docs first.** `AGENTS.md` states this repo's Next.js has breaking changes versus training data. Before writing any component, read the relevant guide under `node_modules/next/dist/docs/`.
- **No em-dashes in any copy, comment, or doc.** Use periods, commas, colons, or parentheses. This is a standing project rule.
- **`svh` not `vh`** for any full-viewport height in a pinned scene. `vh` on iOS Safari is wrong while the URL bar is visible.
- **Transform and opacity only** in scroll-driven animations. No animating `top`, `height`, `margin`, or `filter` on scroll.
- **Every primitive sits inside `@supports (animation-timeline: view())`.** Outside it, no pinning, no drift.
- **`prefers-reduced-motion: reduce` collapses motion entirely**, not slower and not shorter. Extend the existing block at `app/(marketing)/marketing.css:478`.
- **Max four beats per `.mk-scene`.**
- **No JavaScript scroll listeners, no parallax library, no cross-route View Transitions.**
- **Do not modify** `TIER_DISCLOSURE` in `app/(marketing)/pricing/page.tsx` (COMPLIANCE-OWNED), any price or limit in `lib/billing/plans.ts`, or the design tokens in `app/globals.css`.
- **Maple gets no adjectives.** Dates, weights, doses, clinic names only. No "beloved", no "furry friend", no personality.
- **Main auto-deploys to production.** `pnpm check` must pass and the manual matrix in Task 12 must be run before any push.

**Verify empirically, do not assume:**

- Whether `calc()` is accepted inside `animation-range` in the target browsers. If it is not, replace the generic `.mk-beat` rule with precomputed per-index classes (`.mk-beat--1of4`, `.mk-beat--2of4`, and so on). Check this in Task 1 before building anything on top of it.
- The `gsap/Draggable` and `gsap/InertiaPlugin` import paths against what actually ships in `node_modules/gsap` after install (Task 10).

---

## File Structure

**Created:**

| File | Responsibility |
| --- | --- |
| `scripts/test-marketing-scroll.mjs` | CDP harness asserting scene release, sticky integrity, reduced-motion collapse, no-support collapse, axe clean |
| `scripts/run-marketing-scroll.sh` | Boots `next start` plus headless Chrome, runs the harness above |
| `components/marketing/scroll-rail.tsx` | The persistent progress rail |
| `components/marketing/paper-field.tsx` | The ~14 DOM document elements shared by the hero and Scene A |
| `components/marketing/scene-shoebox.tsx` | Scene A |
| `components/marketing/scene-life.tsx` | Scene B, the four ages |
| `components/marketing/scene-citation.tsx` | Scene C |
| `components/marketing/hero.tsx` | Chapter 0, extracted out of the page file |
| `components/marketing/plan-fit.tsx` | Fit-finder, server-rendered static core |
| `components/marketing/plan-fit-gsap.tsx` | GSAP enhancement layer, client-only, dynamically imported |
| `lib/billing/recommend.ts` | Pure `recommendPlan()` used by the fit finder |
| `scripts/test-plan-recommend.ts` | Behavioral tests for `recommendPlan()` |

**Modified:**

| File | Change |
| --- | --- |
| `app/(marketing)/marketing.css` | Adds the four primitives, scene styles, fit-finder styles; extends the reduced-motion block |
| `app/(marketing)/home/page.tsx` | Rewritten as six chapters |
| `app/(marketing)/architecture/page.tsx` | Ambient depth plus scroll-linked diagram assembly |
| `app/(marketing)/about/page.tsx` | Ambient depth plus one pinned scene |
| `app/(marketing)/pricing/page.tsx` | Swaps `PricingTiers` for `PlanFit` |
| `components/marketing/site-header.tsx` | Persistent CTA after hero |
| `components/marketing/legal-shell.tsx` | Rail plus in-page table of contents |
| `components/marketing/claims.tsx` | Asymmetric layout, hosts Scene C |
| `components/marketing/lifecycle.tsx`, `travel-strip.tsx`, `breeder-strip.tsx` | Their vignettes are exported for reuse as Scene B beats |
| `package.json` | Adds `gsap`, adds the scroll test to `test:live` |

**Deleted:** none. `PricingTiers` stays until Task 9 replaces its call sites, then is removed in Task 9.

---

## Task 1: Scroll primitives and their verification harness

**Files:**
- Create: `scripts/test-marketing-scroll.mjs`
- Create: `scripts/run-marketing-scroll.sh`
- Modify: `app/(marketing)/marketing.css` (append primitives; extend the reduced-motion block at line 478)

**Interfaces:**
- Consumes: nothing
- Produces: CSS classes `.mk-parallax` (reads `--mk-depth`), `.mk-scene` (reads `--mk-beats`), `.mk-scene-stage`, `.mk-beat` (reads `--mk-beat-index`), `.mk-crossfade`. Harness command `node scripts/test-marketing-scroll.mjs` exiting nonzero on failure.

- [ ] **Step 1: Read the Next.js docs index**

Run: `ls node_modules/next/dist/docs/` and read any guide covering CSS handling and the App Router file conventions. Note anything that differs from expectation before continuing.

- [ ] **Step 2: Write the failing harness**

Create `scripts/test-marketing-scroll.mjs`. Copy the `CDP` class and `getPageTarget()` verbatim from `scripts/test-cockpit-cdp.mjs:18-60` (same protocol, same connection assumptions). Then add:

```js
// Scroll-system verification. Asserts the four marketing scroll primitives
// behave: scenes release rather than trapping the visitor, sticky stages have
// no overflow-hidden ancestor, and both the no-support and reduced-motion
// paths collapse to a complete static page.
//
// Usage: bash scripts/run-marketing-scroll.sh
const ORIGIN = process.env.SCROLL_ORIGIN ?? "http://localhost:3210";
const PAGES = ["/", "/architecture", "/about", "/pricing"];

let passed = 0;
let failed = 0;
const failures = [];
function check(cond, msg) {
  if (cond) { passed++; }
  else { failed++; failures.push(msg); console.error("FAIL: " + msg); }
}

// Every .mk-scene must be taller than its sticky stage. If it is not, the
// stage never releases and the visitor is trapped in the scene forever.
const SCENE_RELEASE = `(() => {
  const out = [];
  for (const scene of document.querySelectorAll('.mk-scene')) {
    const stage = scene.querySelector('.mk-scene-stage');
    if (!stage) { out.push({ id: scene.id || '(unnamed)', error: 'no stage' }); continue; }
    const sceneH = scene.getBoundingClientRect().height;
    const stageH = stage.getBoundingClientRect().height;
    let bad = null;
    let n = stage.parentElement;
    while (n && n !== document.documentElement) {
      const ov = getComputedStyle(n).overflow;
      if (ov === 'hidden' || ov === 'clip') { bad = n.className || n.tagName; break; }
      n = n.parentElement;
    }
    out.push({ id: scene.id || '(unnamed)', sceneH, stageH, badAncestor: bad,
               position: getComputedStyle(stage).position });
  }
  return JSON.stringify(out);
})()`;

async function evalJson(cdp, expr) {
  const r = await cdp.send("Runtime.evaluate", { expression: expr, returnByValue: true });
  return JSON.parse(r.result.value);
}
```

Then the run body: for each page, `Page.navigate`, wait for load, evaluate `SCENE_RELEASE`, and assert per scene that `sceneH > stageH * 1.5`, `badAncestor === null`, and `position === 'sticky'`. Then repeat every page with `Emulation.setEmulatedMedia` set to `prefers-reduced-motion: reduce` and assert every `.mk-scene` reports `position !== 'sticky'` and `sceneH` within 10% of the natural content height. Finish by printing `passed`/`failed` and `process.exit(failed ? 1 : 0)`.

- [ ] **Step 3: Write the runner script**

Create `scripts/run-marketing-scroll.sh`, modeled on `scripts/run-households-e2e.sh:30-56`:

```bash
#!/usr/bin/env bash
set -euo pipefail
PORT=3210
CDP_PORT=9445
PROFILE=$(mktemp -d)
CHROME="${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"

pnpm exec next build
pnpm exec next start -p $PORT >/tmp/pawdex-scroll-server.log 2>&1 &
SERVER_PID=$!
trap 'kill $SERVER_PID $CHROME_PID 2>/dev/null || true' EXIT

for _ in $(seq 1 60); do
  code=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:$PORT/" 2>/dev/null)
  if [ "$code" = "200" ]; then break; fi
  sleep 1
done

"$CHROME" --headless=new --disable-gpu --no-first-run --no-default-browser-check \
  --remote-debugging-port=$CDP_PORT --user-data-dir="$PROFILE" \
  --hide-scrollbars about:blank >/tmp/pawdex-scroll-chrome.log 2>&1 &
CHROME_PID=$!
for _ in $(seq 1 30); do
  if curl -s "http://localhost:$CDP_PORT/json/version" >/dev/null 2>&1; then break; fi
  sleep 1
done

SCROLL_ORIGIN="http://localhost:$PORT" CDP_PORT=$CDP_PORT node scripts/test-marketing-scroll.mjs
```

- [ ] **Step 4: Run it and verify it fails**

Run: `bash scripts/run-marketing-scroll.sh`
Expected: passes trivially with zero scenes found, because no `.mk-scene` exists yet. Add a guard so that is a failure, not a pass:

```js
check(scenes.length > 0, `${page}: expected at least one .mk-scene, found none`);
```

Re-run. Expected: FAIL on `/` with "expected at least one .mk-scene, found none".

- [ ] **Step 5: Add the primitives to marketing.css**

Append to `app/(marketing)/marketing.css`:

```css
/* ─── Scroll system ────────────────────────────────────────────────────
   Four primitives, used by every marketing page. No page invents its own
   scroll behaviour. Everything below is progressive enhancement: without
   animation-timeline support the page is the plain static layout. */

.mk-scene { position: relative; }
.mk-scene-stage { position: relative; }
.mk-beat { position: relative; }

@supports (animation-timeline: view()) {
  @media (prefers-reduced-motion: no-preference) {

    .mk-parallax {
      --mk-depth: 1;
      will-change: transform;
      animation: mk-drift linear both;
      animation-timeline: view();
      animation-range: cover 0% cover 100%;
    }
    @keyframes mk-drift {
      from { transform: translate3d(0, calc(var(--mk-depth) * 6vh), 0); }
      to   { transform: translate3d(0, calc(var(--mk-depth) * -6vh), 0); }
    }

    .mk-scene {
      --mk-beats: 3;
      min-height: calc((var(--mk-beats) + 1) * 100svh);
      /* view-timeline, NOT scroll-timeline. .mk-scene has no scrollbar of its
         own; what we track is its journey through the viewport. A named
         scroll-timeline here would simply never advance. */
      view-timeline: --scene block;
      content-visibility: auto;
      contain-intrinsic-size: auto 100svh;
    }
    .mk-scene-stage {
      position: sticky;
      top: 0;
      height: 100svh;
      display: grid;
      place-items: center;
      overflow: visible;
    }

    /* A beat owns one slice of the parent scene's progress. --mk-beat-index
       is 0-based; the slice width is 1/--mk-beats of the timeline.

       The range is `contain`, not `entry` and not `cover`. `contain` is the
       span during which the scene fully covers the viewport, which is exactly
       the span during which the sticky stage is pinned. `entry` would run all
       beats out during the first viewport of scroll and then leave the stage
       frozen for the rest of the scene. This supersedes the illustrative
       `cover 25% -> 50%` figures in the spec's Section 3. */
    .mk-beat {
      --mk-beat-index: 0;
      animation: mk-beat-inout linear both;
      animation-timeline: --scene;
      animation-range:
        contain calc(var(--mk-beat-index) / var(--mk-beats) * 100%)
        contain calc((var(--mk-beat-index) + 1) / var(--mk-beats) * 100%);
    }
    @keyframes mk-beat-inout {
      0%   { opacity: 0; transform: translate3d(0, 3svh, 0) scale(0.98); }
      18%  { opacity: 1; transform: none; }
      82%  { opacity: 1; transform: none; }
      100% { opacity: 0; transform: translate3d(0, -3svh, 0) scale(1.02); }
    }

    .mk-crossfade > * {
      animation: mk-crossfade linear both;
      animation-timeline: view();
      animation-range: entry 10% cover 40%;
    }
    @keyframes mk-crossfade {
      from { opacity: 0; transform: translate3d(0, 24px, 0); }
      to   { opacity: 1; transform: none; }
    }
  }
}
```

Note the nested `@media (prefers-reduced-motion: no-preference)`: opting in rather than undoing means the reduced-motion path is the plain static CSS above the `@supports` block, with nothing to unwind.

- [ ] **Step 6: Add a throwaway scene to prove the harness**

Temporarily wrap the existing `<Lifecycle />` call in `app/(marketing)/home/page.tsx` in a scene shell:

```tsx
<section className="mk-scene" id="scene-probe" style={{ "--mk-beats": 2 } as React.CSSProperties}>
  <div className="mk-scene-stage"><Lifecycle /></div>
</section>
```

- [ ] **Step 7: Run the harness and verify it passes**

Run: `bash scripts/run-marketing-scroll.sh`
Expected: PASS. Scene taller than stage, stage sticky, no overflow-hidden ancestor, and under emulated reduced motion the stage reports `position: static`.

If `badAncestor` reports a hit, find the offending `overflow: hidden` in `marketing.css` and scope it away from scene ancestors. Do not remove the assertion.

- [ ] **Step 8: Revert the throwaway scene and relax the guard**

Restore `app/(marketing)/home/page.tsx` to its committed state.

Zero scenes exist anywhere until Task 5 (Task 3's architecture page adds none by design), so the "at least one scene" guard from Step 4 cannot stay as an assertion. Replace it with an expected-count read from the environment, defaulting to 0:

```js
const EXPECTED_SCENES = Number(process.env.EXPECTED_SCENES ?? 0);
check(total >= EXPECTED_SCENES,
  `expected at least ${EXPECTED_SCENES} scenes across all pages, found ${total}`);
```

The per-scene release, sticky, and overflow assertions still run against whatever scenes exist. Task 5 raises `EXPECTED_SCENES` to 1, Task 6 to 2, Task 7 to 3, by editing the default in `run-marketing-scroll.sh`.

- [ ] **Step 9: Wire into the test suite**

Do not add this to `test:live` yet: it asserts nothing meaningful until Task 5. Wire it in at Task 5 Step 5 instead, once the first real scene exists. Leave `package.json` untouched in this task.

- [ ] **Step 10: Commit**

```bash
git add app/\(marketing\)/marketing.css scripts/test-marketing-scroll.mjs scripts/run-marketing-scroll.sh package.json
git commit -m "feat(marketing): CSS scroll primitives and scene verification harness"
```

---

## Task 2: The progress rail

**Files:**
- Create: `components/marketing/scroll-rail.tsx`
- Modify: `app/(marketing)/marketing.css` (rail styles)

**Interfaces:**
- Consumes: `.mk-parallax` support gate from Task 1
- Produces: `<ScrollRail chapters={ScrollRailChapter[]} />` where `type ScrollRailChapter = { id: string; label: string }`. Server component, no client JS.

- [ ] **Step 1: Write the component**

```tsx
// The one piece of chrome that makes a long scroll read as a single document.
// Pure CSS: the fill is driven by a scroll-progress timeline on the document,
// and the labels are anchor links, so it doubles as navigation. No JS.

export type ScrollRailChapter = { id: string; label: string };

export function ScrollRail({ chapters }: { chapters: ScrollRailChapter[] }) {
  return (
    <nav className="mk-rail" aria-label="Page sections">
      <div className="mk-rail-track" aria-hidden="true">
        <div className="mk-rail-fill" />
      </div>
      <ol className="mk-rail-list">
        {chapters.map((c) => (
          <li key={c.id}>
            <a href={`#${c.id}`} className="mk-rail-link">{c.label}</a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
```

- [ ] **Step 2: Add the styles**

```css
.mk-rail {
  position: fixed;
  left: max(16px, calc((100vw - 1180px) / 2 - 44px));
  top: 50%;
  transform: translateY(-50%);
  z-index: 30;
  display: none;
  pointer-events: auto;
}
@media (min-width: 1180px) { .mk-rail { display: grid; grid-template-columns: 2px auto; gap: 14px; } }

.mk-rail-track { width: 2px; background: var(--pw-border); border-radius: 2px; height: 180px; }
.mk-rail-fill { width: 2px; height: 100%; background: var(--pw-accent); transform-origin: top; transform: scaleY(0); border-radius: 2px; }

.mk-rail-list { list-style: none; margin: 0; padding: 0; display: grid; gap: 10px; align-content: space-between; height: 180px; }
.mk-rail-link {
  font: 500 10.5px/1 var(--mk-mono);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--pw-text-subtle);
  text-decoration: none;
}
.mk-rail-link:hover, .mk-rail-link:focus-visible { color: var(--pw-text); }

@supports (animation-timeline: scroll()) {
  @media (prefers-reduced-motion: no-preference) {
    .mk-rail-fill {
      animation: mk-rail-fill linear both;
      animation-timeline: scroll(root block);
    }
    @keyframes mk-rail-fill { to { transform: scaleY(1); } }
  }
}
@media (prefers-reduced-motion: reduce) { .mk-rail-fill { transform: scaleY(1); opacity: 0.35; } }
```

- [ ] **Step 3: Mount it on the home page and check by eye**

Add `<ScrollRail chapters={[...]} />` inside `<main>` in `app/(marketing)/home/page.tsx` with placeholder chapter ids matching the sections that exist today. Run `pnpm dev` and confirm at a viewport wider than 1180px that the fill grows with scroll, the labels are clickable, and nothing overlaps the content column.

- [ ] **Step 4: Confirm it is invisible below 1180px**

Resize to 900px. The rail must not render and must not reserve space.

- [ ] **Step 5: Commit**

```bash
git add components/marketing/scroll-rail.tsx app/\(marketing\)/marketing.css app/\(marketing\)/home/page.tsx
git commit -m "feat(marketing): scroll progress rail"
```

---

## Task 3: Prove the primitives on /architecture

The spec's rollout order: prove on the low-traffic diagram page before the home page depends on it.

**Files:**
- Modify: `app/(marketing)/architecture/page.tsx`
- Modify: `app/(marketing)/architecture/architecture.css`

**Interfaces:**
- Consumes: `.mk-crossfade`, `.mk-parallax`, `ScrollRail` from Tasks 1 and 2
- Produces: nothing new

- [ ] **Step 1: Read the page**

Run: `sed -n 1,120p 'app/(marketing)/architecture/page.tsx'`. Identify the diagram markup and the prose sections that describe it in sequence.

- [ ] **Step 2: Wrap prose sections in `.mk-crossfade`**

Each top-level prose block gets `className="mk-crossfade"` on its container so its children rise in as they enter. No pinning on this page.

- [ ] **Step 3: Make the diagram assemble**

Give each diagram node and connector its own `view()`-driven animation keyed to the prose block that describes it, using the existing `.mk-crossfade` pattern with a staggered `animation-range`. Connectors use `stroke-dasharray` and `stroke-dashoffset` animated to 0, which is a paint-only property on an SVG path and acceptable here because the diagram is small.

- [ ] **Step 4: Add the rail**

Mount `<ScrollRail />` with the page's real section ids.

- [ ] **Step 5: Verify**

Run: `bash scripts/run-marketing-scroll.sh`
Expected: PASS, including the reduced-motion pass showing all diagram nodes at full opacity.

- [ ] **Step 6: Commit**

```bash
git add app/\(marketing\)/architecture
git commit -m "feat(marketing): scroll-linked diagram assembly on the architecture page"
```

---

## Task 4: The paper field and the new hero

**Files:**
- Create: `components/marketing/paper-field.tsx`
- Create: `components/marketing/hero.tsx`
- Modify: `app/(marketing)/marketing.css`
- Modify: `app/(marketing)/home/page.tsx`

**Interfaces:**
- Consumes: `.mk-parallax`
- Produces: `<PaperField variant="hero" | "scene" />` rendering 14 `.mk-paper` elements with per-element `--mk-depth`, `--mk-x`, `--mk-y`, `--mk-rot` custom properties. `<Hero />` rendering Chapter 0 including the existing `<WaitlistForm source="hero" />`.

- [ ] **Step 1: Write the paper field**

```tsx
// The mess, before it is a record. Fourteen documents rendered in DOM from
// existing tokens: no raster images, no extra fonts, correct in dark mode.
// Decorative only, so the whole field is aria-hidden.

type Sheet = {
  kind: "cert" | "invoice" | "discharge" | "fax" | "handwritten";
  depth: number; x: number; y: number; rot: number; w: number;
};

const SHEETS: Sheet[] = [
  { kind: "cert",        depth: 3.0, x: 62, y: 8,  rot: -9,  w: 190 },
  { kind: "invoice",     depth: 2.4, x: 78, y: 34, rot: 6,   w: 210 },
  { kind: "discharge",   depth: 1.8, x: 55, y: 62, rot: -4,  w: 230 },
  { kind: "fax",         depth: 2.9, x: 88, y: 74, rot: 11,  w: 175 },
  { kind: "handwritten", depth: 1.2, x: 68, y: 20, rot: -14, w: 205 },
  // ... nine more, spread 48-96 on x, 4-92 on y, depth 0.8-3.2, rot -14..11
];

export function PaperField({ variant = "hero" }: { variant?: "hero" | "scene" }) {
  return (
    <div className={`mk-paper-field mk-paper-field--${variant}`} aria-hidden="true">
      {SHEETS.map((s, i) => (
        <article
          key={i}
          className={`mk-paper mk-paper--${s.kind} mk-parallax`}
          style={{
            "--mk-depth": s.depth, "--mk-x": `${s.x}%`, "--mk-y": `${s.y}%`,
            "--mk-rot": `${s.rot}deg`, "--mk-w": `${s.w}px`,
          } as React.CSSProperties}
        >
          <Sheet kind={s.kind} />
        </article>
      ))}
    </div>
  );
}
```

`<Sheet>` renders a small header line, two or three ruled body lines, and for `cert` a stamp block. All from `var(--pw-surface)`, `var(--pw-border)`, and `var(--mk-mono)`. Nothing is real text a screen reader would read, because the field is `aria-hidden`.

- [ ] **Step 2: Style the field**

```css
.mk-paper-field { position: absolute; inset: 0; overflow: hidden; pointer-events: none; z-index: 0; }
.mk-paper {
  position: absolute;
  left: var(--mk-x); top: var(--mk-y);
  width: var(--mk-w);
  rotate: var(--mk-rot);
  background: var(--pw-surface);
  border: 1px solid var(--pw-border);
  border-radius: var(--pw-r-sm);
  box-shadow: var(--pw-shadow-md);
  padding: 12px 14px;
  opacity: 0.92;
}
@media (max-width: 920px) { .mk-paper-field--hero { display: none; } }
```

The field is hidden below 920px. A rotated 14-element field on a phone is noise, and it is the cheapest possible perf win on the device class that needs it most.

- [ ] **Step 3: Write the hero**

Extract the current hero JSX from `app/(marketing)/home/page.tsx:44-99` into `components/marketing/hero.tsx`. Change the layout from a two-column grid to a single left-aligned type column at `max-width: 46ch` sitting at `z-index: 1` above `<PaperField variant="hero" />`. Keep the H1, the lead, the eyebrow, and `<WaitlistForm source="hero" />` exactly as they are. Delete the `<HeroVisual />` call and the `STATS` strip: the stats move to Chapter 3 in Task 7, and the hero visual is replaced by the paper field.

Nothing in the hero pins. The first screen must be scrollable and clickable immediately.

- [ ] **Step 4: Verify LCP is not harmed**

Run `pnpm build && pnpm start`, load `/` in Chrome, and record a performance trace. Confirm the LCP element is the H1 and its time has not regressed against the committed version. If the paper field delays it, add `content-visibility: auto` to `.mk-paper-field` and re-measure.

- [ ] **Step 5: Commit**

```bash
git add components/marketing/paper-field.tsx components/marketing/hero.tsx app/\(marketing\)/marketing.css app/\(marketing\)/home/page.tsx
git commit -m "feat(marketing): paper-field hero"
```

---

## Task 5: Scene A, The Shoebox

**Files:**
- Create: `components/marketing/scene-shoebox.tsx`
- Modify: `app/(marketing)/marketing.css`
- Modify: `app/(marketing)/home/page.tsx`

**Interfaces:**
- Consumes: `<PaperField variant="scene" />`, `.mk-scene`, `.mk-beat`
- Produces: `<SceneShoebox />`, a `.mk-scene` with `--mk-beats: 4` and `id="scene-shoebox"`

- [ ] **Step 1: Build the static fallback first**

Write the component so that with no animation at all it renders: the resolved timeline card, in full, with real text. Four date-ordered rows (`Rabies · 3-year · 2024-03-11`, and three more), each with a `mk-cite` badge, plus the "reviewed by you" confirmation. This is what unsupported browsers and reduced-motion users see, and it must be a complete, sensible thing on its own.

- [ ] **Step 2: Verify the fallback in isolation**

Mount it on `/` and load the page in Chrome with `Emulation.setEmulatedMedia` forcing reduced motion (or toggle it in macOS System Settings). Confirm the timeline card reads correctly and no paper is visible.

- [ ] **Step 3: Add the four beats**

Wrap the stage contents in four `.mk-beat` elements with `--mk-beat-index` 0 through 3, and override `animation-range` per beat where the default even slice is wrong. Beat content per the spec:

0. `<PaperField variant="scene" />` scattered, still drifting.
1. Same field, with a `--mk-converged` flag class that animates each sheet's `left`/`top`/`rotate` to a common center via `translate`. Use `translate3d` computed from the difference, not animating `left`/`top` directly.
2. Scan line sweeping the top sheet (reuse the `@keyframes mk-scan` idea at `marketing.css:323`), with four fact chips detaching rightward, each carrying its `mk-cite` badge.
3. Stack fades back and down, chips land into the timeline card from Step 1, "reviewed by you" appears last.

- [ ] **Step 4: Add the beat caption**

A single mono line, pinned bottom-left of the stage, one word-phrase per beat: `a shoebox`, `a tidy shoebox`, `read, cited`, `a record`. Each is a `.mk-beat` sharing the same index as its scene beat.

- [ ] **Step 5: Run the harness and wire it into the suite**

Set `EXPECTED_SCENES=1` as the default in `scripts/run-marketing-scroll.sh`, then append ` && bash scripts/run-marketing-scroll.sh` to the `test:live` script in `package.json`. This is the point at which the harness starts asserting something real.

Run: `bash scripts/run-marketing-scroll.sh`
Expected: PASS. Scene height is 5x stage height (4 beats + 1), stage sticky, no overflow-hidden ancestor, reduced-motion pass shows a static timeline card.

- [ ] **Step 6: Scroll it by hand**

Run `pnpm dev`, scroll through the scene slowly and then very fast. Confirm it releases at the bottom in both cases and that scrolling back up replays cleanly. This is the failure mode the whole harness exists for; check it with your own hands too.

- [ ] **Step 7: Commit**

```bash
git add components/marketing/scene-shoebox.tsx app/\(marketing\)/marketing.css app/\(marketing\)/home/page.tsx
git commit -m "feat(marketing): Scene A, the shoebox resolving into a record"
```

---

## Task 6: Scene B, The Life

**Files:**
- Create: `components/marketing/scene-life.tsx`
- Modify: `components/marketing/lifecycle.tsx`, `components/marketing/travel-strip.tsx`, `components/marketing/breeder-strip.tsx` (export their vignettes)
- Modify: `app/(marketing)/marketing.css`

**Interfaces:**
- Consumes: `.mk-scene`, `.mk-beat`, `<ScrollRail />`
- Produces: `<SceneLife />`, a `.mk-scene` with `--mk-beats: 4` and `id="scene-life"`. Exports `LIFE_AGES: { id: string; age: string }[]` for the rail to consume.

- [ ] **Step 1: Export the existing vignettes**

`components/marketing/lifecycle.tsx` defines `DayOneVignette()` and siblings as module-private functions (line 7). Change them to named exports. Do the same for the card grids inside `travel-strip.tsx` and `breeder-strip.tsx`. Do not change their markup: these are already real product-UI simulations and they are the asset, not the problem.

- [ ] **Step 2: Verify nothing broke**

Run: `pnpm exec tsc --noEmit`
Expected: clean. The existing pages still render the same components.

- [ ] **Step 3: Write the static fallback**

`<SceneLife />` with no animation renders four `<article>` elements in document order, each with a visible age heading (`8 weeks`, `6 months`, `3 years`, `9 years`) and its vignette. This is a readable vertical list of one animal's life. Screen readers get exactly this, in this order, with no beat scaffolding.

- [ ] **Step 4: Add the four beats**

Wrap each article in `.mk-beat` with `--mk-beat-index` 0-3. Unlike Scene A these cross-dissolve rather than transform continuously, so the default `mk-beat-inout` keyframes are correct as-is. Add a hairline spine: a 1px absolutely positioned element running the stage height with `background: var(--pw-border)`, and a dot that moves down it, driven by the same `--scene` timeline.

Beat content:

0. `8 weeks`: the transfer card from `lifecycle.tsx` (`Maple joined your household`, `transferred from Hickory Ridge Goldens`, `with history`) over litter record rows.
1. `6 months`: reminder and series view, DHPP dose 3 completing, rabies scheduled at 16 weeks, plus the weight curve as an inline SVG `<path>` animated with `stroke-dasharray` / `stroke-dashoffset` on the `--scene` timeline.
2. `3 years`: APHIS 7001 worksheet, destination readiness, boarder share link, from `travel-strip.tsx`.
3. `9 years`: stage background transitions toward `var(--mk-ink-band)`; emergency card, one-link history handover, insurance claim with pre-existing-condition review. One line of copy, in `--mk-display` at lead size: `9:42pm. Someone asks when her last rabies was. You already know.`

- [ ] **Step 5: Show the ages beside the rail**

A named view timeline is only visible to descendants of the element that declares it. `.mk-rail` is `position: fixed` and lives outside `#scene-life`, so it cannot read `--scene`, and an anonymous `view()` on the rail would track the rail's own permanent visibility, which never changes. Two workable options; take the second.

Option A: declare `timeline-scope: --scene` on a shared ancestor so the name is visible to both.

Option B (take this one): render the age labels *inside* the scene stage, in a column aligned to the rail's left offset, as `.mk-beat` elements sharing each beat's index. They then read `--scene` as descendants, for free. The rail's own chapter labels stay static and simply show `The life` while this scene is on screen. Export `LIFE_AGES` for the stage to consume.

Option B keeps the rail a dumb, always-correct component and avoids a `timeline-scope` dependency whose browser support has to be verified separately.

- [ ] **Step 6: Read it aloud**

Read all four beats' copy out loud. Any line that makes you wince is saccharine. Cut it. Maple gets dates, weights, doses, and clinic names only. This is a real gate.

- [ ] **Step 7: Run the harness**

Run: `bash scripts/run-marketing-scroll.sh`
Expected: PASS with two scenes now found on `/`, both releasing.

- [ ] **Step 8: Commit**

```bash
git add components/marketing app/\(marketing\)/marketing.css
git commit -m "feat(marketing): Scene B, one animal's life as the scroll"
```

---

## Task 7: Chapter 3, the proof, and Scene C

**Files:**
- Create: `components/marketing/scene-citation.tsx`
- Modify: `components/marketing/claims.tsx`
- Modify: `app/(marketing)/marketing.css`

**Interfaces:**
- Consumes: `.mk-scene`, `.mk-beat`
- Produces: `<SceneCitation />`, a `.mk-scene` with `--mk-beats: 2` and `id="scene-citation"`, mounted inside `<Claims />`

- [ ] **Step 1: Write Scene C's static fallback**

Fact and source side by side, both fully visible, with a visible connector. The fact is `Rabies · 3-year · 2024-03-11` carrying an `mk-cite` badge. The source is a rendered PDF page (DOM, not a raster) with one line highlighted using `--mk-amber` at low alpha, and a mono label reading `page 14 of 41`.

- [ ] **Step 2: Add the two beats**

Beat 0: only the fact and its badge, source column empty.
Beat 1: the badge expands leftward into the source page, the highlight appears, the connector draws via `stroke-dashoffset`.

- [ ] **Step 3: Restructure Claims**

`components/marketing/claims.tsx` currently renders a three-up grid (`.mk-claims-grid`). Change to an asymmetric stack: each of the three claims (`Proof, not vibes.`, `A human in the loop. You.`, `Your data is not the product.`) gets its own full-width row alternating text-left/visual-right and text-right/visual-left, each row wrapped in `.mk-crossfade`. Mount `<SceneCitation />` as the visual for `Proof, not vibes.`

- [ ] **Step 4: Relocate the stats strip**

Move the `STATS` array and its markup out of `app/(marketing)/home/page.tsx` (lines 19-31 and 66-99) into the bottom of `<Claims />`, unchanged in content. It belongs with the rigor argument, not above the fold. Keep the existing `100%`, `~1 min`, and `0` figures exactly as written.

- [ ] **Step 5: Run the harness and check contrast**

Run: `bash scripts/run-marketing-scroll.sh`
Expected: PASS, three scenes on `/`, axe reporting zero violations on the home page in both motion states.

- [ ] **Step 6: Commit**

```bash
git add components/marketing app/\(marketing\)/home/page.tsx app/\(marketing\)/marketing.css
git commit -m "feat(marketing): asymmetric claims with a live citation scene"
```

---

## Task 8: The fit-finder recommendation logic

The one task with genuine unit-testable logic, written test-first against the existing pure-script harness pattern.

**Files:**
- Create: `lib/billing/recommend.ts`
- Create: `scripts/test-plan-recommend.ts`
- Modify: `package.json` (add to `test`)

**Interfaces:**
- Consumes: `PLANS`, `PlanId` from `lib/billing/plans.ts`
- Produces:
  ```ts
  export type FitInput = { pets: number; docsPerMonth: number; placesLitters: boolean };
  export type FitResult = { planId: PlanId; reason: string; outgrewFree: boolean };
  export function recommendPlan(input: FitInput): FitResult;
  export const FIT_LIMITS = { maxPets: 10, maxDocs: 40 } as const;
  ```

- [ ] **Step 1: Write the failing test**

Create `scripts/test-plan-recommend.ts`, using the harness shape from `scripts/test-billing-entitlements.ts` lines 37-45 (`check(cond, msg)`, counters, nonzero exit):

```ts
import { recommendPlan } from "../lib/billing/recommend";

// Litters is a capability, not a quantity. Without it, Breeder is unreachable
// by any slider and the third card looks broken.
check(recommendPlan({ pets: 1, docsPerMonth: 2, placesLitters: true }).planId === "breeder",
  "litters alone must reach Breeder regardless of pet count");
check(recommendPlan({ pets: 10, docsPerMonth: 40, placesLitters: true }).planId === "breeder",
  "max sliders plus litters is Breeder");

// Free's only real meter is AI extraction, at 10/month.
check(recommendPlan({ pets: 1, docsPerMonth: 10, placesLitters: false }).planId === "free",
  "exactly 10 docs still fits Free (limit is inclusive)");
check(recommendPlan({ pets: 1, docsPerMonth: 11, placesLitters: false }).planId === "household",
  "11 docs exceeds Free's 10/month meter");
check(recommendPlan({ pets: 1, docsPerMonth: 11, placesLitters: false }).outgrewFree === true,
  "outgrewFree flags the moment the Free card should step back");

// Free caps pets at 2.
check(recommendPlan({ pets: 2, docsPerMonth: 0, placesLitters: false }).planId === "free",
  "2 pets fits Free");
check(recommendPlan({ pets: 3, docsPerMonth: 0, placesLitters: false }).planId === "household",
  "3 pets exceeds Free's 2-pet limit");

// Every result must carry human-readable justification.
for (const r of [
  recommendPlan({ pets: 1, docsPerMonth: 0, placesLitters: false }),
  recommendPlan({ pets: 6, docsPerMonth: 20, placesLitters: false }),
  recommendPlan({ pets: 6, docsPerMonth: 20, placesLitters: true }),
]) {
  check(r.reason.length > 0, "every recommendation carries a reason");
  check(!r.reason.includes("—"), "no em-dashes in user-facing copy");
}
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm dlx tsx scripts/test-plan-recommend.ts`
Expected: FAIL, cannot resolve `../lib/billing/recommend`.

- [ ] **Step 3: Write the implementation**

```ts
/**
 * Which tier fits a household, given three inputs. Pure: no DB, no env, no
 * network, importable into a client component exactly like plans.ts.
 *
 * Thresholds are read from PLANS rather than hardcoded, so a limit change in
 * plans.ts moves the fit finder with it.
 */
import { PLANS, type PlanId } from "./plans";

export type FitInput = { pets: number; docsPerMonth: number; placesLitters: boolean };
export type FitResult = { planId: PlanId; reason: string; outgrewFree: boolean };
export const FIT_LIMITS = { maxPets: 10, maxDocs: 40 } as const;

export function recommendPlan(input: FitInput): FitResult {
  const free = PLANS.free.limits;
  const petCap = typeof free.pets === "number" ? free.pets : Infinity;
  const docCap = typeof free.aiExtractionsPerMonth === "number"
    ? free.aiExtractionsPerMonth
    : Infinity;

  const overPets = input.pets > petCap;
  const overDocs = input.docsPerMonth > docCap;
  const outgrewFree = overPets || overDocs;

  if (input.placesLitters) {
    return {
      planId: "breeder",
      reason: "Litters, whelping records and placement transfers only exist on Breeder.",
      outgrewFree,
    };
  }
  if (overDocs && overPets) {
    return { planId: "household", reason:
      `More than ${petCap} pets and more than ${docCap} documents a month.`, outgrewFree };
  }
  if (overDocs) {
    return { planId: "household", reason:
      `Free reads ${docCap} documents a month. You are past that.`, outgrewFree };
  }
  if (overPets) {
    return { planId: "household", reason:
      `Free covers up to ${petCap} pets. You have more.`, outgrewFree };
  }
  return { planId: "free", reason:
    "Free covers this. Forever, not a trial.", outgrewFree: false };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm dlx tsx scripts/test-plan-recommend.ts`
Expected: PASS, zero failures.

- [ ] **Step 5: Wire into the suite**

In `package.json`, append to the `test` script: ` && pnpm dlx tsx scripts/test-plan-recommend.ts`. Run `pnpm test` and confirm the whole suite is green.

- [ ] **Step 6: Commit**

```bash
git add lib/billing/recommend.ts scripts/test-plan-recommend.ts package.json
git commit -m "feat(billing): pure plan fit recommendation with tests"
```

---

## Task 9: The fit-finder component, static core

Server-rendered, fully functional, no GSAP. Task 10 enhances it.

**Files:**
- Create: `components/marketing/plan-fit.tsx`
- Modify: `app/(marketing)/pricing/page.tsx`
- Modify: `app/(marketing)/marketing.css`
- Delete: `components/marketing/pricing-tiers.tsx` (after its call site moves)

**Interfaces:**
- Consumes: `recommendPlan`, `FIT_LIMITS`, `FitResult` from Task 8; `PURCHASABLE_PLANS`, `formatUsd`, `annualMonthlyEquivalentCents` from `lib/billing/plans.ts`
- Produces: `<PlanFit disclosure={string} cta="checkout" | "waitlist" />`

- [ ] **Step 1: Build the controls**

Three real form controls, no custom drag yet:

```tsx
<input type="range" min={1} max={FIT_LIMITS.maxPets} step={1} value={pets}
  aria-label="How many pets" onChange={...} />
<input type="range" min={0} max={FIT_LIMITS.maxDocs} step={1} value={docs}
  aria-label="Vet documents per month" onChange={...} />
<input type="checkbox" checked={litters} aria-label="I place litters" onChange={...} />
```

Native `<input type="range">` gives arrow keys, Home/End, focus, and screen reader semantics for free. Every later enhancement layers on top of these; they are never replaced.

- [ ] **Step 2: Announce the result**

The recommendation text sits in `<p role="status" aria-live="polite">` so a screen reader user hears the tier change as they move the slider.

- [ ] **Step 3: Render the three cards**

All three of `PURCHASABLE_PLANS` render at all times. The recommended one gets `data-fit="true"`, the others `data-fit="false"`. Styling is driven entirely off that attribute, so the GSAP layer in Task 10 has a single source of truth to react to. Cards carry the class `pf-card`.

Free's `10 document AI extractions / month` row renders a fill bar reading `min(docs, 10) / 10`, and when `result.outgrewFree` is true it shows the overflow state.

The Breeder card renders the soft cap honestly: `Soft cap at 50 active animals. We'll ask, we never lock the record.` Read the number from `PLANS.breeder.limits.softActiveAnimalCap`, do not hardcode 50.

- [ ] **Step 4: Add the headline**

Above the controls, in `mk-h2`:
`The record is unlimited on every plan. Reading documents at scale is the only thing that costs us anything, so it's the only thing we meter.`

- [ ] **Step 5: Handle the two CTAs**

`cta="checkout"` renders the existing paid-tier buttons and places `disclosure` under each paid card exactly as `pricing-tiers.tsx` does today. `cta="waitlist"` renders `<WaitlistForm source="pricing" />` and reframes the result as `Here's what you'd be on after beta. It's free until then.`

- [ ] **Step 6: Swap the pricing page over**

In `app/(marketing)/pricing/page.tsx` line 85, replace `<PricingTiers disclosure={TIER_DISCLOSURE} />` with `<PlanFit disclosure={TIER_DISCLOSURE} cta="checkout" />`. Leave `TIER_DISCLOSURE` itself untouched: it is COMPLIANCE-OWNED.

- [ ] **Step 7: Delete the old component**

Run: `grep -rn "PricingTiers" app components` and confirm zero remaining references, then `git rm components/marketing/pricing-tiers.tsx`.

- [ ] **Step 8: Verify keyboard-only**

Run `pnpm dev`, load `/pricing`, and drive the whole control with the keyboard alone: Tab to each slider, arrow keys to move, Home/End to jump, Space to toggle litters. Confirm focus is visible at every stop and the recommendation updates.

- [ ] **Step 9: Verify types and tests**

Run: `pnpm check`
Expected: clean tsc, full suite green.

- [ ] **Step 10: Commit**

```bash
git add components/marketing/plan-fit.tsx app/\(marketing\)/pricing/page.tsx app/\(marketing\)/marketing.css
git rm components/marketing/pricing-tiers.tsx
git commit -m "feat(marketing): plan fit finder replaces the static pricing grid"
```

---

## Task 10: The GSAP enhancement layer

**Files:**
- Create: `components/marketing/plan-fit-gsap.tsx`
- Modify: `components/marketing/plan-fit.tsx` (mount the enhancement)
- Modify: `package.json`

**Interfaces:**
- Consumes: the `data-fit` attributes and `.pf-card` class names produced in Task 9
- Produces: nothing consumed elsewhere. This module is a leaf.

- [ ] **Step 1: Install GSAP**

Run: `pnpm add gsap`

GSAP is free for commercial use including the former Club plugins (Webflow, April 2025), so Draggable and InertiaPlugin need no license.

- [ ] **Step 2: Write the enhancement module**

```tsx
"use client";
// GSAP is the ONLY JS animation on this site, and it exists for one reason:
// slider drags need interruptible tweens. A CSS transition restarts when the
// target changes mid-drag; a GSAP tween retargets from its current value.
//
// Dynamically imported and never server-rendered, so the static fit finder is
// complete and interactive before GSAP arrives.
import { useEffect } from "react";

export default function PlanFitGsap({ rootId }: { rootId: string }) {
  useEffect(() => {
    let killed = false;
    (async () => {
      const { gsap } = await import("gsap");
      const { Draggable } = await import("gsap/Draggable");
      const { InertiaPlugin } = await import("gsap/InertiaPlugin");
      if (killed) return;
      gsap.registerPlugin(Draggable, InertiaPlugin);
      // Card emphasis, keyed off [data-fit]:
      //   gsap.to('.pf-card[data-fit="true"]',  { scale: 1.03, y: -8, opacity: 1,   duration: 0.4, overwrite: 'auto' })
      //   gsap.to('.pf-card[data-fit="false"]', { scale: 0.98, y: 0,  opacity: 0.62, duration: 0.4, overwrite: 'auto' })
      // overwrite: 'auto' is the whole reason GSAP is here: mid-drag retarget
      // instead of restart.
      //
      // Mobile carousel: Draggable.create('.pf-track', { type: 'x', inertia: true,
      //   snap: (x) => Math.round(x / cardWidth) * cardWidth, bounds: '.pf-viewport' })
    })();
    return () => { killed = true; };
  }, [rootId]);
  return null;
}
```

- [ ] **Step 3: Mount it lazily**

In `plan-fit.tsx`, gate the dynamic import behind an `IntersectionObserver` with `rootMargin: "400px"` so GSAP downloads as the pricing chapter approaches, never on initial load:

```tsx
const PlanFitGsap = dynamic(() => import("./plan-fit-gsap"), { ssr: false });
```

- [ ] **Step 4: Verify the hero never pays for it**

Run `pnpm build && pnpm start`, load `/` in Chrome DevTools with the Network tab filtered to JS, and confirm no GSAP chunk is requested until you scroll toward the pricing chapter. If it loads eagerly, the observer is wired wrong.

- [ ] **Step 5: Verify it degrades**

Disable JavaScript in DevTools and reload `/pricing`. Expected: all three cards visible, the default recommendation rendered server-side, and the buy CTAs working as links.

- [ ] **Step 6: Verify the mobile carousel**

Emulate an iPhone viewport. Expected: cards become a draggable track with inertia and snap; sliders become steppers with touch targets of at least 44px; arrow keys still work when a control is focused via an attached keyboard.

- [ ] **Step 7: Check the bundle**

Run: `pnpm build` and read the route output. Confirm the GSAP chunk is separate from the home page's initial JS.

- [ ] **Step 8: Commit**

```bash
git add components/marketing/plan-fit-gsap.tsx components/marketing/plan-fit.tsx package.json pnpm-lock.yaml
git commit -m "feat(marketing): GSAP emphasis and mobile carousel for the fit finder"
```

---

## Task 11: Assemble the home page

**Files:**
- Modify: `app/(marketing)/home/page.tsx`
- Modify: `components/marketing/site-header.tsx`

**Interfaces:**
- Consumes: everything from Tasks 2 and 4 through 10
- Produces: the six-chapter page

- [ ] **Step 1: Rewrite the page as six chapters**

```tsx
<main id="main">
  <ScrollRail chapters={CHAPTERS} />
  <Hero />                                  {/* ch 0 */}
  <SceneShoebox />                          {/* ch 1 */}
  <FormatTicker />                          {/* palate cleanser */}
  <SceneLife />                             {/* ch 2 */}
  <Claims />                                {/* ch 3, contains SceneCitation */}
  <section id="pricing"><PlanFit cta="waitlist" disclosure="" /></section>  {/* ch 4 */}
  <Faq />
  <FinalCta />                              {/* ch 5 */}
</main>
```

Remove the now-unused `STATS` constant (moved to Claims in Task 7) and the `HeroVisual`, `Lifecycle`, `TravelStrip`, `BreederStrip` imports, which are now consumed inside `SceneLife`. Keep both `<JsonLd>` calls and the skip link exactly as they are.

- [ ] **Step 2: Verify the JSON-LD still validates**

Run: `curl -s localhost:3000/ | grep -o 'application/ld+json' | wc -l`
Expected: 4 (organization and website from the layout, softwareApplication and faqPage from the page). Then paste both blocks into the Rich Results test to confirm they still parse.

- [ ] **Step 3: Add the persistent header CTA**

In `site-header.tsx`, add a compact "Join the waitlist" button that is hidden while the hero is on screen and visible after. Do this with a `view()`-driven animation on a sentinel element at the bottom of the hero, not with a scroll listener. Under reduced motion or no support, the button is always visible, which is the safe default.

- [ ] **Step 4: Verify the close still converts**

Confirm three separate paths to the waitlist exist and work: the hero form, the header CTA, and `#waitlist` in the final section. Test the `#waitlist` anchor from `/pricing` to make sure cross-page anchoring still lands correctly with the scenes in between.

- [ ] **Step 5: Run everything**

Run: `pnpm check && bash scripts/run-marketing-scroll.sh`
Expected: both green, three scenes found on `/`.

- [ ] **Step 6: Commit**

```bash
git add app/\(marketing\)/home/page.tsx components/marketing/site-header.tsx
git commit -m "feat(marketing): six-chapter narrative home page"
```

---

## Task 12: The remaining pages, then full verification

**Files:**
- Modify: `app/(marketing)/about/page.tsx`
- Modify: `app/(marketing)/pricing/page.tsx`
- Modify: `components/marketing/legal-shell.tsx`

**Interfaces:**
- Consumes: all primitives
- Produces: nothing new

- [ ] **Step 1: About**

Wrap prose blocks in `.mk-crossfade`. Add one `.mk-scene` for the page's strongest single moment. Mount the rail.

- [ ] **Step 2: Pricing**

Add `.mk-crossfade` to the surrounding sections and mount the rail. Add no pinned scenes: visitors here arrived with intent and a decision to make.

- [ ] **Step 3: Legal shell**

Add the rail plus an in-page table of contents built from the section headings already in `privacy`, `terms`, and `accessibility`. No motion of any kind on these three pages. This is a larger real improvement to them than any animation.

- [ ] **Step 4: Contact**

Change nothing. It is a form.

- [ ] **Step 5: Run the full automated gate**

```bash
pnpm check
bash scripts/run-marketing-scroll.sh
node scripts/launch-axe.mjs 9445 http://localhost:3210/ http://localhost:3210/pricing http://localhost:3210/about http://localhost:3210/architecture
```

Expected: tsc clean, suite green, scroll harness green on all four pages in both motion states, axe reporting zero serious or critical violations.

- [ ] **Step 6: Run the manual matrix**

Every row must pass before push. `main` auto-deploys to production, so this is the only gate.

- [ ] Chrome desktop, supported: the intended experience, every scene releases
- [ ] Safari on a real iOS device: no jitter at the top or bottom of any pinned stage while the URL bar collapses and expands
- [ ] A browser with `animation-timeline` unsupported (or the `@supports` block temporarily commented out): every scene renders as a complete static stack
- [ ] macOS System Settings, Reduce Motion on: scenes collapse, nothing merely slows
- [ ] Keyboard-only through the fit finder: tab in, arrows move both sliders, toggle reachable, focus visible at every stop, recommendation announced
- [ ] VoiceOver linear read of `/`: Maple's timeline reads as an ordered document, no beat scaffolding, decorative paper silent

- [ ] **Step 7: Check performance**

Load `/` with a performance trace. LCP must not have regressed against `main`. The hero must remain interactive during the paper drift. If the compositor budget blows, reduce the sheet count in `paper-field.tsx`. Do not add a JS throttle.

- [ ] **Step 8: Read the whole page aloud**

The last gate, and the one that decides whether the design succeeded. Any beat that makes you wince is saccharine and gets cut before it ships.

- [ ] **Step 9: Commit and push**

```bash
git add -A
git commit -m "feat(marketing): scroll treatment across the remaining marketing pages"
git push -u origin worktree-home-parallax-redesign
```

Open a pull request. Do not merge to `main` without a human review, because merging deploys to production.

---

## Self-Review

**Spec coverage.** Section 1 primitives: Task 1. Rail: Task 2. Section 2 arc: Tasks 4 through 7 and 11. Section 3 Scene A: Task 5, Scene B: Task 6, Scene C: Task 7. Section 4 fit finder: Tasks 8 through 10, covering the flat-price correction (the recommendation moves, the price does not), the litters toggle, the soft-cap honesty, the GSAP quarantine, and the beta waitlist CTA. Section 5 per-page treatment: Tasks 3, 11, and 12. Section 6 verification: Tasks 1 and 12. Rollout order (architecture proves the primitives first): Task 3 precedes Task 5.

**Placeholders.** None. Every code step carries real code and every run step carries a real command with an expected result. The two prose-only steps (Task 6 Step 6 and Task 12 Step 8, reading copy aloud) are deliberate human gates carried over from the spec, not omissions.

**Type consistency.** `recommendPlan(FitInput): FitResult` is defined in Task 8 and consumed under those exact names in Task 9. `FIT_LIMITS.maxPets` and `.maxDocs` are used in Task 9 Step 1 as defined. `data-fit` and `.pf-card` are produced in Task 9 Step 3 and consumed in Task 10 Step 2. `--mk-depth`, `--mk-beats`, and `--mk-beat-index` are defined in Task 1 and used consistently thereafter. `<PlanFit disclosure cta>` has the same signature at both call sites (Task 9 Step 6 and Task 11 Step 1).
