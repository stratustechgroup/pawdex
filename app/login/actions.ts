"use server";

import { headers } from "next/headers";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  email: z.string().email(),
  redirectTo: z.string().startsWith("/"),
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
