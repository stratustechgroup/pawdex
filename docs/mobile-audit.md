# Pawdex mobile-compatibility audit (phone-first, 360-390px)

Read-only audit of the committed structure. No files were modified.

## Bottom line

The app is partially phone-ready. The systemic foundation is better than expected: the shared `Input`/`Textarea` primitives are 16px on mobile, the in-app record tables (vaccines, medications, medical, weight) already wrap in `overflow-x:auto` with column-shedding, most cockpit/dashboard grids collapse via `@media`, camera capture works, and Next's default `width=device-width` viewport is injected. But four categories will bite a phone user today: iOS input-zoom on most forms, sub-44px touch targets everywhere, dialogs that can put their own buttons off-screen with no scroll, and a set of fixed-width/multi-column surfaces that force horizontal page scroll (emergency card, packet/print, share link, insurance list). There is also no PWA manifest, so "installable web app" is only half-true. And the marketing header has no mobile menu at all.

Core mechanic: the codebase styles load-bearing layout through inline `style={{}}` objects. Inline styles cannot be overridden by the `@media` rules in `globals.css` (inline specificity wins), so any fixed inline `gridTemplateColumns` or fixed pixel width has no escape hatch unless it uses `auto-fit/auto-fill minmax()` or `flexWrap`. That single fact explains almost every hard break below.

---

## (a) Systemic fixes - change the pattern once

Ranked by user impact.

**1. iOS Safari zoom on almost every form input.** Safari zooms the page whenever a focused input's computed `font-size` is under 16px. The shared `components/ui/input.tsx:11` and `textarea.tsx:10` are correct (`text-base` = 16px on mobile, `md:text-sm` only >=768px), and the 4 dialogs that use them (weight, medication, vaccination, medical-event) are clean. But every form built on a local inline `inputStyle`/`fieldStyle` object hardcodes sub-16px and zooms on tap:
- `app/login/login-form.tsx:21` (14px) - the very first authenticated interaction
- `components/onboarding/ui.tsx:148` (15px) - used across identity-step and pet-step
- `app/(app)/pets/new/pet-form.tsx:609,620` (13px)
- `app/(app)/insurance/new-policy-form.tsx:136,166,49,67` (13px)
- `components/pawdex/breed-combobox.tsx:138` (13px)
- `app/(app)/settings/reminders-form.tsx:387,335` (13px)
- `app/(app)/settings/account/ui.ts:19` (14px - profile/email/password forms)
- `app/(app)/settings/household/invite-form.tsx:65,91` and `new-household-form.tsx:70,96` (13px)
- `app/(app)/breeding/create-litter-form.tsx:27` and `[litterId]/add-puppy-form.tsx:30` (13.5px)
- `app/(app)/vets/[clinicId]/edit-form.tsx:213` (13px)
- The command palette input `globals.css:954` (15px) - zooms even the primary search.

Fix once: a shared input-style helper (or a global `input,select,textarea{font-size:16px}` on `max-width:768px`) that guarantees >=16px on phones. Highest-frequency defect.

**2. Every interactive control is under the ~44px touch-target minimum.** Systemic in `components/ui/button.tsx:24-34` - the whole scale tops out at `h-9` (36px), icon buttons are `size-8`/`size-7`/`size-6` (32/28/24px). Hand-rolled controls repeat it: the vaccine row-menu is 26x26px (`vaccine-row-menu.tsx:68-69`, the known hotspot), microchip copy ~18px (`microchip-copy.tsx:52`), members Remove/Revoke 28px (`members-list.tsx:175,262`), `still-taking-button.tsx:33` and packet `Revoke` (`share-panel.tsx:305`) are `padding:0` text buttons, dropdown/select/tab rows ~28px. Fix: bump the button scale's mobile min-height and give row-menu triggers a >=44px hit area.

**3. Dialog/Sheet content has no max-height and no internal scroll.** `components/ui/dialog.tsx:64` centers content with `-translate-y-1/2` but sets no `max-h`/`overflow-y`. A dialog taller than the phone viewport pushes both its title and its submit button off-screen, unreachable. `components/ui/sheet.tsx:65` bottom sheet is `h-auto` with no scroll region. Hits core data-entry flows (log vaccine/medication/medical event). Fix: `max-h-[90dvh] overflow-y-auto` on `DialogContent`/`SheetContent`. Same latent bug in `delete-document-button.tsx:104-115`.

**4. Top-nav crowding on narrow phones.** `components/pawdex/top-nav.tsx:104` - a 56px bar with `gap:16`, `padding:0 24px`, and five 32px icon buttons (search, hamburger, theme, bell, avatar) plus logo and household switcher. With default flex-shrink it crowds and squeezes the switcher rather than scrolling the page. Two redundancies worsen it: the theme toggle appears both as a bar icon and inside the hamburger, and both the hamburger and avatar dropdown show at once. Correction to the brief: account destinations (billing, household, authorizations, activity) are NOT truly unreachable on mobile - they live in the avatar dropdown (`top-nav.tsx:288-342`), which works on touch; only the hamburger menu (`:380-472`) omits them and lacks Sign out. Fix: collapse the right cluster on mobile, make one menu authoritative.

**5. Non-responsive inline multi-column grids.** No `@media`/`sm:`/`auto-fit` fallback, stay multi-column on phones: `insurance/new-policy-form.tsx:13` (`repeat(2,1fr)`), `settings/household/invite-form.tsx:36` and `new-household-form.tsx:39` (`1fr auto auto`), `packet/share-panel.tsx:83` (`1fr 120px auto`), `eu-travel/destination-selector.tsx:39` (`1fr 1fr auto`), `insurance/[policyId]/estimate/page.tsx:120`, `claims/page.tsx:131` and `claims/[claimId]/page.tsx:87`, `labs/page.tsx:105`, `medications/[medId]/prices/page.tsx:167`.

**6. One responsive-table pattern.** Right pattern exists (`components/ui/table.tsx:9` wraps in `overflow-x-auto`; in-app record tables and `help/vaccines/page.tsx:124` wrap and shed columns). But several tables omit the wrapper and overflow the page: `share/[token]` (6 cols), `packet/page.tsx` (6 cols), `packet/aphis-7001` (5 cols), `briefing/page.tsx` (5 cols). Adopt the wrapper universally.

**7. Pet-subpage double-padding.** `pets/[petId]/layout.tsx:433` wraps children in `padding:24px 24px 56px`, and each subpage adds its own 24-32px container padding, so interior width drops to 248-264px at 360px - the tightest content column in the app, where the fixed-width breaks hurt most.

**8. Minor systemic notes.** `window.confirm` at 8 sites (`members-list.tsx:49,62`, `connected-accounts.tsx:53`, `review-form.tsx:485`, `vaccine-row-menu.tsx:41`, `pet-form.tsx:86`, `vets/[clinicId]/edit-form.tsx:74`, `vets/merge/merge-group.tsx:57`) - functional on mobile but unstyleable; low priority. No `env(safe-area-inset-*)` anywhere.

---

## (b) Per-page / per-component fixes (file:line)

**Hard breaks - real horizontal scroll (fix first):**
- `app/(app)/pets/[petId]/emergency-card/page.tsx:230,397` - both cards hard-code `width:360`, inside a `minmax(320px,360px)` grid (`:173-181`) in a ~264px column -> guaranteed page scroll. Quintessential pull-it-up-on-your-phone surface, so top-ranked despite low frequency.
- `app/share/[token]/page.tsx:274-338` - 6-column vaccination table, no `overflow-x` wrapper, not under the marketing `.mk` clip guard, so it forces real page scroll. Recipient-facing (owner sends to a vet/boarder on their phone). Also fixed 2-col `dl` at `:231`.
- `app/(app)/pets/[petId]/packet/page.tsx:295-371` - 6-col table no wrapper; `aphis-7001/page.tsx:261,367` - 5-col table + fixed 2-col form with `minWidth:130` labels.
- `app/(app)/insurance/page.tsx:143` - `minmax(360px,1fr)`: 360px min track exceeds ~312px interior -> ~48px overflow on every common phone. High impact because 360px is the modal device width.
- `app/(app)/pets/[petId]/briefing/page.tsx:305-354` - 5-col "Currently taking" table, no wrapper.
- `app/(app)/pets/[petId]/eu-travel/destination-selector.tsx:39` - `1fr 1fr auto` with two `type=date` inputs that won't shrink -> overflow at ~248px.

**Overflow / squeeze (fix next):**
- `components/marketing/site-header.tsx:28-34` + `marketing.css:657-666` - primary nav is `display:none` below 768px with no hamburger or mobile menu; only the CTA remains. Pricing and section anchors reachable only via the footer. Navigation dead-end on the first page a prospect sees; high impact for acquisition.
- `app/(app)/pets/[petId]/layout.tsx:364-412` - pet-header action cluster (`Upload` + `Export record` text buttons + menu) is `flexShrink:0` and doesn't wrap; next to the 88px photo it crushes the name/stat column at 360px.
- `app/(app)/vets/page.tsx:76` (`minmax(320px)`, ~8px overflow) and `:180` (`repeat(4,1fr)` stat row never collapses).
- `app/(app)/insurance/[policyId]/estimate/page.tsx:316` - 3-col stat grid with a 22px non-wrapping currency value overflows its ~73px column; `:120` 2-col form.
- `app/(app)/insurance/[policyId]/claims/page.tsx:131` and `claims/[claimId]/page.tsx:87` - date inputs squeezed in fixed 2-/3-col rows.
- `app/(app)/pets/[petId]/labs/page.tsx:105` - 3-col add-value form squeezes date/number inputs to ~85px.
- `app/(app)/inbox/page.tsx:177` - `minWidth:240` exceeds the ~230px content column -> ~10px overflow.
- `app/(app)/pets/[petId]/documents/[docId]/review/review-form.tsx:1880-1892` - fixed bottom footer with no `safe-area-inset-bottom` (overlaps the iOS home indicator), buttons wrap to 2-3 rows on 360px, and the spacer (`:1979`, 24px) under-compensates so content hides behind it.
- Touch-target specifics per systemic #2, plus `packet/share-panel.tsx:83` create-link 3-col form, `quality-of-life/dimension-slider.tsx:49` native range thumb (small drag target), and `cockpit/quick-add.tsx` `.pw-quick-menu` (`globals.css:1033`) which is `position:absolute; right:0; min-width:240` and not portaled/collision-aware, so it can overflow the left edge from a left-positioned trigger.

**Verified fine at 360px (no action):** dashboard `app/(app)/page.tsx` (greeting wraps, all grids collapse), pet overview `pets/[petId]/page.tsx`, settings + authorizations + reminders + ask pages, documents/expiring/activity lists (all use `flex:1;minWidth:0`+ellipsis), the in-app vaccines/medications/medical/weight tables (wrap + shed columns), login/transfer/invite wrappers, legal pages, pricing grid, the command palette (`max-height:70vh`, scroll-contained), and `breed-risk` (paused placeholder). Date inputs are native `type=date` throughout - the correct, keyboard-friendly choice on mobile. Camera capture already works (`components/pawdex/document-uploader.tsx:452`, `capture="environment"`).

---

## (c) PWA / installability checklist

| Item | Status |
|---|---|
| Viewport meta (`width=device-width, initial-scale=1`) | Present - Next.js injects it by default (no custom `viewport` export in `app/layout.tsx`) |
| `viewportFit=cover` (needed for safe-area insets) | Missing - no `viewport` export, so notched-phone insets can't be used |
| `themeColor` (browser UI tint) | Missing |
| Favicon + Apple touch icon | Present - generated from `app/icon.svg` and `app/apple-icon.tsx` |
| `manifest.json` (name, short_name, icons, start_url, display:standalone, theme/background color) | Missing entirely - Android won't offer "Install," no standalone launch |
| `apple-mobile-web-app-capable` / `appleWebApp` metadata | Missing - iOS "Add to Home Screen" opens with full browser chrome |
| Maskable icons | Missing |
| `env(safe-area-inset-*)` handling | Missing everywhere (the one fixed footer overlaps the home indicator) |
| Service worker / offline | Not present (may be out of scope pre-native) |

Minimum to call it installable: add a `manifest.ts`/`manifest.json` (name, icons incl. maskable, `start_url:"/"`, `display:"standalone"`, theme/background colors), a `viewport` export with `themeColor` and `viewportFit:"cover"`, `appleWebApp:{capable:true}`, and safe-area padding on the fixed review footer and top nav.

---

## Ranked priority list (highest user impact first)

1. Kill iOS input-zoom - one shared >=16px input rule (systemic #1). Touches nearly every form.
2. Raise touch targets to ~44px across the button scale and row menus (systemic #2).
3. Give dialogs/sheets `max-h` + scroll so submit buttons can't go off-screen (systemic #3).
4. Fix the fixed-width hard breaks: emergency-card, packet/aphis, share table, `insurance/page.tsx:143`, briefing, destination-selector.
5. De-crowd the top nav and consolidate its menus (systemic #4).
6. Add a mobile menu to the marketing header (`site-header.tsx`) - acquisition surface.
7. Convert non-responsive inline grids to `auto-fit minmax()`/stacking (systemic #5) and wrap the remaining tables (systemic #6).
8. Add the PWA manifest + viewport/theme-color/safe-area metadata (section c).

Files most worth touching first for breadth of payoff: `components/ui/button.tsx`, `components/ui/dialog.tsx`/`sheet.tsx`, `components/pawdex/top-nav.tsx`, `app/globals.css` (add a mobile input-size rule), and `app/layout.tsx` (viewport/manifest).
