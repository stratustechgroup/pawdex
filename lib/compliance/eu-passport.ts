/**
 * Pure compliance computation for EU pet travel post-2026-04-22.
 *
 * Rule sources (current as of plan revision):
 * - Rabies vaccination must be current and administered AFTER microchip
 *   implantation. Booster cadence per product label.
 * - For animals originating in non-listed third countries (incl. USA), a
 *   rabies titer test (FAVN, ≥ 0.5 IU/ml) from an EU-approved lab must be
 *   drawn ≥ 30 days post-vaccination and ≥ 3 months before travel.
 * - Pet must be ≥ 15 weeks old at the time of travel.
 * - Microchip must be ISO 11784/11785 compliant (15 digits, numeric).
 * - For travel to UK/IE/FI/MT/NO: tapeworm treatment (Echinococcus
 *   multilocularis, praziquantel-based) administered 24–120 hours before
 *   arrival, recorded by the issuing vet.
 *
 * Pawdex does not verify against the issuing veterinarian and never makes
 * the final compliance call — this view is a checklist for the owner and a
 * handoff for a USDA-accredited / EU-recognized vet.
 */

import { differenceInDays, formatISO, parseISO, subMonths } from "date-fns";

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
  for (const e of events) {
    const text = `${e.title} ${e.summary ?? ""} ${e.diagnosis ?? ""}`.toLowerCase();
    if (TITER_KEYWORDS.some((k) => text.includes(k))) {
      return { found: true, occurred_on: e.occurred_on, title: e.title };
    }
  }
  return { found: false, occurred_on: null, title: null };
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

export function computeEuComplianceReport(
  input: ComplianceInputs,
): ComplianceReport {
  const today = new Date();
  const travelDate = input.travel_date ? parseISO(input.travel_date) : null;

  const requirements: Requirement[] = [];

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
    const expired =
      rabies.expires_on && parseISO(rabies.expires_on) < (travelDate ?? today);
    if (expired) {
      requirements.push({
        id: "rabies",
        label: "Current rabies vaccination",
        status: "blocker",
        detail: `Last rabies (${rabies.vaccine_type}) administered ${rabies.administered_on}, expires ${rabies.expires_on}. Will be expired at travel.`,
        action_required:
          "Re-vaccinate before travel. The 21-day post-vaccine wait period applies — plan accordingly.",
      });
    } else {
      requirements.push({
        id: "rabies",
        label: "Current rabies vaccination",
        status: "ok",
        detail: `${rabies.vaccine_type} on ${rabies.administered_on}${rabies.expires_on ? `, expires ${rabies.expires_on}` : ""}.`,
        action_required: null,
      });
    }
  }

  // ── Chip-before-rabies ordering (we can't fully verify; flag for vet review)
  if (chip && rabies) {
    requirements.push({
      id: "chip-before-rabies",
      label: "Chip implanted before rabies vaccination",
      status: "todo",
      detail:
        "Pawdex doesn't store the chip-implant date. EU requires the rabies vaccine to have been administered AFTER chip implantation, or the vaccine record is invalid for travel.",
      action_required:
        "Confirm with your vet that the chip was on record before the rabies date shown. If not, re-vaccinate post-chip.",
    });
  }

  // ── Rabies titer for non-listed third countries (US/CA assumed origin)
  const titer = hasTiterOnFile(input.events);
  if (rabies) {
    if (titer.found && titer.occurred_on) {
      const titerDate = parseISO(titer.occurred_on);
      const vaccineDate = parseISO(rabies.administered_on);
      const daysAfterVaccine = differenceInDays(titerDate, vaccineDate);
      const minTravel = subMonths(today, -TITER_MIN_LEAD_MONTHS); // travel ≥ 3 months after titer
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
      void minTravel;
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

  // ── Destination-specific tapeworm
  if (input.destination.requires_tapeworm) {
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

  // ── EU health certificate (USDA APHIS 7001 equivalent — we don't store it,
  //    flag for owner to procure within 10 days of travel)
  requirements.push({
    id: "ehc",
    label: "EU Animal Health Certificate (USDA APHIS 7001)",
    status: "todo",
    detail:
      "Required for non-EU origin pets. Issued by a USDA-accredited vet and endorsed by USDA APHIS Veterinary Services within 10 days of travel. Valid 10 days from issue date.",
    action_required:
      "Schedule the certificate appointment within 10 days of your travel date. The vet will validate your microchip, rabies status, and titer at the visit.",
  });

  const blockers = requirements.filter((r) => r.status === "blocker").length;
  const ok = requirements.filter((r) => r.status === "ok").length;
  const overall: ComplianceReport["overall_status"] =
    blockers > 0
      ? "blocked"
      : requirements.some((r) => r.status === "todo" || r.status === "warning")
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
