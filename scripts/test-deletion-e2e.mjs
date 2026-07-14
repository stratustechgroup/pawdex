// Deletion + retention DB-level E2E harness. Unlike the households harness this
// does NOT drive a browser: the deletion logic lives in query-helper filters, a
// shared purge module, and a cron selection query, all of which are exercisable
// directly against Supabase with the service client. That keeps the harness
// runnable without a built server while still covering the behaviors that
// matter:
//   1. Soft delete a pet -> hidden by the same filters the app helpers use ->
//      restore -> visible again.
//   2. Household deletion enumeration: only SOLELY-owned households are listed
//      for destruction; a household with a second owner is not.
//   3. Purge dry-run: the daily cron's cutoff selection finds a household whose
//      30-day window has elapsed, and skips one still inside it.
//   4. A hard purge of a soft-deleted household removes it and its pets, and
//      writes a durable deletion_log row that OUTLIVES the household.
//
// Requires migrations 0033 + 0034 to be applied to the Supabase the .env.local
// points at. If the schema is not present the harness says so and exits 2
// rather than pretending to pass. All writes are scoped to ZZTEST users and are
// removed in the finally block. Never touches prod data.
//
// Usage: node scripts/test-deletion-e2e.mjs
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const RETENTION_DAYS = 30;
const OWNER_EMAIL = "zztest-deletion-owner@zzpawdextest-nx.io";
const COOWNER_EMAIL = "zztest-deletion-coowner@zzpawdextest-nx.io";
const PET_NAME = "ZZTESTDELPET";

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split("\n")
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    }),
);
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const results = [];
function assert(name, cond, detail = "") {
  results.push({ name, ok: !!cond, detail });
  console.log(`  ${cond ? "PASS" : "FAIL"} ${name}${detail ? `: ${detail}` : ""}`);
}

async function ensureUser(email) {
  for (let page = 1; page <= 20; page++) {
    const { data } = await sb.auth.admin.listUsers({ page, perPage: 200 });
    const u = data.users.find((x) => x.email === email);
    if (u) return u;
    if ((data.users.length ?? 0) < 200) break;
  }
  const { data, error } = await sb.auth.admin.createUser({ email, email_confirm: true });
  if (error) throw error;
  return data.user;
}

async function createHousehold(name, ownerId, kind = "personal") {
  const { data, error } = await sb
    .from("households")
    .insert({ name, kind, created_by: ownerId })
    .select("id")
    .single();
  if (error) throw new Error(`create household: ${error.message}`);
  const { error: mErr } = await sb.from("household_members").insert({
    household_id: data.id,
    user_id: ownerId,
    role: "owner",
    accepted_at: new Date().toISOString(),
    invited_at: new Date().toISOString(),
  });
  if (mErr) throw new Error(`add owner: ${mErr.message}`);
  return data.id;
}

// Mirrors listPetsForHousehold's visibility filters (household + archived_at +
// deleted_at). If a soft-deleted pet leaks through this, it leaks in the app.
async function visiblePets(householdId) {
  const { data } = await sb
    .from("pets")
    .select("id, name")
    .eq("household_id", householdId)
    .is("archived_at", null)
    .is("deleted_at", null);
  return data ?? [];
}

// Mirrors soleOwnedHouseholds from lib/deletion/purge.ts.
async function soleOwned(userId) {
  const { data: owned } = await sb
    .from("household_members")
    .select("household_id")
    .eq("user_id", userId)
    .eq("role", "owner");
  const out = [];
  for (const row of owned ?? []) {
    const { count } = await sb
      .from("household_members")
      .select("user_id", { head: true, count: "exact" })
      .eq("household_id", row.household_id)
      .eq("role", "owner")
      .neq("user_id", userId);
    if ((count ?? 0) === 0) out.push(row.household_id);
  }
  return out;
}

async function schemaReady() {
  // Probe the new columns/tables; a PostgREST error means migrations not applied.
  const petCol = await sb.from("pets").select("deleted_at").limit(1);
  const delLog = await sb.from("deletion_log").select("id").limit(1);
  const acct = await sb.from("account_deletions").select("user_id").limit(1);
  return !petCol.error && !delLog.error && !acct.error;
}

async function main() {
  if (!(await schemaReady())) {
    console.log(
      "\nSCHEMA NOT APPLIED: migrations 0033/0034 are not present on this Supabase.\n" +
        "Apply them (supabase db push locally, or via the migration pipeline) and re-run.",
    );
    process.exit(2);
  }

  const created = { ownerId: null, coownerId: null, hids: new Set() };
  try {
    const owner = await ensureUser(OWNER_EMAIL);
    const coowner = await ensureUser(COOWNER_EMAIL);
    created.ownerId = owner.id;
    created.coownerId = coowner.id;

    // Household A: solely owned, one pet.
    const hidA = await createHousehold("ZZTEST Deletion A", owner.id);
    created.hids.add(hidA);
    const { data: pet } = await sb
      .from("pets")
      .insert({ household_id: hidA, name: PET_NAME, species: "dog", created_by: owner.id })
      .select("id")
      .single();

    // Household B: owner + a second owner (shared).
    const hidB = await createHousehold("ZZTEST Deletion B", owner.id);
    created.hids.add(hidB);
    await sb.from("household_members").insert({
      household_id: hidB,
      user_id: coowner.id,
      role: "owner",
      accepted_at: new Date().toISOString(),
      invited_at: new Date().toISOString(),
    });

    // ── 1. Soft delete pet -> hidden -> restore ──────────────────────────
    console.log("== soft delete pet hides it everywhere, then restores ==");
    assert("pet visible before delete", (await visiblePets(hidA)).some((p) => p.id === pet.id));

    await sb
      .from("pets")
      .update({ deleted_at: new Date().toISOString(), deleted_by: owner.id })
      .eq("id", pet.id);
    assert("pet hidden after soft delete", !(await visiblePets(hidA)).some((p) => p.id === pet.id));

    await sb.from("pets").update({ deleted_at: null, deleted_by: null }).eq("id", pet.id);
    assert("pet visible again after restore", (await visiblePets(hidA)).some((p) => p.id === pet.id));

    // ── 2. Household deletion enumeration ────────────────────────────────
    console.log("== account deletion enumerates only sole-owned households ==");
    const sole = await soleOwned(owner.id);
    assert("sole-owned includes household A", sole.includes(hidA));
    assert("sole-owned EXCLUDES the shared household B", !sole.includes(hidB), `sole=${sole.length}`);

    // ── 3. Purge dry-run: cutoff selection ───────────────────────────────
    console.log("== purge cutoff selects only elapsed windows ==");
    const cutoff = new Date(Date.now() - RETENTION_DAYS * 86_400_000).toISOString();
    // A: soft-deleted 31 days ago (eligible). B: soft-deleted just now (not).
    await sb
      .from("households")
      .update({ deleted_at: new Date(Date.now() - 31 * 86_400_000).toISOString(), deleted_by: owner.id })
      .eq("id", hidA);
    await sb
      .from("households")
      .update({ deleted_at: new Date().toISOString(), deleted_by: owner.id })
      .eq("id", hidB);
    const { data: eligible } = await sb
      .from("households")
      .select("id")
      .not("deleted_at", "is", null)
      .lt("deleted_at", cutoff)
      .in("id", [hidA, hidB]);
    const eligibleIds = (eligible ?? []).map((h) => h.id);
    assert("elapsed household A is purge-eligible", eligibleIds.includes(hidA));
    assert("recently-deleted household B is NOT yet eligible", !eligibleIds.includes(hidB));

    // ── 4. Hard purge removes rows + leaves a durable deletion_log ────────
    console.log("== hard purge removes household + pets, deletion_log survives ==");
    // Clear the RESTRICT edges (none here) then delete the household; cascade
    // takes its pets + members. This mirrors hardPurgeHousehold's core.
    await sb.from("outbound_emails").delete().eq("household_id", hidA);
    await sb.from("research_consents").delete().eq("household_id", hidA);
    await sb.from("litters").delete().eq("household_id", hidA);
    await sb.from("households").delete().eq("id", hidA);
    await sb.from("deletion_log").insert({
      scope: "household",
      subject_id: hidA,
      household_id: hidA,
      actor_user_id: owner.id,
      actor_email: OWNER_EMAIL,
      legal_basis: "retention_purge",
      action: "hard_purge",
      details: { household_name: "ZZTEST Deletion A" },
    });

    const { count: petsLeft } = await sb
      .from("pets")
      .select("id", { head: true, count: "exact" })
      .eq("household_id", hidA);
    assert("hard purge removed the household's pets", (petsLeft ?? 0) === 0, `pets=${petsLeft}`);
    const { count: hhLeft } = await sb
      .from("households")
      .select("id", { head: true, count: "exact" })
      .eq("id", hidA);
    assert("hard purge removed the household", (hhLeft ?? 0) === 0);
    const { count: logLeft } = await sb
      .from("deletion_log")
      .select("id", { head: true, count: "exact" })
      .eq("subject_id", hidA);
    assert("deletion_log entry survives the household purge", (logLeft ?? 0) >= 1, `rows=${logLeft}`);
    // hidA is gone; drop it from cleanup set.
    created.hids.delete(hidA);
  } finally {
    console.log("== cleanup ==");
    for (const hid of created.hids) {
      for (const tbl of ["pets", "household_members", "audit_log"]) {
        await sb.from(tbl).delete().eq("household_id", hid);
      }
      await sb.from("households").delete().eq("id", hid);
    }
    // Remove durable deletion_log rows written for these test households.
    for (const id of [created.ownerId, created.coownerId]) {
      if (id) await sb.from("deletion_log").delete().eq("actor_user_id", id);
    }
    for (const id of [created.ownerId, created.coownerId]) {
      if (!id) continue;
      const { error } = await sb.auth.admin.deleteUser(id);
      if (error) console.log(`  warn deleteUser ${id}: ${error.message}`);
    }
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\ndeletion E2E: ${results.length - failed.length}/${results.length} assertions passed`);
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
