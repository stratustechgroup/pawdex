import "server-only";

// Multi-household support. The DB allows a user to belong to N households, but
// the app renders one at a time. The "active" household is stored in a cookie
// and resolved on every request. When the cookie is missing or points at a
// household the user can no longer reach, both requireSession() and
// bootstrapHousehold() fall back to the SAME deterministic rule below so a
// user always lands on the same household.

export const ACTIVE_HOUSEHOLD_COOKIE = "pawdex-active-household";

export type HouseholdRole = "owner" | "member" | "viewer";
export type HouseholdKind = "personal" | "breeder";

export type MembershipRow = {
  household_id: string;
  role: HouseholdRole;
  accepted_at: string | null;
  invited_at: string;
};

/**
 * Deterministic default: the user's earliest accepted membership. Accepted
 * memberships win over pending ones; among equals we order by accepted_at then
 * invited_at so the choice is stable across requests and across the two call
 * sites (requireSession and bootstrapHousehold). Returns null only when the
 * list is empty.
 */
export function pickDefaultMembership<T extends MembershipRow>(
  memberships: T[],
): T | null {
  if (memberships.length === 0) return null;
  const accepted = memberships.filter((m) => m.accepted_at !== null);
  const pool = accepted.length > 0 ? accepted : memberships;
  return [...pool].sort((a, b) => {
    const aKey = a.accepted_at ?? a.invited_at;
    const bKey = b.accepted_at ?? b.invited_at;
    if (aKey !== bKey) return aKey < bKey ? -1 : 1;
    if (a.invited_at !== b.invited_at) return a.invited_at < b.invited_at ? -1 : 1;
    return a.household_id < b.household_id ? -1 : 1;
  })[0];
}

/**
 * Resolves which membership is active given the cookie value. The cookie only
 * wins when it names a household the user has an ACCEPTED membership in;
 * otherwise we fall back to pickDefaultMembership so a stale or forged cookie
 * can never grant access or strand the user.
 */
export function resolveActiveMembership<T extends MembershipRow>(
  memberships: T[],
  cookieHouseholdId: string | undefined,
): T | null {
  if (cookieHouseholdId) {
    const match = memberships.find(
      (m) => m.household_id === cookieHouseholdId && m.accepted_at !== null,
    );
    if (match) return match;
  }
  return pickDefaultMembership(memberships);
}
