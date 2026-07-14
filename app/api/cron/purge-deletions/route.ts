import { NextResponse, type NextRequest } from "next/server";

import { secretsEqual } from "@/lib/security/compare";
import { createServiceClient } from "@/lib/supabase/service";
import {
  hardPurgeAccount,
  hardPurgeHousehold,
  hardPurgePet,
  RETENTION_DAYS,
} from "@/lib/deletion/purge";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Daily cron, hard-purges everything whose 30-day soft-delete retention window
// has elapsed: households, then any remaining individually-deleted pets, then
// accounts scheduled for deletion. pg_cron POSTs here once a day (see migration
// 0034); authenticated with the CRON_SECRET shared via Supabase Vault, exactly
// like the records-requests cron.
//
// The job is resumable and idempotent: it processes up to a per-scope cap each
// run (storage-prefix deletion is heavy, so one slow household can't blow the
// wall-time budget) and selects strictly by cutoff, so already-purged rows are
// never revisited and the next run continues where this one stopped.

const MAX_HOUSEHOLDS = 20;
const MAX_PETS = 50;
const MAX_ACCOUNTS = 20;

export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      console.error(
        "[purge-deletions] CRON_SECRET not configured in production, refusing request",
      );
      return NextResponse.json(
        { error: "cron secret not configured" },
        { status: 500 },
      );
    }
    console.warn(
      "[purge-deletions] CRON_SECRET not set, accepting unsigned request in dev mode",
    );
  } else {
    const auth = request.headers.get("authorization") ?? "";
    if (!secretsEqual(auth, `Bearer ${secret}`)) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  const service = createServiceClient();
  const now = new Date();
  const cutoff = new Date(now.getTime() - RETENTION_DAYS * 86_400_000).toISOString();
  const nowIso = now.toISOString();

  const summary = {
    triggered_at: nowIso,
    cutoff,
    households_purged: 0,
    households_failed: 0,
    pets_purged: 0,
    pets_failed: 0,
    accounts_purged: 0,
    accounts_failed: 0,
    errors: [] as string[],
  };

  // 1. Households past the window first, this cascades their pets, so any pet
  //    also individually deleted inside them is handled here.
  const { data: households } = await service
    .from("households")
    .select("id")
    .not("deleted_at", "is", null)
    .lt("deleted_at", cutoff)
    .limit(MAX_HOUSEHOLDS);

  for (const hh of households ?? []) {
    const r = await hardPurgeHousehold(service, {
      householdId: hh.id,
      actorUserId: null,
      actorEmail: null,
      legalBasis: "retention_purge",
    });
    if (r.ok) summary.households_purged += 1;
    else {
      summary.households_failed += 1;
      if (r.error) summary.errors.push(`household ${hh.id}: ${r.error}`);
    }
  }

  // 2. Remaining individually-deleted pets whose household still exists.
  const { data: pets } = await service
    .from("pets")
    .select("id, household_id")
    .not("deleted_at", "is", null)
    .lt("deleted_at", cutoff)
    .limit(MAX_PETS);

  for (const pet of pets ?? []) {
    const r = await hardPurgePet(service, {
      householdId: pet.household_id,
      petId: pet.id,
      actorUserId: null,
      actorEmail: null,
      legalBasis: "retention_purge",
    });
    if (r.ok) summary.pets_purged += 1;
    else {
      summary.pets_failed += 1;
      if (r.error) summary.errors.push(`pet ${pet.id}: ${r.error}`);
    }
  }

  // 3. Accounts whose grace window has elapsed.
  const { data: accounts } = await service
    .from("account_deletions")
    .select("user_id, requested_email")
    .eq("status", "pending")
    .lt("purge_after", nowIso)
    .limit(MAX_ACCOUNTS);

  for (const acct of accounts ?? []) {
    const r = await hardPurgeAccount(service, {
      userId: acct.user_id,
      actorEmail: acct.requested_email ?? null,
      legalBasis: "retention_purge",
    });
    if (r.ok) summary.accounts_purged += 1;
    else {
      summary.accounts_failed += 1;
      if (r.error) summary.errors.push(`account ${acct.user_id}: ${r.error}`);
    }
  }

  return NextResponse.json(summary);
}

// GET is allowed for dev-mode manual invocation only.
export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "use POST" }, { status: 405 });
  }
  return POST(request);
}
