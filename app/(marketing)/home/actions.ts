"use server";

import { z } from "zod";

import { joinWaitlist } from "@/lib/db/waitlist";

const schema = z.object({
  email: z.string().trim().toLowerCase().email(),
  source: z.string().max(120).optional(),
  // Honeypot: real people leave this empty. Bots that fill every field get a
  // silent success and never touch the database.
  company: z.string().optional(),
});

export type WaitlistState =
  | { status: "idle" }
  | { status: "joined"; email: string }
  | { status: "already"; email: string }
  | { status: "error"; message: string };

export async function joinWaitlistAction(
  _prev: WaitlistState,
  formData: FormData,
): Promise<WaitlistState> {
  const parsed = schema.safeParse({
    email: formData.get("email"),
    source: formData.get("source") ?? undefined,
    company: formData.get("company") ?? undefined,
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: "That email does not look right. Mind checking it?",
    };
  }

  // Honeypot tripped — pretend it worked, store nothing.
  if (parsed.data.company && parsed.data.company.trim().length > 0) {
    return { status: "joined", email: parsed.data.email };
  }

  const result = await joinWaitlist({
    email: parsed.data.email,
    source: parsed.data.source ?? "home",
  });

  if (result.status === "joined") {
    return { status: "joined", email: parsed.data.email };
  }
  if (result.status === "already") {
    return { status: "already", email: parsed.data.email };
  }
  return {
    status: "error",
    message: "Something went wrong on our end. Please try again in a moment.",
  };
}
