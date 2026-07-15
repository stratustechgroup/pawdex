import "server-only";

import { createServiceClient } from "@/lib/supabase/service";

// The contact_messages table (migration 0036) is not yet in the generated types
// (types.gen.ts is owned elsewhere and regenerates after the migration is
// pushed). Type the row shape locally and scope the untyped-table access to
// this one module so the rest of the app keeps its full typing.
export type ContactMessageInsert = {
  name: string | null;
  email: string;
  subject: string | null;
  message: string;
  source: string | null;
};

export type InsertContactResult = { ok: true } | { ok: false; error: string };

/**
 * Insert one contact-form message. Runs with the service role because RLS on
 * contact_messages has no policies (writes are trusted-backend only). The
 * caller is responsible for validating and normalizing the fields.
 */
export async function insertContactMessage(
  input: ContactMessageInsert,
): Promise<InsertContactResult> {
  const supabase = createServiceClient();

  // Cast scoped to this call: the table exists in the DB but not in the
  // generated Database type until 0036 is pushed and types are regenerated.
  const { error } = await (supabase as unknown as {
    from: (table: string) => {
      insert: (values: ContactMessageInsert) => Promise<{
        error: { message: string } | null;
      }>;
    };
  })
    .from("contact_messages")
    .insert(input);

  if (error) {
    console.error("insertContactMessage:", error.message);
    return { ok: false, error: error.message };
  }
  return { ok: true };
}
