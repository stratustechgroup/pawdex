/**
 * Great Britain pet-entry compliance (England, Scotland, Wales).
 *
 * GB left the EU pet scheme; processing it under EU logic was audit finding
 * §4 of docs/pet-passport-deep-dive.md. Rules encoded here were verified
 * against gov.uk (bring-pet-to-great-britain and subpages), retrieved
 * 2026-08-15/16 — quotes in the deep-dive doc:
 *
 * - Microchip first: "They must be microchipped before they get their rabies
 *   vaccination."
 * - Rabies: vaccinate at 12+ weeks ("Your vet needs proof that your pet's at
 *   least 12 weeks old before vaccinating them"), then "wait at least 21 full
 *   days after the first rabies vaccination" before entry.
 * - NO titer from the US: the blood-test requirement applies to unlisted
 *   countries only, and the USA is listed for GB.
 * - Dogs: praziquantel tapeworm treatment "no less than 24 hours ... no more
 *   than 5 days (120 hours)" before entering GB. Dogs only — always required,
 *   not per-destination like the EU flag.
 * - Document from the US: the "Great Britain pet health certificate", signed
 *   by an official veterinarian; "Your pet must enter Great Britain within 10
 *   days of the pet health certificate being issued."
 * - Approved routes: "Pets have to travel as cargo on a plane unless: you're
 *   flying on a chartered private plane or you're travelling with a guide or
 *   assistance dog."
 *
 * Northern Ireland follows the EU scheme, not this one.
 */

import { differenceInDays, formatISO, parseISO } from "date-fns";

import {
  coveredSpecies,
  hasTapewormTreatment,
  isValidIsoChip,
  latestRabies,
  type ComplianceInputs,
  type ComplianceReport,
  type Requirement,
} from "./eu-passport";

const TAPEWORM_WINDOW_HOURS_MIN = 24;
const TAPEWORM_WINDOW_HOURS_MAX = 120;

export function computeGbComplianceReport(
  input: ComplianceInputs,
): ComplianceReport {
  const today = new Date();
  const travelDate = input.travel_date ? parseISO(input.travel_date) : null;
  const requirements: Requirement[] = [];

  const species = coveredSpecies(input.pet.species);
  if (!species) {
    requirements.push({
      id: "species",
      label: "Species coverage",
      status: "warning",
      detail: `${input.pet.name} is recorded as "${input.pet.species}". The GB pet travel scheme covers dogs, cats and ferrets; other species move under separate GB import rules Pawdex does not model.`,
      action_required:
        "Check gov.uk's import guidance for this species directly, and talk to your vet.",
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

  // ── Microchip presence + format. gov.uk requires a microchip readable by
  //    a standard reader; ISO 11784/11785 is the interoperable choice and the
  //    same 15-digit check the EU regime uses is the right proxy.
  const chip = input.pet.microchip_number;
  if (!chip) {
    requirements.push({
      id: "microchip",
      label: "Microchip",
      status: "blocker",
      detail:
        "No microchip on file. GB requires the pet to be microchipped before the rabies vaccination — a vaccine given first doesn't count.",
      action_required:
        "Implant an ISO microchip, then (re)administer the rabies vaccine, then wait 21 full days before travel.",
    });
  } else if (!isValidIsoChip(chip)) {
    requirements.push({
      id: "microchip",
      label: "Microchip",
      status: "warning",
      detail: `Microchip ${chip} on file but not 15 digits — verify it is ISO 11784/11785 readable, or bring a compatible reader.`,
      action_required: "Have a vet scan and confirm the chip format.",
    });
  } else {
    requirements.push({
      id: "microchip",
      label: "Microchip",
      status: "ok",
      detail: `Chip ${chip}${input.pet.microchip_registry ? ` registered with ${input.pet.microchip_registry}` : ""}.`,
      action_required: null,
    });
  }

  // ── Rabies vaccination: current through the travel day, administered at
  //    12+ weeks of age.
  const rabies = latestRabies(input.vaccinations);
  if (!rabies) {
    requirements.push({
      id: "rabies",
      label: "Current rabies vaccination",
      status: "blocker",
      detail: "No rabies vaccination on file.",
      action_required:
        "Vaccinate after the microchip is in (GB requires chip-first) and once the pet is at least 12 weeks old, then wait 21 full days before travel.",
    });
  } else {
    const expired =
      rabies.expires_on && parseISO(rabies.expires_on) <= (travelDate ?? today);
    if (expired) {
      const alreadyExpired =
        rabies.expires_on && parseISO(rabies.expires_on) < today;
      requirements.push({
        id: "rabies",
        label: "Current rabies vaccination",
        status: "blocker",
        detail: `Last rabies (${rabies.vaccine_type}) administered ${rabies.administered_on}, expires ${rabies.expires_on}. ${alreadyExpired ? "Already expired." : "Will be expired by the travel date."}`,
        action_required:
          "Re-vaccinate before travel — the 21-full-day wait then applies again if the booster chain lapsed.",
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

    // 12-weeks-old-at-vaccination — checkable when DOB is on file.
    if (input.pet.date_of_birth) {
      const ageAtVaccineDays = differenceInDays(
        parseISO(rabies.administered_on),
        parseISO(input.pet.date_of_birth),
      );
      if (ageAtVaccineDays < 12 * 7) {
        requirements.push({
          id: "rabies-age",
          label: "Vaccinated at 12+ weeks of age",
          status: "blocker",
          detail: `The rabies vaccination on ${rabies.administered_on} was given at ${Math.floor(ageAtVaccineDays / 7)} weeks old — GB requires the pet to be at least 12 weeks old at vaccination, so this record does not count.`,
          action_required: "Re-vaccinate now that the pet is old enough, then wait 21 full days.",
        });
      }
    }

    // ── 21 full days after the vaccination before entry. Same chain logic as
    //    the EU regime: a booster within the previous vaccine's validity does
    //    not restart the wait.
    const rabiesAll = input.vaccinations
      .filter((v) => v.is_rabies === true || v.vaccine_family === "rabies")
      .sort((a, b) => (a.administered_on < b.administered_on ? -1 : 1));
    const prior = rabiesAll.length >= 2 ? rabiesAll[rabiesAll.length - 2] : null;
    const chainUnbroken =
      prior?.expires_on != null && rabies.administered_on <= prior.expires_on;
    if (!chainUnbroken) {
      const eligibleFrom = new Date(parseISO(rabies.administered_on));
      eligibleFrom.setDate(eligibleFrom.getDate() + 21);
      const daysSince = differenceInDays(
        travelDate ?? today,
        parseISO(rabies.administered_on),
      );
      if (daysSince < 21) {
        requirements.push({
          id: "rabies-wait",
          label: "21 full days after vaccination",
          status: travelDate ? "blocker" : "warning",
          detail: `GB requires waiting at least 21 full days after the rabies vaccination (${rabies.administered_on}). Earliest eligible entry: ${formatISO(eligibleFrom, { representation: "date" })}.`,
          action_required: travelDate
            ? "Move the travel date to at least 21 full days after the vaccination."
            : "Plan entry no earlier than 21 full days after the vaccination date.",
        });
      } else {
        requirements.push({
          id: "rabies-wait",
          label: "21 full days after vaccination",
          status: "ok",
          detail: `${daysSince} days since the rabies vaccination — the wait is satisfied.`,
          action_required: null,
        });
      }
    } else {
      requirements.push({
        id: "rabies-wait",
        label: "21 full days after vaccination",
        status: "ok",
        detail: `Booster administered ${rabies.administered_on} while the previous vaccination was still valid — the wait doesn't restart.`,
        action_required: null,
      });
    }
  }

  // ── Chip-before-rabies ordering, same mechanics as the EU regime.
  if (chip && rabies) {
    const implanted = input.pet.microchip_implanted_on;
    if (!implanted) {
      requirements.push({
        id: "chip-before-rabies",
        label: "Chip implanted before rabies vaccination",
        status: "todo",
        detail:
          "No chip-implant date on file. GB requires the microchip BEFORE the rabies vaccination, or the vaccine record does not count.",
        action_required:
          "Add the implant date on the pet's edit page and Pawdex will verify the ordering for you.",
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
        detail: `The rabies vaccination (${rabies.administered_on}) predates the chip implant (${implanted}); GB will not accept it.`,
        action_required: "Re-vaccinate now that the chip is in, then wait 21 full days before travel.",
      });
    }
  }

  // ── NO titer from the US — surfaced explicitly so nobody assumes the EU
  //    unlisted-country test applies here.
  requirements.push({
    id: "titer",
    label: "Rabies titer (blood test)",
    status: "na",
    detail:
      "Not required from the United States — the USA is on GB's listed-country track, so no rabies blood test is needed.",
    action_required: null,
  });

  // ── Tapeworm: dogs only, ALWAYS required for GB (unlike the per-country EU
  //    flag), 24–120h before arrival.
  if (species !== "dog") {
    requirements.push({
      id: "tapeworm",
      label: "Tapeworm treatment (dogs only)",
      status: "na",
      detail: `GB's praziquantel requirement applies to dogs only — not required for a ${species}.`,
      action_required: null,
    });
  } else {
    const tapeworm = hasTapewormTreatment(input.medications, input.events, travelDate);
    if (!travelDate) {
      requirements.push({
        id: "tapeworm",
        label: "Tapeworm treatment (praziquantel)",
        status: "todo",
        detail:
          "Once you pick a travel date: a vet must administer praziquantel no less than 24 hours and no more than 120 hours (5 days) before you enter GB, and record it on the certificate.",
        action_required: "Book the treatment inside the 24–120h window before entry.",
      });
    } else if (!tapeworm.found) {
      requirements.push({
        id: "tapeworm",
        label: "Tapeworm treatment (praziquantel)",
        status: "blocker",
        detail:
          "GB requires a vet-administered praziquantel treatment 24–120 hours before entry for all dogs.",
        action_required:
          "Schedule the treatment inside the window — the vet records exact date and time on the certificate.",
      });
    } else {
      const hoursBefore = tapeworm.latest_on
        ? (parseISO(input.travel_date!).getTime() - parseISO(tapeworm.latest_on).getTime()) /
          (1000 * 60 * 60)
        : null;
      if (
        hoursBefore !== null &&
        hoursBefore >= TAPEWORM_WINDOW_HOURS_MIN &&
        hoursBefore <= TAPEWORM_WINDOW_HOURS_MAX
      ) {
        requirements.push({
          id: "tapeworm",
          label: "Tapeworm treatment (praziquantel)",
          status: "ok",
          detail: `Treatment on ${tapeworm.latest_on}, ${Math.round(hoursBefore)}h before travel — within the 24–120h window.`,
          action_required: null,
        });
      } else {
        requirements.push({
          id: "tapeworm",
          label: "Tapeworm treatment (praziquantel)",
          status: "warning",
          detail: tapeworm.latest_on
            ? `Treatment on ${tapeworm.latest_on}${hoursBefore !== null ? `, ${Math.round(hoursBefore)}h before travel — outside the 24–120h window.` : "."}`
            : "Treatment record found but the date is unclear.",
          action_required: "Re-administer inside the 24–120 hour window before entry.",
        });
      }
    }
  }

  // ── The document: Great Britain pet health certificate. A calendar action —
  //    entry must be within 10 days of issue — so it never gates readiness.
  requirements.push({
    id: "gb-phc",
    label: "Great Britain pet health certificate",
    status: "todo",
    gates_readiness: false,
    detail:
      "From the US, GB requires the Great Britain pet health certificate, signed by an official veterinarian. Your pet must enter GB within 10 days of it being issued. (This is GB's own document — not the EU certificate and not APHIS Form 7001.)",
    action_required:
      "Book the certificate appointment inside the 10-day window before entry, with time for USDA endorsement.",
  });

  // ── Approved routes: logistics constraint worth knowing early. Does not
  //    gate record readiness.
  requirements.push({
    id: "gb-route",
    label: "Approved route (pets fly as cargo)",
    status: "todo",
    gates_readiness: false,
    detail:
      "Pets entering GB by air must travel as cargo unless you fly a chartered private plane or travel with a guide/assistance dog. Plan the route and carrier early — cargo capacity books out.",
    action_required:
      "Confirm your carrier accepts pets as cargo into GB on your route, or plan an approved sea/rail route.",
  });

  const gating = requirements.filter((r) => r.gates_readiness !== false);
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
