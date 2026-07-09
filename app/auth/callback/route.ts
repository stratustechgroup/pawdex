import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { bootstrapHousehold } from "@/lib/auth/bootstrap";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");
  const next = url.searchParams.get("next") ?? "/";

  const supabase = await createClient();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(error.message)}`, url));
    }
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: type as "magiclink" | "email" | "signup" | "recovery" | "invite",
    });
    if (error) {
      return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(error.message)}`, url));
    }
  } else {
    return NextResponse.redirect(new URL("/login?error=missing_code", url));
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    try {
      await bootstrapHousehold({
        userId: user.id,
        displayName:
          (user.user_metadata?.full_name as string | undefined) ??
          (user.email ? user.email.split("@")[0] : null),
      });
    } catch (err) {
      console.error("bootstrap failed", err);
      // Don't block login on bootstrap error — onboarding page handles it.
      return NextResponse.redirect(new URL("/onboarding", url));
    }
  }

  return NextResponse.redirect(new URL(next, url));
}
