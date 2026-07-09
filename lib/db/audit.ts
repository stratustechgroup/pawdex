import "server-only";

import { createServiceClient } from "@/lib/supabase/service";
import type { AuditAction, Json } from "@/lib/supabase/types";

// Call from any Server Action that mutates user data. Failures are logged but
// never thrown — audit history is observability, not the user's blocker.

export async function recordAudit(input: {
  householdId: string;
  actorId: string | null;
  action: AuditAction;
  entityType: string;
  entityId?: string | null;
  diff?: Json;
}): Promise<void> {
  try {
    const supabase = createServiceClient();
    await supabase.from("audit_log").insert({
      household_id: input.householdId,
      actor_id: input.actorId ?? null,
      action: input.action,
      entity_type: input.entityType,
      entity_id: input.entityId ?? null,
      diff: input.diff ?? {},
    });
  } catch (err) {
    console.error("recordAudit failed:", err);
  }
}

/**
 * Convenience for change-tracking: pass before+after objects and we'll
 * stash both into the diff column. Caller is responsible for stripping
 * any sensitive fields before passing.
 */
export function diffOf<T extends Record<string, unknown>>(
  before: T | null | undefined,
  after: T | null | undefined,
): Json {
  return {
    before: (before ?? null) as Json,
    after: (after ?? null) as Json,
  };
}
