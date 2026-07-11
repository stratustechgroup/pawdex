// Billing + pricing E2E screenshot harness. Connects to an already-running
// headless Chrome (launched by run-billing-e2e.sh on a debug port with a
// persistent profile) and a built Next server on E2E_ORIGIN.
//
// Captures /pricing (desktop + mobile, light + dark) with no auth, then creates
// an isolated ZZTEST user, logs in headless via a minted magic-link callback,
// and captures /settings/billing (light + dark). The ZZTEST user + the
// household bootstrap creates for it are deleted in a finally block. Never
// touches prod data.
//
// Usage (via the shell runner): bash scripts/run-billing-e2e.sh
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const ORIGIN = process.env.E2E_ORIGIN ?? "http://localhost:3800";
const CDP_PORT = Number(process.env.CDP_PORT ?? 9334);
const SHOT_DIR =
  "/private/tmp/claude-501/-Users-jamesfarmer-projectsv4-puppy/25960530-1760-4c4f-adc6-df7534a1c433/scratchpad/billing-shots";
const TEST_EMAIL = "zztest-billing-e2e@zzpawdextest-nx.io";
mkdirSync(SHOT_DIR, { recursive: true });

// ── env + supabase admin ─────────────────────────────────────────────
const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split("\n")
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    }),
);
const sb = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

// ── CDP plumbing ─────────────────────────────────────────────────────
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getPageTarget() {
  const res = await fetch(`http://localhost:${CDP_PORT}/json`);
  const targets = await res.json();
  let page = targets.find((t) => t.type === "page");
  if (!page) {
    const nt = await fetch(`http://localhost:${CDP_PORT}/json/new`);
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

async function main() {
  const wsUrl = await getPageTarget();
  const ws = await connect(wsUrl);
  const cdp = new CDP(ws);
  await cdp.send("Page.enable");
  await cdp.send("Runtime.enable");

  async function viewport(w, h) {
    await cdp.send("Emulation.setDeviceMetricsOverride", {
      width: w,
      height: h,
      deviceScaleFactor: 2,
      mobile: w < 500,
    });
  }
  async function goto(path) {
    await cdp.send("Page.navigate", { url: `${ORIGIN}${path}` });
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
      sleep(9000),
    ]);
    await sleep(1200);
    const loc = await cdp.send("Runtime.evaluate", {
      expression: "location.pathname",
      returnByValue: true,
    });
    return loc.result.value;
  }
  async function setTheme(theme) {
    await cdp.send("Runtime.evaluate", {
      expression: `localStorage.setItem('pw-theme', ${JSON.stringify(theme)})`,
      returnByValue: true,
    });
    await cdp.send("Page.reload", {});
    await sleep(1600);
  }
  async function shot(name, full = true) {
    const r = await cdp.send("Page.captureScreenshot", {
      format: "png",
      captureBeyondViewport: full,
    });
    writeFileSync(`${SHOT_DIR}/${name}.png`, Buffer.from(r.data, "base64"));
    console.log(`  shot ${name}.png`);
  }

  let userId = null;
  try {
    // ── /pricing, public, no auth ──────────────────────────────────
    console.log("== /pricing (public) ==");
    await viewport(1280, 900);
    let p = await goto("/pricing");
    console.log(`  at ${p}`);
    await setTheme("light");
    await shot("pricing-desktop-light");
    await setTheme("dark");
    await shot("pricing-desktop-dark");

    await viewport(390, 844);
    await goto("/pricing");
    await setTheme("light");
    await shot("pricing-mobile-light");
    await setTheme("dark");
    await shot("pricing-mobile-dark");

    // ── /settings/billing, needs auth ──────────────────────────────
    console.log("== /settings/billing (auth) ==");
    // Create (or find) the isolated ZZTEST user.
    let user = null;
    for (let page = 1; page <= 20 && !user; page++) {
      const { data } = await sb.auth.admin.listUsers({ page, perPage: 200 });
      user = data.users.find((x) => x.email === TEST_EMAIL) ?? null;
      if ((data.users.length ?? 0) < 200) break;
    }
    if (!user) {
      const { data, error } = await sb.auth.admin.createUser({
        email: TEST_EMAIL,
        email_confirm: true,
      });
      if (error) throw error;
      user = data.user;
    }
    userId = user.id;
    console.log(`  zztest user ${userId}`);

    const { data: link, error: linkErr } = await sb.auth.admin.generateLink({
      type: "magiclink",
      email: TEST_EMAIL,
    });
    if (linkErr) throw linkErr;
    const callback = `${ORIGIN}/auth/callback?token_hash=${link.properties.hashed_token}&type=magiclink&next=${encodeURIComponent(
      "/settings/billing",
    )}`;

    await viewport(1280, 1000);
    // Navigate the callback to establish the session cookie; it redirects on
    // to /settings/billing (or /onboarding then we go directly).
    await cdp.send("Page.navigate", { url: callback });
    await sleep(2500);
    let at = await goto("/settings/billing");
    console.log(`  at ${at}`);
    if (at !== "/settings/billing") {
      // First login may route through onboarding/bootstrap; try once more.
      await sleep(1500);
      at = await goto("/settings/billing");
      console.log(`  retry at ${at}`);
    }
    await setTheme("light");
    await shot("settings-billing-light");
    await setTheme("dark");
    await shot("settings-billing-dark");

    // Report what the page rendered so the screenshots are self-describing.
    const text = await cdp.send("Runtime.evaluate", {
      expression: "document.body.innerText.slice(0, 400)",
      returnByValue: true,
    });
    console.log("  billing page text (first 400):");
    console.log(
      "  " + String(text.result.value ?? "").replace(/\n+/g, " ").slice(0, 380),
    );
  } finally {
    ws.close();
    // Cleanup: remove the ZZTEST user + any household bootstrap made.
    if (userId) {
      const { data: mem } = await sb
        .from("household_members")
        .select("household_id")
        .eq("user_id", userId);
      for (const m of mem ?? []) {
        await sb.from("household_members").delete().eq("household_id", m.household_id);
        await sb.from("households").delete().eq("id", m.household_id);
      }
      await sb.auth.admin.deleteUser(userId);
      console.log(`  cleanup: deleted zztest user ${userId} + household(s)`);
    }
  }
  console.log(`\nscreenshots in ${SHOT_DIR}`);
  process.exit(0);
}

main().catch((e) => {
  console.error("E2E ERROR:", e.message ?? e);
  process.exit(1);
});
