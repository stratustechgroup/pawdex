import { NextResponse, type NextRequest } from "next/server";

import { isRateLimited } from "@/lib/security/rate-limit";
import { updateSession } from "@/lib/supabase/middleware";

// Token-guessing surfaces get a per-IP cap (SECURITY.md items 1-2). Limits
// are far above legitimate use: a real user opens a handful of tokenized
// links per minute, not thirty.
const TOKEN_SURFACE = /^\/(share|transfer|invite|api\/unsubscribe)\//;
const TOKEN_SURFACE_LIMIT = 30;

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (TOKEN_SURFACE.test(pathname)) {
    const ip =
      request.headers.get("x-real-ip") ??
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      "unknown";
    if (isRateLimited(`token-surface:${ip}`, TOKEN_SURFACE_LIMIT)) {
      return new NextResponse("Too many requests", {
        status: 429,
        headers: { "Retry-After": "60" },
      });
    }
  }

  return updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - Next internals (_next/static, _next/image)
     * - favicon
     * - public assets (anything with an extension after the last /)
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)",
  ],
};
