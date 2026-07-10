"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";

import { requireSession } from "@/lib/auth/household";
import { getPet } from "@/lib/db/pets";
import { recordAudit } from "@/lib/db/audit";
import { createTransfer, revokeTransfer } from "@/lib/db/transfers";

type CreateResult =
  | { ok: true; link: string; transferId: string }
  | { ok: false; error: string };

async function appOrigin(): Promise<string> {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
  const h = await headers();
  return `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host") ?? "localhost:3000"}`;
}

export async function createTransferAction(
  petId: string,
  input: { recipientEmail: string | null; message: string | null },
): Promise<CreateResult> {
  const session = await requireSession();
  if (session.role !== "owner") {
    return { ok: false, error: "Only the household owner can transfer an animal." };
  }

  const pet = await getPet(session.householdId, petId);
  if (!pet) return { ok: false, error: "Pet not found." };
  if (!pet.animal_id) {
    return {
      ok: false,
      error:
        "This pet is not linked to an animal record yet, so it can't be transferred. Try again shortly.",
    };
  }

  const recipientEmail = input.recipientEmail?.trim() || null;
  if (recipientEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail)) {
    return { ok: false, error: "Enter a valid recipient email or leave it blank." };
  }

  const { transfer, rawToken } = await createTransfer({
    animalId: pet.animal_id,
    fromHouseholdId: session.householdId,
    createdBy: session.userId,
    recipientEmail,
    message: input.message?.trim() || null,
  });

  await recordAudit({
    householdId: session.householdId,
    actorId: session.userId,
    action: "create",
    entityType: "animal_transfer",
    entityId: transfer.id,
    diff: { after: { animal_id: pet.animal_id, recipient_email: recipientEmail } },
  });

  const origin = await appOrigin();
  const link = `${origin}/transfer/${rawToken}`;

  revalidatePath(`/pets/${petId}/transfer`);
  return { ok: true, link, transferId: transfer.id };
}

export async function revokeTransferAction(
  petId: string,
  transferId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await requireSession();
  if (session.role !== "owner") {
    return { ok: false, error: "Only the household owner can revoke a transfer." };
  }

  try {
    await revokeTransfer({ fromHouseholdId: session.householdId, transferId });
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Failed to revoke." };
  }

  await recordAudit({
    householdId: session.householdId,
    actorId: session.userId,
    action: "update",
    entityType: "animal_transfer",
    entityId: transferId,
    diff: { after: { revoked: true } },
  });

  revalidatePath(`/pets/${petId}/transfer`);
  return { ok: true };
}
