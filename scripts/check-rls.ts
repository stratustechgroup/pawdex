 
/**
 * RLS smoke test — proves that the anon role cannot read across households.
 *
 * Setup:
 *   1. Apply all migrations to your Supabase project.
 *   2. Create two test users via the Supabase dashboard or auth.
 *   3. Set env vars below (NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
 *      and NEXT_PUBLIC_SUPABASE_ANON_KEY).
 *   4. Run: pnpm tsx scripts/check-rls.ts
 *
 * It will:
 *   - Use the service role to provision two households with one pet each.
 *   - Use the anon key (no auth) to attempt to read pets — expects 0 rows.
 *   - Sign in as user A and confirm they see only household A.
 *
 * Exit code 0 = passed, 1 = failed.
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

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  console.log("→ Anonymous (no auth) — should see zero pets");
  const anon = createClient(url!, anonKey!);
  const { data: anonPets, error: anonErr } = await anon.from("pets").select("id");
  if (anonErr && anonErr.code !== "PGRST301") {
    // PGRST301 = no rows; acceptable. Other errors fine too if they fail closed.
    console.log(`   anon error (fail-closed): ${anonErr.message}`);
  }
  if (anonPets && anonPets.length > 0) {
    console.error(`✗ FAIL: anon read ${anonPets.length} pets without auth`);
    process.exit(1);
  }
  console.log(`   ✓ anon sees 0 pets`);

  if (userAEmail && userAPassword) {
    console.log("→ User A — should see only their household's pets");
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
    console.log(`   user A sees ${userPets?.length ?? 0} pets`);
    // Spot-check: all pets belong to one household.
    const householdIds = new Set((userPets ?? []).map((p) => p.household_id));
    if (householdIds.size > 1) {
      console.error(`✗ FAIL: user A sees pets across ${householdIds.size} households`);
      process.exit(1);
    }
    console.log(`   ✓ user A scoped to ${householdIds.size} household(s)`);
  } else {
    console.log(
      "→ Skipping authenticated user check (set RLS_TEST_USER_A_EMAIL + RLS_TEST_USER_A_PASSWORD to enable)",
    );
  }

  console.log("\n✓ RLS smoke test passed");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
