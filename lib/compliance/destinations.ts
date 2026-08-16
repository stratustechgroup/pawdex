/**
 * Destination registry + regime dispatch.
 *
 * One entry point (computeComplianceReport) that routes a destination to its
 * rule module and appends the US re-entry checklist to every outbound report.
 * Before this existed, the EU engine's logic applied to every destination
 * unconditionally and GB was processed as an EU member (audit finding §4).
 */

import {
  computeEuComplianceReport,
  EU_DESTINATIONS,
  type ComplianceInputs,
  type ComplianceReport,
  type Destination,
} from "./eu-passport";
import { computeGbComplianceReport } from "./gb";
import { usReentryRequirements } from "./us-reentry";

export const GB_DESTINATION: Destination = {
  code: "GB",
  name: "United Kingdom (GB)",
  regime: "gb",
  requires_tapeworm: true,
  notes:
    "England, Scotland and Wales. Northern Ireland follows the EU scheme — pick Ireland's rules and check gov.uk for NI specifics.",
};

/** Every destination the readiness page can compute, EU first, then GB. */
export const ALL_DESTINATIONS: Destination[] = [
  ...EU_DESTINATIONS,
  GB_DESTINATION,
];

export function findDestination(code: string): Destination | undefined {
  return ALL_DESTINATIONS.find((d) => d.code === code);
}

export function computeComplianceReport(
  input: ComplianceInputs,
): ComplianceReport {
  const report =
    input.destination.regime === "gb"
      ? computeGbComplianceReport(input)
      : computeEuComplianceReport(input);

  // The return leg. Appended to every outbound report because a US household's
  // trip is a round trip; these rows never gate outbound readiness.
  report.requirements.push(...usReentryRequirements(input));

  return report;
}
