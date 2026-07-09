"use server";

import { requireSession } from "@/lib/auth/household";
import { answerHouseholdQuestion, type QaAnswer } from "@/lib/ai/qa";

export type AskState =
  | { status: "idle" }
  | { status: "answered"; question: string; answer: QaAnswer }
  | { status: "error"; question: string; message: string };

export async function askAction(
  _prev: AskState,
  formData: FormData,
): Promise<AskState> {
  const question =
    typeof formData.get("question") === "string"
      ? String(formData.get("question")).trim()
      : "";
  if (!question) {
    return { status: "error", question: "", message: "Ask me something." };
  }
  const session = await requireSession();
  try {
    const answer = await answerHouseholdQuestion({
      householdId: session.householdId,
      question,
    });
    return { status: "answered", question, answer };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return { status: "error", question, message };
  }
}
