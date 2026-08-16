# Marketing scroll redesign: CSS scroll system + narrative home page

Date: 2026-08-16
Status: approved design, ready for implementation planning

## Problem

The marketing home page is nine sections that could be reordered without a
visitor noticing. Every section shares one rhythm: eyebrow, display heading,
lead paragraph, symmetric grid, same container, same width. That structural
sameness, not the palette or the typography, is what reads as generic.

The design tokens are already distinctive and are kept: Fraunces display,
Inter body, JetBrains mono, warm paper background, forest green accent, amber
eyebrows, mono citation badges.

The second problem is aim. The page argues an infrastructure case (permanent
record, source-cited extraction, provenance) to an audience whose actual stake
is the 11pm emergency-vet question and the history their animal cannot tell
them. The existing H1, "They can't tell you their history," already knows this;
the rest of the page changes the subject.

## Strategy

Lead with the stake, prove with the instrument. Emotional truth opens, rigor
closes. Through the middle of the page, the animal's life is the structural
device: the scroll is the timeline, and what are currently separate feature
strips become episodes in that life.

Scroll motion is CSS-first: `position: sticky` for pinned scenes as the
universally supported backbone, CSS scroll-driven animations
(`animation-timeline: view()` / `scroll()`) as progressive enhancement behind
`@supports`. GSAP appears in exactly one component (the pricing fit-finder) and
is dynamically imported.

Explicitly rejected: the `perspective: 1px` + `translateZ` parallax hack. It
requires moving scroll from the window into an inner container, which breaks the
sticky `mk-header`, the `#main` skip link, the `#waitlist` anchor CTA, Next.js
scroll restoration, and mobile URL-bar collapse.

Also rejected: cross-route View Transitions. They add latency to every
navigation to demonstrate capability. Scroll within a page, instant between
pages.

## Section 1: Scroll primitives

All primitives live in `app/(marketing)/marketing.css`. No page invents its own
scroll behavior.

### `.mk-parallax`

Ambient depth. An element declares a depth and drifts against the scroll.

```css
.mk-parallax {
  --mk-depth: 1;              /* 1 = slowest / furthest back */
  will-change: transform;
  animation: mk-drift linear both;
  animation-timeline: view();
  animation-range: cover 0% cover 100%;
}
@keyframes mk-drift {
  from { transform: translate3d(0, calc(var(--mk-depth) * 6vh), 0); }
  to   { transform: translate3d(0, calc(var(--mk-depth) * -6vh), 0); }
}
```

Transform only, so it composites off the main thread. The entire authoring API
is one custom property.

### `.mk-scene`

Pinned-scene shell. Tall outer section, sticky inner stage, beat count declared
as `--mk-beats` (one viewport per beat).

```css
.mk-scene {
  --mk-beats: 3;
  min-height: calc((var(--mk-beats) + 1) * 100svh);
  scroll-timeline: --scene block;
}
.mk-scene-stage {
  position: sticky;
  top: 0;
  height: 100svh;
  display: grid;
  place-items: center;
}
.mk-beat {
  animation: mk-beat linear both;
  animation-timeline: --scene;
}
```

Each beat is a declarative `animation-range` slice of the parent's progress, not
a JS scroll listener. `svh` rather than `vh` throughout: `vh` on iOS Safari is
wrong while the URL bar is visible, and a stage a few pixels too tall jitters.

Hard cap of four beats per scene. Past that, visitors scroll frantically to
escape.

### `.mk-crossfade`

The non-pinning version for sections that want depth without cost. Sibling
layers fade and scale against `view()`. Most of the page uses this.

### `.mk-rail`

Persistent left-edge progress element. Thin vertical line that fills with scroll
progress, current chapter name in mono beside it. It makes the page read as one
document rather than a stack, and it answers "where am I, how much is left,"
which is the standard complaint about scroll-driven sites. In Chapter 2 its
labels switch from chapter names to ages.

### Support and motion contract

Every primitive sits inside `@supports (animation-timeline: view())`. Outside
that block the page is the current static layout with the existing `.mk-reveal`
entrance and no pinning: `.mk-scene` collapses to `min-height: auto`, the stage
un-sticks, all beats render stacked and visible.

`prefers-reduced-motion: reduce` collapses identically. Not slower, not shorter,
absent. Beats become a static stack, drift becomes `none`, the rail marks
position without animating. The existing block at `marketing.css:478` is
extended, not replaced.

No JavaScript polyfill for unsupported browsers. A complete static page is the
correct fallback.

## Section 2: Narrative arc of the home page

Nine sections become six chapters, and none of the six can be reordered.

**Chapter 0, hero.** Keeps the existing H1. Replaces the two-column
type-plus-mock grid with type over a deep field of drifting documents: vet
invoices, a rabies certificate, a discharge summary, a fax, a handwritten weight
log. Each at its own `--mk-depth`, rotated, overlapping. It reads as the mess
first. The waitlist CTA stays exactly where it is; nothing pins above the fold,
and the first screen is scrollable and clickable immediately.

**Chapter 1, pinned Scene A: The Shoebox.** The hero's drifting paper is
resolved rather than replaced.

**Chapter 2, the life.** The scroll becomes one animal's timeline (Maple, litter
to senior). The rail switches to ages. Four current sections are absorbed as
episodes rather than pitches:

- 8 weeks: arrival with history attached, transferred from the kennel
  (`BreederStrip`)
- 6 months: reminders, vaccine series completing, weight curve (`Lifecycle`)
- 3 years: the trip, APHIS 7001, boarder link, destination readiness
  (`TravelStrip`)
- 9 years: the emergency, insurance claim, pre-existing-condition review, full
  history handed over in one link. This moment is not on the page today and is
  the highest-stakes moment in the product.

**Chapter 3, the proof.** `Claims` survives ("proof not vibes", "a human in the
loop", "your data is not the product") but stops being a three-up grid. It goes
asymmetric, roughly one claim per screen, and contains pinned Scene C.

**Chapter 4, pricing.** The fit-finder (Section 4 below).

**Chapter 5, the close.** Waitlist. Short, no ornament, no parallax. After a very
long page, stopping the motion is the strongest available move.

`FormatTicker` moves to just under the hero as a palate cleanser. `Faq` moves
below pricing.

### Narrative discipline

Maple never receives adjectives, a personality, or "beloved companion." She
receives dates, weights, doses, and clinic names. The emotion comes entirely
from the reader supplying their own animal. This restraint is the difference
between the design landing and curdling into sentiment.

## Section 3: The three pinned scenes

### Scene A: The Shoebox (`--mk-beats: 4`)

Approximately 14 paper elements, rendered in DOM from existing tokens (no raster
images), themed correctly in dark mode.

1. `entry 0% -> cover 25%`: inherited hero state. Scattered, rotated -14deg to
   +11deg, per-element `--mk-depth`, still drifting. Nothing has happened.
2. `cover 25% -> 50%`: convergence. Papers animate to a common center, rotation
   eases to 0, z-order collapses into a squared stack roughly 14 sheets thick
   with visible 1px edges. The point of the beat is that a tidy pile is still
   useless.
3. `cover 50% -> 75%`: the read. A horizontal scan line sweeps the top sheet
   (the existing `@keyframes mk-scan` idea at full scale). Facts lift off as
   chips (date, drug, dose, weight), each carrying a mono `mk-cite` badge.
4. `cover 75% -> exit`: the resolve. Paper stack fades back and down, chips land
   into a single date-ordered timeline card rendered as real Pawdex UI. The last
   element to appear is the "reviewed by you" confirmation, making
   human-in-the-loop structural rather than a bullet.

Copy budget for the entire scene: one mono line, pinned bottom-left, changing
per beat: "a shoebox", "a tidy shoebox", "read, cited", "a record".

### Scene B: The Life (`--mk-beats: 4`)

Four discrete tableaux that cross-dissolve, unlike Scene A's single continuous
transformation. Persistence comes from the rail (ages) and a hairline spine
running the stage height.

1. 8 weeks: transfer card from `lifecycle.tsx` ("Maple joined your household",
   "transferred from Hickory Ridge Goldens", "with history") over litter record
   rows.
2. 6 months: reminder and series view, DHPP dose 3 completing, weight curve
   drawing itself via `stroke-dasharray` on the same timeline, rabies scheduled
   at 16 weeks.
3. 3 years: APHIS 7001 worksheet, destination readiness, boarder share link,
   staged as an event in progress rather than a feature list.
4. 9 years: deliberately quieter and darker. Stage background shifts toward
   `--mk-ink-band`, the only warm section on the page. Emergency card, one-link
   history handover, insurance claim with pre-existing-condition review. One
   line of copy: "9:42pm. Someone asks when her last rabies was. You already
   know."

That line is the only overtly emotional sentence in the design and works because
everything around it is dates and doses.

### Scene C: The Citation (`--mk-beats: 2`)

Inside Chapter 3.

1. A timeline fact, "Rabies - 3-year - 2024-03-11", showing its mono citation
   badge.
2. The badge expands leftward into the source PDF page with the exact line
   highlighted and a mono label reading "page 14 of 41". The connector between
   fact and source is drawn, not implied.

This converts the unverifiable stat "100% of extracted facts link back to the
exact page" into something the visitor watches happen.

### Scene constraints

- All scene content exists in the DOM as real, ordered text before any animation
  applies. Beats reveal what is already there. A screen reader walking the page
  linearly gets Maple's timeline as a sensible ordered document with no beat
  scaffolding exposed. Decorative paper is `aria-hidden`.
- Without support, or with reduced motion: Scene A renders the resolved timeline
  card, Scene B renders all four ages as a vertical list, Scene C renders fact
  and source side by side.
- Scene A's papers are the heaviest thing on the site. All CSS and inline SVG,
  no raster images, no additional web fonts. `content-visibility: auto` on
  off-screen scenes.

## Section 4: Pricing fit-finder

### Correction to the original concept

Tiers in `lib/billing/plans.ts` are flat: Free $0, Household $6/mo ($60/yr),
Breeder $29/mo ($290/yr). There is no per-unit price to recompute, so this is a
fit finder, not a calculator. The inputs move the recommendation, not the number.

### Inputs

- Pets: 1 to 10+ (drag slider)
- Documents per month: 0 to 40+ (drag slider)
- "I place litters" (toggle)

The toggle is required, not optional. Nothing between Household and Breeder is a
quantity; the discriminator is a boolean capability (litters, whelping records,
placement transfers, kennel branding). A pure quantity slider would leave
Breeder unreachable and the scene would look broken.

### Framing

The record is uncapped on every tier: pets, reminders, sharing, and export are
unlimited even on Free. The only metered thing in the entire product is AI
extraction (10/month on Free), because it is the only real per-unit cost. The
documents-per-month slider therefore exposes the one true meter in the system.

Headline: "The record is unlimited on every plan. Reading documents at scale is
the only thing that costs us anything, so it's the only thing we meter."

### Behavior

All three cards remain on screen at desktop widths. Dragging either slider live
updates the recommendation: the fitting tier lifts on z, gains border and shadow,
and saturates, while the others recede and desaturate. GSAP tweens these so
transitions are interruptible mid-drag rather than restarting, which is the
actual justification for the dependency over CSS transitions.

As the documents slider passes 10, the Free card's "10 extractions / month" row
visibly fills and overflows, and the card steps back on its own. The visitor
watches themselves outgrow the free tier rather than being told they will. This
matches what the entitlement code actually does.

The Breeder card renders its 50-animal cap as what `plans.ts` says it is: "Soft
cap at 50 active animals. We'll ask, we never lock the record." It is not
presented as a hard limit.

### Mobile and accessibility

Below the desktop breakpoint, cards become a GSAP Draggable carousel with
inertia and snap; sliders become steppers with large touch targets. At every
width the control is backed by real `<input type="range">` semantics, with
arrow keys, Home/End, visible focus, and an accessible announcement of the
recommendation. A drag-only pricing control would be invisible to assistive
technology.

### GSAP boundary

GSAP is licensed free for commercial use including former Club plugins
(Webflow, April 2025). It is loaded via
`dynamic(() => import(...), { ssr: false })`, triggered by an
`IntersectionObserver` as the pricing chapter approaches. The static three-card
grid is server-rendered and fully functional before GSAP loads. Hero LCP never
pays for it. With JS off or the import failed, a working pricing table remains.
GSAP enhances a real component; it does not constitute one.

### Beta state

All current users and waitlist joiners sit on `early_access` (everything free
during beta). The home page pricing chapter therefore closes on the waitlist,
not checkout, reframing the result as "Here's what you'd be on after beta. It's
free until then." The existing `TIER_DISCLOSURE` auto-renewal string is
COMPLIANCE-OWNED and is not modified. One component ships to both `/pricing` and
the home chapter, with a prop switching the CTA between checkout and waitlist.

## Section 5: Treatment per page

| Page | Treatment |
| --- | --- |
| Home | Full: three pinned scenes, ambient depth, rail, fit-finder |
| Pricing | Fit-finder plus ambient depth and rail. No pinned scenes: visitors arrive with intent and a decision to make |
| About | Ambient depth plus one pinned scene |
| Architecture | Ambient depth plus scroll-linked diagram assembly as the prose describes it |
| Privacy, Terms, Accessibility | Rail for reading position and an in-page table of contents. No motion |
| Contact | Nothing. It is a form |

`SiteHeader` keeps its current sticky behavior and gains a compact persistent
CTA that appears once the hero scrolls past, because a meaningful share of
visitors on a page this long will never reach the bottom CTA.

`LegalShell` gains the rail and the table of contents, which is a larger real
improvement to those three pages than any animation.

## Section 6: Verification

The failure mode being designed against is not a build error. It is a section
that pins and never releases, trapping the visitor.

Manual matrix, run before push (main auto-deploys to production, so the pre-push
gate is the only gate):

- Chrome desktop with support: the intended experience
- Safari on a real iOS device: `svh` vs `vh` and URL-bar collapse
- A browser with `animation-timeline` unsupported or forced off: every scene
  renders as a complete static stack
- OS-level reduced motion: scenes collapse rather than slow
- Keyboard-only pass through the fit-finder: tab in, arrows move both sliders,
  toggle reachable, focus visible, recommendation announced
- Screen reader linear read of the home page: Maple's timeline reads as an
  ordered document with no beat scaffolding

Automated:

- `axe-core` (already a devDependency) over the home page in both motion states
- A regression check asserting every `.mk-scene` releases: the sticky stage's
  parent computes taller than the stage, and no ancestor of a sticky element
  sets `overflow: hidden`, the most common cause of sticky silently failing
- `pnpm check` (tsc plus the existing test suite) before push

Performance, via the Speed Insights already installed: LCP must not regress and
the hero must stay interactive during the drifting-paper animation. If the
compositor budget blows, the mitigation is fewer sheets, not a JS throttle.

Content gate: read the entire Maple narrative aloud once. Any beat that makes
the author wince is saccharine and is cut.

## Rollout

Primitives land first and are proven on `/architecture`, which is low-traffic
and diagram-heavy, before the home page depends on them. Then Scene A and the
hero, then Chapter 2, then the fit-finder, then the remaining pages.

## Out of scope

- Cross-route View Transitions
- Any JavaScript scroll-position listener or parallax library
- Changes to the design tokens, palette, or typefaces
- Changes to `TIER_DISCLOSURE` or any compliance-owned copy
- Changes to prices or entitlement limits in `lib/billing/plans.ts`
