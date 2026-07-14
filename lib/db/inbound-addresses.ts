import "server-only";

import { createServiceClient } from "@/lib/supabase/service";
import type { HouseholdInboundAddress } from "@/lib/supabase/types";

// Override via env when deploying to a non-default inbound domain. Resend's
// inbound DNS instructions are tied to this — bump the env var, update DNS,
// reissue addresses. Existing slugs remain valid; only the host changes.
const INBOX_DOMAIN = process.env.PAWDEX_INBOUND_DOMAIN ?? "inbound.pawdex.co";

// Crockford-style base32 alphabet (no I, L, O, U) — readable when typed by a
// human relaying the address verbally.
const SLUG_ALPHABET = "0123456789abcdefghjkmnpqrstvwxyz";
const SLUG_LENGTH = 8;

function generateSlug(): string {
  const buf = new Uint8Array(SLUG_LENGTH);
  crypto.getRandomValues(buf);
  let out = "";
  for (const byte of buf) {
    out += SLUG_ALPHABET[byte % SLUG_ALPHABET.length];
  }
  return out;
}

export function inboxAddressFor(slug: string): string {
  return `inbox+${slug}@${INBOX_DOMAIN}`;
}

export function inboundDomain(): string {
  return INBOX_DOMAIN;
}

/**
 * Parse `inbox+<slug>@<domain>` and return the slug. Returns null for
 * anything that doesn't match — including different local-parts or different
 * domains. Caller is responsible for matching against the active domain.
 */
export function slugFromInboundAddress(address: string): string | null {
  const m = address.trim().toLowerCase().match(/^inbox\+([a-z0-9]+)@(.+)$/);
  if (!m) return null;
  return m[1];
}

export async function getOrCreateInboundAddress(
  householdId: string,
): Promise<HouseholdInboundAddress> {
  const supabase = createServiceClient();
  const { data: existing } = await supabase
    .from("household_inbound_addresses")
    .select("*")
    .eq("household_id", householdId)
    .maybeSingle();
  if (existing) return existing as HouseholdInboundAddress;

  // Slug collisions are astronomically unlikely with 32^8 = 1.1T values but
  // we retry on unique violation just in case.
  let lastError: string | null = null;
  for (let attempt = 0; attempt < 5; attempt++) {
    const { data, error } = await supabase
      .from("household_inbound_addresses")
      .insert({ household_id: householdId, slug: generateSlug() })
      .select("*")
      .single();
    if (data) return data as HouseholdInboundAddress;
    lastError = error?.message ?? "unknown";
    // 23505 = unique_violation. Anything else is fatal.
    if (error?.code !== "23505") break;
  }
  throw new Error(
    `getOrCreateInboundAddress: ${lastError ?? "exhausted retries"}`,
  );
}

export async function findHouseholdBySlug(
  slug: string,
): Promise<string | null> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("household_inbound_addresses")
    .select("household_id, households(deleted_at)")
    .eq("slug", slug.toLowerCase())
    .maybeSingle();
  if (!data) return null;
  // Inbound mail into a soft-deleted household is dropped: no new records should
  // land in a household that is on its way to being purged.
  const household = data.households as unknown as { deleted_at: string | null } | null;
  if (household?.deleted_at) return null;
  return (data.household_id as string | undefined) ?? null;
}
