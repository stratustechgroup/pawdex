"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireSession } from "@/lib/auth/household";
import { updateDisplayName } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";

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
  // Stamp user_metadata.password_set alongside the password so the account UI
  // can tell "has a password" from "magic-link only". auth.users.encrypted_password
  // is NOT a usable signal here: this GoTrue version stores a non-empty hash even
  // for public magic-link signups (verified against a real signInWithOtp user and
  // the founder's own account), so current_user_has_password() reads true for
  // everyone. This flag is the reliable signal, and every set-a-password path
  // (this form, plus the recovery flow which sets its new password through this
  // same action) writes it.
  const { error } = await supabase.auth.updateUser({
    password: parsed.data,
    data: { password_set: true },
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
