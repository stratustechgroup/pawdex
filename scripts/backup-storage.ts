/**
 * Storage backup — downloads every object in the `documents` bucket to a local
 * timestamped directory. Read-only against prod: it only lists and downloads,
 * never writes or deletes in Supabase.
 *
 * Usage:
 *   pnpm dlx tsx scripts/backup-storage.ts [outDir]
 *
 * Default outDir is ./backups. Each run creates ./backups/documents-<ISO>/ and
 * mirrors the bucket's folder structure underneath, so runs never clobber one
 * another and the layout matches the storage_path stored on each document row.
 *
 * Recommended schedule: nightly. A cron/launchd entry or a GitHub Actions
 * scheduled workflow with SUPABASE_SERVICE_ROLE_KEY in secrets both work; keep
 * the output off any public host (the files are pet medical records).
 */
import { createClient } from "@supabase/supabase-js";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";

const BUCKET = "documents";
const LIST_PAGE = 100;

// Load .env.local manually (this script runs outside Next).
function loadEnv() {
  try {
    const text = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
    for (const line of text.split("\n")) {
      if (!line || line.startsWith("#") || !line.includes("=")) continue;
      const i = line.indexOf("=");
      const k = line.slice(0, i).trim();
      const v = line.slice(i + 1).trim();
      if (!process.env[k]) process.env[k] = v;
    }
  } catch {
    // env may already be provided by the caller (e.g. CI secrets)
  }
}

loadEnv();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(2);
}

const sb = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Recursively collect every object path under `prefix`. Supabase returns
// folders as entries with a null id; anything with an id is a real object.
async function listAll(prefix: string): Promise<string[]> {
  const found: string[] = [];
  let offset = 0;
  for (;;) {
    const { data, error } = await sb.storage
      .from(BUCKET)
      .list(prefix, { limit: LIST_PAGE, offset, sortBy: { column: "name", order: "asc" } });
    if (error) throw new Error(`list ${prefix || "/"}: ${error.message}`);
    if (!data || data.length === 0) break;
    for (const entry of data) {
      const full = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.id === null) {
        found.push(...(await listAll(full)));
      } else {
        found.push(full);
      }
    }
    if (data.length < LIST_PAGE) break;
    offset += data.length;
  }
  return found;
}

async function main() {
  const baseOut = process.argv[2] ?? "backups";
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outDir = join(baseOut, `documents-${stamp}`);
  mkdirSync(outDir, { recursive: true });

  console.error(`Enumerating '${BUCKET}' bucket...`);
  const paths = await listAll("");
  console.error(`Found ${paths.length} objects. Downloading to ${outDir}/`);

  let ok = 0;
  let failed = 0;
  let totalBytes = 0;
  for (const path of paths) {
    const { data, error } = await sb.storage.from(BUCKET).download(path);
    if (error || !data) {
      failed++;
      console.error(`  FAIL ${path}: ${error?.message ?? "no data"}`);
      continue;
    }
    const bytes = Buffer.from(await data.arrayBuffer());
    const dest = join(outDir, path);
    mkdirSync(dirname(dest), { recursive: true });
    writeFileSync(dest, bytes);
    ok++;
    totalBytes += bytes.length;
    // Never print file contents — only the path and size.
    console.error(`  ok   ${path} (${bytes.length} bytes)`);
  }

  console.error(
    `\nDone. ${ok} downloaded, ${failed} failed, ${totalBytes} total bytes -> ${outDir}/`,
  );
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
