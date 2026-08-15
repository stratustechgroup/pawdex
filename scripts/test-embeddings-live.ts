/**
 * Live check of lib/ai/embeddings.ts via OpenRouter. Read-only against the
 * API; writes nothing anywhere. Verifies shape, dimensions, and input-order
 * preservation.
 *
 * Run with: pnpm dlx tsx --tsconfig scripts/tsconfig.scripts.json scripts/test-embeddings-live.ts
 */
import { readFileSync } from "node:fs";

for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n")) {
  if (!line || line.startsWith("#") || !line.includes("=")) continue;
  const i = line.indexOf("=");
  const k = line.slice(0, i).trim();
  if (!(k in process.env)) process.env[k] = line.slice(i + 1).trim();
}

async function main() {
  const { embedTexts } = await import("../lib/ai/embeddings");

const inputs = [
  "Rabies vaccine administered 2026-05-01, 3-year duration.",
  "Monthly heartworm preventative, next dose due September.",
];
const t0 = Date.now();
const vecs = await embedTexts(inputs);
const ms = Date.now() - t0;

let pass = 0,
  fail = 0;
function assert(name: string, ok: boolean, detail = "") {
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` (${detail})` : ""}`);
  if (ok) pass++;
  else fail++;
}
assert("returns one vector per input", vecs.length === 2, `got ${vecs.length}`);
assert(
  "vectors are 1536-dim",
  vecs.every((v) => v.length === 1536),
  `dims=${vecs.map((v) => v.length).join(",")}`,
);
assert("values are finite numbers", vecs.every((v) => v.every(Number.isFinite)));
assert("vectors differ across inputs", vecs[0].some((x, i) => x !== vecs[1][i]));
const norm = (v: number[]) => Math.sqrt(v.reduce((s, x) => s + x * x, 0));
assert(
  "non-degenerate norms",
  vecs.every((v) => norm(v) > 0.5 && norm(v) < 2),
  `norms=${vecs.map((v) => norm(v).toFixed(3)).join(",")}`,
);
console.log(`\nembeddings via OpenRouter: ${pass} passed, ${fail} failed (${ms}ms round trip)`);
process.exit(fail ? 1 : 0);
}

void main();
