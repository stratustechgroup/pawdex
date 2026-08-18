import { test, expect, type Page } from "@playwright/test";

/**
 * Multi-viewport, dual-theme sweep of the marketing surface.
 *
 * The CDP harnesses check structure at one width. This checks that the design
 * actually holds at the sizes people use, in both colour schemes, and writes a
 * contact sheet of screenshots so the result can be looked at rather than
 * inferred from assertions.
 *
 * Run: bash scripts/run-playwright.sh
 */

const BASE = process.env.SCROLL_ORIGIN ?? "http://localhost:3210";

const VIEWPORTS = [
  { name: "mobile", width: 390, height: 844 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "laptop", width: 1440, height: 900 },
  { name: "wide", width: 2560, height: 1440 },
];

const SCHEMES = ["light", "dark"] as const;
const PAGES = ["/", "/pricing"];

async function noHorizontalScroll(page: Page) {
  const { sw, cw } = await page.evaluate(() => ({
    sw: document.documentElement.scrollWidth,
    cw: document.documentElement.clientWidth,
  }));
  expect(sw, "page must not scroll sideways").toBeLessThanOrEqual(cw + 1);
}

for (const vp of VIEWPORTS) {
  for (const scheme of SCHEMES) {
    test.describe(`${vp.name} ${scheme}`, () => {
      test.use({
        viewport: { width: vp.width, height: vp.height },
        colorScheme: scheme,
      });

      for (const path of PAGES) {
        test(`renders ${path}`, async ({ page }) => {
          await page.goto(BASE + path, { waitUntil: "load" });
          await page.waitForTimeout(600);

          await noHorizontalScroll(page);

          // Nothing on the surface may carry an em-dash.
          const text = await page.evaluate(() => document.body.innerText);
          expect(text, "no em-dash in rendered text").not.toContain("—");

          // Every CTA label stays on one line: a wrapped button is broken.
          // Counted as line boxes, not element height. These buttons have a
          // fixed height, so scrollHeight says nothing about the text inside.
          const wrapped = await page.evaluate(() => {
            const bad: string[] = [];
            for (const el of document.querySelectorAll<HTMLElement>(".mk-btn")) {
              const label = [...el.childNodes].find(
                (n) => n.nodeType === Node.TEXT_NODE && n.textContent?.trim(),
              );
              if (!label) continue;
              const range = document.createRange();
              range.selectNodeContents(label);
              // One client rect per line box the text occupies.
              if (range.getClientRects().length > 1) {
                bad.push((el.innerText || "").slice(0, 24));
              }
            }
            return bad;
          });
          expect(wrapped, "CTA labels must not wrap").toEqual([]);

          // Radius zero is the shape system; nothing may opt out.
          const rounded = await page.evaluate(() => {
            const bad: string[] = [];
            for (const el of document.querySelectorAll<HTMLElement>(
              ".mk-btn, .mk-card, .pf-card, .mk-preview-stage",
            )) {
              const r = getComputedStyle(el).borderTopLeftRadius;
              if (r !== "0px") bad.push(`${el.className}:${r}`);
            }
            return bad.slice(0, 5);
          });
          expect(rounded, "one shape system, radius 0").toEqual([]);

          await page.screenshot({
            path: `${process.env.SHOT_DIR ?? "/tmp/pw"}/${vp.name}-${scheme}${path.replace("/", "-") || "-home"}.png`,
          });
        });
      }
    });
  }
}
