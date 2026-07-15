import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

import type { Database } from "@/lib/supabase/types";

// Paths reachable without a session. "/" stays public because an anonymous
// visitor is rewritten to the marketing home below (not redirected to login);
// "/home" is the marketing route itself, plus where its waitlist Server Action
// POST lands after the "/" rewrite. The legal pages are part of the public
// marketing surface and must be crawlable and readable signed-out.
const PUBLIC_PATHS = [
  "/login",
  "/auth/callback",
  "/",
  "/home",
  "/pricing",
  "/about",
  "/contact",
  "/privacy",
  "/terms",
  "/accessibility",
  "/favicon.ico",
];

// Copy any session cookies Supabase refreshed onto `source` over to a
// redirect/rewrite response. getUser() can rotate the auth token; a bare
// NextResponse.redirect/rewrite would drop it and silently sign the user out.
function withSessionCookies(source: NextResponse, target: NextResponse) {
  source.cookies.getAll().forEach((cookie) => target.cookies.set(cookie));
  return target;
}

// Supabase stores its session in cookies named `sb-<ref>-auth-token` (chunked
// as `.0`, `.1` when large). If none of them are present the visitor cannot
// have a session, so getUser() would return null after doing nothing useful.
// Match the `!user` outcome directly and skip building the client entirely.
function hasAuthCookie(request: NextRequest): boolean {
  return request.cookies.getAll().some((c) => c.name.startsWith("sb-"));
}

function isPublicPath(path: string): boolean {
  return (
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
    // Generated metadata images (Next hashes the OG route name, so match the
    // prefix). Social scrapers and browsers fetch these without any cookie.
    path.startsWith("/opengraph-image") ||
    path.startsWith("/apple-icon") ||
    path.startsWith("/icon") ||
    path.includes(".")
  );
}

export async function updateSession(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // Fast path for anonymous traffic (the entire marketing surface). No auth
  // cookie means no session, so we can reproduce the signed-out routing below
  // without constructing a Supabase client or calling the auth API at all.
  // Nothing here can refresh a session, so there are no cookies to carry over.
  if (!hasAuthCookie(request)) {
    if (path === "/") {
      const url = request.nextUrl.clone();
      url.pathname = "/home";
      return NextResponse.rewrite(url);
    }
    if (!isPublicPath(path)) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("redirect", path);
      return NextResponse.redirect(url);
    }
    return NextResponse.next({ request });
  }

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

  // Refresh session if expired (required for Server Components). Runs for every
  // matched path, including the marketing rewrite below.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Anonymous visitor to "/" sees the marketing home. Rewrite (not redirect) so
  // the URL stays "/" while Next serves app/(marketing)/home.
  if (!user && path === "/") {
    const url = request.nextUrl.clone();
    url.pathname = "/home";
    return withSessionCookies(response, NextResponse.rewrite(url));
  }

  // Signed-in visitor never needs the marketing page, so send them to the app.
  if (user && path === "/home") {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return withSessionCookies(response, NextResponse.redirect(url));
  }

  if (!user && !isPublicPath(path)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirect", path);
    return withSessionCookies(response, NextResponse.redirect(url));
  }

  return response;
}
