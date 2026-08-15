import { NextResponse } from "next/server";

import { createServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";
export const maxDuration = 10;

// Public health check for an external uptime monitor. Unauthenticated by
// design: a monitor cannot hold a secret, and this is the one endpoint whose
// whole job is to be reachable. That constrains what it may reveal.
//
// It answers exactly one question — "can this deployment serve a request that
// reaches the database?" — because a 200 from a static page would stay green
// while Supabase was unreachable and every real page was failing.
//
// Deliberately NOT exposed: version/commit strings, env var names or values,
// row counts, table names, driver error text, or timing detail beyond a coarse
// latency number. An unauthenticated endpoint is reconnaissance surface, so a
// failure reports *that* it failed, never *why*. The why goes to the logs (and
// to error tracking once a DSN is configured).

const DB_TIMEOUT_MS = 5000;

type Health = {
  status: "ok" | "degraded";
  checks: { database: "ok" | "fail" };
  latency_ms: number;
};

export async function GET() {
  const started = Date.now();
  let database: "ok" | "fail" = "fail";

  try {
    const supabase = createServiceClient();
    // Cheapest possible round trip that proves the connection and PostgREST are
    // both alive: a head-only count against a tiny table, no rows returned.
    const probe = supabase
      .from("households")
      .select("id", { head: true, count: "exact" })
      .limit(1);

    const { error } = (await Promise.race([
      probe,
      new Promise<{ error: Error }>((_, reject) =>
        setTimeout(() => reject(new Error("db probe timed out")), DB_TIMEOUT_MS),
      ),
    ])) as { error: unknown };

    if (!error) database = "ok";
    else console.error("[health] database probe failed", error);
  } catch (err) {
    // Includes the timeout above. Logged server-side, never returned.
    console.error("[health] database probe threw", err);
  }

  const body: Health = {
    status: database === "ok" ? "ok" : "degraded",
    checks: { database },
    latency_ms: Date.now() - started,
  };

  // 503 on degraded so a monitor alerts on status code alone, without needing
  // to parse the body.
  return NextResponse.json(body, {
    status: database === "ok" ? 200 : 503,
    headers: { "cache-control": "no-store, max-age=0" },
  });
}
