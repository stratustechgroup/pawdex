import "server-only";

import { createClient } from "@/lib/supabase/server";

// Reusable email re-verification for high-stakes actions (household + account
// deletion). It proves the person driving the request still controls the
// account's email, without introducing a password (many users are magic-link
// only).
//
// It uses auth.reauthenticate(), the purpose-built primitive for confirming a
// signed-in user's identity: it sends a nonce via Supabase's dedicated
// Reauthentication email template (which ships a numeric code by default, unlike
// this project's magic-link login template) and, unlike signInWithOtp/verifyOtp
// on the login templates, does NOT mint a fresh session. The email is implicit
// (the logged-in user's own), so a code can never be routed to another address.
// The nonce is checked with verifyOtp(type:"reauthentication").
//
// NOTE: unverified end to end here (no local Supabase / email delivery in this
// environment). If a project ever disables the Reauthentication template, this
// returns a clean error rather than failing open.

type Result = { ok: true } | { ok: false; error: string };

/**
 * Send a reauthentication code to the logged-in user's email. Returns the
 * masked address so the UI can say where the code went.
 */
export async function sendReverificationCode(): Promise<
  { ok: true; sentTo: string } | { ok: false; error: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) {
    return { ok: false, error: "No email on file for this account." };
  }

  const { error } = await supabase.auth.reauthenticate();
  if (error) return { ok: false, error: error.message };

  return { ok: true, sentTo: maskEmail(user.email) };
}

/**
 * Verify a reauthentication code the user typed against the session email. A
 * wrong or expired code returns a friendly error.
 */
export async function verifyReverificationCode(code: string): Promise<Result> {
  const trimmed = code.trim();
  if (!/^\d{6}$/.test(trimmed)) {
    return { ok: false, error: "Enter the 6-digit code from your email." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) {
    return { ok: false, error: "No email on file for this account." };
  }

  const { error } = await supabase.auth.verifyOtp({
    email: user.email,
    token: trimmed,
    type: "reauthentication",
  });
  if (error) {
    return { ok: false, error: "That code didn't match. Request a new one and try again." };
  }
  return { ok: true };
}

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return email;
  const head = local.slice(0, 2);
  return `${head}${"*".repeat(Math.max(1, local.length - 2))}@${domain}`;
}
