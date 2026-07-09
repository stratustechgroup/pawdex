"use server";

import { revalidatePath } from "next/cache";

import { requireSession } from "@/lib/auth/household";
import { sendRecordsRequestForEvent } from "@/lib/outbound/records-request";

export type RequestRecordsState =
  | { status: "idle" }
  | { status: "sent"; outboundEmailId: string }
  | { status: "error"; message: string; code: string };

export async function requestRecordsAction(
  _prev: RequestRecordsState,
  formData: FormData,
): Promise<RequestRecordsState> {
  const medicalEventId = formData.get("medical_event_id");
  const petId = formData.get("pet_id");
  if (typeof medicalEventId !== "string" || !medicalEventId) {
    return {
      status: "error",
      message: "Missing medical event id.",
      code: "validation",
    };
  }

  const session = await requireSession();
  const result = await sendRecordsRequestForEvent({
    householdId: session.householdId,
    userId: session.userId,
    medicalEventId,
  });

  if (!result.ok) {
    return { status: "error", message: result.error, code: result.code };
  }

  if (typeof petId === "string" && petId) {
    revalidatePath(`/pets/${petId}/medical`);
  }
  revalidatePath("/settings/activity");

  return { status: "sent", outboundEmailId: result.outbound_email_id };
}
