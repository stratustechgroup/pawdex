/**
 * Unit tests for the EU travel compliance engine (lib/compliance/eu-passport).
 *
 * The engine had zero test coverage while carrying the product's flagship
 * claims, and its worst defect (titer demanded from US-origin pets the EU
 * exempts) survived precisely because nothing asserted rule behavior. Every
 * rule corrected in the Phase 1 pass gets a test here, including the ones
 * that were previously advisory-only text.
 *
 * Pure function, no DB, no network.
 * Run: pnpm dlx tsx scripts/test-eu-passport.ts
 */
import {
  computeEuComplianceReport,
  EU_DESTINATIONS,
  type ComplianceInputs,
} from "../lib/compliance/eu-passport";

let pass = 0;
let fail = 0;
function assert(name: string, ok: boolean, detail = "") {
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` (${detail})` : ""}`);
  if (ok) pass++;
  else fail++;
}

const FR = EU_DESTINATIONS.find((d) => d.code === "FR")!;
const FI = EU_DESTINATIONS.find((d) => d.code === "FI")!;

const iso = (daysFromNow: number) => {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return d.toISOString().slice(0, 10);
};

function base(overrides: Partial<ComplianceInputs> = {}): ComplianceInputs {
  return {
    pet: {
      name: "Testpet",
      species: "dog",
      date_of_birth: iso(-800),
      microchip_number: "985112345678903",
      microchip_registry: "AKC Reunite",
      microchip_implanted_on: iso(-700),
      ...(overrides.pet ?? {}),
    },
    vaccinations: overrides.vaccinations ?? [
      {
        vaccine_type: "Rabies 3yr",
        vaccine_family: "rabies",
        administered_on: iso(-400),
        expires_on: iso(700),
        is_rabies: true,
      },
    ],
    medications: overrides.medications ?? [],
    events: overrides.events ?? [],
    destination: overrides.destination ?? FR,
    travel_date: "travel_date" in overrides ? (overrides.travel_date ?? null) : iso(45),
    origin: overrides.origin,
  };
}

const row = (r: ReturnType<typeof computeEuComplianceReport>, id: string) =>
  r.requirements.find((x) => x.id === id);

console.log("(1) titer is NOT required for US origin — the Annex II exemption");
{
  const r = computeEuComplianceReport(base());
  const titer = row(r, "titer")!;
  assert("titer row present but 'na'", titer.status === "na", titer.status);
  assert("detail cites the listed-country exemption", /listed|Annex II/i.test(titer.detail));
  assert("no titer blocker anywhere", !r.requirements.some((x) => x.id === "titer" && x.status === "blocker"));
}

console.log("\n(2) titer still applies to unlisted origins");
{
  const r = computeEuComplianceReport(base({ origin: "unlisted" }));
  const titer = row(r, "titer")!;
  assert("no titer on file → blocker for unlisted origin", titer.status === "blocker", titer.status);
}

console.log("\n(3) titer event selection is deterministic (latest wins)");
{
  const r = computeEuComplianceReport(
    base({
      origin: "unlisted",
      events: [
        { event_type: "lab", occurred_on: iso(-200), title: "FAVN titer old", summary: null, diagnosis: null },
        { event_type: "lab", occurred_on: iso(-100), title: "FAVN titer new", summary: null, diagnosis: null },
      ],
    }),
  );
  const titer = row(r, "titer")!;
  assert("uses the newest titer event", titer.detail.includes(iso(-100)), titer.detail.slice(0, 80));
}

console.log("\n(4) 21-day wait is computed, not advisory");
{
  const r = computeEuComplianceReport(
    base({
      vaccinations: [{ vaccine_type: "Rabies 1yr", vaccine_family: "rabies", administered_on: iso(-5), expires_on: iso(360), is_rabies: true }],
      travel_date: iso(2),
    }),
  );
  const wait = row(r, "rabies-wait")!;
  assert("vaccine 5 days ago + travel in 2 → blocker", wait.status === "blocker", wait.status);
  assert("overall blocked", r.overall_status === "blocked");

  const r2 = computeEuComplianceReport(
    base({
      vaccinations: [{ vaccine_type: "Rabies 1yr", vaccine_family: "rabies", administered_on: iso(-5), expires_on: iso(360), is_rabies: true }],
      travel_date: null,
    }),
  );
  assert("no travel date → warning, not blocker", row(r2, "rabies-wait")!.status === "warning", row(r2, "rabies-wait")!.status);

  const r3 = computeEuComplianceReport(base());
  assert("vaccine 400 days ago → wait ok", row(r3, "rabies-wait")!.status === "ok");
}

console.log("\n(5) an unbroken booster chain does not restart the wait");
{
  const r = computeEuComplianceReport(
    base({
      vaccinations: [
        { vaccine_type: "Rabies 1yr", vaccine_family: "rabies", administered_on: iso(-370), expires_on: iso(-4), is_rabies: true },
        // booster given 5 days ago, BEFORE the prior expired (prior expires in -4 → administered -5 is before)
        { vaccine_type: "Rabies 3yr", vaccine_family: "rabies", administered_on: iso(-5), expires_on: iso(1090), is_rabies: true },
      ],
      travel_date: iso(2),
    }),
  );
  const wait = row(r, "rabies-wait")!;
  assert("booster within validity → no 21-day restart", wait.status === "ok", wait.status);
  assert("detail explains the chain", /booster|still valid/i.test(wait.detail));
}

console.log("\n(6) chip-before-rabies is a real check now");
{
  const ok = computeEuComplianceReport(base());
  assert("implant before vaccine → ok", row(ok, "chip-before-rabies")!.status === "ok");

  const bad = computeEuComplianceReport(
    base({ pet: { microchip_implanted_on: iso(-300) } as never }),
  );
  // implant -300, vaccine -400 → vaccine predates chip
  assert("vaccine before implant → blocker", row(bad, "chip-before-rabies")!.status === "blocker", row(bad, "chip-before-rabies")!.status);

  const unknown = computeEuComplianceReport(
    base({ pet: { microchip_implanted_on: null } as never }),
  );
  const r = row(unknown, "chip-before-rabies")!;
  assert("missing implant date → todo asking for the date", r.status === "todo");
  assert("todo points at the edit page, not the vet-only copy", /edit page/i.test(r.action_required ?? ""));
}

console.log("\n(7) a vaccine expiring on the travel day is not current");
{
  const r = computeEuComplianceReport(
    base({
      vaccinations: [{ vaccine_type: "Rabies 1yr", vaccine_family: "rabies", administered_on: iso(-360), expires_on: iso(45), is_rabies: true }],
      travel_date: iso(45),
    }),
  );
  assert("expires_on == travel date → blocker", row(r, "rabies")!.status === "blocker", row(r, "rabies")!.status);
}

console.log("\n(8) species gating");
{
  const cat = computeEuComplianceReport(base({ pet: { species: "cat" } as never, destination: FI }));
  assert("cat to Finland: tapeworm 'na' (dogs only)", row(cat, "tapeworm")!.status === "na", row(cat, "tapeworm")!.status);
  assert("cat still gets rabies rules", !!row(cat, "rabies"));

  const rabbit = computeEuComplianceReport(base({ pet: { species: "rabbit" } as never }));
  assert("rabbit: single not-covered row", rabbit.requirements.length === 1 && rabbit.requirements[0].id === "species");
  assert("rabbit: overall partial, no fabricated dog rules", rabbit.overall_status === "partial");
}

console.log("\n(9) 'ready' is reachable — the certificate row no longer poisons it");
{
  const r = computeEuComplianceReport(base());
  const ehc = row(r, "ehc")!;
  assert("fully compliant dog → overall ready", r.overall_status === "ready", r.overall_status);
  assert("ehc row still present as the calendar action", ehc.status === "todo");
  assert("ehc names VEHCS, not Form 7001", /VEHCS/.test(ehc.label + ehc.detail) && !/7001.*equivalent/i.test(ehc.detail));
}

console.log("\n(10) primary-vaccination 1-year caveat");
{
  const single = computeEuComplianceReport(base());
  assert("single rabies record → 1-year caveat shown", /1 year/i.test(row(single, "rabies")!.detail));
  const chained = computeEuComplianceReport(
    base({
      vaccinations: [
        { vaccine_type: "Rabies 1yr", vaccine_family: "rabies", administered_on: iso(-500), expires_on: iso(-140), is_rabies: true },
        { vaccine_type: "Rabies 3yr", vaccine_family: "rabies", administered_on: iso(-150), expires_on: iso(945), is_rabies: true },
      ],
    }),
  );
  assert("multiple records → no caveat", !/1 year/i.test(row(chained, "rabies")!.detail));
}

console.log("\n(11) tapeworm window math for dogs");
{
  const inWindow = computeEuComplianceReport(
    base({
      destination: FI,
      travel_date: iso(2),
      medications: [{ name: "Droncit", generic_name: "praziquantel", indication: "tapeworm", started_on: iso(0), ended_on: null }],
    }),
  );
  assert("treatment 48h before travel → ok", row(inWindow, "tapeworm")!.status === "ok", row(inWindow, "tapeworm")!.status);

  const stale = computeEuComplianceReport(
    base({
      destination: FI,
      travel_date: iso(30),
      medications: [{ name: "Droncit", generic_name: "praziquantel", indication: "tapeworm", started_on: iso(0), ended_on: null }],
    }),
  );
  assert("treatment 30 days before travel → outside window", row(stale, "tapeworm")!.status === "warning", row(stale, "tapeworm")!.status);
}

console.log(`\neu passport engine: ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
