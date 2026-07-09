import "server-only";

export type RecordsRequestContext = {
  ownerName: string | null;
  ownerEmail: string | null;
  petName: string;
  petSpecies: string;
  visitDate: string | null; // ISO date string
  visitTitle: string | null;
  clinicName: string;
};

export function renderRecordsRequestEmail(ctx: RecordsRequestContext): {
  subject: string;
  text: string;
  html: string;
} {
  const ownerLabel = ctx.ownerName ?? ctx.ownerEmail ?? "the owner";
  const visitLine =
    ctx.visitDate && ctx.visitTitle
      ? `the visit on ${ctx.visitDate} (${ctx.visitTitle})`
      : ctx.visitDate
        ? `the visit on ${ctx.visitDate}`
        : ctx.visitTitle
          ? `the visit titled "${ctx.visitTitle}"`
          : "recent visits";

  const subject = `Records request for ${ctx.petName} — sent on behalf of ${ownerLabel}`;

  const text = `Hello ${ctx.clinicName} records team,

Pawdex is requesting a copy of the full medical record for ${ctx.petName} (${ctx.petSpecies}) on behalf of ${ownerLabel}.

Records of interest: ${visitLine}, including the SOAP notes, lab results, imaging reports, prescriptions issued, and discharge summaries.

Please reply directly to ${ctx.ownerEmail ?? "the owner"} with the records attached as PDFs. ${ctx.ownerEmail ? `A copy will be retained in their Pawdex account.` : ""}

This message was sent through Pawdex (https://pawdex.app) under the owner's documented authorization to request records on their behalf. The authorization is available on request.

Thank you,
Pawdex on behalf of ${ownerLabel}`;

  const html = `<!doctype html><html><body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #1a1a1a; line-height: 1.55;">
<p>Hello ${escapeHtml(ctx.clinicName)} records team,</p>
<p>Pawdex is requesting a copy of the full medical record for <strong>${escapeHtml(ctx.petName)}</strong> (${escapeHtml(ctx.petSpecies)}) on behalf of <strong>${escapeHtml(ownerLabel)}</strong>.</p>
<p><strong>Records of interest:</strong> ${escapeHtml(visitLine)}, including the SOAP notes, lab results, imaging reports, prescriptions issued, and discharge summaries.</p>
<p>Please reply directly to <a href="mailto:${escapeHtml(ctx.ownerEmail ?? "")}">${escapeHtml(ctx.ownerEmail ?? "the owner")}</a> with the records attached as PDFs.${ctx.ownerEmail ? " A copy will be retained in their Pawdex account." : ""}</p>
<p style="color:#666; font-size: 13px; margin-top: 24px; padding-top: 16px; border-top: 1px solid #e5e5e5;">
This message was sent through <a href="https://pawdex.app" style="color:#2d5a3d;">Pawdex</a> under the owner's documented authorization to request records on their behalf. The authorization is available on request.
</p>
<p>Thank you,<br>Pawdex on behalf of ${escapeHtml(ownerLabel)}</p>
</body></html>`;

  return { subject, text, html };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
