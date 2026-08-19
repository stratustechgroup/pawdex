/**
 * WCAG 2.1 AA audit of the AUTHENTICATED app, both themes, phone and desktop.
 *
 * The marketing surface has had an axe pass for a while. The signed-in
 * product, which is where people actually spend their time, had none: every
 * a11y check in this repo stopped at the login wall.
 *
 * Reuses the storage state written by scripts/shoot-app.mjs, so run that first
 * (it is what mints the session from the cockpit e2e magic link).
 *
 * Usage:
 *   pnpm exec next start -p 3700
 *   CALLBACK_URL=... node scripts/shoot-app.mjs      # once, to log in
 *   node scripts/axe-app.mjs
 */
import { chromium } from "@playwright/test";
import { readFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const axeSource = readFileSync(require.resolve("axe-core/axe.min.js"), "utf8");

const ORIGIN = process.env.APP_ORIGIN ?? "http://localhost:3700";
const STATE = process.env.STATE ?? "/tmp/pawdex-app-state.json";
if (!existsSync(STATE)) {
  console.error(`No storage state at ${STATE}. Run shoot-app.mjs first.`);
  process.exit(1);
}

const ROUTES = ["/", "/expiring", "/inbox", "/insurance", "/settings"];

const browser = await chromium.launch();
let total = 0;
for (const vp of [
  { name: "phone", width: 390, height: 844 },
  { name: "desktop", width: 1440, height: 900 },
]) {
  for (const scheme of ["light", "dark"]) {
    const ctx = await browser.newContext({
      storageState: STATE,
      viewport: { width: vp.width, height: vp.height },
      colorScheme: scheme,
    });
    const page = await ctx.newPage();
    for (const route of ROUTES) {
      await page.goto(ORIGIN + route, { waitUntil: "networkidle" });
      await page.waitForTimeout(500);
      await page.addScriptTag({ content: axeSource });
      const res = await page.evaluate(
        async () =>
          await window.axe.run(document, {
            runOnly: {
              type: "tag",
              values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"],
            },
          }),
      );
      for (const v of res.violations) {
        total++;
        console.log(
          `[${vp.name}/${scheme}] ${route} — ${v.impact} ${v.id}: ${v.help} (${v.nodes.length})`,
        );
        for (const n of v.nodes.slice(0, 2)) console.log(`      ${n.target.join(" ")}`);
      }
    }
    await ctx.close();
  }
}
await browser.close();
console.log(`\ntotal violations: ${total}`);
