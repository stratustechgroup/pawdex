// Onboarding E2E harness. Creates an isolated ZZTEST organic user, mints the
// magic-link callback URL for headless login, inspects the DB state the
// onboarding flow writes, and can inject a synthetic document to exercise the
// "forward an email landed" celebration. ALL writes are scoped to this one
// ZZTEST user + its bootstrapped household, deleted by cleanup and confirmed by
// verify-clean. Never touches prod data.
//
// Usage:
//   node scripts/test-onboarding-e2e.mjs setup
//   node scripts/test-onboarding-e2e.mjs magiclink [next]   # default next=/
//   node scripts/test-onboarding-e2e.mjs state              # dump onboarding-relevant rows
//   node scripts/test-onboarding-e2e.mjs add-doc            # inject a ZZTEST document
//   node scripts/test-onboarding-e2e.mjs cleanup
//   node scripts/test-onboarding-e2e.mjs verify-clean
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const TEST_EMAIL = "zztest-onboarding@zzpawdextest-nx.io";
const APP_ORIGIN = process.env.E2E_ORIGIN ?? "http://localhost:3600";

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

async function householdsFor(userId) {
  const { data } = await sb
    .from("household_members")
    .select("household_id")
    .eq("user_id", userId);
  return (data ?? []).map((m) => m.household_id);
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
  console.log("CREATED_AT=" + u.created_at);
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

async function cmdState() {
  const u = await findUser();
  if (!u) return console.log("No ZZTEST user.");
  console.log("USER_ID=" + u.id);

  const { data: prof } = await sb
    .from("profiles")
    .select("display_name")
    .eq("id", u.id)
    .maybeSingle();
  console.log("PROFILE_DISPLAY_NAME=" + JSON.stringify(prof?.display_name ?? null));

  const hids = await householdsFor(u.id);
  for (const hid of hids) {
    const { data: hh } = await sb.from("households").select("name").eq("id", hid).maybeSingle();
    console.log(`HOUSEHOLD ${hid} name=${JSON.stringify(hh?.name ?? null)}`);

    const { data: pets } = await sb
      .from("pets")
      .select("id, name, species, date_of_birth, dob_is_estimated, photo_storage_path")
      .eq("household_id", hid);
    console.log("  PETS=" + JSON.stringify(pets ?? []));

    const { count: docCount } = await sb
      .from("documents")
      .select("id", { head: true, count: "exact" })
      .eq("household_id", hid);
    console.log("  DOCUMENTS_COUNT=" + (docCount ?? 0));

    const { data: rem } = await sb
      .from("reminders")
      .select("entity_type, entity_id, due_on, lead_days, status")
      .eq("household_id", hid)
      .order("due_on", { ascending: true });
    console.log("  REMINDERS=" + JSON.stringify(rem ?? []));

    const { data: auths } = await sb
      .from("authorizations")
      .select("authorization_type, revoked_at")
      .eq("household_id", hid);
    console.log("  AUTHORIZATIONS=" + JSON.stringify(auths ?? []));

    const { count: consentCount } = await sb
      .from("research_consents")
      .select("id", { head: true, count: "exact" })
      .eq("household_id", hid);
    console.log("  RESEARCH_CONSENTS_COUNT=" + (consentCount ?? 0));

    const { data: inbox } = await sb
      .from("household_inbound_addresses")
      .select("slug")
      .eq("household_id", hid)
      .maybeSingle();
    console.log("  INBOUND_SLUG=" + JSON.stringify(inbox?.slug ?? null));
  }
}

async function cmdAddDoc() {
  const u = await findUser();
  if (!u) return console.log("No ZZTEST user.");
  const hids = await householdsFor(u.id);
  if (hids.length === 0) return console.log("No household yet.");
  const hid = hids[0];
  const { data: pet } = await sb
    .from("pets")
    .select("id")
    .eq("household_id", hid)
    .limit(1)
    .maybeSingle();
  const { data, error } = await sb
    .from("documents")
    .insert({
      household_id: hid,
      pet_id: pet?.id ?? null,
      storage_path: `zztest/${crypto.randomUUID()}.pdf`,
      original_filename: "ZZTEST-vaccine-cert.pdf",
      doc_type: "unknown",
      processing_status: "pending",
      created_by: u.id,
    })
    .select("id")
    .single();
  if (error) throw error;
  console.log("INSERTED_DOC=" + data.id);
}

async function cmdCleanup() {
  const u = await findUser();
  if (!u) return console.log("Nothing to clean. no ZZTEST user.");
  const hids = await householdsFor(u.id);
  for (const hid of hids) {
    for (const tbl of [
      "reminders",
      "research_consents",
      "authorizations",
      "household_inbound_addresses",
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
  if (u) return console.log("NOT CLEAN. user still exists: " + u.id);
  console.log("CLEAN. no ZZTEST user remains.");
}

const cmd = process.argv[2];
const map = {
  setup: cmdSetup,
  magiclink: cmdMagicLink,
  state: cmdState,
  "add-doc": cmdAddDoc,
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
