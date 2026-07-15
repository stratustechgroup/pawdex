"use server";

import { headers } from "next/headers";
import { Resend } from "resend";
import { z } from "zod";

import { insertContactMessage } from "@/lib/db/contact";
import { isRateLimited } from "@/lib/security/rate-limit";

export type ContactState =
  | { status: "idle" }
  | { status: "sent" }
  | { status: "error"; message: string };

const schema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().toLowerCase().email(),
  subject: z.string().trim().max(160).optional(),
  message: z.string().trim().min(1).max(4000),
  // Honeypot: real people leave this empty. Bots that fill every field get a
  // silent success and never touch the database or the inbox.
  company: z.string().optional(),
});

// A real visitor sends one message. A low per-IP cap only bites a script
// hammering the public form. Paired with the honeypot as defense in depth.
const RATE_LIMIT = 5;
const RATE_WINDOW_MS = 60_000;

export async function submitContactAction(
  _prev: ContactState,
  formData: FormData,
): Promise<ContactState> {
  const parsed = schema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    subject: formData.get("subject") ?? undefined,
    message: formData.get("message"),
    company: formData.get("company") ?? undefined,
  });

  if (!parsed.success) {
    return {
      status: "error",
      message:
        "Please check the form. A name, a valid email, and a message are required.",
    };
  }

  // Honeypot tripped. Pretend it worked, store nothing, send nothing.
  if (parsed.data.company && parsed.data.company.trim().length > 0) {
    return { status: "sent" };
  }

  // Per-IP throttle. Best-effort in-process limiter (see lib/security).
  const h = await headers();
  const ip =
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    h.get("x-real-ip") ??
    "unknown";
  if (isRateLimited("contact:" + ip, RATE_LIMIT, RATE_WINDOW_MS)) {
    return {
      status: "error",
      message:
        "You have sent several messages already. Please wait a minute and try again.",
    };
  }

  const { name, email, message } = parsed.data;
  const subject =
    parsed.data.subject && parsed.data.subject.length > 0
      ? parsed.data.subject
      : null;

  // Fail-soft and durable. Attempt BOTH the DB insert and the notification
  // email, with no short-circuit. The submission counts as sent if EITHER path
  // holds the message, so a not-yet-applied migration or an unset Resend key
  // never loses a message or hard-fails the visitor. Only both failing (or
  // validation / rate-limit above) returns an error.
  const stored = await tryStore({ name, email, subject, message });
  const emailed = await tryEmail({ name, email, subject, message });

  if (stored || emailed) {
    return { status: "sent" };
  }

  return {
    status: "error",
    message:
      "Something went wrong on our end. Please email support@pawdex.co directly.",
  };
}

async function tryStore(input: {
  name: string;
  email: string;
  subject: string | null;
  message: string;
}): Promise<boolean> {
  try {
    const result = await insertContactMessage({
      name: input.name,
      email: input.email,
      subject: input.subject,
      message: input.message,
      source: "contact",
    });
    return result.ok;
  } catch (err) {
    console.error("[contact] store failed:", err);
    return false;
  }
}

async function tryEmail(input: {
  name: string;
  email: string;
  subject: string | null;
  message: string;
}): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn(
      "[contact] RESEND_API_KEY not set. Skipping notification email.",
    );
    return false;
  }

  try {
    const from = process.env.RESEND_FROM_EMAIL ?? "contact@pawdex.co";
    const resend = new Resend(apiKey);
    const subjectLine = input.subject
      ? `Contact form: ${input.subject}`
      : "Contact form: new message";

    const text =
      `New message from the Pawdex contact form.\n\n` +
      `Name: ${input.name}\n` +
      `Email: ${input.email}\n` +
      (input.subject ? `Subject: ${input.subject}\n` : "") +
      `\n${input.message}\n`;

    const html =
      `<p>New message from the Pawdex contact form.</p>` +
      `<p><strong>Name:</strong> ${escapeHtml(input.name)}<br>` +
      `<strong>Email:</strong> ${escapeHtml(input.email)}` +
      (input.subject
        ? `<br><strong>Subject:</strong> ${escapeHtml(input.subject)}`
        : "") +
      `</p><p style="white-space:pre-wrap">${escapeHtml(input.message)}</p>`;

    const result = await resend.emails.send({
      from,
      to: "support@pawdex.co",
      replyTo: input.email,
      subject: subjectLine,
      text,
      html,
    });

    if (result.error) {
      console.error("[contact] resend error:", result.error);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[contact] email failed:", err);
    return false;
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
