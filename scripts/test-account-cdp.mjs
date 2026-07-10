// Minimal Chrome DevTools Protocol driver for dashboard E2E verification.
// Connects to an already-running headless Chrome (launched separately with
// --remote-debugging-port=9222 and a persistent --user-data-dir so the auth
// session cookie survives across navigations). Reuses a single page target so
// the login session persists.
//
// Usage: node scripts/test-dashboard-cdp.mjs '<json steps>'
//   steps: [{goto|shot|eval|viewport|wait|waitText|click|type|key}]
// Screenshots saved under scratchpad/shots/<name>.png
import { mkdirSync, writeFileSync } from "node:fs";

const PORT = Number(process.env.CDP_PORT ?? 9333);
const SHOT_DIR =
  "/private/tmp/claude-501/-Users-jamesfarmer-projectsv4-puppy/25960530-1760-4c4f-adc6-df7534a1c433/scratchpad/account-shots";
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
      // Wait for load event.
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
      console.log(
        `eval: ${JSON.stringify(r.result.value ?? r.result.description ?? null)}`,
      );
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
    if (step.click) {
      const r = await cdp.send("Runtime.evaluate", {
        expression: `(() => {
          const els = [...document.querySelectorAll(${JSON.stringify(step.click)})];
          if (!els.length) return "no match";
          const el = els[${step.nth ?? 0}] || els[0];
          const b = el.getBoundingClientRect();
          window.__cx = b.left + b.width/2; window.__cy = b.top + b.height/2;
          return "ok:" + Math.round(window.__cx) + "," + Math.round(window.__cy);
        })()`,
        returnByValue: true,
      });
      console.log(`click ${step.click}: ${r.result.value}`);
      const m = /ok:(\d+),(\d+)/.exec(r.result.value ?? "");
      if (m) {
        const x = +m[1],
          y = +m[2];
        await cdp.send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", clickCount: 1 });
        await cdp.send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", clickCount: 1 });
        await sleep(step.settle ?? 900);
      }
    }
    if (step.clickText) {
      const r = await cdp.send("Runtime.evaluate", {
        expression: `(() => {
          const els = [...document.querySelectorAll('a,button')].filter(e => e.innerText.trim().includes(${JSON.stringify(step.clickText)}));
          if (!els.length) return "no match";
          const el = els[0]; const b = el.getBoundingClientRect();
          window.__cx=b.left+b.width/2; window.__cy=b.top+b.height/2;
          return "ok:"+Math.round(window.__cx)+","+Math.round(window.__cy);
        })()`,
        returnByValue: true,
      });
      console.log(`clickText ${JSON.stringify(step.clickText)}: ${r.result.value}`);
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
      // Basic: dispatch a key like "Enter"
      const map = { Enter: { keyCode: 13, key: "Enter" } };
      const k = map[step.key];
      if (k) {
        await cdp.send("Input.dispatchKeyEvent", { type: "keyDown", ...k });
        await cdp.send("Input.dispatchKeyEvent", { type: "keyUp", ...k });
      }
      console.log(`key ${step.key}`);
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
