import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

import type { Database } from "@/lib/supabase/types";

// Paths reachable without a session. "/" stays public because an anonymous
// visitor is rewritten to the marketing home below (not redirected to login);
// "/home" is the marketing route itself, plus where its waitlist Server Action
// POST lands after the "/" rewrite.
const PUBLIC_PATHS = ["/login", "/auth/callback", "/", "/home", "/favicon.ico"];

// Copy any session cookies Supabase refreshed onto `source` over to a
// redirect/rewrite response. getUser() can rotate the auth token; a bare
// NextResponse.redirect/rewrite would drop it and silently sign the user out.
function withSessionCookies(source: NextResponse, target: NextResponse) {
  source.cookies.getAll().forEach((cookie) => target.cookies.set(cookie));
  return target;
}

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    },
  );

  // Refresh session if expired — required for Server Components. Runs for every
  // matched path, including the marketing rewrite below.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;

  // Anonymous visitor to "/" sees the marketing home. Rewrite (not redirect) so
  // the URL stays "/" while Next serves app/(marketing)/home.
  if (!user && path === "/") {
    const url = request.nextUrl.clone();
    url.pathname = "/home";
    return withSessionCookies(response, NextResponse.rewrite(url));
  }

  // Signed-in visitor never needs the marketing page — send them to the app.
  if (user && path === "/home") {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return withSessionCookies(response, NextResponse.redirect(url));
  }

  const isPublic =
    PUBLIC_PATHS.some((p) => path === p || path.startsWith(`${p}/`)) ||
    path.startsWith("/api/webhooks/") ||
    // Unauthenticated-by-design surfaces. Each handler does its own token auth
    // (Bearer CRON_SECRET, HMAC unsubscribe token, share token), so the session
    // gate here must let them through instead of bouncing them to /login.
    path.startsWith("/api/cron/") ||
    path.startsWith("/api/unsubscribe/") ||
    path.startsWith("/share/") ||
    // Token-gated pages that render a preview and inline sign-in for anonymous
    // visitors (adoption transfers, household invites). The pages validate
    // their tokens server-side and handle the signed-out state themselves.
    path.startsWith("/invite/") ||
    path.startsWith("/transfer/") ||
    path.startsWith("/_next/") ||
    path.includes(".");

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirect", path);
    return withSessionCookies(response, NextResponse.redirect(url));
  }

  return response;
}
