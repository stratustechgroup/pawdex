"use server";

import { revalidatePath } from "next/cache";
import { Resend } from "resend";

import { requireSession } from "@/lib/auth/household";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { createHousehold } from "@/lib/auth/households";
import { switchHousehold } from "@/lib/auth/switch-household";
import type { HouseholdKind } from "@/lib/auth/active-household";
import {
  generateInvitationToken,
  invitationExpiry,
} from "@/lib/auth/invitations";
import { recordAudit } from "@/lib/db/audit";

type Result = { ok: true } | { ok: false; error: string };

// Guardrail against runaway creation. Counts households the user OWNS (created),
// not every membership, so being invited into several households never blocks a
// user from spinning up their own.
const MAX_OWNED_HOUSEHOLDS = 5;
const MAX_NAME_LENGTH = 60;

/**
 * Creates a new household with the caller as owner, then switches the active
 * household to it and redirects to the dashboard. On validation failure it
 * returns a friendly error; on success it never returns (switchHousehold
 * redirects). The redirect must stay outside any try/catch so its control-flow
 * throw is not mistaken for a creation error.
 */
export async function createHouseholdAction(
  rawName: string,
  rawKind: string,
): Promise<Result> {
  const session = await requireSession();

  const name = rawName.trim();
  if (!name) {
    return { ok: false, error: "Give the household a name." };
  }
  if (name.length > MAX_NAME_LENGTH) {
    return {
      ok: false,
      error: `Keep the name under ${MAX_NAME_LENGTH} characters.`,
    };
  }

  const kind: HouseholdKind = rawKind === "breeder" ? "breeder" : "personal";

  const ownedCount = session.households.filter((h) => h.role === "owner").length;
  if (ownedCount >= MAX_OWNED_HOUSEHOLDS) {
    return {
      ok: false,
      error: `You can own up to ${MAX_OWNED_HOUSEHOLDS} households. Remove or leave one before creating another.`,
    };
  }

  let householdId: string;
  try {
    ({ householdId } = await createHousehold({
      userId: session.userId,
      name,
      kind,
    }));
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Could not create the household.",
    };
  }

  await recordAudit({
    householdId,
    actorId: session.userId,
    action: "create",
    entityType: "household",
    entityId: householdId,
    diff: { after: { name, kind } },
  });

  // Redirects to "/". Kept outside the try above so its NEXT_REDIRECT throw is
  // never swallowed as a creation failure.
  await switchHousehold(householdId);
  return { ok: true };
}

/**
 * Flips the ACTIVE household between personal and breeder. Owner-only: kind
 * decides whether breeder surfaces (litters, placement, transfers) are exposed,
 * so it's an ownership-level decision. Non-destructive in both directions:
 * flipping breeder→personal only hides those surfaces, it never deletes breeder
 * data, so a mistaken flip is fully recoverable by flipping back.
 */
export async function setHouseholdKindAction(rawKind: string): Promise<Result> {
  const session = await requireSession();
  if (session.role !== "owner") {
    return { ok: false, error: "Only the household owner can change the type." };
  }

  const kind: HouseholdKind = rawKind === "breeder" ? "breeder" : "personal";
  if (kind === session.householdKind) {
    return { ok: true };
  }

  // Owner already verified above; use the service client so the write doesn't
  // depend on has_household_write (which also admits non-owner members).
  const service = createServiceClient();
  const { error } = await service
    .from("households")
    .update({ kind })
    .eq("id", session.householdId);
  if (error) return { ok: false, error: error.message };

  await recordAudit({
    householdId: session.householdId,
    actorId: session.userId,
    action: "update",
    entityType: "household",
    entityId: session.householdId,
    diff: { before: { kind: session.householdKind }, after: { kind } },
  });

  // Revalidate the whole app: the nav's breeder-only surfaces key off kind.
  revalidatePath("/", "layout");
  revalidatePath("/settings/household");
  return { ok: true };
}

function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

export async function sendHouseholdInvitation(
  rawEmail: string,
  role: "member" | "viewer" = "member",
): Promise<Result> {
  const session = await requireSession();
  if (session.role !== "owner") {
    return { ok: false, error: "Only the household owner can invite members." };
  }

  const email = rawEmail.trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: "That doesn't look like a valid email." };
  }
  if (email === (session.email ?? "").toLowerCase()) {
    return { ok: false, error: "You can't invite yourself." };
  }

  const supabase = await createClient();

  // If a pending invitation exists for this email already, revoke it and
  // create a new one; keeps things simple and gives the invitee a fresh link.
  await supabase
    .from("household_invitations")
    .update({ revoked_at: new Date().toISOString() })
    .eq("household_id", session.householdId)
    .eq("email", email)
    .is("accepted_at", null)
    .is("revoked_at", null);

  const { raw, hash } = generateInvitationToken();
  const expiresAt = invitationExpiry(7);

  const { data: invitation, error: insErr } = await supabase
    .from("household_invitations")
    .insert({
      household_id: session.householdId,
      email,
      token_hash: hash,
      role,
      invited_by: session.userId,
      expires_at: expiresAt.toISOString(),
    })
    .select("id")
    .single();

  if (insErr || !invitation) {
    return { ok: false, error: insErr?.message ?? "Failed to create invitation" };
  }

  const acceptUrl = `${appUrl()}/invite/${raw}`;

  // Send via Resend if a key is configured. In dev without one, log to console
  // so the developer can still test by visiting the URL manually.
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL ?? "invites@pawdex.co";

  if (apiKey) {
    try {
      const resend = new Resend(apiKey);
      await resend.emails.send({
        from,
        to: email,
        subject: `${session.email ?? "Someone"} invited you to ${session.householdName} on Pawdex`,
        html: invitationHtml({
          householdName: session.householdName,
          inviterEmail: session.email ?? "Someone",
          acceptUrl,
          expiresAt,
        }),
        text:
          `${session.email ?? "Someone"} invited you to join "${session.householdName}" on Pawdex.\n\n` +
          `Accept: ${acceptUrl}\n\nLink expires ${expiresAt.toUTCString()}.`,
      });
    } catch (err) {
      console.error("invitation send failed:", err);
      // Don't surface the error; the invitation is created; the owner can
      // copy the link from the pending-invitations list as a fallback.
    }
  } else {
    console.warn(
      `[invitations] RESEND_API_KEY not set. Paste this URL into the invitee's email manually:\n  ${acceptUrl}`,
    );
  }

  await recordAudit({
    householdId: session.householdId,
    actorId: session.userId,
    action: "invite_member",
    entityType: "household_invitation",
    entityId: invitation.id,
    diff: { after: { email, role, expires_at: expiresAt.toISOString() } },
  });

  revalidatePath("/settings/household");
  return { ok: true };
}

export async function revokeInvitation(
  invitationId: string,
): Promise<Result> {
  const session = await requireSession();
  if (session.role !== "owner") {
    return { ok: false, error: "Owners only." };
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("household_invitations")
    .update({ revoked_at: new Date().toISOString() })
    .eq("household_id", session.householdId)
    .eq("id", invitationId);
  if (error) return { ok: false, error: error.message };

  await recordAudit({
    householdId: session.householdId,
    actorId: session.userId,
    action: "revoke_member",
    entityType: "household_invitation",
    entityId: invitationId,
  });

  revalidatePath("/settings/household");
  return { ok: true };
}

export async function removeHouseholdMember(
  userId: string,
): Promise<Result> {
  const session = await requireSession();
  if (session.role !== "owner") {
    return { ok: false, error: "Owners only." };
  }
  if (userId === session.userId) {
    return {
      ok: false,
      error: "You're the owner; transfer ownership before removing yourself.",
    };
  }

  // Use service client so we can delete the membership row without RLS games.
  const service = createServiceClient();
  const { error } = await service
    .from("household_members")
    .delete()
    .eq("household_id", session.householdId)
    .eq("user_id", userId);

  if (error) return { ok: false, error: error.message };

  await recordAudit({
    householdId: session.householdId,
    actorId: session.userId,
    action: "revoke_member",
    entityType: "household_member",
    entityId: userId,
    diff: { before: { user_id: userId } },
  });

  revalidatePath("/settings/household");
  return { ok: true };
}

function invitationHtml(v: {
  householdName: string;
  inviterEmail: string;
  acceptUrl: string;
  expiresAt: Date;
}): string {
  const expires = v.expiresAt.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  return `<!doctype html>
<html lang="en"><body style="margin:0;background:#FAF9F6;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#14181B;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FAF9F6;padding:40px 16px;">
<tr><td align="center">
<table role="presentation" width="100%" style="max-width:520px;background:#FFFFFF;border:1px solid #E8E4DA;border-radius:14px;padding:28px;">
<tr><td>
<div style="display:inline-block;padding:6px 12px;background:#E2EDE5;color:#1F4E33;border-radius:999px;font:600 11px Inter,sans-serif;letter-spacing:0.04em;text-transform:uppercase;">Pawdex household invite</div>
<h1 style="margin:14px 0 6px;font:500 24px Georgia,serif;color:#14181B;letter-spacing:-0.015em;">${escapeHtml(v.inviterEmail)} added you to ${escapeHtml(v.householdName)}</h1>
<p style="margin:0;font:400 14px Inter,sans-serif;color:#404750;line-height:1.55;">Accept the invite to see your shared pets&rsquo; vaccine schedules, medications, and visit history.</p>
<table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:20px;">
<tr><td><a href="${escapeHtml(v.acceptUrl)}" style="display:inline-block;background:#2F6F4E;color:#FFFFFF;padding:12px 20px;border-radius:8px;font:500 14px Inter,sans-serif;text-decoration:none;">Accept invitation &rarr;</a></td></tr>
</table>
<p style="margin:20px 0 0;font:400 12px Inter,sans-serif;color:#6A7079;">Link expires ${escapeHtml(expires)}. If you weren&rsquo;t expecting this, you can ignore it.</p>
</td></tr></table></td></tr></table></body></html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
