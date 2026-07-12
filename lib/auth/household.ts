import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import {
  ACTIVE_HOUSEHOLD_COOKIE,
  resolveActiveMembership,
  type HouseholdKind,
  type HouseholdRole,
  type MembershipRow,
} from "@/lib/auth/active-household";

export type HouseholdSummary = {
  householdId: string;
  name: string;
  kind: HouseholdKind;
  role: HouseholdRole;
  isActive: boolean;
};

export type Session = {
  userId: string;
  email: string | null;
  displayName: string | null;
  householdId: string;
  householdName: string;
  role: HouseholdRole;
  householdKind: HouseholdKind;
  // Every household the user belongs to, for the switcher. Always includes the
  // active one. A single-household user gets a one-element array.
  households: HouseholdSummary[];
};

type MemberRowWithHousehold = MembershipRow & {
  households: { id: string; name: string; kind: HouseholdKind } | null;
};

/**
 * Resolves the authenticated user's active household for Server Components.
 * Redirects to /login if unauthenticated, /onboarding if no household yet.
 *
 * The active household comes from the pawdex-active-household cookie when it
 * names a household the user can reach; otherwise it falls back to the earliest
 * accepted membership (see resolveActiveMembership). The same fallback backs
 * bootstrapHousehold so both agree on the "primary" household.
 *
 * Wrapped in React cache() so the layout, the page, and any nav component that
 * all call it during one render resolve the session ONCE per request instead of
 * re-running getUser + the DB reads for each. cache() memoizes per request only
 * (never across users/requests), so this is pure dedup with no behavior change.
 */
export const requireSession = cache(async function requireSession(): Promise<Session> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // The memberships (with their households) and the profile display name both
  // key off user.id and don't depend on each other, so fetch them in parallel:
  // one cross-region round trip instead of two. The profile read stays
  // best-effort — a missing row (before the 0030 backfill lands in a given DB)
  // or an unset name both fall back to email downstream, so a null is never
  // fatal.
  const [memberRes, profileRes] = await Promise.all([
    supabase
      .from("household_members")
      .select("household_id, role, accepted_at, invited_at, households(id, name, kind)")
      .eq("user_id", user.id),
    supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle(),
  ]);

  if (memberRes.error) {
    throw new Error(`requireSession member: ${memberRes.error.message}`);
  }

  const rows = (memberRes.data ?? []) as unknown as MemberRowWithHousehold[];
  if (rows.length === 0) {
    redirect("/onboarding");
  }

  const profileRow = profileRes.data;

  const cookieStore = await cookies();
  const cookieHouseholdId = cookieStore.get(ACTIVE_HOUSEHOLD_COOKIE)?.value;

  const active = resolveActiveMembership(rows, cookieHouseholdId);
  if (!active || !active.households) {
    // Membership rows with no readable household are unusable; treat as none.
    redirect("/onboarding");
  }

  const households: HouseholdSummary[] = rows
    .filter((r): r is MemberRowWithHousehold & { households: NonNullable<MemberRowWithHousehold["households"]> } =>
      r.households !== null,
    )
    .map((r) => ({
      householdId: r.household_id,
      name: r.households.name,
      kind: r.households.kind,
      role: r.role,
      isActive: r.household_id === active.household_id,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return {
    userId: user.id,
    email: user.email ?? null,
    displayName: profileRow?.display_name ?? null,
    householdId: active.household_id,
    householdName: active.households.name,
    role: active.role,
    householdKind: active.households.kind,
    households,
  };
});
