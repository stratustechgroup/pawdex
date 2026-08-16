/**
 * Screenshot the marketing surface at a series of scroll offsets so a human (or
 * a model) can actually look at the scroll scenes instead of trusting that the
 * assertions imply they look right. They do not: a scene can pin correctly,
 * release correctly, attach every timeline, and still be ugly or unreadable.
 *
 * Usage: node scripts/shoot-marketing.mjs <path> <outDir> [scrollPx ...]
 * Requires a headless Chrome already listening on CDP_PORT (default 9445) and a
 * server on SCROLL_ORIGIN (default http://localhost:3210).
 */
import { mkdirSync, writeFileSync } from "node:fs";

const PORT = Number(process.env.CDP_PORT ?? 9445);
const ORIGIN = process.env.SCROLL_ORIGIN ?? "http://localhost:3210";
const PATHNAME = process.argv[2] ?? "/";
const OUT = process.argv[3] ?? "/tmp/pawdex-shots";
const OFFSETS = process.argv.slice(4).map(Number);

mkdirSync(OUT, { recursive: true });

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

const connect = (url) =>
  new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    ws.addEventListener("open", () => resolve(ws));
    ws.addEventListener("error", (e) => reject(new Error("ws " + e.message)));
  });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const ws = await connect(await getPageTarget());
const cdp = new CDP(ws);
await cdp.send("Page.enable");
await cdp.send("Runtime.enable");
const W = Number(process.env.SHOT_WIDTH ?? 1440);
const H = Number(process.env.SHOT_HEIGHT ?? 900);
await cdp.send("Emulation.setDeviceMetricsOverride", {
  width: W,
  height: H,
  deviceScaleFactor: 1,
  mobile: W < 600,
});
if (process.env.SHOT_SCHEME) {
  await cdp.send("Emulation.setEmulatedMedia", {
    features: [{ name: "prefers-color-scheme", value: process.env.SHOT_SCHEME }],
  });
}
if (process.env.SHOT_MOTION) {
  await cdp.send("Emulation.setEmulatedMedia", {
    features: [
      { name: "prefers-color-scheme", value: process.env.SHOT_SCHEME || "dark" },
      { name: "prefers-reduced-motion", value: process.env.SHOT_MOTION },
    ],
  });
}
await cdp.send("Page.navigate", { url: ORIGIN + PATHNAME });
await sleep(2500);

const total = (
  await cdp.send("Runtime.evaluate", {
    expression: "document.documentElement.scrollHeight",
    returnByValue: true,
  })
).result.value;
console.log(`page height ${total}px`);

const offsets = OFFSETS.length
  ? OFFSETS
  : [0, 0.15, 0.3, 0.45, 0.6, 0.8].map((f) => Math.round(total * f));

for (const y of offsets) {
  await cdp.send("Runtime.evaluate", {
    expression: `window.scrollTo(0, ${y})`,
  });
  // Scroll-driven animations settle on the next frame, but give the compositor
  // a couple to be safe before grabbing the pixels.
  await sleep(500);
  const shot = await cdp.send("Page.captureScreenshot", { format: "png" });
  const file = `${OUT}/${String(y).padStart(6, "0")}.png`;
  writeFileSync(file, Buffer.from(shot.data, "base64"));
  console.log(file);
}

ws.close();
process.exit(0);
