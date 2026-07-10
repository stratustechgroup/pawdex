import "server-only";

import { createServiceClient } from "@/lib/supabase/service";

// The waitlist_signups table (migration 0029) is not yet in the generated types
// (types.gen.ts is owned elsewhere and regenerates after the migration is
// pushed). Type the row shape locally and scope the untyped-table access to
// this one module so the rest of the app keeps its full typing.
export type WaitlistInsert = {
  email: string;
  source: string | null;
};

export type JoinWaitlistResult =
  | { status: "joined" }
  | { status: "already" }
  | { status: "rate_limited" }
  | { status: "error" };

const PG_UNIQUE_VIOLATION = "23505";

// Serverless-safe throttle without extra tables or shared state: cap how many
// signups the whole list accepts inside a short rolling window. A real visitor
// signs up once; only a script hammering the public form crosses this. Paired
// with the per-email unique index and the form honeypot, it keeps a flood from
// filling the table without punishing normal traffic. Per-email dedup means a
// single automated address cannot inflate the count by retrying.
const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_MAX_IN_WINDOW = 30;

async function recentSignupCount(
  supabase: ReturnType<typeof createServiceClient>,
): Promise<number | null> {
  const since = new Date(Date.now() - RATE_WINDOW_MS).toISOString();
  const { count, error } = await (supabase as unknown as {
    from: (table: string) => {
      select: (
        cols: string,
        opts: { count: "exact"; head: true },
      ) => {
        gte: (
          col: string,
          value: string,
        ) => Promise<{ count: number | null; error: { message: string } | null }>;
      };
    };
  })
    .from("waitlist_signups")
    .select("id", { count: "exact", head: true })
    .gte("created_at", since);

  if (error) {
    // Fail open on a count error: the throttle is a backstop, not the gate.
    console.error("recentSignupCount:", error.message);
    return null;
  }
  return count ?? 0;
}

/**
 * Insert a normalized email into the waitlist. Runs with the service role
 * because RLS on waitlist_signups has no policies (writes are trusted-backend
 * only). `email` must already be lowercased and validated by the caller.
 *
 * A duplicate is a success from the visitor's point of view — they are on the
 * list — so it resolves to "already" rather than an error.
 */
export async function joinWaitlist(
  input: WaitlistInsert,
): Promise<JoinWaitlistResult> {
  const supabase = createServiceClient();

  const recent = await recentSignupCount(supabase);
  if (recent !== null && recent >= RATE_MAX_IN_WINDOW) {
    return { status: "rate_limited" };
  }

  // Cast scoped to this call: the table exists in the DB but not in the
  // generated Database type until 0029 is pushed and types are regenerated.
  const { error } = await (supabase as unknown as {
    from: (table: string) => {
      insert: (values: WaitlistInsert) => Promise<{
        error: { code?: string; message: string } | null;
      }>;
    };
  })
    .from("waitlist_signups")
    .insert(input);

  if (!error) return { status: "joined" };
  if (error.code === PG_UNIQUE_VIOLATION) return { status: "already" };

  console.error("joinWaitlist:", error.message);
  return { status: "error" };
}
