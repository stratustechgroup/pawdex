// Account-management E2E harness. Creates an isolated ZZTEST user, mints
// magic-link and recovery callback URLs for headless login, and verifies
// password / profile / identity state via the service + anon clients. ALL
// writes are scoped to this one ZZTEST user and the household bootstrap creates
// for it. Never touches prod data.
//
// Usage:
//   node scripts/test-account-e2e.mjs setup            # create user
//   node scripts/test-account-e2e.mjs magiclink [next] # print login callback URL
//   node scripts/test-account-e2e.mjs recovery         # print recovery callback URL (-> /settings/account)
//   node scripts/test-account-e2e.mjs signin <pw>      # try password sign-in, report ok/fail
//   node scripts/test-account-e2e.mjs profile          # dump profile display_name + membership
//   node scripts/test-account-e2e.mjs state
//   node scripts/test-account-e2e.mjs cleanup          # delete everything
//   node scripts/test-account-e2e.mjs verify-clean
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const TEST_EMAIL = "zztest-account@zzpawdextest-nx.io";
const APP_ORIGIN = process.env.E2E_ORIGIN ?? "http://localhost:3400";

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split("\n")
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    }),
);

const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;
const anon = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !key) throw new Error("Missing Supabase env");

const sb = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function findUser() {
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const u = data.users.find((x) => x.email === TEST_EMAIL);
    if (u) return u;
    if (data.users.length < 200) break;
  }
  return null;
}

async function cmdSetup() {
  let u = await findUser();
  if (!u) {
    const { data, error } = await sb.auth.admin.createUser({
      email: TEST_EMAIL,
      email_confirm: true,
    });
    if (error) throw error;
    u = data.user;
    console.log("Created user:", u.id);
  } else {
    console.log("User already exists:", u.id);
  }
  console.log("USER_ID=" + u.id);
}

async function cmdMagicLink() {
  const next = process.argv[3] ?? "/";
  const { data, error } = await sb.auth.admin.generateLink({
    type: "magiclink",
    email: TEST_EMAIL,
  });
  if (error) throw error;
  const props = data.properties;
  console.log(
    "CALLBACK_URL=" +
      `${APP_ORIGIN}/auth/callback?token_hash=${props.hashed_token}&type=magiclink&next=${encodeURIComponent(next)}`,
  );
}

async function cmdRecovery() {
  const { data, error } = await sb.auth.admin.generateLink({
    type: "recovery",
    email: TEST_EMAIL,
  });
  if (error) throw error;
  const props = data.properties;
  console.log(
    "CALLBACK_URL=" +
      `${APP_ORIGIN}/auth/callback?token_hash=${props.hashed_token}&type=recovery&next=${encodeURIComponent("/settings/account")}`,
  );
}

async function cmdSignin() {
  const pw = process.argv[3];
  if (!pw) throw new Error("usage: signin <password>");
  const client = createClient(url, anon, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await client.auth.signInWithPassword({
    email: TEST_EMAIL,
    password: pw,
  });
  if (error) {
    console.log("SIGNIN=fail: " + error.message);
    process.exit(2);
  }
  console.log("SIGNIN=ok user=" + data.user?.id);
}

async function cmdProfile() {
  const u = await findUser();
  if (!u) return console.log("No ZZTEST user.");
  const { data: prof, error } = await sb
    .from("profiles")
    .select("id, display_name")
    .eq("id", u.id)
    .maybeSingle();
  if (error) console.log("profiles read error (0030 not applied?):", error.message);
  else console.log("PROFILE display_name=" + JSON.stringify(prof?.display_name ?? null));
  console.log(
    "IDENTITIES=" +
      JSON.stringify((u.identities ?? []).map((i) => i.provider)),
  );
  const { data: mem } = await sb
    .from("household_members")
    .select("household_id, role")
    .eq("user_id", u.id);
  console.log("MEMBERSHIPS=" + JSON.stringify(mem ?? []));
}

async function cmdState() {
  const u = await findUser();
  if (!u) return console.log("No ZZTEST user.");
  console.log("user:", u.id, u.email);
  const { data: mem } = await sb
    .from("household_members")
    .select("household_id, role, households(name, kind)")
    .eq("user_id", u.id);
  for (const m of mem ?? []) {
    console.log("  household:", m.household_id, JSON.stringify(m.households), m.role);
  }
}

async function cmdCleanup() {
  const u = await findUser();
  if (!u) return console.log("Nothing to clean. no ZZTEST user.");
  const { data: mem } = await sb
    .from("household_members")
    .select("household_id")
    .eq("user_id", u.id);
  for (const m of mem ?? []) {
    const hid = m.household_id;
    for (const tbl of [
      "reminders",
      "vaccinations",
      "insurance_policies",
      "weight_log",
      "medical_events",
      "medications",
      "documents",
      "reminder_preferences",
      "pets",
      "household_members",
    ]) {
      const { error } = await sb.from(tbl).delete().eq("household_id", hid);
      if (error) console.log(`  warn ${tbl}: ${error.message}`);
    }
    const { error: hErr } = await sb.from("households").delete().eq("id", hid);
    if (hErr) console.log(`  warn households: ${hErr.message}`);
    console.log("  cleaned household", hid);
  }
  // profiles row (if 0030 applied) is removed by the auth.users delete cascade.
  const { error: uErr } = await sb.auth.admin.deleteUser(u.id);
  if (uErr) console.log("  warn deleteUser:", uErr.message);
  else console.log("  deleted user", u.id);
}

async function cmdVerifyClean() {
  const u = await findUser();
  if (u) return console.log("NOT CLEAN. user still exists:", u.id);
  console.log("CLEAN. no ZZTEST user remains.");
}

const cmd = process.argv[2];
const map = {
  setup: cmdSetup,
  magiclink: cmdMagicLink,
  recovery: cmdRecovery,
  signin: cmdSignin,
  profile: cmdProfile,
  state: cmdState,
  cleanup: cmdCleanup,
  "verify-clean": cmdVerifyClean,
};
if (!map[cmd]) {
  console.log("commands:", Object.keys(map).join(", "));
  process.exit(1);
}
map[cmd]().then(
  () => process.exit(0),
  (e) => {
    console.error("ERROR:", e.message ?? e);
    process.exit(1);
  },
);
