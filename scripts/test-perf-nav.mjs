// Navigation-performance harness. Creates an isolated ZZTEST user + household +
// one pet, mints a magic-link for headless login, and prints the ids the CDP
// measurement step needs. ALL writes are scoped to this one zztest-perf user
// and the household it owns. Never a blanket mutation, never prod data.
//
// Pairs with scripts/test-perf-measure.mjs, which connects to a running
// headless Chrome, completes the magic-link login, and times authenticated RSC
// navigations (the exact request a nav-bar click makes) for each route.
//
// Usage:
//   node scripts/test-perf-nav.mjs setup                 # create user+household+pet
//   E2E_ORIGIN=https://www.pawdex.co node scripts/test-perf-nav.mjs magiclink
//   node scripts/test-perf-nav.mjs ids                   # print HOUSEHOLD_ID / PET_ID
//   node scripts/test-perf-nav.mjs cleanup               # delete everything
//   node scripts/test-perf-nav.mjs verify-clean
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const TEST_EMAIL = "zztest-perf-nav@zzpawdextest-nx.io";
const APP_ORIGIN = process.env.E2E_ORIGIN ?? "http://localhost:3900";

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

async function findHousehold(userId) {
  const { data } = await sb
    .from("household_members")
    .select("household_id")
    .eq("user_id", userId);
  return data?.[0]?.household_id ?? null;
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
    console.log("User exists:", u.id);
  }

  let householdId = await findHousehold(u.id);
  if (!householdId) {
    const { data: hh, error: hhErr } = await sb
      .from("households")
      .insert({ name: "zztest-perf Household", created_by: u.id })
      .select("id")
      .single();
    if (hhErr) throw hhErr;
    householdId = hh.id;
    const { error: memErr } = await sb.from("household_members").insert({
      household_id: householdId,
      user_id: u.id,
      role: "owner",
      accepted_at: new Date().toISOString(),
    });
    if (memErr) throw memErr;
    await sb
      .from("reminder_preferences")
      .insert({ household_id: householdId })
      .select()
      .maybeSingle();
    console.log("Created household:", householdId);
  } else {
    console.log("Household exists:", householdId);
  }

  const { data: pets } = await sb
    .from("pets")
    .select("id")
    .eq("household_id", householdId)
    .limit(1);
  let petId = pets?.[0]?.id;
  if (!petId) {
    const { data: pet, error: pErr } = await sb
      .from("pets")
      .insert({
        household_id: householdId,
        name: "zztest-perf Pet",
        species: "dog",
        created_by: u.id,
      })
      .select("id")
      .single();
    if (pErr) throw pErr;
    petId = pet.id;
    console.log("Created pet:", petId);
  } else {
    console.log("Pet exists:", petId);
  }
  console.log("HOUSEHOLD_ID=" + householdId);
  console.log("PET_ID=" + petId);
}

async function cmdMagicLink() {
  const { data, error } = await sb.auth.admin.generateLink({
    type: "magiclink",
    email: TEST_EMAIL,
  });
  if (error) throw error;
  console.log(
    "CALLBACK_URL=" +
      `${APP_ORIGIN}/auth/callback?token_hash=${data.properties.hashed_token}&type=magiclink&next=/`,
  );
}

async function cmdIds() {
  const u = await findUser();
  if (!u) return console.log("No ZZTEST user.");
  const householdId = await findHousehold(u.id);
  const { data: pets } = await sb
    .from("pets")
    .select("id")
    .eq("household_id", householdId)
    .limit(1);
  console.log("USER_ID=" + u.id);
  console.log("HOUSEHOLD_ID=" + householdId);
  console.log("PET_ID=" + (pets?.[0]?.id ?? ""));
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
  ids: cmdIds,
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
