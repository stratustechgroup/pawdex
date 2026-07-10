import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { bootstrapHousehold } from "@/lib/auth/bootstrap";
import { ONBOARDED_COOKIE } from "@/components/onboarding/constants";

// A brand-new organic signup lands on /onboarding; everyone else keeps their
// existing destination. We only ever override the DEFAULT target ("/"), so an
// invite (next=/invite/token) or transfer (next=/transfer/token) acceptor is
// never pulled into onboarding. "Brand new" = account created within the hour,
// no onboarded cookie, and a household with zero pets and zero documents.
async function shouldRouteToOnboarding(
  supabase: Awaited<ReturnType<typeof createClient>>,
  request: NextRequest,
  next: string,
  createdAt: string | undefined,
  householdId: string,
): Promise<boolean> {
  if (next !== "/") return false;
  if (request.cookies.get(ONBOARDED_COOKIE)?.value === "1") return false;

  const created = createdAt ? new Date(createdAt).getTime() : 0;
  if (!created || Date.now() - created > 60 * 60 * 1000) return false;

  const [{ count: pets }, { count: docs }] = await Promise.all([
    supabase.from("pets").select("id", { head: true, count: "exact" }).eq("household_id", householdId),
    supabase.from("documents").select("id", { head: true, count: "exact" }).eq("household_id", householdId),
  ]);
  return (pets ?? 0) === 0 && (docs ?? 0) === 0;
}

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
    let householdId: string | null = null;
    try {
      householdId = (
        await bootstrapHousehold({
          userId: user.id,
          displayName:
            (user.user_metadata?.full_name as string | undefined) ??
            (user.email ? user.email.split("@")[0] : null),
        })
      ).householdId;
    } catch (err) {
      console.error("bootstrap failed", err);
      // Don't block login on bootstrap error, onboarding page handles it.
      return NextResponse.redirect(new URL("/onboarding", url));
    }

    if (
      householdId &&
      (await shouldRouteToOnboarding(supabase, request, next, user.created_at, householdId))
    ) {
      return NextResponse.redirect(new URL("/onboarding", url));
    }
  }

  return NextResponse.redirect(new URL(next, url));
}
