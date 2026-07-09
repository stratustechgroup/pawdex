/**
 * One-off backfill: hash every document missing a content_hash and write it.
 *
 * Usage:
 *   pnpm dlx tsx scripts/backfill-content-hash.ts
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY + NEXT_PUBLIC_SUPABASE_URL in env. Safe
 * to re-run — only touches rows where content_hash IS NULL.
 */

import { createHash } from "node:crypto";

import { createClient } from "@supabase/supabase-js";

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      "Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before running.",
    );
  }
  const supabase = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: docs, error } = await supabase
    .from("documents")
    .select("id, household_id, storage_bucket, storage_path")
    .is("content_hash", null);
  if (error) throw new Error(`fetch: ${error.message}`);

  console.log(`Backfilling ${docs?.length ?? 0} documents…`);

  let ok = 0;
  let skipped = 0;
  for (const doc of docs ?? []) {
    const { data: blob, error: dlErr } = await supabase.storage
      .from(doc.storage_bucket)
      .download(doc.storage_path);
    if (dlErr || !blob) {
      console.warn(`skip ${doc.id} — download failed: ${dlErr?.message}`);
      skipped++;
      continue;
    }
    const buf = Buffer.from(await blob.arrayBuffer());
    const hash = createHash("sha256").update(buf).digest("hex");

    const { error: updErr } = await supabase
      .from("documents")
      .update({ content_hash: hash })
      .eq("id", doc.id);

    if (updErr) {
      console.warn(`skip ${doc.id} — update failed: ${updErr.message}`);
      skipped++;
      continue;
    }
    ok++;
  }

  console.log(`Done. hashed=${ok} skipped=${skipped}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
