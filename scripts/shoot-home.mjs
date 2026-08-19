/**
 * Screenshot the marketing home page across viewports and themes via Playwright.
 *
 * Companion to run-marketing-shots.sh, which needs a locally installed Chrome.
 * This one uses the Playwright chromium the repo already depends on. Looking at
 * the page is not optional: the assertions prove structure, not that it reads.
 *
 * Needs a server already up: pnpm exec next start -p 3210
 * Run: node scripts/shoot-home.mjs   (OUT=... to change the output directory)
 */
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";

const ORIGIN = process.env.ORIGIN ?? "http://localhost:3210";
const OUT = process.env.OUT ?? "/Users/jamesfarmer/.claude/jobs/5e33097d/tmp/shots";
mkdirSync(OUT, { recursive: true });

const CASES = [
  { name: "desktop-light", width: 1440, height: 900, scheme: "light" },
  { name: "desktop-dark", width: 1440, height: 900, scheme: "dark" },
  { name: "mobile-light", width: 390, height: 844, scheme: "light" },
];

const browser = await chromium.launch();
for (const c of CASES) {
  const ctx = await browser.newContext({
    viewport: { width: c.width, height: c.height },
    colorScheme: c.scheme,
    deviceScaleFactor: 2,
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(`${ORIGIN}/`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${OUT}/${c.name}-full.png`, fullPage: true });
  // Fold shot plus three scroll stops so sections can be read individually.
  for (const y of [0, 900, 1900, 2900, 3900]) {
    await page.evaluate((py) => window.scrollTo(0, py), y);
    await page.waitForTimeout(450);
    await page.screenshot({ path: `${OUT}/${c.name}-y${y}.png` });
  }
  if (errors.length) console.log(`[${c.name}] console errors:`, errors.slice(0, 5));
  else console.log(`[${c.name}] clean`);
  await ctx.close();
}
await browser.close();
console.log("shots in", OUT);
