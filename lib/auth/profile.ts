import "server-only";

import { createClient } from "@/lib/supabase/server";

/**
 * Updates the calling user's display name. RLS restricts the write to the
 * caller's own row, so no explicit ownership check is needed here. Pass a
 * trimmed, validated value; an empty string clears the name back to null.
 */
export async function updateDisplayName(
  userId: string,
  displayName: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const trimmed = displayName.trim();
  const supabase = await createClient();
  // Select back the updated row: an empty result means no profile row exists
  // for this user yet (e.g. the 0030 backfill hasn't reached this DB), which we
  // surface rather than reporting a silent success. There is no INSERT policy,
  // so an upsert would fail RLS — the row must come from the trigger/backfill.
  const { data, error } = await supabase
    .from("profiles")
    .update({ display_name: trimmed === "" ? null : trimmed })
    .eq("id", userId)
    .select("id");
  if (error) return { ok: false, error: error.message };
  if (!data || data.length === 0) {
    return { ok: false, error: "Your profile isn't ready yet. Try again in a moment." };
  }
  return { ok: true };
}

/**
 * The first name to greet someone by. Prefers the profile display name's first
 * token, falling back to the email local part.
 */
export function firstNameFrom(
  displayName: string | null,
  email: string | null,
): string {
  const source = (displayName ?? email?.split("@")[0] ?? "there").trim();
  const first = source.split(/[\s._-]+/).filter(Boolean)[0];
  return first || "there";
}
