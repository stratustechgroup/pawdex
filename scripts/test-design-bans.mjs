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

console.log(`\ndesign bans: ${passed} passed, ${failed} failed`);
if (failed) {
  console.error("\n" + failures.map((f) => "  - " + f).join("\n"));
  process.exit(1);
}
