/**
 * Behavioral test for the waitlist global-rate-limit backstop (lib/db/waitlist.ts).
 *
 * The throttle is global (recent signups across the whole table), so this test
 * writes ZZTEST rows, exercises the boundary, and ALWAYS cleans them up in a
 * finally block. The exposure window is a few seconds against a pre-launch
 * waitlist with effectively no live traffic; rows are clearly marked and removed.
 *
 * Usage: pnpm dlx tsx --tsconfig scripts/tsconfig.scripts.json scripts/test-waitlist-ratelimit.ts
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

// Load .env.local before importing anything that reads env.
for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n")) {
  if (!line || line.startsWith("#") || !line.includes("=")) continue;
  const i = line.indexOf("=");
  const k = line.slice(0, i).trim();
  if (!process.env[k]) process.env[k] = line.slice(i + 1).trim();
}

const MARK = "zztest-ratelimit";
const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

let passed = 0;
let failed = 0;
function assert(cond: boolean, msg: string) {
  if (cond) {
    passed++;
    console.log(`  PASS  ${msg}`);
  } else {
    failed++;
    console.log(`  FAIL  ${msg}`);
  }
}

async function cleanup() {
  await sb.from("waitlist_signups").delete().eq("source", MARK);
}

async function main() {
  // Import the production path after env is loaded.
  const { joinWaitlist } = await import("../lib/db/waitlist");

  await cleanup(); // start from a clean slate

  console.log("(1) below the threshold, a signup still joins");
  const first = await joinWaitlist({ email: `${MARK}-below@example.com`, source: MARK });
  assert(first.status === "joined", `first signup joins (got ${first.status})`);

  console.log("(2) fill the 10-minute window past the cap, then the next call is throttled");
  const rows = Array.from({ length: 30 }, (_, i) => ({
    email: `${MARK}-${i}-${Date.now()}@example.com`,
    source: MARK,
  }));
  const { error: insErr } = await sb.from("waitlist_signups").insert(rows);
  assert(!insErr, `seeded 30 recent signups (${insErr?.message ?? "ok"})`);

  const throttled = await joinWaitlist({ email: `${MARK}-over@example.com`, source: MARK });
  assert(
    throttled.status === "rate_limited",
    `31st signup is rate_limited (got ${throttled.status})`,
  );

  console.log("(3) after the window clears, signups resume");
  await cleanup();
  const resumed = await joinWaitlist({ email: `${MARK}-resumed@example.com`, source: MARK });
  assert(resumed.status === "joined", `signup resumes once the window is clear (got ${resumed.status})`);
}

main()
  .catch((err) => {
    console.error(err);
    failed++;
  })
  .finally(async () => {
    await cleanup();
    console.log(`\nRESULT: ${failed === 0 ? "PASS" : "FAIL"} (${passed} passed, ${failed} failed)`);
    process.exit(failed === 0 ? 0 : 1);
  });
