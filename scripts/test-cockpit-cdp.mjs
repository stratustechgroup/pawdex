// CDP driver for cockpit dashboard verification. Extends the dashboard CDP
// driver with real keyboard events (Escape, Tab, arrows, Enter, and Ctrl/Cmd-K)
// and an axe-core accessibility pass. Connects to an already-running headless
// Chrome on --remote-debugging-port=9222 with a persistent --user-data-dir so
// the login cookie survives across navigations.
//
// Usage: node scripts/test-cockpit-cdp.mjs '<json steps>'
//   steps: goto|shot|eval|viewport|wait|waitText|click|clickText|type|key|axe
//   axe: { axe: "<path-to-axe.min.js>", selector?: "#main" }  → prints violations
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";

const PORT = 9222;
const SHOT_DIR =
  "/private/tmp/claude-501/-Users-jamesfarmer-projectsv4-puppy/25960530-1760-4c4f-adc6-df7534a1c433/scratchpad/shots";
mkdirSync(SHOT_DIR, { recursive: true });

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
    ws.addEventListener("message", (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(JSON.stringify(msg.error)));
        else resolve(msg.result);
      }
    });
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

function connect(url) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    ws.addEventListener("open", () => resolve(ws));
    ws.addEventListener("error", (e) => reject(new Error("ws error " + e.message)));
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const KEYS = {
  Enter: { keyCode: 13, key: "Enter", code: "Enter" },
  Escape: { keyCode: 27, key: "Escape", code: "Escape" },
  Tab: { keyCode: 9, key: "Tab", code: "Tab" },
  ArrowDown: { keyCode: 40, key: "ArrowDown", code: "ArrowDown" },
  ArrowUp: { keyCode: 38, key: "ArrowUp", code: "ArrowUp" },
  k: { keyCode: 75, key: "k", code: "KeyK" },
};

async function dispatchKey(cdp, name, { shift = false, ctrl = false, meta = false } = {}) {
  const k = KEYS[name];
  if (!k) return;
  let modifiers = 0;
  if (shift) modifiers |= 8;
  if (ctrl) modifiers |= 2;
  if (meta) modifiers |= 4;
  await cdp.send("Input.dispatchKeyEvent", { type: "keyDown", modifiers, ...k });
  await cdp.send("Input.dispatchKeyEvent", { type: "keyUp", modifiers, ...k });
}

async function main() {
  const steps = JSON.parse(process.argv[2] ?? "[]");
  const wsUrl = await getPageTarget();
  const ws = await connect(wsUrl);
  const cdp = new CDP(ws);
  await cdp.send("Page.enable");
  await cdp.send("Runtime.enable");
  await cdp.send("Network.enable");

  for (const step of steps) {
    if (step.viewport) {
      await cdp.send("Emulation.setDeviceMetricsOverride", {
        width: step.viewport[0],
        height: step.viewport[1],
        deviceScaleFactor: 1,
        mobile: step.viewport[0] < 500,
      });
      console.log(`viewport ${step.viewport[0]}x${step.viewport[1]}`);
    }
    if (step.goto) {
      await cdp.send("Page.navigate", { url: step.goto });
      await Promise.race([
        new Promise((res) => {
          const h = (ev) => {
            const m = JSON.parse(ev.data);
            if (m.method === "Page.loadEventFired") {
              ws.removeEventListener("message", h);
              res();
            }
          };
          ws.addEventListener("message", h);
        }),
        sleep(8000),
      ]);
      await sleep(step.settle ?? 1200);
      const loc = await cdp.send("Runtime.evaluate", {
        expression: "location.href",
        returnByValue: true,
      });
      console.log(`goto ${step.goto} -> ${loc.result.value}`);
    }
    if (step.wait) await sleep(step.wait);
    if (step.eval) {
      const r = await cdp.send("Runtime.evaluate", {
        expression: step.eval,
        returnByValue: true,
        awaitPromise: true,
      });
      console.log(`eval: ${JSON.stringify(r.result.value ?? r.result.description ?? null)}`);
    }
    if (step.waitText) {
      let found = false;
      for (let i = 0; i < 20; i++) {
        const r = await cdp.send("Runtime.evaluate", {
          expression: `document.body && document.body.innerText.includes(${JSON.stringify(step.waitText)})`,
          returnByValue: true,
        });
        if (r.result.value) {
          found = true;
          break;
        }
        await sleep(400);
      }
      console.log(`waitText ${JSON.stringify(step.waitText)}: ${found}`);
    }
    if (step.click || step.clickText) {
      const sel = step.click
        ? `[...document.querySelectorAll(${JSON.stringify(step.click)})][${step.nth ?? 0}]`
        : `[...document.querySelectorAll('a,button,[role=option],[role=menuitem]')].filter(e => e.innerText.trim().includes(${JSON.stringify(step.clickText)}))[0]`;
      const r = await cdp.send("Runtime.evaluate", {
        expression: `(() => { const el = ${sel}; if(!el) return "no match"; const b = el.getBoundingClientRect(); window.__cx=b.left+b.width/2; window.__cy=b.top+b.height/2; return "ok:"+Math.round(window.__cx)+","+Math.round(window.__cy); })()`,
        returnByValue: true,
      });
      console.log(`click ${step.click ?? step.clickText}: ${r.result.value}`);
      const m = /ok:(\d+),(\d+)/.exec(r.result.value ?? "");
      if (m) {
        const x = +m[1], y = +m[2];
        await cdp.send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", clickCount: 1 });
        await cdp.send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", clickCount: 1 });
        await sleep(step.settle ?? 900);
      }
    }
    if (step.type !== undefined) {
      for (const ch of step.type) {
        await cdp.send("Input.dispatchKeyEvent", { type: "char", text: ch });
      }
      console.log(`typed ${step.type.length} chars`);
    }
    if (step.key) {
      await dispatchKey(cdp, step.key, {
        shift: step.shift,
        ctrl: step.ctrl,
        meta: step.meta,
      });
      await sleep(step.settle ?? 300);
      console.log(`key ${step.key}${step.ctrl ? "+ctrl" : ""}${step.shift ? "+shift" : ""}`);
    }
    if (step.focused) {
      const r = await cdp.send("Runtime.evaluate", {
        expression: `(() => { const a = document.activeElement; return a ? (a.tagName + (a.getAttribute('aria-label')?(' ['+a.getAttribute('aria-label')+']'):'') + (a.id?(' #'+a.id):'')) : 'none'; })()`,
        returnByValue: true,
      });
      console.log(`focused: ${r.result.value}`);
    }
    if (step.axe) {
      const axeSrc = readFileSync(step.axe, "utf8");
      await cdp.send("Runtime.evaluate", { expression: axeSrc, returnByValue: false });
      const sel = step.selector ? JSON.stringify(step.selector) : "document";
      const r = await cdp.send("Runtime.evaluate", {
        expression: `axe.run(${sel === "document" ? "document" : sel}, { runOnly: { type: 'tag', values: ['wcag2a','wcag2aa','wcag21a','wcag21aa'] } }).then(res => JSON.stringify(res.violations.map(v => ({ id: v.id, impact: v.impact, nodes: v.nodes.length, help: v.help }))))`,
        returnByValue: true,
        awaitPromise: true,
      });
      const violations = JSON.parse(r.result.value ?? "[]");
      const serious = violations.filter((v) => v.impact === "serious" || v.impact === "critical");
      console.log(`axe(${step.label ?? sel}): ${violations.length} total, ${serious.length} serious/critical`);
      for (const v of violations) {
        console.log(`  [${v.impact}] ${v.id} (${v.nodes}): ${v.help}`);
      }
    }
    if (step.shot) {
      const r = await cdp.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: !!step.full });
      writeFileSync(`${SHOT_DIR}/${step.shot}.png`, Buffer.from(r.data, "base64"));
      console.log(`shot ${SHOT_DIR}/${step.shot}.png`);
    }
  }
  ws.close();
  process.exit(0);
}

main().catch((e) => {
  console.error("CDP ERROR:", e.message);
  process.exit(1);
});
