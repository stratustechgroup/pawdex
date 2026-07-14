"use server";

import { headers } from "next/headers";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  email: z.string().email(),
  // Internal paths only. startsWith("/") alone admits "//evil.com" (and the
  // "/\\" backslash variant), which resolves to an external origin downstream.
  redirectTo: z
    .string()
    .startsWith("/")
    .refine((v) => !v.startsWith("//") && !v.startsWith("/\\"), {
      message: "redirectTo must be an internal path.",
    }),
});

export async function sendMagicLink(
  input: z.input<typeof schema>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Invalid email." };
  }

  const supabase = await createClient();
  const h = await headers();
  const origin =
    process.env.NEXT_PUBLIC_APP_URL ??
    `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host") ?? "localhost:3000"}`;

  const emailRedirectTo = `${origin}/auth/callback?next=${encodeURIComponent(parsed.data.redirectTo)}`;

  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data.email,
    options: {
      emailRedirectTo,
      shouldCreateUser: true,
    },
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true };
}

const resetSchema = z.object({
  email: z.string().email(),
});

export async function sendPasswordReset(
  input: z.input<typeof resetSchema>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = resetSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Invalid email." };
  }

  const supabase = await createClient();
  const h = await headers();
  const origin =
    process.env.NEXT_PUBLIC_APP_URL ??
    `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host") ?? "localhost:3000"}`;

  // Land the recovery link signed in on the account page so the user can set a
  // new password immediately.
  const redirectTo = `${origin}/auth/callback?next=${encodeURIComponent("/settings/account")}`;

  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo,
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true };
}
