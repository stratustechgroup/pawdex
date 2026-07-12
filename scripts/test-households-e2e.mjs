// Multi-household E2E harness. Connects to an already-running headless Chrome
// (launched by run-households-e2e.sh on a debug port with a persistent profile)
// and a built Next server on E2E_ORIGIN.
//
// Exercises the households UX end to end with two isolated ZZTEST users:
//   1. Owner logs in (bootstrap makes household A, personal). We seed one pet.
//   2. Owner creates a SECOND household (breeder) via the new-household flow;
//      the active household switches to it and the dashboard is empty.
//   3. The switcher lists BOTH households with role + kind badges.
//   4. Flip A <-> B and assert data isolation: A's pet renders only while A is
//      active, never while B is active.
//   5. Invite the second user to household B (breeder); they accept, land in B,
//      and their own switcher shows both their personal household and B.
//
// ALL writes are scoped to two ZZTEST users (zztest-households-*) and the
// households they own/join. Everything is deleted in the finally block and the
// deletion is count-verified. Never touches prod data.
//
// Usage (via the shell runner): bash scripts/run-households-e2e.sh
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { createHash, randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const ORIGIN = process.env.E2E_ORIGIN ?? "http://localhost:4000";
const CDP_PORT = Number(process.env.CDP_PORT ?? 9336);
const SHOT_DIR =
  "/private/tmp/claude-501/-Users-jamesfarmer-projectsv4-puppy/25960530-1760-4c4f-adc6-df7534a1c433/scratchpad/households-shots";
const OWNER_EMAIL = "zztest-households-owner@zzpawdextest-nx.io";
const INVITEE_EMAIL = "zztest-households-invitee@zzpawdextest-nx.io";
const PET_NAME = "ZZTESTPETALPHA";
const HOUSEHOLD_B_NAME = "ZZTEST Breeder Kennel";
mkdirSync(SHOT_DIR, { recursive: true });

// env + supabase admin
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

// assertions
const results = [];
function assert(name, cond, detail = "") {
  results.push({ name, ok: !!cond, detail });
  console.log(`  ${cond ? "PASS" : "FAIL"} ${name}${detail ? `: ${detail}` : ""}`);
}

// CDP plumbing
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

// DB helpers
async function ensureUser(email) {
  let user = null;
  for (let page = 1; page <= 20 && !user; page++) {
    const { data } = await sb.auth.admin.listUsers({ page, perPage: 200 });
    user = data.users.find((x) => x.email === email) ?? null;
    if ((data.users.length ?? 0) < 200) break;
  }
  if (!user) {
    const { data, error } = await sb.auth.admin.createUser({
      email,
      email_confirm: true,
    });
    if (error) throw error;
    user = data.user;
  }
  return user;
}

async function findUser(email) {
  for (let page = 1; page <= 20; page++) {
    const { data } = await sb.auth.admin.listUsers({ page, perPage: 200 });
    const u = data.users.find((x) => x.email === email);
    if (u) return u;
    if ((data.users.length ?? 0) < 200) break;
  }
  return null;
}

async function membershipsFor(userId) {
  const { data } = await sb
    .from("household_members")
    .select("household_id, role, households(name, kind)")
    .eq("user_id", userId);
  return data ?? [];
}

async function magicCallback(email, next = "/") {
  const { data, error } = await sb.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  if (error) throw error;
  return `${ORIGIN}/auth/callback?token_hash=${data.properties.hashed_token}&type=magiclink&next=${encodeURIComponent(next)}`;
}

async function cleanupHousehold(hid) {
  for (const tbl of [
    "reminders",
    "research_consents",
    "authorizations",
    "household_inbound_addresses",
    "household_invitations",
    "vaccinations",
    "insurance_policies",
    "weight_log",
    "medical_events",
    "medications",
    "documents",
    "reminder_preferences",
    "pets",
    "audit_log",
    "household_members",
  ]) {
    const { error } = await sb.from(tbl).delete().eq("household_id", hid);
    if (error) console.log(`  warn ${tbl}: ${error.message}`);
  }
  const { error: hErr } = await sb.from("households").delete().eq("id", hid);
  if (hErr) console.log(`  warn households: ${hErr.message}`);
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
      deviceScaleFactor: 1,
      mobile: w < 500,
    });
  }
  async function navigate(urlStr, settle = 1500) {
    await cdp.send("Page.navigate", { url: urlStr });
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
    await sleep(settle);
  }
  const goto = (path, settle) => navigate(`${ORIGIN}${path}`, settle);
  async function evalRaw(expr) {
    const r = await cdp.send("Runtime.evaluate", {
      expression: expr,
      returnByValue: true,
      awaitPromise: true,
    });
    return r.result.value;
  }
  const pathname = () => evalRaw("location.pathname");
  const bodyText = () => evalRaw("document.body ? document.body.innerText : ''");
  async function clickEl(findExpr, settle = 900) {
    const coords = await evalRaw(
      `(() => { const el = ${findExpr}; if (!el) return null; const b = el.getBoundingClientRect(); return [Math.round(b.left + b.width / 2), Math.round(b.top + b.height / 2)]; })()`,
    );
    if (!coords) return false;
    const [x, y] = coords;
    await cdp.send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", clickCount: 1 });
    await cdp.send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", clickCount: 1 });
    await sleep(settle);
    return true;
  }
  async function typeText(str) {
    for (const ch of str) {
      await cdp.send("Input.dispatchKeyEvent", { type: "char", text: ch });
    }
  }
  async function shot(name) {
    const r = await cdp.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true });
    writeFileSync(`${SHOT_DIR}/${name}.png`, Buffer.from(r.data, "base64"));
    console.log(`  shot ${name}.png`);
  }
  // Opens the top-nav switcher (first aria-haspopup=menu button) and clicks the
  // menuitem whose text includes `name`. Returns false if the item isn't found.
  async function switchTo(name) {
    await clickEl(`document.querySelector('button[aria-haspopup="menu"]')`, 500);
    const found = await clickEl(
      `[...document.querySelectorAll('[role=menuitem]')].find(e => e.innerText.includes(${JSON.stringify(name)}))`,
      1600,
    );
    return found;
  }
  async function readSwitcherMenu() {
    await clickEl(`document.querySelector('button[aria-haspopup="menu"]')`, 500);
    const text = await evalRaw(
      `(() => { const m = document.querySelector('[role=menu]'); return m ? m.innerText : ''; })()`,
    );
    return text ?? "";
  }

  const created = { ownerId: null, inviteeId: null };
  try {
    await viewport(1300, 1000);

    // ── User A: login (bootstraps household A) ──────────────────────────
    console.log("== owner login + bootstrap ==");
    const ownerUser = await ensureUser(OWNER_EMAIL);
    created.ownerId = ownerUser.id;
    await navigate(await magicCallback(OWNER_EMAIL, "/"), 2500);
    await goto("/", 1500);
    let mem = await membershipsFor(ownerUser.id);
    assert("owner has one household after bootstrap", mem.length === 1, `count=${mem.length}`);
    const householdA = mem[0]?.household_id;
    const householdAName = mem[0]?.households?.name ?? "";
    console.log(`  household A ${householdA} name=${JSON.stringify(householdAName)}`);

    // Seed a pet into household A so isolation is observable.
    const { error: petErr } = await sb.from("pets").insert({
      household_id: householdA,
      name: PET_NAME,
      species: "dog",
      created_by: ownerUser.id,
    });
    if (petErr) throw new Error("seed pet: " + petErr.message);

    await goto("/", 1500);
    let text = await bodyText();
    assert("household A shows its pet", text.includes(PET_NAME));
    await shot("01-household-a-pets");

    // Single-household discoverability: the switcher is now an openable menu
    // even with one household, offering "New household..." to everyone.
    const soloMenu = await readSwitcherMenu();
    assert("single-household switcher opens a menu", soloMenu.length > 0);
    assert("single-household menu offers New household", /new household/i.test(soloMenu));
    await shot("00-single-household-menu");
    await clickEl(`document.querySelector('button[aria-haspopup="menu"]')`, 400);

    // ── Create household B (breeder) via the new-household flow ──────────
    console.log("== create second household (breeder) ==");
    await goto("/settings/household?kind=breeder#new-household", 1500);
    await clickEl(`document.querySelector('#new-household input[type="text"]')`, 400);
    await typeText(HOUSEHOLD_B_NAME);
    // Confirm the kind select was preselected to breeder by the query param.
    const kindVal = await evalRaw(
      `(() => { const s = document.querySelector('#new-household select'); return s ? s.value : null; })()`,
    );
    assert("breeder preselected from ?kind=breeder", kindVal === "breeder", `value=${kindVal}`);
    await clickEl(`document.querySelector('#new-household button[type="submit"]')`, 2600);

    let at = await pathname();
    assert("create redirects to dashboard", at === "/", `at=${at}`);
    mem = await membershipsFor(ownerUser.id);
    assert("owner now has two households", mem.length === 2, `count=${mem.length}`);
    const bRow = mem.find((m) => m.households?.name === HOUSEHOLD_B_NAME);
    const householdB = bRow?.household_id;
    assert("household B is a breeder household", bRow?.households?.kind === "breeder", `kind=${bRow?.households?.kind}`);
    assert("owner is owner of household B", bRow?.role === "owner", `role=${bRow?.role}`);

    const { count: createAudit } = await sb
      .from("audit_log")
      .select("id", { head: true, count: "exact" })
      .eq("household_id", householdB)
      .eq("action", "create")
      .eq("entity_type", "household");
    assert("creation wrote an audit_log entry", (createAudit ?? 0) >= 1, `count=${createAudit}`);

    // ── Data isolation: B is active, A's pet must NOT render ─────────────
    console.log("== data isolation (B active) ==");
    await goto("/", 1500);
    text = await bodyText();
    assert("household B does NOT show household A's pet", !text.includes(PET_NAME));
    await shot("02-household-b-empty-isolation");

    // ── Switcher lists both with badges ─────────────────────────────────
    console.log("== switcher shows both ==");
    let menu = await readSwitcherMenu();
    assert("switcher lists household A", menu.includes(householdAName), menu.replace(/\n/g, " | "));
    assert("switcher lists household B", menu.includes(HOUSEHOLD_B_NAME));
    assert("switcher shows a Breeder badge", /breeder/i.test(menu));
    await shot("03-switcher-both");
    // Close the menu.
    await clickEl(`document.querySelector('button[aria-haspopup="menu"]')`, 400);

    // ── Flip to A: pet visible again ────────────────────────────────────
    console.log("== flip to A ==");
    const flippedA = await switchTo(householdAName);
    assert("switcher item for A was clickable", flippedA);
    at = await pathname();
    text = await bodyText();
    assert("flip to A lands on dashboard", at === "/", `at=${at}`);
    assert("household A shows its pet again after flip", text.includes(PET_NAME));
    await shot("04-flipped-back-to-a");

    // In-place kind flip via the owner-only HouseholdTypeControl in settings.
    // Complements the create-separate-breeder path: this converts the current
    // household; it is owner-gated, audited, and kind-only (never deletes data).
    console.log("== in-place household type flip ==");
    await goto("/settings/household", 1500);
    await clickEl(
      `[...document.querySelectorAll('button')].find(e => e.innerText.includes('Switch to Breeder'))`,
      2200,
    );
    let haKind = (await sb.from("households").select("kind").eq("id", householdA).maybeSingle()).data?.kind;
    assert("in-place flip sets household A to breeder", haKind === "breeder", `kind=${haKind}`);
    const { count: flipAudit } = await sb
      .from("audit_log")
      .select("id", { head: true, count: "exact" })
      .eq("household_id", householdA)
      .eq("action", "update")
      .eq("entity_type", "household");
    assert("in-place flip wrote an audit_log entry", (flipAudit ?? 0) >= 1, `count=${flipAudit}`);
    await shot("04b-household-type-control");
    await clickEl(
      `[...document.querySelectorAll('button')].find(e => e.innerText.includes('Switch to Personal'))`,
      2200,
    );
    haKind = (await sb.from("households").select("kind").eq("id", householdA).maybeSingle()).data?.kind;
    assert("in-place flip back to personal", haKind === "personal", `kind=${haKind}`);
    const { count: petStill } = await sb
      .from("pets")
      .select("id", { head: true, count: "exact" })
      .eq("household_id", householdA);
    assert("kind round-trip preserves household data", (petStill ?? 0) === 1, `pets=${petStill}`);

    // ── Flip to B: isolation holds in the other direction ───────────────
    console.log("== flip to B ==");
    const flippedB = await switchTo(HOUSEHOLD_B_NAME);
    assert("switcher item for B was clickable", flippedB);
    text = await bodyText();
    assert("household B still hides household A's pet after flip", !text.includes(PET_NAME));

    // ── Invite the second user to household B ───────────────────────────
    console.log("== invite second user to household B ==");
    const inviteeUser = await ensureUser(INVITEE_EMAIL);
    created.inviteeId = inviteeUser.id;
    const raw = randomBytes(32)
      .toString("base64")
      .replace(/=+$/, "")
      .replace(/\+/g, "-")
      .replace(/\//g, "_");
    const tokenHash = createHash("sha256").update(raw).digest("hex");
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);
    const { error: invErr } = await sb.from("household_invitations").insert({
      household_id: householdB,
      email: INVITEE_EMAIL,
      token_hash: tokenHash,
      role: "member",
      invited_by: ownerUser.id,
      expires_at: expiresAt.toISOString(),
    });
    if (invErr) throw new Error("invite insert: " + invErr.message);

    // ── User B: login (bootstraps their own household), then accept ─────
    console.log("== invitee login + accept ==");
    await navigate(await magicCallback(INVITEE_EMAIL, "/"), 2500);
    let inviteeMem = await membershipsFor(inviteeUser.id);
    const inviteeOwnName = inviteeMem[0]?.households?.name ?? "";
    console.log(`  invitee own household name=${JSON.stringify(inviteeOwnName)}`);

    await goto(`/invite/${raw}`, 1500);
    await clickEl(
      `[...document.querySelectorAll('button')].find(e => e.innerText.includes('Accept invitation'))`,
      2600,
    );
    at = await pathname();
    assert("invitee lands on dashboard after accept", at === "/", `at=${at}`);

    inviteeMem = await membershipsFor(inviteeUser.id);
    assert("invitee now belongs to two households", inviteeMem.length === 2, `count=${inviteeMem.length}`);
    assert(
      "invitee is a member of household B",
      inviteeMem.some((m) => m.household_id === householdB && m.role === "member"),
    );

    const { count: acceptAudit } = await sb
      .from("audit_log")
      .select("id", { head: true, count: "exact" })
      .eq("household_id", householdB)
      .eq("action", "accept_invitation");
    assert("accept wrote an audit_log entry", (acceptAudit ?? 0) >= 1, `count=${acceptAudit}`);

    // Active household after accept should be B (acceptInvitation sets cookie).
    const activeBtn = await evalRaw(
      `(() => { const b = document.querySelector('button[aria-haspopup="menu"]'); return b ? b.innerText : ''; })()`,
    );
    assert("invitee is active in household B after accept", activeBtn.includes(HOUSEHOLD_B_NAME), `btn=${JSON.stringify(activeBtn)}`);

    text = await bodyText();
    assert("invitee does NOT see household A's pet in B", !text.includes(PET_NAME));

    menu = await readSwitcherMenu();
    assert("invitee switcher lists their own household", menu.includes(inviteeOwnName), menu.replace(/\n/g, " | "));
    assert("invitee switcher lists household B", menu.includes(HOUSEHOLD_B_NAME));
    await shot("05-invitee-switcher-both");
    await clickEl(`document.querySelector('button[aria-haspopup="menu"]')`, 400);

    // Invitee flips to their own household and back to prove fluid switching.
    const toOwn = await switchTo(inviteeOwnName);
    assert("invitee can switch to their own household", toOwn);
    at = await pathname();
    assert("invitee flip lands on dashboard", at === "/", `at=${at}`);
    await shot("06-invitee-own-household");
    const backToB = await switchTo(HOUSEHOLD_B_NAME);
    assert("invitee can switch back to household B", backToB);
  } finally {
    ws.close();
    console.log("== cleanup ==");
    // Gather every household either test user touches, delete children, then
    // households, then the users. Count-verify nothing remains.
    const hids = new Set();
    for (const id of [created.ownerId, created.inviteeId]) {
      if (!id) continue;
      const { data } = await sb
        .from("household_members")
        .select("household_id")
        .eq("user_id", id);
      for (const m of data ?? []) hids.add(m.household_id);
    }
    for (const hid of hids) {
      await cleanupHousehold(hid);
      console.log(`  cleaned household ${hid}`);
    }
    for (const id of [created.ownerId, created.inviteeId]) {
      if (!id) continue;
      const { error } = await sb.auth.admin.deleteUser(id);
      if (error) console.log(`  warn deleteUser ${id}: ${error.message}`);
      else console.log(`  deleted user ${id}`);
    }
    // Count-verify: no ZZTEST users, no leftover households by test name.
    const ownerLeft = await findUser(OWNER_EMAIL);
    const inviteeLeft = await findUser(INVITEE_EMAIL);
    const { count: hbLeft } = await sb
      .from("households")
      .select("id", { head: true, count: "exact" })
      .eq("name", HOUSEHOLD_B_NAME);
    assert("cleanup: owner user removed", !ownerLeft);
    assert("cleanup: invitee user removed", !inviteeLeft);
    assert("cleanup: no leftover breeder test household", (hbLeft ?? 0) === 0, `count=${hbLeft}`);
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\nhouseholds E2E: ${results.length - failed.length}/${results.length} assertions passed`);
  console.log(`screenshots in ${SHOT_DIR}`);
  if (failed.length) {
    console.log("FAILURES:");
    for (const f of failed) console.log(`  - ${f.name}${f.detail ? ` (${f.detail})` : ""}`);
    process.exit(1);
  }
  console.log("RESULT: PASS");
  process.exit(0);
}

main().catch((e) => {
  console.error("E2E ERROR:", e.message ?? e);
  process.exit(1);
});
