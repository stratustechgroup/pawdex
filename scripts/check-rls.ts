/**
 * RLS smoke test — proves that the anon role cannot read across households.
 * Updated for Phase 6: covers every household-scoped table.
 *
 * Setup:
 *   1. Apply all migrations to your Supabase project.
 *   2. Optional: create a test user + set RLS_TEST_USER_A_EMAIL +
 *      RLS_TEST_USER_A_PASSWORD to also exercise the authenticated path.
 *   3. Set NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY +
 *      SUPABASE_SERVICE_ROLE_KEY in your env.
 *   4. Run: pnpm tsx scripts/check-rls.ts
 *
 * Exit code 0 = all tables fail-closed for anon; 1 = at least one table leaked.
 */

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const userAEmail = process.env.RLS_TEST_USER_A_EMAIL;
const userAPassword = process.env.RLS_TEST_USER_A_PASSWORD;

if (!url || !anonKey || !serviceKey) {
  console.error(
    "Missing env vars. Need NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY.",
  );
  process.exit(1);
}

// Every household-scoped table Pawdex defines. Adding a new domain table?
// Add it here too — and write an RLS policy for it!
const TABLES_TO_CHECK = [
  // Phase 1 core
  "households",
  "household_members",
  "pets",
  "weight_log",
  "vaccinations",
  "medical_events",
  "medications",
  "vet_clinics",
  "documents",
  "document_extractions",
  "document_pet_links",
  "reminders",
  "reminder_preferences",
  // Phase 2.6 / 2.7
  "extraction_feedback",
  // Phase 4
  "audit_log",
  "household_invitations",
  // Phase 5
  "authorizations",
  "outbound_emails",
  "insurance_policies",
  "cost_estimates",
  "extraction_chunks",
  "pending_records_requests",
  "household_inbound_addresses",
  // Phase 6
  "share_links",
  "qol_entries",
  "medication_administrations",
  "medication_price_quotes",
  "claims",
  "claim_attachments",
  "lab_values",
  // Phase 6.41 — identity core
  "animals",
  "custodianships",
  "litters",
  "animal_transfers",
  "research_consents",
  "dataset_releases",
  "dataset_release_items",
];

async function main() {
  const anon = createClient(url!, anonKey!);

  console.log(`→ Anonymous read across ${TABLES_TO_CHECK.length} tables — expect zero rows each\n`);

  const leaked: { table: string; count: number; sample: unknown }[] = [];
  for (const table of TABLES_TO_CHECK) {
    const { data, error } = await anon
      .from(table)
      .select("*", { count: "exact", head: false })
      .limit(3);
    const rowCount = data?.length ?? 0;
    if (rowCount > 0) {
      leaked.push({ table, count: rowCount, sample: data?.[0] });
      console.error(`   ✗ ${table}: leaked ${rowCount} row(s)`);
    } else {
      // Show errors as informational; fail-closed errors are expected for RLS.
      const why = error?.message
        ? ` (${error.code ?? "err"}: ${error.message})`
        : "";
      console.log(`   ✓ ${table}${why}`);
    }
  }

  if (leaked.length > 0) {
    console.error(
      `\n✗ FAIL: ${leaked.length} table${leaked.length === 1 ? "" : "s"} leaked rows to anon.`,
    );
    process.exit(1);
  }

  if (userAEmail && userAPassword) {
    console.log("\n→ Authenticated user A — pets must be single-household-scoped");
    const userA = createClient(url!, anonKey!);
    const { error: signInErr } = await userA.auth.signInWithPassword({
      email: userAEmail,
      password: userAPassword,
    });
    if (signInErr) {
      console.error(`✗ Sign-in failed: ${signInErr.message}`);
      process.exit(1);
    }
    const { data: userPets } = await userA.from("pets").select("id, household_id");
    const householdIds = new Set((userPets ?? []).map((p) => p.household_id));
    console.log(`   user A sees ${userPets?.length ?? 0} pets across ${householdIds.size} household(s)`);
    if (householdIds.size > 1) {
      console.error(`✗ FAIL: user A sees pets across ${householdIds.size} households`);
      process.exit(1);
    }
  } else {
    console.log(
      "\n→ Skipping authenticated user check (set RLS_TEST_USER_A_EMAIL + RLS_TEST_USER_A_PASSWORD to enable)",
    );
  }

  console.log("\n✓ RLS smoke test passed — anon cannot read household data.");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
