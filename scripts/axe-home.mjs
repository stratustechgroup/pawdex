/**
 * WCAG 2.1 AA audit of the marketing home page, in BOTH themes, via Playwright.
 *
 * The existing run-marketing-axe.sh drives a locally installed Google Chrome
 * over CDP, which means it only runs on a machine that has Chrome at the
 * expected path. This uses the Playwright chromium the repo already depends on,
 * so it runs anywhere pnpm install has run.
 *
 * Both themes are checked because the marketing palette is declared twice (an
 * explicit data-theme toggle and prefers-color-scheme), and a contrast
 * regression can land in one and not the other.
 *
 * Needs a server already up: pnpm exec next start -p 3210
 * Run: node scripts/axe-home.mjs
 */
import { chromium } from "@playwright/test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const axeSource = readFileSync(require.resolve("axe-core/axe.min.js"), "utf8");

const b = await chromium.launch();
let total = 0;
for (const scheme of ["light", "dark"]) {
  const ctx = await b.newContext({
    viewport: { width: 1440, height: 900 },
    colorScheme: scheme,
  });
  const p = await ctx.newPage();
  await p.goto("http://localhost:3210/", { waitUntil: "networkidle" });
  await p.waitForTimeout(800);
  await p.addScriptTag({ content: axeSource });
  const res = await p.evaluate(async () =>
    await window.axe.run(document, {
      runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] },
    }),
  );
  const v = res.violations;
  total += v.length;
  console.log(`\n=== ${scheme}: ${v.length} violations ===`);
  for (const x of v) {
    console.log(`[${x.impact}] ${x.id}: ${x.help} (${x.nodes.length} nodes)`);
    for (const n of x.nodes.slice(0, 3)) console.log(`    ${n.target.join(" ")}`);
  }
  await ctx.close();
}
await b.close();
console.log(`\ntotal violations: ${total}`);
