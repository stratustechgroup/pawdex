// Cockpit dashboard E2E harness. Creates an isolated ZZTEST user + household,
// seeds a rich, realistic set (2-3 pets, weight history for sparklines and the
// weight-loss insight, a due-soon vaccine, an overdue vaccine, a policy, an
// active medication, and a document waiting for review), mints a magic-link for
// headless login, and cleans everything up with a count check. ALL writes are
// scoped to the ZZTEST household_id. Never a blanket mutation, never prod data.
//
// Usage:
//   node scripts/test-cockpit-e2e.mjs setup       # create user, print id
//   node scripts/test-cockpit-e2e.mjs magiclink   # print callback URL (port 3700)
//   node scripts/test-cockpit-e2e.mjs seed        # seed the rich fixture
//   node scripts/test-cockpit-e2e.mjs set-kind breeder|personal
//   node scripts/test-cockpit-e2e.mjs state
//   node scripts/test-cockpit-e2e.mjs cleanup     # delete everything
//   node scripts/test-cockpit-e2e.mjs verify-clean
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const TEST_EMAIL = "zztest-cockpit@example.com";
const APP_ORIGIN = process.env.E2E_ORIGIN ?? "http://localhost:3700";

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

const today = new Date();
const iso = (d) => d.toISOString().slice(0, 10);
const plusDays = (n) => {
  const d = new Date(today);
  d.setDate(d.getDate() + n);
  return iso(d);
};

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
  console.log(
    "CALLBACK_URL=" +
      `${APP_ORIGIN}/auth/callback?token_hash=${data.properties.hashed_token}&type=magiclink&next=/`,
  );
}

async function cmdSeed() {
  const hh = await findHousehold();
  if (!hh || hh.memberships.length === 0)
    throw new Error("No household yet. Log in once so bootstrap runs, then seed.");
  const householdId = hh.memberships[0].household_id;
  const userId = hh.user.id;
  console.log("Seeding into household:", householdId);

  // ── Pet A: adult dog, full record, WEIGHT LOSS (insight should surface) ──
  const { data: luna, error: lErr } = await sb
    .from("pets")
    .insert({
      household_id: householdId,
      name: "zztest-cockpit Luna",
      species: "dog",
      breed: "Golden Retriever",
      sex: "female",
      date_of_birth: plusDays(-365 * 4), // adult
      created_by: userId,
    })
    .select("id")
    .single();
  if (lErr) throw lErr;

  // Weight history trending DOWN ~8% over 90 days (5 readings → sparkline).
  await sb.from("weight_log").insert(
    [
      [-90, 30.0],
      [-68, 29.2],
      [-45, 28.6],
      [-22, 28.0],
      [-2, 27.6],
    ].map(([d, kg]) => ({
      household_id: householdId,
      pet_id: luna.id,
      recorded_on: plusDays(d),
      weight_kg: kg,
      source: "manual",
      created_by: userId,
    })),
  );

  // Rabies due soon (12 days) + DHPP healthy. is_rabies is a generated column
  // (computed from vaccine_type), so it is never inserted.
  const vErrA = (
    await sb.from("vaccinations").insert([
      {
        household_id: householdId,
        pet_id: luna.id,
        vaccine_type: "Rabies (3yr)",
        administered_on: plusDays(-1083),
        expires_on: plusDays(12),
        created_by: userId,
      },
      {
        household_id: householdId,
        pet_id: luna.id,
        vaccine_type: "DHPP",
        administered_on: plusDays(-120),
        expires_on: plusDays(240),
        created_by: userId,
      },
    ])
  ).error;
  if (vErrA) throw vErrA;

  // Active medication.
  await sb.from("medications").insert({
    household_id: householdId,
    pet_id: luna.id,
    name: "Levothyroxine",
    dose: "0.5 mg",
    frequency: "twice daily",
    medication_context: "prescribed_takehome",
    started_on: plusDays(-60),
    created_by: userId,
  });

  // Insurance policy renewing in 40 days (badge + rail row).
  await sb.from("insurance_policies").insert({
    household_id: householdId,
    pet_id: luna.id,
    insurer_name: "zztest Trupanion",
    plan_name: "Accident & Illness",
    renews_on: plusDays(40),
    created_by: userId,
  });

  // A document extracted and waiting for review (action item + activity feed).
  await sb.from("documents").insert({
    household_id: householdId,
    pet_id: luna.id,
    original_filename: "luna-rabies-cert.pdf",
    doc_type: "vaccine_certificate",
    processing_status: "extracted",
    storage_bucket: "documents",
    storage_path: `zztest/${luna.id}/rabies.pdf`,
    created_by: userId,
  });

  // ── Pet B: KITTEN, weight GAIN (insight should NOT surface: growth) ──
  const { data: finn, error: fErr } = await sb
    .from("pets")
    .insert({
      household_id: householdId,
      name: "zztest-cockpit Finn",
      species: "cat",
      breed: "Domestic Shorthair",
      sex: "male",
      date_of_birth: plusDays(-150), // ~5 months, growing
      created_by: userId,
    })
    .select("id")
    .single();
  if (fErr) throw fErr;

  await sb.from("weight_log").insert(
    [
      [-70, 1.8],
      [-45, 2.3],
      [-20, 2.9],
      [-2, 3.3],
    ].map(([d, kg]) => ({
      household_id: householdId,
      pet_id: finn.id,
      recorded_on: plusDays(d),
      weight_kg: kg,
      source: "manual",
      created_by: userId,
    })),
  );

  // Overdue rabies (action item: overdue).
  const vErrB = (
    await sb.from("vaccinations").insert({
      household_id: householdId,
      pet_id: finn.id,
      vaccine_type: "Rabies (1yr)",
      administered_on: plusDays(-400),
      expires_on: plusDays(-18),
      created_by: userId,
    })
  ).error;
  if (vErrB) throw vErrB;

  // ── Pet C: minimal, incomplete (no vaccines) ──
  await sb.from("pets").insert({
    household_id: householdId,
    name: "zztest-cockpit Rex",
    species: "dog",
    breed: "Beagle",
    sex: "male",
    date_of_birth: plusDays(-365 * 2),
    created_by: userId,
  });

  console.log("Seeded: 3 pets, weight history, due+overdue vaccines, 1 policy, 1 med, 1 doc.");
}

async function cmdSetKind(kind) {
  if (!["breeder", "personal"].includes(kind))
    throw new Error("kind must be breeder|personal");
  const hh = await findHousehold();
  const householdId = hh.memberships[0].household_id;
  const { error } = await sb.from("households").update({ kind }).eq("id", householdId);
  if (error) throw error;
  console.log(`Set household ${householdId} kind=${kind}`);
}

async function cmdState() {
  const hh = await findHousehold();
  if (!hh) return console.log("No ZZTEST user.");
  console.log("user:", hh.user.id, hh.user.email);
  for (const m of hh.memberships) {
    console.log("  household:", m.household_id, JSON.stringify(m.households));
    for (const tbl of [
      "pets",
      "vaccinations",
      "insurance_policies",
      "weight_log",
      "medications",
      "documents",
    ]) {
      const { count } = await sb
        .from(tbl)
        .select("*", { count: "exact", head: true })
        .eq("household_id", m.household_id);
      console.log(`    ${tbl}: ${count}`);
    }
  }
}

async function cmdCleanup() {
  const hh = await findHousehold();
  if (!hh) return console.log("Nothing to clean. No ZZTEST user.");
  for (const m of hh.memberships) {
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
