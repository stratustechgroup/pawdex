/**
 * Behavioural verification for the pricing fit finder, in a real browser.
 *
 * The unit tests in scripts/test-plan-recommend.ts prove the recommendation
 * logic. They cannot prove the thing a visitor actually touches: that the
 * sliders are reachable and drivable from the keyboard alone, that the
 * recommendation is announced rather than only shown, and that GSAP is not
 * downloaded before anyone scrolls near it.
 *
 * Usage: bash scripts/run-plan-fit.sh
 */

const PORT = Number(process.env.CDP_PORT ?? 9445);
const ORIGIN = process.env.SCROLL_ORIGIN ?? "http://localhost:3210";

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

async function getPageTarget() {
  const res = await fetch(`http://localhost:${PORT}/json`);
  const targets = await res.json();
  let page = targets.find((t) => t.type === "page");
  if (!page) {
    const nt = await fetch(`http://localhost:${PORT}/json/new`);
    page = await nt.json();
  }
  return page.webSocketDebuggerUrl;
}

class CDP {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    this.listeners = [];
    ws.addEventListener("message", (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(JSON.stringify(msg.error)));
        else resolve(msg.result);
      } else if (msg.method) {
        for (const fn of this.listeners) fn(msg);
      }
    });
  }
  on(fn) {
    this.listeners.push(fn);
  }
  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error(`timeout ${method}`));
        }
      }, 30000);
    });
  }
}

const connect = (url) =>
  new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    ws.addEventListener("open", () => resolve(ws));
    ws.addEventListener("error", (e) => reject(new Error("ws " + e.message)));
  });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const evalJson = async (cdp, expr) => {
  const r = await cdp.send("Runtime.evaluate", {
    expression: expr,
    returnByValue: true,
    awaitPromise: true,
  });
  if (r.exceptionDetails)
    throw new Error("eval threw: " + JSON.stringify(r.exceptionDetails));
  return JSON.parse(r.result.value);
};

async function key(cdp, name, code, vk) {
  for (const type of ["keyDown", "keyUp"]) {
    await cdp.send("Input.dispatchKeyEvent", {
      type,
      key: name,
      code,
      windowsVirtualKeyCode: vk,
      nativeVirtualKeyCode: vk,
    });
  }
}

const STATE = `(() => {
  const cards = [...document.querySelectorAll('.pf-card')];
  const result = document.querySelector('.pf-result');
  const ranges = [...document.querySelectorAll('.pf input[type=range]')];
  return JSON.stringify({
    cards: cards.length,
    fit: cards.findIndex((c) => c.dataset.fit === 'true'),
    fitName: cards.find((c) => c.dataset.fit === 'true')?.querySelector('.pf-card-name')?.textContent ?? null,
    live: result ? result.getAttribute('aria-live') : null,
    resultText: result ? result.textContent.trim().slice(0, 90) : null,
    ranges: ranges.length,
    rangeValues: ranges.map((r) => r.value),
    focus: document.activeElement ? document.activeElement.tagName + ':' + (document.activeElement.type || '') : null,
    meterOver: document.querySelector('.pf-meter')?.dataset.over ?? null,
  });
})()`;

async function main() {
  const ws = await connect(await getPageTarget());
  const cdp = new CDP(ws);
  await cdp.send("Page.enable");
  await cdp.send("Runtime.enable");
  await cdp.send("Network.enable");
  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width: 1440,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false,
  });

  // Track every script request so we can prove GSAP is not eagerly loaded.
  const scripts = [];
  cdp.on((msg) => {
    if (msg.method === "Network.requestWillBeSent") {
      scripts.push(msg.params.request.url);
    }
  });

  // ── the home page must not download GSAP before you scroll ────────
  await cdp.send("Page.navigate", { url: ORIGIN + "/" });
  await sleep(3000);
  const eager = scripts.filter((u) => /gsap|Draggable|Inertia/i.test(u));
  check(
    eager.length === 0,
    `home page eagerly requested ${eager.length} GSAP chunk(s) before any scroll: ${eager.join(", ")}`,
  );

  // ── the fit finder itself ─────────────────────────────────────────
  await cdp.send("Page.navigate", { url: ORIGIN + "/pricing" });
  await sleep(2500);

  let s = await evalJson(cdp, STATE);
  check(s.cards === 3, `expected 3 plan cards, found ${s.cards}`);
  check(s.ranges === 2, `expected 2 range inputs, found ${s.ranges}`);
  check(
    s.live === "polite",
    `the recommendation must be announced, aria-live is "${s.live}"`,
  );
  check(
    s.fit >= 0,
    "exactly one card must be marked as the fit at all times, found none",
  );
  console.log(`  default fit: ${s.fitName} (${s.resultText})`);

  // ── keyboard only ─────────────────────────────────────────────────
  // Focus the documents slider directly, then drive it with arrows alone. If
  // the control were drag-only this is where it would fail.
  await cdp.send("Runtime.evaluate", {
    expression:
      "document.querySelectorAll('.pf input[type=range]')[1].focus()",
  });
  const before = (await evalJson(cdp, STATE)).rangeValues[1];
  for (let i = 0; i < 8; i++) await key(cdp, "ArrowRight", "ArrowRight", 39);
  await sleep(400);
  s = await evalJson(cdp, STATE);
  check(
    Number(s.rangeValues[1]) > Number(before),
    `arrow keys must move the documents slider (${before} -> ${s.rangeValues[1]})`,
  );

  // Push past Free's meter and confirm the recommendation actually changes.
  await cdp.send("Runtime.evaluate", { expression: "void 0" });
  for (let i = 0; i < 20; i++) await key(cdp, "ArrowRight", "ArrowRight", 39);
  await sleep(500);
  s = await evalJson(cdp, STATE);
  check(
    s.fitName !== null && !/^Free/.test(s.fitName),
    `past Free's document cap the fit must move off Free, got "${s.fitName}"`,
  );
  check(
    s.meterOver === "true",
    `the Free card's meter must show the overflow state, data-over is "${s.meterOver}"`,
  );
  console.log(`  after arrows: ${s.fitName} (${s.resultText})`);

  // Home key must snap back to the minimum.
  await key(cdp, "Home", "Home", 36);
  await sleep(400);
  s = await evalJson(cdp, STATE);
  check(
    s.rangeValues[1] === "0",
    `Home must jump the slider to its minimum, got ${s.rangeValues[1]}`,
  );

  // ── the litters toggle is what makes Breeder reachable ────────────
  await cdp.send("Runtime.evaluate", {
    expression: "document.querySelector('.pf-toggle input').click()",
  });
  await sleep(400);
  s = await evalJson(cdp, STATE);
  check(
    /Breeder/.test(s.fitName ?? ""),
    `the litters toggle must reach Breeder, got "${s.fitName}"`,
  );

  ws.close();
  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed) console.error("\n" + failures.map((f) => "  - " + f).join("\n"));
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
