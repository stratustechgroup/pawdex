// Dashboard E2E harness. Creates an isolated ZZTEST user + household, seeds
// data that exercises the reminder-rail bug, mints a magic-link token_hash for
// headless login, and cleans everything up. ALL writes are scoped to the
// ZZTEST household_id. never a blanket mutation. Never touches prod data.
//
// Usage:
//   node scripts/test-dashboard-e2e.mjs setup      # create user + household, print ids
//   node scripts/test-dashboard-e2e.mjs seed       # seed pet + same-family vaccines + policy
//   node scripts/test-dashboard-e2e.mjs magiclink  # print token_hash callback URL
//   node scripts/test-dashboard-e2e.mjs set-kind breeder|personal
//   node scripts/test-dashboard-e2e.mjs state       # dump current ZZTEST state
//   node scripts/test-dashboard-e2e.mjs cleanup     # delete everything, verify counts
//   node scripts/test-dashboard-e2e.mjs verify-clean
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const TEST_EMAIL = "zztest-dash@example.com";
const APP_ORIGIN = process.env.E2E_ORIGIN ?? "http://localhost:3300";

// Load .env.local manually (scripts run outside Next).
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
  // listUsers is paginated; scan for our test email.
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const u = data.users.find((x) => x.email === TEST_EMAIL);
    if (u) return u;
    if (data.users.length < 200) break;
  }
  return null;
}

async function findHousehold() {
  const u = await findUser();
  if (!u) return null;
  const { data } = await sb
    .from("household_members")
    .select("household_id, households(id, name, kind)")
    .eq("user_id", u.id);
  return { user: u, memberships: data ?? [] };
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
  const { data, error } = await sb.auth.admin.generateLink({
    type: "magiclink",
    email: TEST_EMAIL,
  });
  if (error) throw error;
  const props = data.properties;
  console.log("hashed_token=" + props.hashed_token);
  console.log(
    "CALLBACK_URL=" +
      `${APP_ORIGIN}/auth/callback?token_hash=${props.hashed_token}&type=magiclink&next=/`,
  );
}

async function cmdSeed() {
  const hh = await findHousehold();
  if (!hh || hh.memberships.length === 0)
    throw new Error("No household yet. log in once so bootstrap runs, then seed.");
  const householdId = hh.memberships[0].household_id;
  const userId = hh.user.id;
  console.log("Seeding into household:", householdId);

  // One pet.
  const { data: pet, error: petErr } = await sb
    .from("pets")
    .insert({
      household_id: householdId,
      name: "ZZTest Rex",
      species: "dog",
      created_by: userId,
    })
    .select("id")
    .single();
  if (petErr) throw petErr;
  console.log("PET_ID=" + pet.id);

  const today = new Date();
  const iso = (d) => d.toISOString().slice(0, 10);
  const plusDays = (n) => {
    const d = new Date(today);
    d.setDate(d.getDate() + n);
    return iso(d);
  };

  // TWO rabies doses, same family. the OLD one expired, the LATEST expires in
  // 20 days. Dashboard inline query (no dedup) would show BOTH; expiring.ts
  // dedups to the latest only. This is the divergence.
  const { error: vErr } = await sb.from("vaccinations").insert([
    {
      household_id: householdId,
      pet_id: pet.id,
      vaccine_type: "Rabies (1yr)",
      administered_on: plusDays(-400),
      expires_on: plusDays(-35), // old dose, expired
      created_by: userId,
    },
    {
      household_id: householdId,
      pet_id: pet.id,
      vaccine_type: "Rabies (3yr)",
      administered_on: plusDays(-10),
      expires_on: plusDays(20), // latest dose, due soon
      created_by: userId,
    },
    {
      household_id: householdId,
      pet_id: pet.id,
      vaccine_type: "DHPP",
      administered_on: plusDays(-30),
      expires_on: plusDays(45),
      created_by: userId,
    },
  ]);
  if (vErr) throw vErr;

  // An insurance policy renewing in 25 days. dashboard inline query MISSES
  // this entirely; expiring.ts includes it.
  const { error: pErr } = await sb.from("insurance_policies").insert({
    household_id: householdId,
    pet_id: pet.id,
    insurer_name: "ZZTest Insurance Co",
    plan_name: "Accident & Illness",
    renews_on: plusDays(25),
    created_by: userId,
  });
  if (pErr) throw pErr;

  console.log("Seeded: 1 pet, 3 vaccinations (2 rabies same-family), 1 policy.");
}

async function cmdSetKind(kind) {
  if (!["breeder", "personal"].includes(kind))
    throw new Error("kind must be breeder|personal");
  const hh = await findHousehold();
  const householdId = hh.memberships[0].household_id;
  const { error } = await sb
    .from("households")
    .update({ kind })
    .eq("id", householdId); // scoped to ZZTEST household only
  if (error) throw error;
  console.log(`Set household ${householdId} kind=${kind}`);
}

async function cmdState() {
  const hh = await findHousehold();
  if (!hh) return console.log("No ZZTEST user.");
  console.log("user:", hh.user.id, hh.user.email);
  for (const m of hh.memberships) {
    console.log("  household:", m.household_id, JSON.stringify(m.households));
    const hid = m.household_id;
    for (const tbl of ["pets", "vaccinations", "insurance_policies", "reminders"]) {
      const { count } = await sb
        .from(tbl)
        .select("*", { count: "exact", head: true })
        .eq("household_id", hid);
      console.log(`    ${tbl}: ${count}`);
    }
  }
}

async function cmdCleanup() {
  const hh = await findHousehold();
  if (!hh) return console.log("Nothing to clean. no ZZTEST user.");
  for (const m of hh.memberships) {
    const hid = m.household_id;
    // Delete child rows scoped to this household, then the household.
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
  const { error: uErr } = await sb.auth.admin.deleteUser(hh.user.id);
  if (uErr) console.log("  warn deleteUser:", uErr.message);
  else console.log("  deleted user", hh.user.id);
}

async function cmdVerifyClean() {
  const u = await findUser();
  if (u) return console.log("NOT CLEAN. user still exists:", u.id);
  console.log("CLEAN. no ZZTEST user remains.");
}

const cmd = process.argv[2];
const arg = process.argv[3];
const map = {
  setup: cmdSetup,
  magiclink: cmdMagicLink,
  seed: cmdSeed,
  "set-kind": () => cmdSetKind(arg),
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
