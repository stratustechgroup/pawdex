/**
 * Pure compliance computation for EU pet travel under the post-2026-04-22
 * regime (Delegated Reg (EU) 2026/131 + Implementing Reg (EU) 2026/636).
 * Verified against primary sources 2026-08-15/16 — see
 * docs/pet-passport-deep-dive.md §3 for per-rule citations.
 *
 * Rules encoded (dogs, cats, ferrets):
 * - ISO 11784/11785 microchip, implanted on or before the date of the rabies
 *   vaccination — a vaccine given before the chip does not count.
 * - Current rabies vaccination, valid through the travel day, administered at
 *   12+ weeks of age; entry no earlier than 21 days after a PRIMARY
 *   vaccination (an unbroken booster chain does not restart the wait).
 * - Rabies titer (FAVN ≥ 0.5 IU/ml): NOT required from listed countries. The
 *   US is listed in Annex II of Reg (EU) 2026/636, so the default US origin is
 *   exempt; the requirement applies only to unlisted-origin pets.
 * - ~15-week effective age minimum (12-week vaccine minimum + 21-day wait).
 * - Echinococcus (praziquantel) treatment 24–120h before arrival, DOGS ONLY,
 *   for the destinations flagged below (FI/IE/MT/NO — GB has its own regime).
 * - EU animal health certificate: issued by a USDA-accredited vet via VEHCS,
 *   endorsed (ink-signed) by USDA APHIS, within 10 days of entry. This is an
 *   EU-specific certificate — it is NOT APHIS Form 7001.
 *
 * Pawdex does not verify against the issuing veterinarian and never makes
 * the final compliance call — this view is a checklist for the owner and a
 * handoff for a USDA-accredited vet.
 */

import { differenceInDays, formatISO, parseISO } from "date-fns";

export type CountryCode =
  | "AT"
  | "BE"
  | "BG"
  | "HR"
  | "CY"
  | "CZ"
  | "DK"
  | "EE"
  | "FI"
  | "FR"
  | "DE"
  | "GR"
  | "HU"
  | "IE"
  | "IT"
  | "LV"
  | "LT"
  | "LU"
  | "MT"
  | "NL"
  | "PL"
  | "PT"
  | "RO"
  | "SK"
  | "SI"
  | "ES"
  | "SE"
  | "NO"
  | "GB";

export type Destination = {
  code: CountryCode;
  name: string;
  requires_tapeworm: boolean;
  notes?: string;
};

export const EU_DESTINATIONS: Destination[] = [
  { code: "AT", name: "Austria", requires_tapeworm: false },
  { code: "BE", name: "Belgium", requires_tapeworm: false },
  { code: "BG", name: "Bulgaria", requires_tapeworm: false },
  { code: "HR", name: "Croatia", requires_tapeworm: false },
  { code: "CY", name: "Cyprus", requires_tapeworm: false },
  { code: "CZ", name: "Czechia", requires_tapeworm: false },
  { code: "DK", name: "Denmark", requires_tapeworm: false },
  { code: "EE", name: "Estonia", requires_tapeworm: false },
  {
    code: "FI",
    name: "Finland",
    requires_tapeworm: true,
    notes: "Echinococcus treatment 24–120h before arrival.",
  },
  { code: "FR", name: "France", requires_tapeworm: false },
  { code: "DE", name: "Germany", requires_tapeworm: false },
  { code: "GR", name: "Greece", requires_tapeworm: false },
  { code: "HU", name: "Hungary", requires_tapeworm: false },
  {
    code: "IE",
    name: "Ireland",
    requires_tapeworm: true,
    notes: "Echinococcus treatment 24–120h before arrival.",
  },
  { code: "IT", name: "Italy", requires_tapeworm: false },
  { code: "LV", name: "Latvia", requires_tapeworm: false },
  { code: "LT", name: "Lithuania", requires_tapeworm: false },
  { code: "LU", name: "Luxembourg", requires_tapeworm: false },
  {
    code: "MT",
    name: "Malta",
    requires_tapeworm: true,
    notes: "Echinococcus treatment 24–120h before arrival.",
  },
  { code: "NL", name: "Netherlands", requires_tapeworm: false },
  {
    code: "NO",
    name: "Norway",
    requires_tapeworm: true,
    notes: "Echinococcus treatment 24–120h before arrival.",
  },
  { code: "PL", name: "Poland", requires_tapeworm: false },
  { code: "PT", name: "Portugal", requires_tapeworm: false },
  { code: "RO", name: "Romania", requires_tapeworm: false },
  { code: "SK", name: "Slovakia", requires_tapeworm: false },
  { code: "SI", name: "Slovenia", requires_tapeworm: false },
  { code: "ES", name: "Spain", requires_tapeworm: false },
  { code: "SE", name: "Sweden", requires_tapeworm: false },
  {
    code: "GB",
    name: "United Kingdom",
    requires_tapeworm: true,
    notes: "Echinococcus treatment 24–120h before arrival.",
  },
];

export type RequirementStatus = "ok" | "warning" | "blocker" | "todo" | "na";

export type Requirement = {
  id: string;
  label: string;
  status: RequirementStatus;
  detail: string;
  action_required: string | null;
};

export type ComplianceReport = {
  destination: Destination;
  travel_date: string | null;
  overall_status: "ready" | "partial" | "blocked";
  ready_count: number;
  blocker_count: number;
  requirements: Requirement[];
};

export type ComplianceInputs = {
  pet: {
    name: string;
    species: string;
    date_of_birth: string | null;
    microchip_number: string | null;
    microchip_registry: string | null;
    /** DATE the chip was implanted (pets.microchip_implanted_on). Added by
     *  migration 0023 for exactly the chip-before-rabies check. */
    microchip_implanted_on: string | null;
  };
  vaccinations: Array<{
    vaccine_type: string;
    vaccine_family: string | null;
    administered_on: string;
    expires_on: string | null;
    is_rabies: boolean | null;
  }>;
  medications: Array<{
    name: string;
    generic_name: string | null;
    indication: string | null;
    started_on: string;
    ended_on: string | null;
  }>;
  events: Array<{
    event_type: string;
    occurred_on: string;
    title: string;
    summary: string | null;
    diagnosis: string | null;
  }>;
  destination: Destination;
  travel_date: string | null; // ISO YYYY-MM-DD or null = unknown
  /** Where the pet is travelling FROM. "US" (Annex II listed — no titer) is
   *  the default; "unlisted" turns the titer requirement on. There is no UI
   *  for this yet — it exists so the titer logic is origin-gated rather than
   *  wrongly applied to everyone (the pre-2026 engine's central defect). */
  origin?: "US" | "unlisted";
};

const FIFTEEN_WEEK_DAYS = 15 * 7;
const TITER_MIN_GAP_DAYS = 30; // ≥ 30d post-vaccine
const TITER_MIN_LEAD_MONTHS = 3; // ≥ 3 months before travel
const TAPEWORM_WINDOW_HOURS_MIN = 24;
const TAPEWORM_WINDOW_HOURS_MAX = 120;

const TAPEWORM_KEYWORDS = ["praziquantel", "droncit", "echinococcus", "drontal"];
const TITER_KEYWORDS = ["favn", "rabies titer", "rabies antibody", "raffit"];

function latestRabies(
  vaccs: ComplianceInputs["vaccinations"],
): ComplianceInputs["vaccinations"][number] | null {
  const rabies = vaccs.filter(
    (v) => v.is_rabies === true || v.vaccine_family === "rabies",
  );
  if (rabies.length === 0) return null;
  return rabies.reduce((acc, v) =>
    v.administered_on > acc.administered_on ? v : acc,
  );
}

function hasTiterOnFile(events: ComplianceInputs["events"]): {
  found: boolean;
  occurred_on: string | null;
  title: string | null;
} {
  // Latest matching event, not first-in-DB-order: the query feeding this has
  // no ORDER BY, and "which titer" must not depend on row order.
  let best: ComplianceInputs["events"][number] | null = null;
  for (const e of events) {
    const text = `${e.title} ${e.summary ?? ""} ${e.diagnosis ?? ""}`.toLowerCase();
    if (TITER_KEYWORDS.some((k) => text.includes(k))) {
      if (!best || e.occurred_on > best.occurred_on) best = e;
    }
  }
  return best
    ? { found: true, occurred_on: best.occurred_on, title: best.title }
    : { found: false, occurred_on: null, title: null };
}

function hasTapewormTreatment(
  meds: ComplianceInputs["medications"],
  events: ComplianceInputs["events"],
  asOf: Date | null,
): { found: boolean; latest_on: string | null } {
  let latest: string | null = null;
  for (const m of meds) {
    const text = `${m.name} ${m.generic_name ?? ""} ${m.indication ?? ""}`.toLowerCase();
    if (TAPEWORM_KEYWORDS.some((k) => text.includes(k))) {
      if (!latest || m.started_on > latest) latest = m.started_on;
    }
  }
  for (const e of events) {
    const text = `${e.title} ${e.summary ?? ""} ${e.diagnosis ?? ""}`.toLowerCase();
    if (TAPEWORM_KEYWORDS.some((k) => text.includes(k))) {
      if (!latest || e.occurred_on > latest) latest = e.occurred_on;
    }
  }
  if (!asOf || !latest) return { found: latest !== null, latest_on: latest };
  return { found: true, latest_on: latest };
}

export function isValidIsoChip(value: string | null): boolean {
  if (!value) return false;
  const trimmed = value.replace(/\s+/g, "");
  return /^\d{15}$/.test(trimmed);
}

/** The EU non-commercial pet regime covers exactly dogs, cats and ferrets. */
function coveredSpecies(species: string): "dog" | "cat" | "ferret" | null {
  const s = species.trim().toLowerCase();
  if (s.startsWith("dog") || s === "canine") return "dog";
  if (s.startsWith("cat") || s === "feline") return "cat";
  if (s.startsWith("ferret")) return "ferret";
  return null;
}

export function computeEuComplianceReport(
  input: ComplianceInputs,
): ComplianceReport {
  const today = new Date();
  const travelDate = input.travel_date ? parseISO(input.travel_date) : null;

  const requirements: Requirement[] = [];

  // The regime covers dogs, cats and ferrets only. Anything else gets an
  // honest "not covered" instead of dog rules applied to a rabbit — which is
  // what this engine did before species gating.
  const species = coveredSpecies(input.pet.species);
  if (!species) {
    requirements.push({
      id: "species",
      label: "Species coverage",
      status: "warning",
      detail: `${input.pet.name} is recorded as "${input.pet.species}". The EU non-commercial pet rules encoded here cover dogs, cats and ferrets; other species move under different (often stricter) national rules Pawdex does not model.`,
      action_required:
        "Check the destination country's national import rules for this species directly, and talk to your vet.",
    });
    return {
      destination: input.destination,
      travel_date: input.travel_date,
      overall_status: "partial",
      ready_count: 0,
      blocker_count: 0,
      requirements,
    };
  }

  // ── Microchip presence + ISO format
  const chip = input.pet.microchip_number;
  if (!chip) {
    requirements.push({
      id: "microchip",
      label: "ISO-compliant microchip",
      status: "blocker",
      detail:
        "No microchip on file. EU entry requires a 15-digit ISO 11784/11785 microchip implanted before rabies vaccination.",
      action_required:
        "Implant a 15-digit ISO microchip, then re-administer the rabies vaccine 21 days later.",
    });
  } else if (!isValidIsoChip(chip)) {
    requirements.push({
      id: "microchip",
      label: "ISO-compliant microchip",
      status: "warning",
      detail: `Microchip ${chip} on file but is not 15 digits — verify it matches ISO 11784/11785.`,
      action_required:
        "Have a vet scan and confirm chip format. A non-ISO chip means you must bring a portable reader to EU port-of-entry, OR re-chip with an ISO chip and re-vaccinate.",
    });
  } else {
    requirements.push({
      id: "microchip",
      label: "ISO-compliant microchip",
      status: "ok",
      detail: `Chip ${chip}${input.pet.microchip_registry ? ` registered with ${input.pet.microchip_registry}` : ""}.`,
      action_required: null,
    });
  }

  // ── Age at travel
  if (!input.pet.date_of_birth) {
    requirements.push({
      id: "age",
      label: "Age ≥ 15 weeks at travel",
      status: "warning",
      detail: "Date of birth missing — cannot verify the 15-week minimum.",
      action_required: "Add the pet's DOB on the edit page.",
    });
  } else {
    const dob = parseISO(input.pet.date_of_birth);
    const ageAtTravelDays = differenceInDays(travelDate ?? today, dob);
    if (ageAtTravelDays < FIFTEEN_WEEK_DAYS) {
      requirements.push({
        id: "age",
        label: "Age ≥ 15 weeks at travel",
        status: travelDate ? "blocker" : "warning",
        detail: `${input.pet.name} would be ${Math.floor(ageAtTravelDays / 7)} weeks old at travel — below the 15-week minimum.`,
        action_required: travelDate
          ? "Postpone travel until the pet is at least 15 weeks old."
          : "Once you pick a travel date, confirm the pet is ≥ 15 weeks by then.",
      });
    } else {
      requirements.push({
        id: "age",
        label: "Age ≥ 15 weeks at travel",
        status: "ok",
        detail: `${Math.floor(ageAtTravelDays / 7)} weeks old ${travelDate ? "at travel" : "today"}.`,
        action_required: null,
      });
    }
  }

  // ── Current rabies vaccination
  const rabies = latestRabies(input.vaccinations);
  if (!rabies) {
    requirements.push({
      id: "rabies",
      label: "Current rabies vaccination",
      status: "blocker",
      detail: "No rabies vaccination on file.",
      action_required:
        "Schedule a rabies vaccine with a USDA-accredited vet. Note: the vaccine must be administered AFTER microchip implantation, or it doesn't count for EU travel.",
    });
  } else {
    // Valid THROUGH the travel day: a vaccine expiring on the date of entry
    // is not current at the border, so the comparison is <=, not <.
    const expired =
      rabies.expires_on && parseISO(rabies.expires_on) <= (travelDate ?? today);
    if (expired) {
      // Tense follows reality: with no travel date the comparison is against
      // today, so the vaccine is already expired, not "will be" anything.
      const alreadyExpired =
        rabies.expires_on && parseISO(rabies.expires_on) < today;
      requirements.push({
        id: "rabies",
        label: "Current rabies vaccination",
        status: "blocker",
        detail: `Last rabies (${rabies.vaccine_type}) administered ${rabies.administered_on}, expires ${rabies.expires_on}. ${alreadyExpired ? "Already expired." : "Will be expired by the travel date."}`,
        action_required:
          "Re-vaccinate before travel. The 21-day post-vaccine wait period applies — plan accordingly.",
      });
    } else {
      // APHIS: a PRIMARY rabies vaccination administered in the US counts for
      // only 1 year for EU travel, even when the product is labeled 3-year.
      // With a single rabies record on file we cannot tell primary from
      // booster, so surface the trap instead of silently trusting the label.
      const rabiesCount = input.vaccinations.filter(
        (v) => v.is_rabies === true || v.vaccine_family === "rabies",
      ).length;
      const primaryCaveat =
        rabiesCount === 1
          ? " Note: if this was the pet's FIRST rabies vaccination, USDA treats it as valid for 1 year for EU travel even if labeled 3-year — confirm with your vet."
          : "";
      requirements.push({
        id: "rabies",
        label: "Current rabies vaccination",
        status: "ok",
        detail: `${rabies.vaccine_type} on ${rabies.administered_on}${rabies.expires_on ? `, expires ${rabies.expires_on}` : ""}.${primaryCaveat}`,
        action_required: null,
      });
    }
  }

  // ── 21-day wait after a PRIMARY rabies vaccination (Reg 2026/131 Art
  //    14(b): "complete primary course ... at least 21 days prior to the date
  //    of movement"). Previously this rule existed only as advisory strings, so
  //    a vaccine administered yesterday with travel tomorrow computed "ok".
  //    An unbroken booster chain does not restart the wait: if the newest
  //    rabies was administered while the previous one was still valid, the
  //    primary course was completed long ago.
  if (rabies) {
    const rabiesAll = input.vaccinations
      .filter((v) => v.is_rabies === true || v.vaccine_family === "rabies")
      .sort((a, b) => (a.administered_on < b.administered_on ? -1 : 1));
    const prior = rabiesAll.length >= 2 ? rabiesAll[rabiesAll.length - 2] : null;
    const chainUnbroken =
      prior?.expires_on != null && rabies.administered_on <= prior.expires_on;

    if (!chainUnbroken) {
      const eligibleFrom = new Date(parseISO(rabies.administered_on));
      eligibleFrom.setDate(eligibleFrom.getDate() + 21);
      const reference = travelDate ?? today;
      const daysSince = differenceInDays(reference, parseISO(rabies.administered_on));
      if (daysSince < 21) {
        requirements.push({
          id: "rabies-wait",
          label: "21-day wait after primary vaccination",
          status: travelDate ? "blocker" : "warning",
          detail: travelDate
            ? `Only ${daysSince} day${daysSince === 1 ? "" : "s"} between the rabies vaccination (${rabies.administered_on}) and travel — the EU requires at least 21. Earliest eligible entry: ${formatISO(eligibleFrom, { representation: "date" })}.`
            : `The rabies vaccination on ${rabies.administered_on} was ${daysSince} day${daysSince === 1 ? "" : "s"} ago. EU entry is allowed from ${formatISO(eligibleFrom, { representation: "date" })} (21 days after vaccination).`,
          action_required: travelDate
            ? "Move the travel date to at least 21 days after the vaccination, or confirm with your vet that an earlier valid booster chain applies."
            : "Plan travel no earlier than 21 days after the vaccination date.",
        });
      } else {
        requirements.push({
          id: "rabies-wait",
          label: "21-day wait after primary vaccination",
          status: "ok",
          detail: `${daysSince} days since the rabies vaccination — the 21-day post-vaccination wait is satisfied.`,
          action_required: null,
        });
      }
    } else {
      requirements.push({
        id: "rabies-wait",
        label: "21-day wait after primary vaccination",
        status: "ok",
        detail: `Booster administered ${rabies.administered_on} while the previous vaccination was still valid — the primary-course wait doesn't restart.`,
        action_required: null,
      });
    }
  }

  // ── Chip-before-rabies ordering. Reg: "the date of administration of the
  //    vaccine does not precede the date of identification". Same-day counts.
  //    pets.microchip_implanted_on (migration 0023) exists for exactly this
  //    check — the old code claimed the date wasn't stored and pushed an
  //    unconditional todo.
  if (chip && rabies) {
    const implanted = input.pet.microchip_implanted_on;
    if (!implanted) {
      requirements.push({
        id: "chip-before-rabies",
        label: "Chip implanted before rabies vaccination",
        status: "todo",
        detail:
          "No chip-implant date on file. The EU requires the rabies vaccine to have been administered on or after the day the chip went in — a vaccine given before the chip does not count for travel.",
        action_required:
          "Add the implant date on the pet's edit page (it's on the chip registration or the implanting vet's record), and Pawdex will verify the ordering for you.",
      });
    } else if (implanted <= rabies.administered_on) {
      requirements.push({
        id: "chip-before-rabies",
        label: "Chip implanted before rabies vaccination",
        status: "ok",
        detail: `Chip implanted ${implanted}, rabies vaccinated ${rabies.administered_on} — ordering satisfied.`,
        action_required: null,
      });
    } else {
      requirements.push({
        id: "chip-before-rabies",
        label: "Chip implanted before rabies vaccination",
        status: "blocker",
        detail: `The rabies vaccination (${rabies.administered_on}) predates the chip implant (${implanted}). For EU travel that vaccination does not count.`,
        action_required:
          "Re-vaccinate now that the chip is in, then wait 21 days before travel. Ask your vet to record the new vaccination against the chip number.",
      });
    }
  }

  // ── Rabies titer — ONLY for unlisted-origin pets. The US is listed in
  //    Annex II of Reg (EU) 2026/636, and the Commission is explicit that the
  //    test "is not required" from listed countries. The pre-2026 engine
  //    applied this to everyone — its single worst defect: every US household
  //    was told to ship blood to Kansas and wait 3 months for a test the EU
  //    dropped for them.
  const origin = input.origin ?? "US";
  if (origin === "US") {
    requirements.push({
      id: "titer",
      label: "Rabies titer (FAVN)",
      status: "na",
      detail:
        "Not required from the United States — the US is a listed country (Annex II, Reg (EU) 2026/636), so no rabies antibody test is needed for EU entry.",
      action_required: null,
    });
  }
  const titer = hasTiterOnFile(input.events);
  if (origin !== "US" && rabies) {
    if (titer.found && titer.occurred_on) {
      const titerDate = parseISO(titer.occurred_on);
      const vaccineDate = parseISO(rabies.administered_on);
      const daysAfterVaccine = differenceInDays(titerDate, vaccineDate);
      const earliestTravel = travelDate
        ? differenceInDays(travelDate, titerDate) >= TITER_MIN_LEAD_MONTHS * 30
        : true; // can't evaluate without travel date

      if (daysAfterVaccine < TITER_MIN_GAP_DAYS) {
        requirements.push({
          id: "titer",
          label: "Rabies titer (FAVN, ≥ 0.5 IU/ml)",
          status: "blocker",
          detail: `Titer drawn ${titer.occurred_on}, only ${daysAfterVaccine} days after the rabies vaccine. EU requires ≥ 30 days between vaccine and titer draw.`,
          action_required:
            "Re-draw the titer ≥ 30 days after the most recent rabies vaccine. The lab must be EU-approved.",
        });
      } else if (!earliestTravel) {
        requirements.push({
          id: "titer",
          label: "Rabies titer (FAVN, ≥ 0.5 IU/ml)",
          status: "warning",
          detail: `Titer on file from ${titer.occurred_on}. Travel must be at least 3 months after this date.`,
          action_required: "Verify the 3-month lead time before booking flights.",
        });
      } else {
        requirements.push({
          id: "titer",
          label: "Rabies titer (FAVN, ≥ 0.5 IU/ml)",
          status: "ok",
          detail: `Titer recorded on ${titer.occurred_on} ("${titer.title}"). Confirm result was ≥ 0.5 IU/ml from an EU-approved lab.`,
          action_required: null,
        });
      }
    } else {
      requirements.push({
        id: "titer",
        label: "Rabies titer (FAVN, ≥ 0.5 IU/ml)",
        status: "blocker",
        detail:
          "No titer on file. Pets entering the EU from non-listed third countries (incl. USA) must show a current rabies titer ≥ 0.5 IU/ml from an EU-approved laboratory.",
        action_required:
          "Have your vet draw blood ≥ 30 days post-vaccine and ship to an EU-approved lab (Kansas State Rabies Lab, Auburn, etc.). Travel must be ≥ 3 months after the draw.",
      });
    }
  }

  // ── Destination-specific tapeworm — DOGS ONLY (Reg 2026/131 Art 14(d)
  //    covers dogs; the engine used to demand praziquantel from cats too).
  if (input.destination.requires_tapeworm && species !== "dog") {
    requirements.push({
      id: "tapeworm",
      label: `Echinococcus treatment (${input.destination.name})`,
      status: "na",
      detail: `${input.destination.name}'s Echinococcus treatment rule applies to dogs only — not required for a ${species}.`,
      action_required: null,
    });
  } else if (input.destination.requires_tapeworm) {
    const tapeworm = hasTapewormTreatment(
      input.medications,
      input.events,
      travelDate,
    );
    if (!travelDate) {
      requirements.push({
        id: "tapeworm",
        label: `Echinococcus treatment (${input.destination.name})`,
        status: "todo",
        detail:
          "Once you pick a travel date, schedule praziquantel tapeworm treatment 24–120 hours before arrival, administered by a vet.",
        action_required:
          "Book the treatment in your destination's accepted window. The vet must record the exact date and time on the EU health certificate.",
      });
    } else if (!tapeworm.found) {
      requirements.push({
        id: "tapeworm",
        label: `Echinococcus treatment (${input.destination.name})`,
        status: "blocker",
        detail: `${input.destination.name} requires praziquantel-based tapeworm treatment administered 24–120 hours before arrival.`,
        action_required:
          "Schedule the treatment with your vet — must be recorded on the EU health certificate with exact date/time.",
      });
    } else {
      const hoursBefore = tapeworm.latest_on
        ? (parseISO(input.travel_date!).getTime() -
            parseISO(tapeworm.latest_on).getTime()) /
          (1000 * 60 * 60)
        : null;
      if (
        hoursBefore !== null &&
        hoursBefore >= TAPEWORM_WINDOW_HOURS_MIN &&
        hoursBefore <= TAPEWORM_WINDOW_HOURS_MAX
      ) {
        requirements.push({
          id: "tapeworm",
          label: `Echinococcus treatment (${input.destination.name})`,
          status: "ok",
          detail: `Treatment on ${tapeworm.latest_on}, ${Math.round(hoursBefore)}h before travel — within 24–120h window.`,
          action_required: null,
        });
      } else {
        requirements.push({
          id: "tapeworm",
          label: `Echinococcus treatment (${input.destination.name})`,
          status: "warning",
          detail: tapeworm.latest_on
            ? `Treatment on ${tapeworm.latest_on}${hoursBefore !== null ? `, ${Math.round(hoursBefore)}h before travel — outside the 24–120h window.` : "."}`
            : "Treatment record found but date unclear.",
          action_required:
            "Re-administer within the 24–120 hour window before arrival. Vet must record exact date/time.",
        });
      }
    }
  } else {
    requirements.push({
      id: "tapeworm",
      label: "Echinococcus treatment",
      status: "na",
      detail: `${input.destination.name} doesn't require Echinococcus treatment for entry.`,
      action_required: null,
    });
  }

  // ── EU animal health certificate. Two corrections from the audit: this is
  //    an EU-SPECIFIC certificate, NOT APHIS Form 7001 (APHIS says outright
  //    not to submit the 7001 when the destination doesn't require it), and
  //    the workflow is VEHCS — accredited vet issues, USDA endorses with an
  //    ink signature for the EU. It can only exist within 10 days of entry,
  //    so it is a calendar action, not a record Pawdex can hold in advance —
  //    which is why it is excluded from the readiness computation below
  //    (the old unconditional todo made "ready" unreachable by construction).
  requirements.push({
    id: "ehc",
    label: "EU animal health certificate (via VEHCS)",
    status: "todo",
    detail:
      "Issued by a USDA-accredited vet through VEHCS and endorsed (ink-signed) by USDA APHIS, within 10 days of EU entry. This is the EU's own certificate — not APHIS Form 7001. Once checked at entry it covers onward EU movement for 6 months.",
    action_required:
      "Book the certificate appointment for the 10-day window before your travel date, and allow time for USDA endorsement. The vet validates chip, rabies record and dates at that visit.",
  });

  // Readiness reflects the RECORDS. The certificate is inherently a
  // last-10-days errand, so it never blocks "ready" — the page copy presents
  // ready as "records ready, certificate appointment remains".
  const gating = requirements.filter((r) => r.id !== "ehc");
  const blockers = gating.filter((r) => r.status === "blocker").length;
  const ok = requirements.filter((r) => r.status === "ok").length;
  const overall: ComplianceReport["overall_status"] =
    blockers > 0
      ? "blocked"
      : gating.some((r) => r.status === "todo" || r.status === "warning")
        ? "partial"
        : "ready";

  return {
    destination: input.destination,
    travel_date: input.travel_date,
    overall_status: overall,
    ready_count: ok,
    blocker_count: blockers,
    requirements,
  };
}

export function todayIso(): string {
  return formatISO(new Date(), { representation: "date" });
}
