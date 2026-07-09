import { NextResponse, type NextRequest } from "next/server";

import { createServiceClient } from "@/lib/supabase/service";
import { verifyUnsubscribeToken } from "@/lib/reminders/unsubscribe-token";

export const dynamic = "force-dynamic";

// One-click unsubscribe: every reminder email carries an HMAC-signed link
// pointing here. Verifies the signature, flips email_enabled to false on the
// household's reminder_preferences row, and renders a confirmation.

export async function GET(
  request: NextRequest,
  ctx: { params: Promise<{ token: string }> },
) {
  const { token } = await ctx.params;
  const payload = verifyUnsubscribeToken(token);

  if (!payload) {
    return new NextResponse(
      htmlPage(
        "Link expired or invalid",
        "This unsubscribe link couldn't be verified. It may have been corrupted in transit or the unsubscribe secret has rotated.",
        "If you'd like to stop receiving reminders, sign in and visit Settings → Reminders.",
      ),
      { status: 400, headers: { "Content-Type": "text/html; charset=utf-8" } },
    );
  }

  const supabase = createServiceClient();

  // Upsert: ensure the row exists even if reminder_preferences was never
  // explicitly created for this household (some early household rows from
  // before Phase 3 may not have one).
  const { error } = await supabase
    .from("reminder_preferences")
    .upsert(
      { household_id: payload.householdId, email_enabled: false },
      { onConflict: "household_id" },
    );

  if (error) {
    console.error("unsubscribe upsert failed:", error.message);
    return new NextResponse(
      htmlPage(
        "Something went wrong",
        "We couldn't update your preferences. Please try again, or update them manually in Settings → Reminders.",
        null,
      ),
      { status: 500, headers: { "Content-Type": "text/html; charset=utf-8" } },
    );
  }

  return new NextResponse(
    htmlPage(
      "Unsubscribed",
      "You'll stop receiving reminder emails from Pawdex.",
      "Change your mind? Re-enable any time in Settings → Reminders.",
    ),
    { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
}

// Some email clients (Gmail's one-click "list-unsubscribe" header in
// particular) issue POST requests. Mirror GET semantics so either works.
export async function POST(
  request: NextRequest,
  ctx: { params: Promise<{ token: string }> },
) {
  return GET(request, ctx);
}

function htmlPage(
  heading: string,
  primary: string,
  footer: string | null,
): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${heading} — Pawdex</title>
  <style>
    body {
      margin: 0;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
      background: #FAF9F6;
      color: #14181B;
      font: 400 14px/1.55 -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, sans-serif;
    }
    .card {
      max-width: 440px;
      background: #FFFFFF;
      border: 1px solid #E8E4DA;
      border-radius: 14px;
      padding: 28px;
      text-align: center;
    }
    h1 {
      margin: 0 0 8px;
      font: 500 22px Georgia, serif;
      letter-spacing: -0.015em;
    }
    p {
      margin: 0 0 12px;
      color: #404750;
    }
    a {
      color: #2F6F4E;
    }
    .footer {
      margin-top: 18px;
      font-size: 12.5px;
      color: #6A7079;
    }
  </style>
</head>
<body>
  <div class="card">
    <h1>${heading}</h1>
    <p>${primary}</p>
    ${footer ? `<p class="footer">${footer}</p>` : ""}
    <p class="footer"><a href="/">Back to Pawdex</a></p>
  </div>
</body>
</html>`;
}
