/**
 * Waitlist export — prints the pre-launch waitlist as CSV to stdout. Read-only.
 *
 * Usage:
 *   pnpm dlx tsx scripts/waitlist-export.ts > waitlist.csv
 *
 * Columns: email, source, created_at. Ordered oldest first. Progress/log lines
 * go to stderr so the CSV on stdout stays clean and pipeable.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

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
    // env may already be provided by the caller
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

// Minimal RFC-4180 quoting: wrap in quotes and double any embedded quotes.
function csvCell(value: unknown): string {
  const s = value == null ? "" : String(value);
  return `"${s.replace(/"/g, '""')}"`;
}

async function main() {
  const { data, error } = await sb
    .from("waitlist_signups")
    .select("email, source, created_at")
    .order("created_at", { ascending: true });

  if (error) {
    console.error("waitlist-export:", error.message);
    process.exit(1);
  }

  const rows = data ?? [];
  process.stdout.write("email,source,created_at\n");
  for (const r of rows as Array<Record<string, unknown>>) {
    process.stdout.write(
      [csvCell(r.email), csvCell(r.source), csvCell(r.created_at)].join(",") + "\n",
    );
  }
  console.error(`Exported ${rows.length} waitlist rows.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
