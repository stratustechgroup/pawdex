# Pawdex design system: Field Record

The source of truth for the front end. Tokens live in `app/globals.css`; this
file says what they mean and why they are what they are.

## What the product is, in design terms

Pawdex is a permanent, portable, cited medical record for an animal. Three
facts about it drive every decision below.

1. **The record outlives the account.** The animal is the durable entity, not
   the household. The record changes hands at adoption, rehoming, and death.
   The interface should feel like a document of record, not a subscription app.
2. **It is a phone.** Until a native app ships, the web app *is* the phone
   experience (`docs/mobile-audit.md`, and the standing PWA-grade requirement).
   It gets used one-handed in a waiting room, at a boarding-kennel counter, at
   a border crossing, in an emergency. Phone is the design target; desktop is
   the adaptation.
3. **The core job is status against time.** What is current, what is due, what
   has lapsed. Everything else is in service of answering that in one glance.

The register, then, is the artifact this product replaces: a rabies
certificate, a lab printout, a vaccination card, a pet passport. Those are
*forms* — ruled, gridded, high-contrast, tabular, undecorated, designed to be
read fast and to survive a photocopier. Not paper cosplay: no grain textures,
no torn edges, no faux stamps. The structure of a form, in a screen's own
material.

## What was replaced, and why

The previous system was warm cream, white cards, 10px radii, soft shadows, a
serif display face, and pastel status pills. Two things were wrong beyond
taste.

**The accent collided with a status.** `--pw-accent` was `#2F6F4E` and
`--pw-status-up-dot` was `#2F6F4E`. The same green meant "primary action" and
"this animal is up to date." On a screen whose entire job is conveying medical
status, the most emphatic colour was ambiguous between "press this" and
"healthy." Green is now reserved exclusively for status. The brand accent moved
to an ink blue, which is the register of forms and passports anyway.

**Cards fought the phone.** Floating rounded cards with outer margins spend
horizontal space on gutters twice over (page padding plus card padding) and
turn a record into a stack of loose boxes. At 390px that is the difference
between a readable row and a truncated one. The unit is now a **ruled row**,
full-bleed to the page gutter, separated by a hairline. A record is a list of
entries, and a list of entries is a table.

## Type

**IBM Plex Sans** for interface and prose, **IBM Plex Mono** for every number,
date, dose, weight, and identifier.

Plex was commissioned as a technical and documentation typeface. It is
slightly mechanical, has real character at small sizes, and its mono is one of
the few with genuinely good tabular figures. One superfamily covers display,
UI, and data, so the surface has a single voice.

Explicitly not: Inter, Geist, Space Grotesk (the house style of generated
product pages), and not the previous Archivo or the Source Serif display. The
serif was doing "trustworthy editorial" in an app that needs "accurate
instrument."

- Display: Plex Sans 600, tight tracking, large. `text-wrap: balance`.
- UI: Plex Sans 400/500/600.
- Data: Plex Mono 400/500 with `font-variant-numeric: tabular-nums`, always.
  Dates, weights, doses, page citations, prices, counts. If a column of it can
  be read downward, it is mono.

## Colour

Neutral cool ground, one accent, and status colours that are functional rather
than decorative.

Ground is a cool near-neutral, never pure white and never cream. Cream reads as
a lifestyle brand; this is a medical record. Surfaces sit *lighter* than the
page, and separation comes from a hairline, never from elevation.

**One accent: ink blue.** Interactive, and nothing else. It never indicates
health, urgency, or time.

**Status is never a pastel pill.** A tinted lozenge with a rounded end is both
on the ban list and bad at its job: pastel backgrounds carry almost no contrast
against a light page, so the colour does the work and the shape does none.
Status is instead a squared tag: a 1px border in the status hue, status-hue
text at full darkness, on the normal surface, with a small square marker. It
reads at arm's length, it survives greyscale because the label is always
present, and it is not carried by fill alone.

Status semantics, fixed: **green = current**, **amber = due**, **red =
lapsed**, **grey = nothing on record**. Green means one thing on this surface.

## Shape and depth

- **Radius 0.** Everywhere, all sizes. One shape system.
- **No shadows.** Structure is a 1px hairline plus spacing and density.
  Elevation is a lie on a flat page and blurred shadows are the tell.
- **No gradients.** Including the pet-photo fallbacks, which were four
  `linear-gradient` tints and are now flat tones.
- Overlays (dialogs, popovers, sheets) separate from content with a solid
  ground, a strong hairline, and a dimmed scrim, not a blur and not a shadow.

## Layout

Phone first, and literally: the phone rules are the base rules and desktop is
the media query, not the other way round.

- **Rows, not cards.** Full-bleed ruled entries. A row owns the page gutter.
- Never three equal columns. Content that wants a grid gets an asymmetric or
  auto-fit one, and collapses to rows.
- Every grid track is `minmax(0, …)`. The documented overflow bugs on this app
  were all implicit `auto` minimums refusing to shrink.
- `100dvh`, never `100vh`.
- Safe-area insets on anything pinned to an edge.

## Navigation

- **Phone: a bottom tab bar.** Primary destinations belong under the thumb, not
  behind a hamburger. The previous top bar carried a wordmark, a household
  switcher, search, a theme toggle, notifications, and an avatar in one row,
  and hid every actual destination in a menu. This is the de-crowding
  `docs/mobile-audit.md` deferred as "a design change, not a layout patch."
- **Desktop: a single top bar.** Same destinations, laid out horizontally.
- The command palette stays on both.

## Motion

Colour and opacity only. No transforms on hover, no lifting, no sliding arrows.
Everything honours `prefers-reduced-motion`. Loading is a static, hairline-
boxed placeholder matched to the shape of the content it replaces — the shape
is kept because matched loading states are a stated product priority, the
shimmer is dropped because animated shimmer is theatre.

## Enforcement

`scripts/test-design-bans.mjs` runs in `pnpm test`. It covers the marketing
surface, and its palette-bounds checks (no purple, no neon, no pastel) also
read `app/globals.css`, so the app's tokens are held to the same rule.
