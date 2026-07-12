/**
 * Shared helpers for the one-off production data reprocessing scripts
 * (scripts/reprocess-phase{1,2,3}-*.ts).
 *
 * These run against the LIVE Supabase project with the service-role key and
 * operate on the founder's real household. Every script is dry-run by default;
 * pass --execute to actually mutate. See docs/reprocessing-report.md.
 *
 * Env: NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (load with
 *   `pnpm dlx tsx --env-file=.env.local ...`).
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/** The founder's (and only) household - realalecfarmer's Household. */
export const HOUSEHOLD_ID = "fa497bc6-4513-4104-95ed-896502a399e0";

/** Absolute scratchpad dir for this session - backups are mirrored here. */
export const SCRATCHPAD =
  "/private/tmp/claude-501/-Users-jamesfarmer-projectsv4-puppy/25960530-1760-4c4f-adc6-df7534a1c433/scratchpad";

/** Report date, used in the committed backup filename. */
export const REPROC_DATE = new Date().toISOString().slice(0, 10);

/** True when the operator passed --execute; otherwise everything is a dry run. */
export function isExecute(): boolean {
  return process.argv.includes("--execute");
}

export function makeDb(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (use --env-file=.env.local).",
    );
  }
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/** The founder's user id, used as audit actor_id. Falls back to null. */
export async function getActorId(db: SupabaseClient): Promise<string | null> {
  const { data } = await db
    .from("households")
    .select("created_by")
    .eq("id", HOUSEHOLD_ID)
    .maybeSingle();
  return (data?.created_by as string | null) ?? null;
}

type AuditAction =
  | "create"
  | "update"
  | "delete"
  | "archive"
  | "commit_extraction"
  | "discard_extraction";

/**
 * Error-CHECKED audit insert. Unlike lib/db/audit.recordAudit (which swallows
 * failures - right for a user request, wrong for a data-migration invariant),
 * this throws if the row does not land, so "an audit entry per mutation" cannot
 * be silently violated by e.g. a bad enum value.
 */
export async function auditInsert(
  db: SupabaseClient,
  input: {
    actorId: string | null;
    action: AuditAction;
    entityType: string;
    entityId: string | null;
    diff: unknown;
  },
): Promise<void> {
  const { error } = await db.from("audit_log").insert({
    household_id: HOUSEHOLD_ID,
    actor_id: input.actorId,
    action: input.action,
    entity_type: input.entityType,
    entity_id: input.entityId,
    diff: input.diff as never,
  });
  if (error) {
    throw new Error(
      `audit insert failed (${input.action} ${input.entityType} ${input.entityId}): ${error.message}`,
    );
  }
}

/**
 * Write a JSON backup to BOTH the scratchpad and docs/reprocessing-backup-
 * <date>.json (the lead commits the docs/ copy later). Returns the docs path.
 */
export function writeBackup(basename: string, payload: unknown): string {
  const json = JSON.stringify(payload, null, 2);
  const docsPath = join(
    process.cwd(),
    "docs",
    `reprocessing-backup-${REPROC_DATE}.json`,
  );
  const scratchPath = join(SCRATCHPAD, basename);
  for (const p of [docsPath, scratchPath]) {
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, json);
  }
  return docsPath;
}

export function banner(title: string): void {
  const mode = isExecute() ? "EXECUTE" : "DRY-RUN";
  console.log(`\n${"=".repeat(64)}\n${title}  [${mode}]\n${"=".repeat(64)}`);
}
