// Authenticated navigation timing over the Chrome DevTools Protocol. Connects
// to an already-running headless Chrome (launched with
// --remote-debugging-port=9222 and a persistent --user-data-dir so the login
// cookie survives), completes the magic-link callback, then times the exact
// request a nav-bar click makes: an RSC fetch (`RSC: 1` header) for each route.
// The fetch promise resolves when response headers arrive, so the elapsed time
// is server TTFB — the requireSession + page-query work we are optimizing.
//
// Usage:
//   node scripts/test-perf-measure.mjs '<CALLBACK_URL>' '<PET_ID>' '<ORIGIN>' [samples]
import { writeFileSync, mkdirSync } from "node:fs";

const PORT = 9222;
const OUT_DIR =
  "/private/tmp/claude-501/-Users-jamesfarmer-projectsv4-puppy/25960530-1760-4c4f-adc6-df7534a1c433/scratchpad";
mkdirSync(OUT_DIR, { recursive: true });

const callbackUrl = process.argv[2];
const petId = process.argv[3];
const origin = process.argv[4] ?? "https://www.pawdex.co";
const samples = Number(process.argv[5] ?? 3);
if (!callbackUrl) throw new Error("usage: <CALLBACK_URL> <PET_ID> [ORIGIN] [samples]");

const routes = [
  { label: "dashboard", path: "/" },
  { label: "pet page", path: `/pets/${petId}` },
  { label: "expiring", path: "/expiring" },
  { label: "insurance", path: "/insurance" },
  { label: "settings/household", path: "/settings/household" },
];

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

function evalExpr(cdp, expression) {
  return cdp
    .send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true })
    .then((r) => r.result.value);
}

async function main() {
  const ws = await connect(await getPageTarget());
  const cdp = new CDP(ws);
  await cdp.send("Page.enable");
  await cdp.send("Runtime.enable");

  // 1. Log in via the magic-link callback.
  await cdp.send("Page.navigate", { url: callbackUrl });
  await sleep(3500);
  const href = await evalExpr(cdp, "location.href");
  console.log("after login ->", href);

  // 2. Land on the app so the origin/document context is correct for fetch().
  await cdp.send("Page.navigate", { url: origin + "/" });
  await sleep(2500);
  const loggedIn = await evalExpr(
    cdp,
    "!location.pathname.startsWith('/login')",
  );
  if (!loggedIn) throw new Error("login failed — still on /login");

  // 3. Time RSC navigations in-page. fetch() resolves on response headers, so
  //    elapsed ms is server TTFB. Same-origin, so x-vercel-id is readable.
  const script = `(async () => {
    const routes = ${JSON.stringify(routes)};
    const N = ${samples};
    const out = [];
    for (const r of routes) {
      const ms = [];
      let vid = "", status = 0;
      for (let i = 0; i < N; i++) {
        const t0 = performance.now();
        const res = await fetch(r.path, { headers: { RSC: "1" }, cache: "no-store" });
        const ttfb = performance.now() - t0;
        status = res.status;
        vid = res.headers.get("x-vercel-id") || vid;
        await res.text();
        ms.push(Math.round(ttfb));
        await new Promise((x) => setTimeout(x, 250));
      }
      out.push({ label: r.label, path: r.path, ms, status, region: (vid.split("::")[0] || vid) });
    }
    return JSON.stringify(out);
  })()`;
  const raw = await evalExpr(cdp, script);
  const results = JSON.parse(raw);

  const median = (a) => {
    const s = [...a].sort((x, y) => x - y);
    return s[Math.floor(s.length / 2)];
  };
  console.log("\nroute                 region   samples(ms)        median");
  console.log("-".repeat(64));
  for (const r of results) {
    console.log(
      `${r.label.padEnd(20)}  ${String(r.region).padEnd(7)}  ${JSON.stringify(r.ms).padEnd(18)} ${median(r.ms)}  ${r.status !== 200 ? "[HTTP " + r.status + "]" : ""}`,
    );
  }
  writeFileSync(
    `${OUT_DIR}/perf-results.json`,
    JSON.stringify({ origin, when: new Date().toISOString(), results }, null, 2),
  );
  console.log(`\nsaved ${OUT_DIR}/perf-results.json`);
  ws.close();
  process.exit(0);
}

main().catch((e) => {
  console.error("MEASURE ERROR:", e.message);
  process.exit(1);
});
