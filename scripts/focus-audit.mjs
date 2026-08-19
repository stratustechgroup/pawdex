/**
 * Focus-visibility audit: tab through a page and assert every focusable stop
 * paints something a keyboard user can see.
 *
 * Written after finding 35 inline `outline: "none"` suppressions in this repo,
 * including both inputs on /login. axe does not catch a missing focus ring:
 * the element is perfectly accessible right up until someone tries to see
 * where they are.
 *
 * Needs a server on :3210. Run: node scripts/focus-audit.mjs
 */
import { chromium } from "@playwright/test";
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
for (const route of ["/login", "/onboarding", "/"]) {
  await p.goto("http://localhost:3210" + route, { waitUntil: "networkidle" });
  await p.waitForTimeout(500);
  const seen = [];
  for (let i = 0; i < 8; i++) {
    await p.keyboard.press("Tab");
    const r = await p.evaluate(() => {
      const el = document.activeElement;
      if (!el || el === document.body) return null;
      const c = getComputedStyle(el);
      const visible =
        (c.outlineStyle !== "none" && parseFloat(c.outlineWidth) > 0) ||
        (c.boxShadow && c.boxShadow !== "none");
      return {
        tag: el.tagName.toLowerCase(),
        label: (el.textContent || el.getAttribute("aria-label") || "").trim().slice(0, 22),
        visible,
        outline: `${c.outlineStyle} ${c.outlineWidth}`,
        shadow: (c.boxShadow || "none").slice(0, 28),
      };
    });
    if (r) seen.push(r);
  }
  const bad = seen.filter((s) => !s.visible);
  console.log(`${route}: ${seen.length} focusables, ${bad.length} WITHOUT a visible indicator`);
  for (const x of bad) console.log("   NO RING:", JSON.stringify(x));
}
await b.close();
