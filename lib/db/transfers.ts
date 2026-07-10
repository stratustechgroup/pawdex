import "server-only";

import { createHash, randomBytes } from "node:crypto";

import { createServiceClient } from "@/lib/supabase/service";
import type { Database } from "@/lib/supabase/types";

export {
  documentsToMove,
  type DocumentAssociation,
} from "@/lib/db/transfer-logic";

type AnimalTransfer = Database["public"]["Tables"]["animal_transfers"]["Row"];

const TOKEN_BYTES = 32; // 256 bits, mirroring household_invitations.

export function generateTransferToken(): { raw: string; hash: string } {
  const raw = randomBytes(TOKEN_BYTES).toString("base64url");
  return { raw, hash: hashTransferToken(raw) };
}

export function hashTransferToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

// The pure document-move decision lives in transfer-logic.ts (re-exported
// above) so it can be behaviorally tested without pulling in server-only.

// ── service-role DB helpers ──────────────────────────────────────────

export async function createTransfer(input: {
  animalId: string;
  fromHouseholdId: string;
  createdBy: string;
  recipientEmail: string | null;
  message: string | null;
  ttlDays?: number;
}): Promise<{ transfer: AnimalTransfer; rawToken: string }> {
  const { raw, hash } = generateTransferToken();
  const expiresAt = new Date(
    Date.now() + (input.ttlDays ?? 14) * 86_400_000,
  ).toISOString();

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("animal_transfers")
    .insert({
      animal_id: input.animalId,
      from_household_id: input.fromHouseholdId,
      token_hash: hash,
      created_by: input.createdBy,
      recipient_email: input.recipientEmail,
      message: input.message,
      expires_at: expiresAt,
    })
    .select("*")
    .single();
  if (error || !data) {
    throw new Error(`createTransfer: ${error?.message ?? "no row"}`);
  }
  return { transfer: data as AnimalTransfer, rawToken: raw };
}

export async function revokeTransfer(input: {
  fromHouseholdId: string;
  transferId: string;
}): Promise<void> {
  const supabase = createServiceClient();
  const { error } = await supabase
    .from("animal_transfers")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", input.transferId)
    .eq("from_household_id", input.fromHouseholdId)
    .is("accepted_at", null);
  if (error) throw new Error(`revokeTransfer: ${error.message}`);
}

/**
 * Resolve a raw token from the public accept URL. Returns the row only if it is
 * still pending (not accepted / revoked / declined) and unexpired. The accept
 * route validates the recipient and then calls transfer_animal().
 */
export async function lookupTransferByToken(
  rawToken: string,
): Promise<AnimalTransfer | null> {
  if (!rawToken || rawToken.length < 8) return null;
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("animal_transfers")
    .select("*")
    .eq("token_hash", hashTransferToken(rawToken))
    .maybeSingle();
  if (error || !data) return null;
  const transfer = data as AnimalTransfer;
  if (transfer.accepted_at || transfer.revoked_at || transfer.declined_at) {
    return null;
  }
  if (new Date(transfer.expires_at) <= new Date()) return null;
  return transfer;
}

/**
 * Complete an accepted transfer: stamp accepted_by, then run the atomic
 * ownership + record move in Postgres. All under the service role.
 */
export async function acceptTransfer(input: {
  transferId: string;
  animalId: string;
  toHouseholdId: string;
  acceptedBy: string;
}): Promise<void> {
  const supabase = createServiceClient();

  const { error: stampErr } = await supabase
    .from("animal_transfers")
    .update({ accepted_by: input.acceptedBy })
    .eq("id", input.transferId)
    .is("accepted_at", null);
  if (stampErr) throw new Error(`acceptTransfer stamp: ${stampErr.message}`);

  const { error: rpcErr } = await supabase.rpc("transfer_animal", {
    p_animal_id: input.animalId,
    p_to_household_id: input.toHouseholdId,
    p_transfer_id: input.transferId,
  });
  if (rpcErr) throw new Error(`acceptTransfer rpc: ${rpcErr.message}`);
}
