/**
 * Screenshot the AUTHENTICATED app across viewports and themes.
 *
 * The marketing surface has had a shot harness for a while; the signed-in app
 * never did, which is why design regressions inside the product were only ever
 * caught by hand. This logs in with a magic link minted by the cockpit e2e
 * harness, then walks a representative route list.
 *
 * Phone first, and phones first in the list, because the product brief is that
 * the web app IS the phone experience until a native app ships.
 *
 * Usage:
 *   node scripts/test-cockpit-e2e.mjs setup
 *   pnpm exec next start -p 3700
 *   node scripts/test-cockpit-e2e.mjs magiclink      # once, to bootstrap
 *   CALLBACK_URL="<from magiclink>" node scripts/shoot-app.mjs
 *
 * Env: APP_ORIGIN (default http://localhost:3700), OUT, CALLBACK_URL,
 *      STATE (storage-state path, reused when CALLBACK_URL is absent),
 *      ONLY (comma-separated route substrings to filter the list).
 */
import { chromium } from "@playwright/test";
import { mkdirSync, existsSync } from "node:fs";

const ORIGIN = process.env.APP_ORIGIN ?? "http://localhost:3700";
const OUT = process.env.OUT ?? "/tmp/pawdex-app-shots";
const STATE = process.env.STATE ?? "/tmp/pawdex-app-state.json";
mkdirSync(OUT, { recursive: true });

const ROUTES = [
  ["dashboard", "/"],
  ["expiring", "/expiring"],
  ["inbox", "/inbox"],
  ["insurance", "/insurance"],
  ["vets", "/vets"],
  ["ask", "/ask"],
  ["reminders", "/reminders"],
  ["settings", "/settings"],
];

const VIEWPORTS = [
  { name: "phone", width: 390, height: 844 },
  { name: "desktop", width: 1440, height: 900 },
];

const only = process.env.ONLY?.split(",").map((s) => s.trim()).filter(Boolean);
const routes = only
  ? ROUTES.filter(([n, p]) => only.some((o) => n.includes(o) || p.includes(o)))
  : ROUTES;

const browser = await chromium.launch();

// Log in once and persist the session, so each viewport/theme context reuses it
// instead of burning a single-use magic link per pass.
if (process.env.CALLBACK_URL) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(process.env.CALLBACK_URL, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  await ctx.storageState({ path: STATE });
  console.log("logged in ->", page.url());
  await ctx.close();
}
if (!existsSync(STATE)) {
  console.error("No storage state. Pass CALLBACK_URL on the first run.");
  process.exit(1);
}

let shots = 0;
for (const vp of VIEWPORTS) {
  for (const scheme of ["light", "dark"]) {
    const ctx = await browser.newContext({
      storageState: STATE,
      viewport: { width: vp.width, height: vp.height },
      colorScheme: scheme,
      deviceScaleFactor: 2,
      isMobile: vp.name === "phone",
      hasTouch: vp.name === "phone",
    });
    const page = await ctx.newPage();
    for (const [name, path] of routes) {
      await page.goto(ORIGIN + path, { waitUntil: "networkidle" });
      await page.waitForTimeout(700);
      // Horizontal overflow is the documented failure mode on this app at
      // 360-390px, so it is measured on every shot rather than eyeballed.
      const over = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      if (over > 0) console.log(`OVERFLOW ${vp.name} ${scheme} ${path}: ${over}px`);
      await page.screenshot({ path: `${OUT}/${vp.name}-${scheme}-${name}.png` });
      shots++;
    }
    await ctx.close();
  }
}
await browser.close();
console.log(`${shots} shots ->`, OUT);
