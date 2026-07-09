import { NextResponse, type NextRequest } from "next/server";
import { after } from "next/server";
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";

import { processDocumentExtraction } from "@/lib/ai/extraction-trigger";
import { recordAudit } from "@/lib/db/audit";
import {
  findHouseholdBySlug,
  inboundDomain,
  slugFromInboundAddress,
} from "@/lib/db/inbound-addresses";
import { createServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

// Resend Inbound webhook — receives parsed inbound email and turns each
// document-shaped attachment into a `documents` row + extraction job.
//
// Wiring (one-time, in Resend dashboard):
//   1. Create an inbound domain (eg `inbound.pawdex.app`) and add the MX/TXT
//      records Resend gives you.
//   2. Create an inbound route with destination = this URL
//      (https://<your-app>/api/webhooks/resend-inbound).
//   3. Copy the signing secret into RESEND_INBOUND_SECRET.
//
// Per-household addresses are issued lazily by getOrCreateInboundAddress() in
// the household bootstrap path, and surfaced in /settings.

type InboundAttachment = {
  filename?: string | null;
  content_type?: string | null;
  content?: string | null; // base64
  content_id?: string | null;
};

type InboundEvent = {
  type?: string;
  data?: {
    from?: string | { email?: string } | null;
    to?: string | string[] | { email?: string }[] | null;
    subject?: string | null;
    text?: string | null;
    html?: string | null;
    attachments?: InboundAttachment[] | null;
    headers?: Record<string, string> | null;
  };
};

const TOLERANCE_SECONDS = 5 * 60;
const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024; // 25 MB — Resend's inbound cap

const ALLOWED_MIME_PREFIXES = ["application/pdf", "image/"];

function verifySvixSignature(
  body: string,
  headers: Headers,
  secret: string,
): boolean {
  const id = headers.get("svix-id");
  const timestamp = headers.get("svix-timestamp");
  const signatureHeader = headers.get("svix-signature");
  if (!id || !timestamp || !signatureHeader) return false;

  const ts = Number.parseInt(timestamp, 10);
  if (!Number.isFinite(ts)) return false;
  if (Math.abs(Date.now() / 1000 - ts) > TOLERANCE_SECONDS) return false;

  const secretBytes = secret.startsWith("whsec_")
    ? Buffer.from(secret.slice("whsec_".length), "base64")
    : Buffer.from(secret, "utf8");

  const expected = createHmac("sha256", secretBytes)
    .update(`${id}.${timestamp}.${body}`)
    .digest("base64");

  const provided = signatureHeader
    .split(" ")
    .map((part) => part.split(","))
    .filter(([scheme]) => scheme === "v1")
    .map(([, sig]) => sig);

  for (const sig of provided) {
    if (!sig) continue;
    const a = Buffer.from(sig, "base64");
    const b = Buffer.from(expected, "base64");
    if (a.length === b.length && timingSafeEqual(a, b)) return true;
  }
  return false;
}

function normalizeRecipients(
  to: InboundEvent["data"] extends infer T
    ? T extends { to?: infer U }
      ? U
      : never
    : never,
): string[] {
  if (!to) return [];
  if (typeof to === "string") return [to];
  if (Array.isArray(to)) {
    return to
      .map((entry) => (typeof entry === "string" ? entry : entry?.email ?? ""))
      .filter((s): s is string => !!s);
  }
  return [];
}

function senderEmail(
  from: InboundEvent["data"] extends infer T
    ? T extends { from?: infer U }
      ? U
      : never
    : never,
): string | null {
  if (!from) return null;
  if (typeof from === "string") return from;
  return from.email ?? null;
}

function extFromMime(mime: string, filename?: string | null): string {
  if (mime === "application/pdf") return "pdf";
  if (mime.startsWith("image/")) {
    const sub = mime.slice("image/".length);
    if (sub === "jpeg") return "jpg";
    return sub;
  }
  const name = (filename ?? "").toLowerCase();
  const m = name.match(/\.([a-z0-9]+)$/);
  return m ? m[1] : "bin";
}

export async function POST(request: NextRequest) {
  const secret = process.env.RESEND_INBOUND_SECRET;
  const body = await request.text();

  if (secret) {
    if (!verifySvixSignature(body, request.headers, secret)) {
      return NextResponse.json({ error: "bad signature" }, { status: 401 });
    }
  } else if (process.env.NODE_ENV === "production") {
    console.error(
      "[inbound webhook] RESEND_INBOUND_SECRET not configured in production — refusing request",
    );
    return NextResponse.json(
      { error: "webhook secret not configured" },
      { status: 500 },
    );
  } else {
    console.warn(
      "[inbound webhook] RESEND_INBOUND_SECRET not set — accepting unsigned event in dev mode",
    );
  }

  let event: InboundEvent;
  try {
    event = JSON.parse(body) as InboundEvent;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const recipients = normalizeRecipients(event.data?.to ?? null);
  const sender = senderEmail(event.data?.from ?? null);
  const domain = inboundDomain().toLowerCase();

  // Match the FIRST recipient that targets our inbound domain. Forwarded
  // emails often Cc/Bcc the original vet inbox too; we only care about ours.
  let householdId: string | null = null;
  let matchedSlug: string | null = null;
  for (const addr of recipients) {
    const slug = slugFromInboundAddress(addr);
    if (!slug) continue;
    const lower = addr.trim().toLowerCase();
    if (!lower.endsWith(`@${domain}`)) continue;
    const id = await findHouseholdBySlug(slug);
    if (id) {
      householdId = id;
      matchedSlug = slug;
      break;
    }
  }

  if (!householdId) {
    console.warn("[inbound webhook] no matching household for recipients", {
      recipients,
      sender,
    });
    // Acknowledge so Resend doesn't retry; the message is unroutable.
    return NextResponse.json({ ok: true, status: "no_match" });
  }

  const attachments = (event.data?.attachments ?? []).filter((a) => {
    const mime = (a.content_type ?? "").toLowerCase();
    if (!ALLOWED_MIME_PREFIXES.some((p) => mime.startsWith(p))) return false;
    if (!a.content) return false;
    return true;
  });

  const subject = event.data?.subject ?? "(no subject)";
  const supabase = createServiceClient();

  const createdDocumentIds: string[] = [];

  for (const att of attachments) {
    const mime = (att.content_type ?? "application/octet-stream").toLowerCase();
    const buf = Buffer.from(att.content ?? "", "base64");
    if (buf.byteLength === 0 || buf.byteLength > MAX_ATTACHMENT_BYTES) continue;

    const docId = randomUUID();
    const ext = extFromMime(mime, att.filename);
    const storagePath = `${householdId}/inbound/${docId}.${ext}`;

    const { error: uploadErr } = await supabase.storage
      .from("documents")
      .upload(storagePath, buf, { contentType: mime, upsert: false });
    if (uploadErr) {
      console.error("[inbound webhook] upload failed", {
        documentId: docId,
        err: uploadErr.message,
      });
      continue;
    }

    const filename =
      att.filename && att.filename.trim().length > 0
        ? att.filename
        : `inbound-${docId}.${ext}`;

    const { data: doc, error: insertErr } = await supabase
      .from("documents")
      .insert({
        id: docId,
        household_id: householdId,
        pet_id: null, // assigned during review
        storage_bucket: "documents",
        storage_path: storagePath,
        mime_type: mime,
        original_filename: filename,
        byte_size: buf.byteLength,
        processing_status: "pending",
        created_by: null, // inbound = no user actor
      })
      .select("id")
      .single();

    if (insertErr || !doc) {
      console.error("[inbound webhook] document insert failed", {
        documentId: docId,
        err: insertErr?.message,
      });
      // Best-effort cleanup of the orphaned storage object.
      await supabase.storage.from("documents").remove([storagePath]);
      continue;
    }

    createdDocumentIds.push(doc.id);
  }

  await recordAudit({
    householdId,
    actorId: null,
    action: "create",
    entityType: "inbound_email",
    diff: {
      after: {
        from: sender,
        slug: matchedSlug,
        subject,
        attachments_total: attachments.length,
        documents_created: createdDocumentIds.length,
      },
    },
  });

  // Kick off extraction outside the request lifecycle so Resend gets a fast 200.
  after(async () => {
    for (const id of createdDocumentIds) {
      await processDocumentExtraction({ documentId: id });
    }
  });

  return NextResponse.json({
    ok: true,
    household_id: householdId,
    documents_created: createdDocumentIds.length,
  });
}
