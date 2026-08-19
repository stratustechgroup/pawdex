/**
 * Design ban list, enforced.
 *
 * Every rule below is a named constraint on the marketing surface. They were
 * applied once by hand; this file is what stops them creeping back in six
 * weeks, which is what always happens otherwise.
 *
 * Static analysis only: reads the marketing source, no browser, no server.
 * Run: node scripts/test-design-bans.mjs
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, extname } from "node:path";

let passed = 0;
let failed = 0;
const failures = [];
function check(cond, msg) {
  if (cond) passed++;
  else {
    failed++;
    failures.push(msg);
    console.error("FAIL: " + msg);
  }
}

// ── Collect the marketing surface ───────────────────────────────────────
const ROOTS = ["app/(marketing)", "components/marketing"];
const files = [];
function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else if ([".tsx", ".ts", ".css"].includes(extname(p))) files.push(p);
  }
}
for (const r of ROOTS) walk(r);

const src = new Map(files.map((f) => [f, readFileSync(f, "utf8")]));
const css = [...src].filter(([f]) => f.endsWith(".css"));
const tsx = [...src].filter(([f]) => f.endsWith(".tsx"));

/** Strip block and line comments so a rule's own explanation never trips it. */
function code(text, isCss) {
  let out = text.replace(/\/\*[\s\S]*?\*\//g, "");
  if (!isCss) out = out.replace(/^\s*\/\/.*$/gm, "");
  return out;
}

function scan(label, re, { cssOnly = false, tsxOnly = false } = {}) {
  const set = cssOnly ? css : tsxOnly ? tsx : [...src];
  const hits = [];
  for (const [f, text] of set) {
    const body = code(text, f.endsWith(".css"));
    for (const line of body.split("\n")) {
      if (re.test(line)) hits.push(`${f}: ${line.trim().slice(0, 70)}`);
    }
  }
  check(hits.length === 0, `${label} -> ${hits.slice(0, 4).join(" | ")}`);
}

// ── The ban list ────────────────────────────────────────────────────────
scan("em-dash anywhere on the marketing surface", /—/);
scan("en-dash used as a separator", /–/);
scan("drop shadows", /box-shadow\s*:(?!\s*none)/, { cssOnly: true });
scan("liquid glass / backdrop blur", /backdrop-filter/, { cssOnly: true });
scan("radial orbs and mesh gradients", /radial-gradient/, { cssOnly: true });
scan("soft corner radius", /border-radius\s*:(?!\s*0\s*;)/, { cssOnly: true });
scan("hover animations that move an element", /:hover[^{]*\{[^}]*transform/);
scan("lucide icon imports", /from ["']lucide-react["']/);
scan(
  "hand-rolled icon paths on the marketing surface",
  /<path\s+d=["']M[\d.]/,
  { tsxOnly: true },
);
scan("neon or pure-black/pure-white literals", /#000000\b|#ffffff\b|#fff\b|#000\b/, {
  cssOnly: true,
});
scan(
  "emoji",
  /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2728}\u{2B50}]/u,
);
scan("the 'not X, Y' construction in visible copy", /\b(?:is|are|it's|its) not [a-z]+,/i);
scan("dot grid backgrounds", /background-image:[^;]*radial-gradient[^;]*circle/, {
  cssOnly: true,
});
scan("transition on transform (hover motion)", /transition:[^;]*transform/, {
  cssOnly: true,
});

// ── Structural rules that need counting, not grepping ───────────────────

// Colour lives in tokens. A hex on a custom-property line is the palette being
// defined, which is correct; a hex anywhere else is a colour smuggled into a
// rule, which is how a one-accent surface quietly becomes a three-accent one.
{
  const stray = [];
  for (const [f, t] of css) {
    for (const line of code(t, true).split("\n")) {
      if (!/#[0-9a-fA-F]{3,8}\b/.test(line)) continue;
      if (/^\s*--[a-z0-9-]+\s*:/.test(line)) continue; // token definition
      if (/data:image\/svg/.test(line)) continue; // the grain texture
      stray.push(`${f}: ${line.trim().slice(0, 60)}`);
    }
  }
  check(
    stray.length === 0,
    `raw colour outside the token block: ${stray.slice(0, 4).join(" | ")}`,
  );
}

// Eyebrow budget: at most ceil(sections / 3) on the home page. Counted across
// the components the home page actually imports, because unmounted components
// cannot contribute to a rhythm nobody sees.
{
  const home = code(readFileSync("app/(marketing)/home/page.tsx", "utf8"), false);
  const imported = [...home.matchAll(/from "@\/components\/marketing\/([a-z-]+)"/g)].map(
    (m) => `components/marketing/${m[1]}.tsx`,
  );
  const bodies = imported
    .filter((f) => src.has(f))
    .map((f) => code(src.get(f), false));
  const eyebrows = bodies.join("\n").match(/className="mk-eyebrow/g)?.length ?? 0;
  const sections = home.match(/<(section|Scene|Hero|Claims|Faq)/g)?.length ?? 0;
  const budget = Math.max(2, Math.ceil(sections / 3));
  check(
    eyebrows <= budget,
    `home renders ${eyebrows} eyebrows, budget is ${budget} for ${sections} sections`,
  );
}

// Feature lists must not carry tick/cross glyph columns. The first version of
// this check looked for a literal name="check", and missed
// name={f.included ? "check" : "x"} entirely, which is exactly how the
// checkmarks came back. Match the icon name anywhere in a feature list block.
{
  const hits = [];
  for (const [f, t] of tsx) {
    const body = code(t, false);
    // Any icon whose name expression mentions "check" or "x" sitting inside a
    // list item that also carries a feature class.
    const re =
      /<li[^>]*className=\{?`?[^>]*(?:pf-feature|mk-feature|feature)[^>]*>[\s\S]{0,240}?<[A-Z]\w*Icon?[^>]*name=\{?[^>]*["'](?:check|x)["']/;
    if (re.test(body)) hits.push(f);
    if (/className="pf-check"/.test(body)) hits.push(f);
  }
  check(
    hits.length === 0,
    `checkmark bullets in a feature list: ${[...new Set(hits)].join(", ")}`,
  );
}

// Three equal pricing columns.
{
  const cssText = css.map(([, t]) => code(t, true)).join("\n");
  check(
    !/\.pf-track\s*\{[^}]*repeat\(3,/.test(cssText),
    "pricing renders three equal tier columns",
  );
}

// ════════════════════════════════════════════════════════════════════════
// Second wave. Every rule below is a named item from the standing design
// ban list, turned into something a machine can fail on.
//
// The first wave was written when the surface was cut from eighteen screens
// to five. These were added with the records-ledger redesign, because a ban
// that only lives in a conversation is a ban that lasts until the next one.
// ════════════════════════════════════════════════════════════════════════

// Colour gradients. mask-image gradients are alpha ramps, not colour, and are
// how the ticker fades at its edges; those stay. A gradient that paints colour
// is the thing being banned.
{
  const hits = [];
  for (const [f, t] of css) {
    const body = code(t, true);
    for (const line of body.split("\n")) {
      if (!/linear-gradient|conic-gradient/.test(line)) continue;
      if (/mask-image|mask:/.test(line)) continue;
      hits.push(`${f}: ${line.trim().slice(0, 60)}`);
    }
    // Multi-line declarations: catch `background: linear-gradient(` blocks
    // whose property sits on the line above the gradient call.
    const multi = body.match(
      /(?:background|background-image)\s*:\s*(?:linear|conic)-gradient/g,
    );
    if (multi) hits.push(`${f}: ${multi.length} gradient background(s)`);
  }
  check(hits.length === 0, `colour gradient -> ${[...new Set(hits)].slice(0, 4).join(" | ")}`);
}

// Banned typefaces. These three are the house style of generated marketing
// pages; the surface carries Archivo instead.
scan("Inter / Geist / Space Grotesk on the marketing surface", /\b(Inter|Geist|Space_Grotesk|Space Grotesk)\b/);

// Skeleton loaders. A marketing page renders server-side with the data already
// in hand; a shimmer block there is a drawing of loading, not loading.
scan("skeleton loader", /[Ss]keleton/);

// Sparkle / star "AI" iconography, and the animated arrow.
scan("sparkle or star iconography", /["'{]\s*(sparkle|sparkles|star|wand|magic)\s*["'}]|name="sparkle/i);
{
  const cssText = css.map(([, t]) => code(t, true)).join("\n");
  const hits = [...cssText.matchAll(/\.[a-z-]*arrow[a-z-]*\s*\{[^}]*\}/g)]
    .filter((m) => /animation|transition/.test(m[0]))
    .map((m) => m[0].slice(0, 50));
  check(hits.length === 0, `animated arrow -> ${hits.slice(0, 3).join(" | ")}`);
}

// Motifs.
scan("terminal / code-window chrome", /terminal|traffic-light|window-dots|titlebar/i);
scan("testimonials (there are no customers yet, so any quote is invented)", /testimonial|quote-card|customer-quote/i);
scan("bento grid", /bento/i);

// Three across. The three-equal-column feature row is the single most
// recognisable generated layout; the pricing check already covers .pf-track,
// this covers every other track on the surface.
{
  const hits = [];
  for (const [f, t] of css) {
    for (const m of code(t, true).matchAll(
      /([.#][a-z0-9-]+)\s*\{[^}]*grid-template-columns\s*:\s*repeat\(3,/g,
    )) {
      hits.push(`${f}: ${m[1]}`);
    }
    for (const m of code(t, true).matchAll(
      /([.#][a-z0-9-]+)\s*\{[^}]*grid-template-columns\s*:\s*(?:1fr\s+){2}1fr\s*;/g,
    )) {
      hits.push(`${f}: ${m[1]} (1fr 1fr 1fr)`);
    }
  }
  check(hits.length === 0, `three equal columns -> ${[...new Set(hits)].slice(0, 4).join(" | ")}`);
}

// The coloured left stripe. A hairline rule in the neutral rule token is the
// surface's own grid and is fine; a left border painted in the accent is the
// callout-box cliche.
{
  const hits = [];
  for (const [f, t] of css) {
    for (const line of code(t, true).split("\n")) {
      if (!/border-left\s*:/.test(line)) continue;
      if (/var\(--(mk-rule|pw-border)/.test(line) || /:\s*0/.test(line)) continue;
      hits.push(`${f}: ${line.trim().slice(0, 60)}`);
    }
  }
  check(hits.length === 0, `coloured left stripe -> ${hits.slice(0, 3).join(" | ")}`);
}

// ── Palette bounds ──────────────────────────────────────────────────────
// Purple, neon and nursery pastel are all ruled out. Rather than blocklisting
// hex strings (which only ever catches the exact shade someone already used),
// convert every declared token to HSL and reject whole regions of the space.
{
  function hsl(hex) {
    let h = hex.replace("#", "");
    if (h.length === 3) h = [...h].map((c) => c + c).join("");
    const r = parseInt(h.slice(0, 2), 16) / 255;
    const g = parseInt(h.slice(2, 4), 16) / 255;
    const b = parseInt(h.slice(4, 6), 16) / 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const l = (max + min) / 2;
    let s = 0;
    let hue = 0;
    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      if (max === r) hue = ((g - b) / d + (g < b ? 6 : 0)) * 60;
      else if (max === g) hue = ((b - r) / d + 2) * 60;
      else hue = ((r - g) / d + 4) * 60;
    }
    return { h: hue, s: s * 100, l: l * 100 };
  }

  const purple = [];
  const neon = [];
  const pastel = [];
  for (const [f, t] of css) {
    for (const line of code(t, true).split("\n")) {
      const m = line.match(/^\s*(--[a-z0-9-]+)\s*:\s*(#[0-9a-fA-F]{3,6})\b/);
      if (!m) continue;
      const [, name, hex] = m;
      const c = hsl(hex);
      const where = `${f}: ${name} ${hex}`;
      // Purple / violet / magenta with any real chroma in it.
      if (c.h >= 255 && c.h <= 330 && c.s > 12) purple.push(where);
      // Neon: screaming saturation at mid lightness.
      if (c.s > 85 && c.l >= 40 && c.l <= 75) neon.push(where);
      // Nursery pastel: tinted and washed out at once.
      if (c.l > 82 && c.s > 22) pastel.push(where);
    }
  }
  check(purple.length === 0, `purple in the palette -> ${purple.slice(0, 3).join(" | ")}`);
  check(neon.length === 0, `neon in the palette -> ${neon.slice(0, 3).join(" | ")}`);
  check(pastel.length === 0, `pastel in the palette -> ${pastel.slice(0, 3).join(" | ")}`);
}

// ── Positive rules ──────────────────────────────────────────────────────
// "No real product demos" is on the ban list as a sin, not a permission: the
// home page must render actual product components, not a drawing of them.
{
  const home = code(readFileSync("app/(marketing)/home/page.tsx", "utf8"), false);
  const imported = [...home.matchAll(/from "@\/components\/marketing\/([a-z-]+)"/g)].map(
    (m) => `components/marketing/${m[1]}.tsx`,
  );
  const tree = imported
    .filter((f) => src.has(f))
    .map((f) => src.get(f))
    .join("\n");
  check(
    /ProductSurface|@\/components\/pawdex\//.test(tree),
    "home page renders real product components rather than a mock",
  );
}

console.log(`\ndesign bans: ${passed} passed, ${failed} failed`);
if (failed) {
  console.error("\n" + failures.map((f) => "  - " + f).join("\n"));
  process.exit(1);
}
