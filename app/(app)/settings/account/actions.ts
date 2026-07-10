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
