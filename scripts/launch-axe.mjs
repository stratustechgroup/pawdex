// Accessibility audit runner. Connects to an already-running headless Chrome
// (launched with --remote-debugging-port), navigates to each URL, injects
// axe-core, runs it against WCAG 2.0/2.1 A + AA rules, and prints a per-page
// count of violations grouped by impact.
//
// Usage: node scripts/launch-axe.mjs <port> <url> [url...]
// Auth: navigate to a magic-link callback URL first (as one of the args) to
// seed the session cookie in the shared browser profile before the app pages.
import { readFileSync } from "node:fs";

const PORT = Number(process.argv[2] ?? 9444);
const URLS = process.argv.slice(3);
const AXE_SRC = readFileSync(
  new URL("../node_modules/axe-core/axe.min.js", import.meta.url),
  "utf8",
);

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

async function evalExpr(cdp, expression, awaitPromise = false) {
  const r = await cdp.send("Runtime.evaluate", {
    expression,
    awaitPromise,
    returnByValue: true,
  });
  if (r.exceptionDetails) {
    throw new Error(
      r.exceptionDetails.exception?.description ??
        JSON.stringify(r.exceptionDetails),
    );
  }
  return r.result.value;
}

async function auditPage(cdp, url) {
  await cdp.send("Page.navigate", { url });
  await sleep(2500); // let the app hydrate and client transitions settle
  await evalExpr(cdp, AXE_SRC);
  const detail = process.env.DETAIL === "1";
  const nodeExpr = detail
    ? "v.nodes.map(n => ({ target: n.target, summary: n.failureSummary }))"
    : "v.nodes.length";
  const json = await evalExpr(
    cdp,
    `axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a','wcag2aa','wcag21a','wcag21aa'] } }).then(r => JSON.stringify(r.violations.map(v => ({ id: v.id, impact: v.impact, nodes: ${detail ? "v.nodes.length" : "v.nodes.length"}, detail: ${nodeExpr}, help: v.help }))))`,
    true,
  );
  return JSON.parse(json);
}

async function main() {
  const wsUrl = await getPageTarget();
  const ws = await connect(wsUrl);
  const cdp = new CDP(ws);
  await cdp.send("Page.enable");
  await cdp.send("Runtime.enable");
  if (process.env.THEME === "light" || process.env.THEME === "dark") {
    await cdp.send("Emulation.setEmulatedMedia", {
      features: [{ name: "prefers-color-scheme", value: process.env.THEME }],
    });
  }

  for (const url of URLS) {
    // A callback URL just seeds the session; don't audit it.
    const isAuthSeed = url.includes("/auth/callback");
    const violations = await auditPage(cdp, url);
    if (isAuthSeed) {
      console.log(`\n[seeded session via ${url}]`);
      continue;
    }
    const byImpact = { critical: 0, serious: 0, moderate: 0, minor: 0 };
    for (const v of violations) byImpact[v.impact ?? "minor"]++;
    console.log(`\n=== ${url} ===`);
    console.log(
      `critical=${byImpact.critical} serious=${byImpact.serious} moderate=${byImpact.moderate} minor=${byImpact.minor}`,
    );
    for (const v of violations) {
      console.log(`  [${v.impact}] ${v.id} (${v.nodes}) — ${v.help}`);
      if (process.env.DETAIL === "1" && Array.isArray(v.detail)) {
        for (const n of v.detail) {
          console.log(`      target: ${JSON.stringify(n.target)}`);
          console.log(`      ${(n.summary ?? "").replace(/\n/g, " ")}`);
        }
      }
    }
  }
  ws.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
