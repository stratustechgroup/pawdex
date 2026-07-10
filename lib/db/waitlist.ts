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
  | { status: "error" };

const PG_UNIQUE_VIOLATION = "23505";

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
