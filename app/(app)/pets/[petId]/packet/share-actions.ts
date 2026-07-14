"use server";

import { revalidatePath } from "next/cache";

import { requireSession } from "@/lib/auth/household";
import { recordAudit } from "@/lib/db/audit";
import { getPet } from "@/lib/db/pets";
import {
  createShareLink,
  revokeShareLink,
} from "@/lib/db/share-links";

export type CreateShareState =
  | { status: "idle" }
  | {
      status: "created";
      url: string;
      expiresAt: string;
      recipientLabel: string | null;
    }
  | { status: "error"; message: string };

const TTL_DAYS_DEFAULT = 14;
const TTL_DAYS_MAX = 60;

function appUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, "") ??
    "http://localhost:3000"
  );
}

export async function createBoardingShareLink(
  _prev: CreateShareState,
  formData: FormData,
): Promise<CreateShareState> {
  const petId = String(formData.get("pet_id") ?? "");
  if (!petId) return { status: "error", message: "Missing pet id." };

  const recipientLabel =
    String(formData.get("recipient_label") ?? "").trim() || null;
  const ttlRaw = String(formData.get("ttl_days") ?? "");
  const ttlDays = Math.max(
    1,
    Math.min(TTL_DAYS_MAX, Number(ttlRaw) || TTL_DAYS_DEFAULT),
  );

  const session = await requireSession();
  if (session.role === "viewer") {
    return { status: "error", message: "Viewers can't create share links." };
  }

  // Confirm the pet belongs to this household before minting a PUBLIC link —
  // createShareLink trusts the pet_id, so an unscoped id would leak another
  // household's pet (microchip included).
  const pet = await getPet(session.householdId, petId);
  if (!pet) {
    return { status: "error", message: "Pet not found in this household." };
  }

  try {
    const { link, rawToken } = await createShareLink({
      householdId: session.householdId,
      petId,
      userId: session.userId,
      scope: "boarding_packet",
      recipientLabel,
      ttlDays,
    });

    await recordAudit({
      householdId: session.householdId,
      actorId: session.userId,
      action: "create",
      entityType: "share_link",
      entityId: link.id,
      diff: {
        after: {
          pet_id: petId,
          recipient_label: recipientLabel,
          scope: "boarding_packet",
          ttl_days: ttlDays,
        },
      },
    });

    revalidatePath(`/pets/${petId}/packet`);

    return {
      status: "created",
      url: `${appUrl()}/share/${rawToken}`,
      expiresAt: link.expires_at,
      recipientLabel,
    };
  } catch (err) {
    return {
      status: "error",
      message: err instanceof Error ? err.message : "Failed to create link.",
    };
  }
}

export async function revokeBoardingShareLink(
  formData: FormData,
): Promise<void> {
  const linkId = String(formData.get("link_id") ?? "");
  const petId = String(formData.get("pet_id") ?? "");
  if (!linkId || !petId) throw new Error("link_id + pet_id required");
  const session = await requireSession();
  if (session.role === "viewer") throw new Error("Viewers can't revoke share links.");
  await revokeShareLink({
    householdId: session.householdId,
    linkId,
  });
  await recordAudit({
    householdId: session.householdId,
    actorId: session.userId,
    action: "update",
    entityType: "share_link",
    entityId: linkId,
    diff: { after: { revoked: true } },
  });
  revalidatePath(`/pets/${petId}/packet`);
}
