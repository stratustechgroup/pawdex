"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireSession } from "@/lib/auth/household";
import { updateDisplayName } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { recordAudit } from "@/lib/db/audit";
import {
  sendReverificationCode,
  verifyReverificationCode,
} from "@/lib/auth/reverify";
import {
  hardPurgeAccount,
  soleOwnedHouseholds,
  writeDeletionLog,
  RETENTION_DAYS,
} from "@/lib/deletion/purge";
import type { Json } from "@/lib/supabase/types";

export type ActionResult = { ok: true } | { ok: false; error: string };

const displayNameSchema = z
  .string()
  .trim()
  .max(80, "Keep your display name under 80 characters.");

export async function saveDisplayName(rawName: string): Promise<ActionResult> {
  const session = await requireSession();
  const parsed = displayNameSchema.safeParse(rawName ?? "");
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid name." };
  }
  const result = await updateDisplayName(session.userId, parsed.data);
  if (!result.ok) return result;
  revalidatePath("/settings/account");
  revalidatePath("/settings/household");
  revalidatePath("/");
  return { ok: true };
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function changeEmail(rawEmail: string): Promise<ActionResult> {
  const session = await requireSession();
  const email = (rawEmail ?? "").trim().toLowerCase();
  if (!EMAIL_RE.test(email)) {
    return { ok: false, error: "That doesn't look like a valid email." };
  }
  if (email === (session.email ?? "").toLowerCase()) {
    return { ok: false, error: "That's already your email." };
  }

  const supabase = await createClient();
  // Secure email change is on by default: Supabase mails a confirmation link to
  // BOTH the current and the new address, and the change only lands once both
  // are clicked. We just kick it off here.
  const { error } = await supabase.auth.updateUser({ email });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// Password minimum is 10 in the project's auth config; enforce the same here so
// the server never accepts a shorter one than the UI advertises.
const passwordSchema = z
  .string()
  .min(10, "Use at least 10 characters.")
  .max(72, "Passwords can be at most 72 characters.");

export async function setPassword(rawPassword: string): Promise<ActionResult> {
  await requireSession();
  const parsed = passwordSchema.safeParse(rawPassword ?? "");
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid password." };
  }
  const supabase = await createClient();
  // updateUser adds a password when there is none and changes it when there is,
  // so this one call covers both cases. We deliberately don't try to detect which:
  // auth.users.encrypted_password is non-empty even for magic-link-only users in
  // this GoTrue version (verified against a real signInWithOtp signup and the
  // founder's own account), so it can't distinguish "has a password" from "none".
  // The account UI uses detection-independent copy instead.
  const { error } = await supabase.auth.updateUser({ password: parsed.data });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// ============================================================
// Account deletion (confirmation ladder rung 3)
// ============================================================

/**
 * Enumerate what account deletion will affect: households the user SOLELY owns
 * (deleted with the account) versus households with other owners or where the
 * user is a member/viewer (which just lose this membership). Shown at the
 * confirmation step so the user sees exactly what is destroyed.
 */
export async function getAccountDeletionPreviewAction(): Promise<{
  soleOwned: Array<{ id: string; name: string }>;
  sharedOrMember: Array<{ id: string; name: string; role: string }>;
}> {
  const session = await requireSession();
  const service = createServiceClient();

  const soleOwned = await soleOwnedHouseholds(service, session.userId);
  const soleIds = new Set(soleOwned.map((h) => h.id));

  const { data: memberships } = await service
    .from("household_members")
    .select("role, households(id, name)")
    .eq("user_id", session.userId);

  const sharedOrMember: Array<{ id: string; name: string; role: string }> = [];
  for (const m of memberships ?? []) {
    const hh = m.households as unknown as { id: string; name: string } | null;
    if (!hh || soleIds.has(hh.id)) continue;
    sharedOrMember.push({ id: hh.id, name: hh.name, role: m.role });
  }

  return { soleOwned, sharedOrMember };
}

/** Send the email OTP for account deletion. Any signed-in user. */
export async function sendAccountDeletionCodeAction(): Promise<
  { ok: true; sentTo: string } | { ok: false; error: string }
> {
  await requireSession();
  return sendReverificationCode();
}

/**
 * Delete the account. Emailed OTP plus a clear grace-period notice. `immediate`
 * runs a full hard purge now (CCPA erasure); otherwise the account enters a
 * 30-day grace window: every solely-owned household is soft-deleted immediately
 * and an account_deletions row schedules the purge for the daily job to
 * complete. During grace the user is frozen to the deletion-scheduled screen and
 * can still restore.
 */
export async function deleteAccountAction(input: {
  code: string;
  immediate?: boolean;
}): Promise<ActionResult> {
  const session = await requireSession();

  const verified = await verifyReverificationCode(input.code);
  if (!verified.ok) return verified;

  const service = createServiceClient();

  if (input.immediate) {
    const purged = await hardPurgeAccount(service, {
      userId: session.userId,
      actorEmail: session.email,
      legalBasis: "ccpa_immediate",
    });
    if (!purged.ok) return { ok: false, error: purged.error ?? "Purge failed." };
    return { ok: true };
  }

  const sole = await soleOwnedHouseholds(service, session.userId);
  const now = new Date();
  const nowIso = now.toISOString();
  const purgeAfter = new Date(
    now.getTime() + RETENTION_DAYS * 86_400_000,
  ).toISOString();

  for (const hh of sole) {
    const { error } = await service
      .from("households")
      .update({ deleted_at: nowIso, deleted_by: session.userId })
      .eq("id", hh.id)
      .is("deleted_at", null);
    if (error) return { ok: false, error: error.message };

    await recordAudit({
      householdId: hh.id,
      actorId: session.userId,
      action: "delete",
      entityType: "household",
      entityId: hh.id,
      diff: { after: { deleted_at: nowIso, mode: "soft", via: "account_deletion" } },
    });
  }

  const { error: adErr } = await service.from("account_deletions").upsert(
    {
      user_id: session.userId,
      requested_at: nowIso,
      purge_after: purgeAfter,
      mode: "scheduled",
      status: "pending",
      requested_email: session.email,
      sole_owned_households: sole as unknown as Json,
    },
    { onConflict: "user_id" },
  );
  if (adErr) return { ok: false, error: adErr.message };

  await writeDeletionLog(service, {
    scope: "account",
    subjectId: session.userId,
    householdId: null,
    actorUserId: session.userId,
    actorEmail: session.email,
    legalBasis: "user_request",
    action: "soft_delete",
    details: {
      mode: "scheduled",
      purge_after: purgeAfter,
      sole_owned_households: sole as unknown as Json,
    },
  });

  revalidatePath("/", "layout");
  return { ok: true };
}

/**
 * Cancel a scheduled account deletion during the grace window: flip the
 * account_deletions row to cancelled and restore every household it soft-deleted
 * on the user's behalf. Called from the deletion-scheduled screen.
 */
export async function restoreAccountAction(): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const service = createServiceClient();
  const { data: row } = await service
    .from("account_deletions")
    .select("user_id, status, sole_owned_households")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!row || row.status !== "pending") return { ok: true };

  const households =
    (row.sole_owned_households as unknown as Array<{ id: string }>) ?? [];
  for (const hh of households) {
    await service
      .from("households")
      .update({ deleted_at: null, deleted_by: null })
      .eq("id", hh.id);
  }

  await service
    .from("account_deletions")
    .update({ status: "cancelled" })
    .eq("user_id", user.id);

  await writeDeletionLog(service, {
    scope: "account",
    subjectId: user.id,
    householdId: null,
    actorUserId: user.id,
    actorEmail: user.email ?? null,
    legalBasis: "user_request",
    action: "restore",
    details: { restored_households: households.length },
  });

  revalidatePath("/", "layout");
  return { ok: true };
}
