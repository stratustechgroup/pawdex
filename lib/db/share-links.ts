import "server-only";

import { createHash, randomBytes } from "node:crypto";

import { createServiceClient } from "@/lib/supabase/service";
import type { ShareLink, ShareScope } from "@/lib/supabase/types";

const TOKEN_BYTES = 24; // 192 bits → 32-char base64url

export function generateShareToken(): string {
  return randomBytes(TOKEN_BYTES).toString("base64url");
}

export function hashShareToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function createShareLink(input: {
  householdId: string;
  petId: string;
  userId: string;
  scope: ShareScope;
  recipientLabel: string | null;
  ttlDays: number;
}): Promise<{ link: ShareLink; rawToken: string }> {
  const rawToken = generateShareToken();
  const tokenHash = hashShareToken(rawToken);
  const expiresAt = new Date(Date.now() + input.ttlDays * 86400_000);

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("share_links")
    .insert({
      household_id: input.householdId,
      pet_id: input.petId,
      token_hash: tokenHash,
      scope: input.scope,
      recipient_label: input.recipientLabel,
      expires_at: expiresAt.toISOString(),
      created_by: input.userId,
    })
    .select("*")
    .single();
  if (error || !data) {
    throw new Error(`createShareLink: ${error?.message ?? "no row"}`);
  }
  return { link: data as ShareLink, rawToken };
}

export async function revokeShareLink(input: {
  householdId: string;
  linkId: string;
}): Promise<void> {
  const supabase = createServiceClient();
  const { error } = await supabase
    .from("share_links")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", input.linkId)
    .eq("household_id", input.householdId);
  if (error) throw new Error(`revokeShareLink: ${error.message}`);
}

export async function listShareLinksForPet(
  householdId: string,
  petId: string,
): Promise<ShareLink[]> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("share_links")
    .select("*")
    .eq("household_id", householdId)
    .eq("pet_id", petId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`listShareLinksForPet: ${error.message}`);
  return (data ?? []) as ShareLink[];
}

/**
 * Resolve a raw token from a public URL. Returns the link row only if it's
 * not expired and not revoked. Records the access (count + last_accessed_at)
 * as a side-effect.
 */
export async function resolveShareToken(
  rawToken: string,
): Promise<ShareLink | null> {
  if (!rawToken || rawToken.length < 8) return null;
  const tokenHash = hashShareToken(rawToken);
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("share_links")
    .select("*")
    .eq("token_hash", tokenHash)
    .maybeSingle();
  if (error || !data) return null;
  const link = data as ShareLink;
  if (link.revoked_at) return null;
  if (new Date(link.expires_at) <= new Date()) return null;

  // Fire-and-forget — failures are acceptable, we shouldn't 500 a recipient.
  await supabase
    .from("share_links")
    .update({
      access_count: link.access_count + 1,
      last_accessed_at: new Date().toISOString(),
    })
    .eq("id", link.id);

  return link;
}
