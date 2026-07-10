import "server-only";

import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { recordAudit } from "@/lib/db/audit";
import type {
  Authorization,
  AuthorizationType,
} from "@/lib/supabase/types";

// Frozen scope copy. Bump SCOPE_VERSION when wording changes — every grant
// snapshots the text it agreed to, so a later wording update never silently
// rewrites a user's historical consent.
export const SCOPE_VERSION = "v1.2026-05";

export type AuthorizationDescriptor = {
  type: AuthorizationType;
  label: string;
  short: string;
  icon: string;
  scopeText: string;
  scopeVersion: string;
  requiresOwner: boolean;
};

export const AUTHORIZATION_DESCRIPTORS: Record<
  AuthorizationType,
  AuthorizationDescriptor
> = {
  records_request_to_vets: {
    type: "records_request_to_vets",
    label: "Request records from my vets",
    short:
      "Lets Pawdex email vet clinics in your history to request medical records, vaccine certificates, and visit summaries.",
    icon: "mail",
    scopeVersion: SCOPE_VERSION,
    requiresOwner: true,
    scopeText:
      "I authorize Pawdex to send email on my behalf to veterinary practices and clinics in my pet's care history, requesting copies of medical records, vaccination certificates, lab results, and visit summaries. Pawdex may identify itself as acting on my behalf, may attach a copy of this authorization to such emails, and will store all sent emails and responses in my Pawdex account for my reference. I can revoke this authorization at any time; revocation stops new outbound requests but does not recall messages already sent.",
  },
  records_distribution_to_third_parties: {
    type: "records_distribution_to_third_parties",
    label: "Send my records to third parties",
    short:
      "Lets Pawdex email selected records to recipients you designate — boarding, specialists, insurers, new vets — on a per-recipient confirmation basis.",
    icon: "send",
    scopeVersion: SCOPE_VERSION,
    requiresOwner: true,
    scopeText:
      "I authorize Pawdex to send copies of my pet's medical records, vaccination certificates, and related documents — as I select on a per-recipient basis — to third parties I designate, including but not limited to veterinary practices, boarding facilities, groomers, pet insurers, and adoptive owners. Each distribution requires my per-recipient confirmation. Pawdex will record what was sent, to whom, and when. I can revoke this authorization at any time.",
  },
  insurer_clarification_emails: {
    type: "insurer_clarification_emails",
    label: "Draft clarification emails to my insurer",
    short:
      "Lets Pawdex draft policy-clarification email to your insurer for your review. Nothing is sent without your explicit approval.",
    icon: "shieldCheck",
    scopeVersion: SCOPE_VERSION,
    requiresOwner: true,
    scopeText:
      "I authorize Pawdex to draft, on my behalf and for my approval before sending, email correspondence to my pet insurer(s) seeking clarification of policy terms, coverage decisions, claim status, or pre-existing-condition determinations. Each draft will be presented for my review and explicit approval before any email is sent. Pawdex will not advocate, demand, or make admissions on my behalf. I can revoke this authorization at any time.",
  },
  affiliate_disclosure_acknowledged: {
    type: "affiliate_disclosure_acknowledged",
    label: "Acknowledge affiliate disclosure",
    short:
      "Required before Pawdex shows partner intro rates or sponsored comparisons. Pawdex marks every partner placement as Sponsored.",
    icon: "info",
    scopeVersion: SCOPE_VERSION,
    requiresOwner: false,
    scopeText:
      "I acknowledge that Pawdex may earn referral fees, commissions, or other compensation when I purchase pet insurance, products, or services through links or recommendations surfaced in the app. Pawdex will visibly mark any partner-sponsored placement as 'Sponsored' or 'Partner' and link to its full disclosure policy. This acknowledgement enables comparison features and partner intro rates; it does not authorize Pawdex to make any purchase or commitment on my behalf.",
  },
  research_data_sharing: {
    type: "research_data_sharing",
    label: "Share de-identified data for research",
    short:
      "Lets Pawdex include your animals' de-identified records in aggregate research datasets. You choose which animals; nothing personally identifying is shared.",
    icon: "activity",
    scopeVersion: SCOPE_VERSION,
    requiresOwner: true,
    scopeText:
      "I authorize Pawdex to include de-identified medical records for the animals I select in aggregate datasets shared with veterinary and animal-health researchers. Direct identifiers (my name, contact details, and precise location) are removed before any data leaves Pawdex. I can revoke this authorization at any time; revocation stops inclusion in future releases but does not recall datasets already shared.",
  },
};

export const AUTHORIZATION_TYPES = Object.keys(
  AUTHORIZATION_DESCRIPTORS,
) as AuthorizationType[];

export type AuthorizationStateRow = {
  descriptor: AuthorizationDescriptor;
  effective: Authorization | null;
  history: Authorization[];
};

/**
 * Returns the household's latest non-revoked authorization for `type`, or null.
 * Uses the RLS-scoped client so callers can't peek across households.
 */
export async function getEffectiveAuthorization(
  householdId: string,
  type: AuthorizationType,
): Promise<Authorization | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("authorizations")
    .select("*")
    .eq("household_id", householdId)
    .eq("authorization_type", type)
    .is("revoked_at", null)
    .order("granted_at", { ascending: false })
    .limit(1);
  if (error) throw new Error(`getEffectiveAuthorization: ${error.message}`);
  return (data?.[0] as Authorization | undefined) ?? null;
}

/**
 * Throws if the household has no effective authorization of `type`. Use this
 * in every outbound code path before drafting or sending — no auth, no email.
 */
export async function requireAuthorization(
  householdId: string,
  type: AuthorizationType,
): Promise<Authorization> {
  const auth = await getEffectiveAuthorization(householdId, type);
  if (!auth) {
    throw new AuthorizationMissingError(type);
  }
  return auth;
}

export class AuthorizationMissingError extends Error {
  readonly type: AuthorizationType;
  constructor(type: AuthorizationType) {
    super(
      `Authorization '${type}' is required but has not been granted for this household.`,
    );
    this.type = type;
    this.name = "AuthorizationMissingError";
  }
}

export async function listAuthorizationsForHousehold(
  householdId: string,
): Promise<AuthorizationStateRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("authorizations")
    .select("*")
    .eq("household_id", householdId)
    .order("granted_at", { ascending: false });
  if (error) throw new Error(`listAuthorizations: ${error.message}`);

  const rows = (data ?? []) as Authorization[];
  return AUTHORIZATION_TYPES.map((type) => {
    const history = rows.filter((r) => r.authorization_type === type);
    const effective = history.find((r) => r.revoked_at === null) ?? null;
    return {
      descriptor: AUTHORIZATION_DESCRIPTORS[type],
      effective,
      history,
    };
  });
}

export async function grantAuthorization(input: {
  householdId: string;
  userId: string;
  type: AuthorizationType;
  ipAddress?: string | null;
  userAgent?: string | null;
}): Promise<Authorization> {
  const descriptor = AUTHORIZATION_DESCRIPTORS[input.type];

  // Idempotency: if a non-revoked grant already exists, return it unchanged
  // so the UI can stay declarative ("grant" is a state, not an event).
  const existing = await getEffectiveAuthorization(input.householdId, input.type);
  if (existing) return existing;

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("authorizations")
    .insert({
      household_id: input.householdId,
      authorization_type: input.type,
      granted_by: input.userId,
      scope_text: descriptor.scopeText,
      ip_address: input.ipAddress ?? null,
      user_agent: input.userAgent ?? null,
    })
    .select("*")
    .single();
  if (error || !data) {
    throw new Error(`grantAuthorization: ${error?.message ?? "no row returned"}`);
  }

  await recordAudit({
    householdId: input.householdId,
    actorId: input.userId,
    action: "create",
    entityType: "authorization",
    entityId: data.id,
    diff: {
      after: {
        authorization_type: input.type,
        scope_version: descriptor.scopeVersion,
      },
    },
  });

  return data as Authorization;
}

export async function revokeAuthorization(input: {
  householdId: string;
  userId: string;
  type: AuthorizationType;
}): Promise<Authorization | null> {
  const effective = await getEffectiveAuthorization(input.householdId, input.type);
  if (!effective) return null;

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("authorizations")
    .update({ revoked_at: new Date().toISOString(), revoked_by: input.userId })
    .eq("id", effective.id)
    .select("*")
    .single();
  if (error || !data) {
    throw new Error(`revokeAuthorization: ${error?.message ?? "no row returned"}`);
  }

  await recordAudit({
    householdId: input.householdId,
    actorId: input.userId,
    action: "update",
    entityType: "authorization",
    entityId: data.id,
    diff: {
      before: { revoked_at: null },
      after: { revoked_at: data.revoked_at, authorization_type: input.type },
    },
  });

  return data as Authorization;
}
